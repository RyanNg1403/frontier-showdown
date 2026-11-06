import { BTN, RULES } from "./constants.js";
import { mirrorDir, parseMotion } from "./input.js";
import { createRng } from "./rng.js";

export const DIFFICULTIES = Object.freeze({
  easy: { reaction: 26, block: 0.18, lowRead: 0.3, antiAir: 0.12, punish: 0.12, combo: 0.25, aggression: 0.3, zoning: 0.15, tech: 0.05, breaker: 0, mistake: 0.25, superUse: 0.3, assist: 0.002, tag: 0.002 },
  normal: { reaction: 15, block: 0.45, lowRead: 0.5, antiAir: 0.35, punish: 0.4, combo: 0.55, aggression: 0.45, zoning: 0.28, tech: 0.25, breaker: 0.15, mistake: 0.1, superUse: 0.6, assist: 0.006, tag: 0.004 },
  hard: { reaction: 9, block: 0.7, lowRead: 0.72, antiAir: 0.65, punish: 0.7, combo: 0.8, aggression: 0.55, zoning: 0.35, tech: 0.5, breaker: 0.4, mistake: 0.04, superUse: 0.85, assist: 0.01, tag: 0.006 },
  brutal: { reaction: 5, block: 0.88, lowRead: 0.9, antiAir: 0.85, punish: 0.9, combo: 0.95, aggression: 0.62, zoning: 0.4, tech: 0.75, breaker: 0.65, mistake: 0, superUse: 1, assist: 0.014, tag: 0.008 },
});

const NEUTRAL = { dir: 5, buttons: 0 };

/** Turn a motion string into a list of relative-direction input steps. */
export function motionSteps(input, buttonOverride = null) {
  const m = parseMotion(input);
  const steps = [];
  if (m.charge) steps.push({ dir: m.charge.dir === 4 ? 1 : m.charge.dir, frames: RULES.chargeFrames + 4 });
  const seq = m.seq.length ? m.seq : [5];
  seq.forEach((d, i) => {
    if (i > 0 && d === seq[i - 1]) steps.push({ dir: 5, frames: 2 });
    steps.push({ dir: d, frames: 2 });
  });
  let buttons = buttonOverride ?? m.buttonMask;
  if (buttons === (BTN.LP | BTN.HP)) buttons = BTN.LP;
  if (buttons === (BTN.LK | BTN.HK)) buttons = BTN.LK;
  steps[steps.length - 1] = { ...steps[steps.length - 1], buttons, frames: 2 };
  steps.push({ dir: 5, frames: 1 });
  return steps;
}

export class CpuController {
  constructor(difficulty = "normal", seed = 1) {
    this.difficulty = DIFFICULTIES[difficulty] ? difficulty : "normal";
    this.p = DIFFICULTIES[this.difficulty];
    this.rng = createRng(seed);
    this.queue = [];
    this.history = [];
    this.cooldown = 0;
    this.lastComboBreakCheck = 0;
    this.techChecked = false;
  }

  push(steps) {
    for (const s of steps) this.queue.push({ dir: s.dir ?? 5, buttons: s.buttons ?? 0, frames: s.frames ?? 1 });
  }

  hold(dir, frames, buttons = 0) {
    this.push([{ dir, frames, buttons }]);
  }

  /** Guard with the block button; `low` crouch-blocks. */
  guard(frames, low = false) {
    this.push([{ dir: low ? 2 : 5, frames, buttons: BTN.BLOCK }]);
  }

  press(dir, buttons) {
    this.push([{ dir, buttons, frames: 2 }, { dir: 5, frames: 1 }]);
  }

  perceive(match, side) {
    const opp = match.point(1 - side);
    this.history.push({
      x: opp.x,
      y: opp.y,
      state: opp.state,
      airborne: opp.airborne,
      attacking: opp.isAttacking,
      recovering: opp.state === "attack" && opp.move && opp.moveFrame >= opp.move.startup + opp.move.active,
      level: opp.move?.level || "mid",
      vx: opp.vx,
      crouching: opp.crouching,
      lying: opp.isLying,
    });
    if (this.history.length > 40) this.history.shift();
    const lag = Math.min(this.history.length - 1, this.p.reaction);
    return this.history[this.history.length - 1 - lag];
  }

  think(match, side) {
    const self = match.point(side);
    const team = match.sides[side];
    const seen = this.perceive(match, side);
    const out = this.next(self.facing);
    if (out) return out;
    if (this.cooldown > 0) {
      this.cooldown -= 1;
      return NEUTRAL;
    }
    if (!self.canFight) return NEUTRAL;
    if (match.phase === "finish") return this.finishLogic(match, side, self) || NEUTRAL;
    if (match.phase !== "fight") return NEUTRAL;
    this.decide(match, side, self, team, seen);
    return this.next(self.facing) || NEUTRAL;
  }

  next(facing) {
    const step = this.queue[0];
    if (!step) return null;
    step.frames -= 1;
    if (step.frames <= 0) this.queue.shift();
    const dir = facing < 0 ? mirrorDir(step.dir) : step.dir;
    return { dir, buttons: step.buttons };
  }

  chance(p) {
    return this.rng.chance(p);
  }

  decide(match, side, self, team, seen) {
    const p = this.p;
    const opp = match.point(1 - side);
    const dist = Math.abs(opp.x - self.x);
    const def = self.def;
    const meter = team.meter;

    if (self.state === "thrown") {
      if (!this.techChecked) {
        this.techChecked = true;
        if (this.chance(p.tech)) this.press(5, BTN.LP | BTN.LK);
      }
      return;
    }
    this.techChecked = false;

    if (self.state === "blockstun") {
      const push = !this.guardrailChecked && team.runway >= RULES.guardrailCost && this.chance(p.tech * 0.3);
      this.guardrailChecked = true;
      if (push) this.press(5, BTN.HP | BTN.HK);
      else this.guard(4, seen.level === "low" && this.chance(p.lowRead));
      return;
    }
    this.guardrailChecked = false;

    if (self.isStunned) {
      if (self.combo.hits >= 2 && !team.breakerUsed && meter >= RULES.breakerCost && team.runway >= RULES.runwayMax && match.frame - this.lastComboBreakCheck > 20) {
        this.lastComboBreakCheck = match.frame;
        if (this.chance(p.breaker)) this.press(6, BTN.BLOCK);
      }
      return;
    }

    if (self.state === "attack" && self.move?.scaled && !self.move.isScaled && self.moveFrame <= 4 && meter >= RULES.scaleUpCost + 50 && !this.scaleChecked) {
      this.scaleChecked = true;
      if (this.chance(p.superUse * 0.3)) this.press(5, BTN.BLOCK);
      return;
    }
    if (self.state !== "attack") this.scaleChecked = false;
    if (self.state === "attack" && self.connected && self.move?.cancelInto.length) {
      if (this.chance(p.combo * 0.25)) this.planCancel(self, team, dist);
      return;
    }
    if (!self.isNeutral && self.state !== "run") return;

    if (match.tagMode && this.tagLogic(match, side, self, team, dist)) return;

    if (this.chance(p.mistake * 0.2)) {
      this.press(this.rng.pick([5, 2, 6]), this.rng.pick([BTN.LP, BTN.HP, BTN.LK, BTN.HK]));
      return;
    }

    const incoming = match.projectiles.find((pr) => pr.side !== side && Math.sign(self.x - pr.x) === Math.sign(pr.vx) && Math.abs(self.x - pr.x) < 360);
    if (incoming) {
      const r = this.rng.next();
      if (r < p.block) this.guard(18);
      else if (r < p.block + 0.25 && Math.abs(self.x - incoming.x) > 160) this.hold(9, 6);
      else this.hold(6, 6);
      return;
    }

    if (seen.airborne && !seen.lying && dist < 250 && seen.y < -40) {
      if (this.chance(p.antiAir)) {
        this.antiAir(self, team);
        return;
      }
    }

    if (seen.attacking && dist < 230) {
      const parry = def.specials.find((s) => s.parry);
      if (parry && seen.level !== "low" && dist < 170 && this.chance(p.punish * 0.25)) {
        this.doSpecial(self, team, parry);
        return;
      }
      if (this.chance(p.block)) {
        const low = seen.level === "low" && this.chance(p.lowRead);
        this.guard(this.rng.int(10, 18), low);
        return;
      }
    }

    if (seen.recovering && dist < 200 && this.chance(p.punish)) {
      this.punish(self, team, dist);
      return;
    }

    if (seen.lying) {
      if (dist > 160) this.hold(6, 10);
      else this.hold(this.chance(0.5) ? 1 : 5, 12);
      return;
    }

    const sup = def.super;
    if (sup && self.canSuper({ team }, sup) && dist < (sup.projectile ? 600 : 220) && this.chance(p.superUse * 0.04)) {
      this.push(motionSteps(sup.input));
      return;
    }

    if (dist > 420) this.farGame(match, self, team, dist);
    else if (dist > 170) this.midGame(match, self, team, dist);
    else this.closeGame(match, self, team, dist, seen);
  }

  projectileSpecial(self) {
    return self.def.specials.find((s) => s.projectile);
  }

  chargeReady(team, self, dir) {
    return team.input.chargeInfo(dir, self.facing).holding >= RULES.chargeFrames;
  }

  doSpecial(self, team, sp) {
    if (!sp) return false;
    const m = sp.motion;
    if (m.charge && this.chargeReady(team, self, m.charge.dir)) {
      const steps = motionSteps(sp.input).slice(1);
      this.push(steps);
      return true;
    }
    this.push(motionSteps(sp.input));
    return true;
  }

  farGame(match, self, team, dist) {
    const p = this.p;
    const wall = self.def.specials.find((s) => s.barrier);
    if (wall && !match.barriers.some((w) => w.ownerUid === self.uid) && this.chance(p.zoning * 0.5)) {
      this.doSpecial(self, team, wall);
      this.cooldown = 8;
      return;
    }
    const proj = this.projectileSpecial(self);
    if (proj && !match.projectiles.some((pr) => pr.ownerUid === self.uid) && this.chance(p.zoning)) {
      this.doSpecial(self, team, proj);
      this.cooldown = 10;
      return;
    }
    const r = this.rng.next();
    if (r < p.aggression * 0.5) {
      this.push([{ dir: 6, frames: 2 }, { dir: 5, frames: 2 }, { dir: 6, frames: this.rng.int(12, 30) }]);
    } else if (r < p.aggression) {
      this.hold(6, this.rng.int(12, 28));
    } else if (r < p.aggression + 0.12) {
      this.hold(9, 4);
    } else {
      this.hold(proj && proj.motion.charge ? 4 : 5, this.rng.int(10, 24));
    }
  }

  midGame(match, self, team, dist) {
    const p = this.p;
    const r = this.rng.next();
    const proj = this.projectileSpecial(self);
    if (proj && !match.projectiles.some((pr) => pr.ownerUid === self.uid) && r < p.zoning * 0.6) {
      this.doSpecial(self, team, proj);
      this.cooldown = 8;
      return;
    }
    if (r < 0.18 * p.aggression + 0.05) {
      this.push([{ dir: 9, frames: 4 }, { dir: 5, frames: 14 }, { dir: 5, frames: 2, buttons: this.chance(0.5) ? BTN.HK : BTN.HP }, { dir: 5, frames: 12 }]);
      return;
    }
    if (dist < 240 && r < 0.45) {
      const poke = this.rng.pick([
        [6, BTN.HK],
        [3, BTN.LK],
        [2, BTN.HK],
        [6, BTN.HP],
      ]);
      this.press(poke[0] === 6 ? 5 : poke[0], poke[1]);
      this.cooldown = 6;
      return;
    }
    if (r < 0.45 + p.aggression * 0.4) {
      this.hold(6, this.rng.int(8, 22));
    } else {
      this.hold(this.chance(0.5) ? 4 : 1, this.rng.int(8, 20));
    }
  }

  closeGame(match, self, team, dist, seen) {
    const p = this.p;
    const r = this.rng.next();
    if (dist < RULES.throwRange - 8 && r < 0.12 + p.aggression * 0.1) {
      this.press(this.chance(0.4) ? 4 : 6, BTN.LP | BTN.LK);
      return;
    }
    const grab = self.def.specials.find((s) => s.grab);
    if (grab && dist < grab.grab.range - 10 && r < 0.2) {
      this.doSpecial(self, team, grab);
      return;
    }
    if (r < 0.25 + p.aggression * 0.35) {
      this.comboString(self, team, dist);
      return;
    }
    if (r < 0.75) {
      this.guard(this.rng.int(8, 16), seen.crouching);
      return;
    }
    this.push([{ dir: 4, frames: 2 }, { dir: 5, frames: 2 }, { dir: 4, frames: 2 }, { dir: 5, frames: 10 }]);
  }

  comboString(self, team, dist) {
    const p = this.p;
    const routes = [
      [[5, BTN.LP], [5, BTN.LP], [5, BTN.HP]],
      [[2, BTN.LK], [2, BTN.LP]],
      [[5, BTN.LK], [5, BTN.HP]],
      [[2, BTN.HP]],
      [[2, BTN.HK]],
    ];
    const route = this.rng.pick(routes);
    const executed = this.chance(p.combo) ? route : route.slice(0, 1);
    for (const [dir, btn] of executed) {
      this.push([{ dir, buttons: btn, frames: 2 }, { dir, frames: this.rng.int(5, 8) }]);
    }
    if (executed.length === route.length && this.chance(p.combo)) this.planCancel(self, team, dist);
  }

  planCancel(self, team, dist) {
    const sup = self.def.super;
    if (sup && self.canSuper({ team }, sup) && this.chance(this.p.superUse * 0.5)) {
      this.push(motionSteps(sup.input));
      return;
    }
    const options = self.def.specials.filter((s) => !s.grab && !s.parry && !s.barrier && (!s.motion.charge || this.chargeReady(team, self, s.motion.charge.dir)));
    const sp = options.find((s) => !s.projectile && s.velocity.length) || options[0];
    if (sp) this.doSpecial(self, team, sp);
  }

  antiAir(self, team) {
    const dp = self.def.specials.find((s) => s.invuln && s.knockback.y > 0);
    if (dp && (!dp.motion.charge || this.chargeReady(team, self, dp.motion.charge.dir))) {
      this.doSpecial(self, team, dp);
    } else {
      this.press(2, BTN.HP);
    }
  }

  punish(self, team, dist) {
    if (dist < 130 && this.chance(0.5)) {
      this.press(2, BTN.HP);
      return;
    }
    const rush = self.def.specials.find((s) => !s.projectile && !s.grab && !s.parry && !s.barrier && (s.velocity.length || s.teleport) && s.knockback.y === 0);
    if (rush && (!rush.motion.charge || this.chargeReady(team, self, rush.motion.charge.dir))) {
      this.doSpecial(self, team, rush);
      return;
    }
    this.comboString(self, team, dist);
  }

  tagLogic(match, side, self, team, dist) {
    const partner = team.members[1 - team.active];
    if (!partner || partner.ko || partner.onField) return false;
    const share = self.health / self.maxHealth;
    if (team.tagCooldown === 0 && share < 0.35 && partner.health / partner.maxHealth > share + 0.15 && this.chance(this.p.tag * 6)) {
      this.push([{ dir: 5, buttons: BTN.TAG, frames: RULES.tagHoldFrames + 2 }, { dir: 5, frames: 1 }]);
      return true;
    }
    if (team.assistCooldown === 0 && !team.lastStanding && dist > 160 && dist < 520 && this.chance(this.p.assist * 4)) {
      this.press(this.chance(0.3) ? 4 : 5, BTN.TAG);
      return true;
    }
    return false;
  }

  finishLogic(match, side, self) {
    if (match.finishSide !== side) return null;
    const loser = match.point(1 - side);
    const fin = self.def.finisher;
    if (!fin || loser.state !== "dazed" || !self.isNeutral) return NEUTRAL;
    const dist = Math.abs(loser.x - self.x);
    if (dist > fin.range - 30) return { dir: self.facing > 0 ? 6 : 4, buttons: 0 };
    if (dist < 90) return { dir: self.facing > 0 ? 4 : 6, buttons: 0 };
    if (this.chance(this.p.combo)) this.push(motionSteps(fin.input));
    else this.press(5, BTN.HP);
    return this.next(self.facing);
  }
}

export function createCpu(difficulty = "normal", seed = 1) {
  return new CpuController(difficulty, seed);
}
