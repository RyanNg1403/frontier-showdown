import { BTN, DT, PHYS, RULES } from "./constants.js";
import { Fighter } from "./fighter.js";
import { InputBuffer, NEUTRAL_INPUT, isBack, matchMotion } from "./input.js";
import { anyOverlap, intersectionCenter, overlaps, resolvePush, toWorld } from "./boxes.js";
import { addMeter, applyDamage, guardBlocks, meterOnBlock, meterOnHit, regenRed, scaledDamage, timeUpWinner } from "./rules.js";
import { createRng } from "./rng.js";

const START_X = 230;

/**
 * One match: two sides, each with one (1v1) or two (2v2) fighters.
 * Pure simulation: no DOM. Feed it one input per side per 60 Hz step.
 */
export class Match {
  /**
   * @param {object} opts
   * @param {"1v1"|"2v2"} opts.mode
   * @param {Array<{team: object[], control?: string, difficulty?: string, cpu?: object}>} opts.sides character defs per side
   * @param {Map<string, object>} [opts.atlases]
   * @param {{left:number, right:number}} [opts.bounds]
   */
  constructor({ mode = "1v1", sides, atlases = new Map(), bounds, roundsToWin = RULES.roundsToWin, timer = RULES.roundSeconds, stage = "default", emit = () => {}, seed = 7, skipIntro = false } = {}) {
    this.mode = mode;
    this.tagMode = mode === "2v2";
    this.stage = stage;
    this.bounds = { left: bounds?.left ?? PHYS.stageLeft, right: bounds?.right ?? PHYS.stageRight };
    this.roundsToWin = roundsToWin;
    this.roundSeconds = timer;
    this.emitFn = emit;
    this.rng = createRng(seed);
    this.skipIntro = skipIntro;
    this.sides = sides.map((s, side) => ({
      side,
      control: s.control || "human",
      difficulty: s.difficulty || "normal",
      cpu: s.cpu || null,
      members: s.team.slice(0, this.tagMode ? 2 : 1).map((def, slot) => new Fighter(def, { side, slot, atlas: atlases.get(def.id) || null })),
      active: 0,
      wins: 0,
      meter: 0,
      breakerUsed: false,
      tagCooldown: 0,
      assistCooldown: 0,
      forcedTagIn: 0,
      input: new InputBuffer(),
      assist: null,
    }));
    this.projectiles = [];
    this.frame = 0;
    this.round = 0;
    this.phase = "intro";
    this.phaseFrame = 0;
    this.timerFrames = timer * 60;
    this.freezeFrames = 0;
    this.announce = null;
    this.winner = null;
    this.roundWinner = null;
    this.finishSide = null;
    this.shakeFrames = 0;
    this.nextProjectileId = 1;
    this.lastInputs = [NEUTRAL_INPUT, NEUTRAL_INPUT];
    this.envs = new Map();
  }

  /** Begin round 1. Called automatically by the first `step()` if needed. */
  start() {
    if (this.round === 0) {
      this.emit("matchStart", {
        mode: this.mode,
        stage: this.stage,
        sides: this.sides.map((s) => ({ team: s.members.map((m) => m.id), control: s.control })),
      });
      this.startRound();
    }
    return this;
  }

  emit(name, payload = {}) {
    this.emitFn(name, payload);
  }

  vfx(type, x, y, opts = {}) {
    if (opts.labId === undefined && opts.side !== undefined) {
      const f = this.point(opts.side);
      opts = { ...opts, labId: f?.def.labId, characterId: opts.characterId ?? f?.id };
    }
    this.emitFn("vfx", { type, x, y, opts });
  }

  // ------------------------------------------------------------------ accessors

  point(side) {
    const s = this.sides[side];
    return s.members[s.active];
  }

  get fighters() {
    const out = [];
    for (const s of this.sides) {
      for (const m of s.members) if (m.onField) out.push(m);
    }
    return out;
  }

  get allFighters() {
    return this.sides.flatMap((s) => s.members);
  }

  get timer() {
    return Math.ceil(this.timerFrames / 60);
  }

  // ------------------------------------------------------------------ round flow

  startRound() {
    this.round += 1;
    this.projectiles = [];
    this.timerFrames = this.roundSeconds * 60;
    this.roundWinner = null;
    this.finishSide = null;
    for (const s of this.sides) {
      s.active = 0;
      s.breakerUsed = false;
      s.tagCooldown = 0;
      s.assistCooldown = 0;
      s.forcedTagIn = 0;
      s.assist = null;
      s.input.clear();
      s.members.forEach((m, i) => {
        const x = s.side === 0 ? -START_X : START_X;
        m.reset(x, s.side === 0 ? 1 : -1);
        m.dazedPending = false;
        m.onField = i === 0;
        if (i !== 0) m.setState("bench");
        else m.setState(this.skipIntro ? "idle" : "intro");
      });
    }
    this.setPhase("intro");
    this.emit("roundStart", { round: this.round });
    if (this.skipIntro) this.beginFight();
    else this.say(this.round === 1 && this.sides.every((s) => s.wins === 0) ? `ROUND ${this.round}` : this.isFinalRound() ? "FINAL ROUND" : `ROUND ${this.round}`, "", 70);
  }

  isFinalRound() {
    return this.sides.every((s) => s.wins === this.roundsToWin - 1);
  }

  introLength() {
    return this.round === 1 ? 150 : 110;
  }

  beginFight() {
    this.setPhase("fight");
    for (const s of this.sides) {
      const p = this.point(s.side);
      if (p.state === "intro") p.setState("idle");
    }
    this.say("FIGHT!", "", 50);
    this.emit("fight", { round: this.round });
  }

  setPhase(phase) {
    this.phase = phase;
    this.phaseFrame = 0;
  }

  say(text, sub = "", frames = 90) {
    this.announce = { text, sub, frames };
    this.emit("announce", { text, sub });
  }

  // ------------------------------------------------------------------ main step

  /** Advance one 60 Hz frame. `inputs[i]` is `{dir, buttons}` or null to ask the side's CPU. */
  step(inputs = []) {
    if (this.round === 0) this.start();
    this.frame += 1;
    this.phaseFrame += 1;
    if (this.announce && --this.announce.frames <= 0) this.announce = null;
    if (this.shakeFrames > 0) this.shakeFrames -= 1;

    for (const s of this.sides) {
      let input = inputs[s.side];
      if (!input && s.cpu) input = s.cpu.think(this, s.side);
      input = input || NEUTRAL_INPUT;
      this.lastInputs[s.side] = input;
      s.input.push(input);
    }

    this.updatePhase();
    if (this.freezeFrames > 0) {
      this.freezeFrames -= 1;
      this.vfxTick(0);
      return;
    }

    const anyHitstop = this.fighters.some((f) => f.hitstop > 0);
    for (const f of [...this.fighters]) f.update(this.envFor(f));
    this.updateAssists();
    this.updateProjectiles();
    this.resolvePushboxes();
    this.resolveThrows();
    this.resolveHits();
    this.checkKOs();
    this.updateTeams();
    this.updateCombos();
    this.vfxTick(anyHitstop ? 0 : DT);
  }

  vfxTick(dt) {
    this.emitFn("tick", { dt });
  }

  updatePhase() {
    switch (this.phase) {
      case "intro":
        if (this.phaseFrame === this.introLength() - 45) this.say("FIGHT!", "", 50);
        if (this.phaseFrame >= this.introLength()) {
          this.setPhase("fight");
          for (const s of this.sides) {
            const p = this.point(s.side);
            if (p.state === "intro") p.setState("idle");
          }
          this.emit("fight", { round: this.round });
        }
        break;
      case "fight":
        if (this.freezeFrames > 0) break;
        if (this.timerFrames > 0) {
          this.timerFrames -= 1;
          if (this.timerFrames === 0) this.timeUp();
        }
        break;
      case "ko":
        if (this.phaseFrame >= 150) this.endRound(this.roundWinner, this.roundWinner === null ? "draw" : "ko");
        break;
      case "finish": {
        const winner = this.point(this.finishSide);
        const loser = this.point(1 - this.finishSide);
        if (loser.state === "dazed" && winner.isNeutral && !winner.airborne) {
          const fin = winner.def.finisher;
          const s = this.sides[this.finishSide];
          if (fin && Math.abs(winner.x - loser.x) <= fin.range && matchMotion(s.input, fin.motion, winner.facing, 8) >= 0) {
            s.input.consume();
            this.startFinisher(winner, loser);
            break;
          }
        }
        if (this.phaseFrame >= 330) {
          if (loser.state !== "ko") this.koFighter(loser, winner);
          this.setPhase("ko");
          this.phaseFrame = 90;
        }
        break;
      }
      case "finisher":
        if (this.phaseFrame >= this.finisherLength) this.endRound(this.finishSide, "finisher");
        break;
      case "roundEnd":
        if (this.phaseFrame === 20 && this.roundWinner !== null) {
          const w = this.point(this.roundWinner);
          if (!w.ko && !w.airborne) w.setState("victory");
        }
        if (this.phaseFrame >= 170) {
          if (this.winner !== null || this.sides.some((s) => s.wins >= this.roundsToWin)) {
            this.endMatch();
          } else if (this.round >= 9) {
            this.endMatch();
          } else {
            this.startRound();
          }
        }
        break;
      case "matchEnd":
        if (this.phaseFrame === 30 && this.winner !== null) {
          const w = this.point(this.winner);
          if (!w.ko && w.state !== "victory" && !w.airborne) w.setState("victory");
        }
        break;
      default:
        break;
    }
  }

  canAct(side) {
    if (this.phase === "fight") return true;
    if (this.phase === "finish") return side === this.finishSide;
    return false;
  }

  envFor(f) {
    let env = this.envs.get(f.uid);
    if (!env) {
      env = {
        emit: (n, p) => this.emit(n, p),
        vfx: (t, x, y, o = {}) => this.vfx(t, x, y, { facing: f.facing, side: f.side, ...o }),
        spawnProjectile: (owner, move) => this.spawnProjectile(owner, move),
        hasProjectile: (owner) => this.projectiles.some((p) => p.ownerUid === owner.uid && p.category !== "super"),
        freeze: (frames) => {
          this.freezeFrames = Math.max(this.freezeFrames, frames);
        },
        shake: (frames) => {
          this.shakeFrames = Math.max(this.shakeFrames, frames);
        },
        techThrow: (a, d) => this.techThrow(a, d),
        releaseThrow: (a, d) => this.releaseThrow(a, d),
        breaker: (victim) => this.comboBreaker(victim),
        threat: (self) => this.threatNear(self),
        benched: (fighter) => this.bench(fighter),
        endAssist: (fighter) => this.endAssist(fighter),
      };
      this.envs.set(f.uid, env);
    }
    const s = this.sides[f.side];
    const isPoint = s.members[s.active] === f && !f.assistMode;
    env.team = s;
    env.opponent = this.point(1 - f.side);
    env.input = isPoint ? s.input : null;
    env.canAct = isPoint ? this.canAct(f.side) : f.assistMode;
    return env;
  }

  threatNear(self) {
    const range = RULES.proximityGuard;
    for (const f of this.fighters) {
      if (f.side === self.side) continue;
      if (f.isAttacking && Math.abs(f.x - self.x) < range) return true;
    }
    for (const p of this.projectiles) {
      if (p.side === self.side) continue;
      const dx = self.x - p.x;
      if (Math.sign(dx) === Math.sign(p.vx) && Math.abs(dx) < range + 80) return true;
    }
    return false;
  }

  // ------------------------------------------------------------------ projectiles

  spawnProjectile(owner, move) {
    const p = move.projectile;
    const proj = {
      id: this.nextProjectileId++,
      ownerUid: owner.uid,
      ownerId: owner.id,
      owner,
      side: owner.side,
      category: move.category,
      moveId: move.id,
      def: p,
      x: owner.x + owner.facing * p.offset.x,
      y: owner.y + p.offset.y,
      vx: owner.facing * p.speed,
      facing: owner.facing,
      age: 0,
      hits: 0,
      durability: p.durability,
      lastHit: new Map(),
      vfx: p.vfx,
      palette: owner.def.palette,
      dead: false,
    };
    this.projectiles.push(proj);
    return proj;
  }

  projectileBox(p) {
    return toWorld(p.def.hitbox, p.x, p.y, p.facing);
  }

  updateProjectiles() {
    for (const p of this.projectiles) {
      if (p.hitstop > 0) {
        p.hitstop -= 1;
        continue;
      }
      p.x += p.vx * DT;
      p.age += 1;
      if (p.age > p.def.lifetime || p.x < this.bounds.left - 200 || p.x > this.bounds.right + 200) {
        p.dead = true;
        this.vfx("projectile_fizzle", p.x, p.y, { facing: p.facing, side: p.side, vfx: p.vfx });
      }
    }
    for (let i = 0; i < this.projectiles.length; i += 1) {
      const a = this.projectiles[i];
      if (a.dead) continue;
      for (let j = i + 1; j < this.projectiles.length; j += 1) {
        const b = this.projectiles[j];
        if (b.dead || a.side === b.side) continue;
        const ba = this.projectileBox(a);
        const bb = this.projectileBox(b);
        if (!overlaps(ba, bb)) continue;
        const c = intersectionCenter(ba, bb);
        const da = a.durability;
        a.durability -= b.durability;
        b.durability -= da;
        if (a.durability <= 0) a.dead = true;
        if (b.durability <= 0) b.dead = true;
        this.vfx("clash", c.x, c.y, { facing: a.facing, side: a.side });
      }
    }
    this.projectiles = this.projectiles.filter((p) => !p.dead);
  }

  // ------------------------------------------------------------------ space

  resolvePushboxes() {
    const { left, right } = this.bounds;
    const a = this.point(0);
    const b = this.point(1);
    const prevMid = (a.x + b.x) / 2;
    for (const f of this.fighters) {
      if (f.state === "bench") continue;
      if (f.state === "tag_in" || f.state === "tag_out" || f.state === "assist_in" || f.state === "assist_out") continue;
      const hw = f.push.w / 2;
      f.x = Math.max(left + hw, Math.min(right - hw, f.x));
    }
    if (a.canFight && b.canFight && a.state !== "thrown" && b.state !== "thrown" && !a.isLying && !b.isLying) {
      resolvePush(a, b, left, right);
    }
    const half = PHYS.maxSeparation / 2;
    if (a.canFight && b.canFight) {
      for (const f of [a, b]) {
        f.x = Math.max(prevMid - half, Math.min(prevMid + half, f.x));
      }
    }
  }

  atWall(f) {
    const hw = f.push.w / 2;
    return f.x - hw <= this.bounds.left + 2 || f.x + hw >= this.bounds.right - 2;
  }

  // ------------------------------------------------------------------ throws

  resolveThrows() {
    const attempts = [];
    for (const a of this.fighters) {
      if (a.state !== "attack" || !a.move?.grab || a.hitstop > 0) continue;
      const m = a.move;
      if (a.moveFrame < m.startup || a.moveFrame >= m.startup + m.active) continue;
      const d = this.point(1 - a.side);
      if (!d || d.invulnTo("throw")) continue;
      if (Math.abs(a.x - d.x) > m.grab.range || a.airborne) continue;
      attempts.push({ a, d, m });
    }
    if (attempts.length === 2 && attempts[0].m.grab.techable && attempts[1].m.grab.techable) {
      this.techThrow(attempts[0].a, attempts[1].a);
      return;
    }
    for (const { a, d, m } of attempts) {
      if (d.state === "throwing" || d.state === "thrown" || a.state !== "attack") continue;
      const back = this.sides[a.side].input && isBack(this.sides[a.side].input.dir(a.facing));
      a.setState("throwing", { keepAnim: true });
      a.anim = { name: m.anim, t: 0 };
      a.grab = { length: Math.max(30, m.recovery + 10), victim: d, move: m };
      d.setState("thrown");
      d.combo = { hits: 0, damage: 0 };
      d.grab = {
        by: a,
        move: m,
        techable: m.grab.techable,
        release: m.grab.techable ? RULES.throwTechWindow + 2 : 10,
        damage: m.grab.damage,
        knockback: m.grab.knockback,
        back,
      };
      this.emit("throw", { attacker: a.id, defender: d.id, side: a.side, moveId: m.id });
      this.vfx("throw", (a.x + d.x) / 2, -110, { facing: a.facing, side: a.side, tech: false });
    }
  }

  techThrow(a, d) {
    for (const [f, dir] of [[a, -1], [d, 1]]) {
      const facingSign = a.x <= d.x ? 1 : -1;
      f.grab = null;
      f.setState("tech");
      f.vx = dir * facingSign * 330;
      f.y = 0;
      f.vy = 0;
      f.hitstop = 6;
    }
    this.emit("tech", { fighter: d.id, side: d.side });
    this.vfx("tech", (a.x + d.x) / 2, -120, { facing: a.facing, side: d.side });
  }

  releaseThrow(a, d) {
    const g = d.grab;
    if (!g) return;
    d.grab = null;
    const dir = g.back ? -a.facing : a.facing;
    if (g.back) d.x = a.x - a.facing * 50;
    const s = this.sides[a.side];
    d.combo = { hits: 1, damage: 0 };
    const dealt = applyDamage(d, g.damage, { redRatio: this.tagMode ? RULES.redRatio : 0 });
    d.combo.damage = dealt;
    addMeter(s, meterOnHit(g.move, dealt).attacker);
    addMeter(this.sides[d.side], meterOnHit(g.move, dealt).defender);
    d.setState("juggle");
    d.juggleLocked = true;
    d.y = -40;
    d.vy = -(g.knockback.y || 650);
    d.vx = dir * (g.knockback.x || 280);
    d.facing = -dir;
    d.hitstop = 10;
    a.hitstop = 10;
    this.shakeFrames = Math.max(this.shakeFrames, 8);
    this.emit("hit", { attacker: a.id, defender: d.id, side: a.side, moveId: g.move.id, kind: "throw", damage: dealt, combo: 1, comboDamage: dealt, counter: false, level: "unblockable", x: d.x, y: -100 });
    this.vfx("hit_heavy", d.x, -100, { facing: a.facing, side: a.side, damage: dealt, combo: 1, palette: a.def.palette });
  }

  // ------------------------------------------------------------------ strikes

  resolveHits() {
    const hits = [];
    const fighters = this.fighters;
    for (const a of fighters) {
      const idx = a.activeHitIndex();
      if (idx < 0 || a.hitstop > 0) continue;
      const boxes = a.hitboxes();
      for (const d of fighters) {
        if (d.side === a.side || d.invulnTo("strike")) continue;
        const log = a.hitLog.get(d.uid);
        if (log !== undefined && log >= idx) continue;
        const pair = anyOverlap(boxes, d.hurtboxes());
        if (!pair) continue;
        hits.push({ a, d, move: a.move, idx, at: intersectionCenter(pair[0], pair[1]) });
      }
    }
    for (const p of this.projectiles) {
      if (p.dead || p.hitstop > 0) continue;
      const box = this.projectileBox(p);
      for (const d of fighters) {
        if (d.side === p.side || d.invulnTo("projectile")) continue;
        const last = p.lastHit.get(d.uid);
        if (last !== undefined && p.age - last < p.def.hitInterval) continue;
        const pair = anyOverlap([box], d.hurtboxes());
        if (!pair) continue;
        hits.push({ p, d, at: intersectionCenter(pair[0], pair[1]) });
      }
    }
    for (const h of hits) {
      if (h.p) this.applyProjectileHit(h.p, h.d, h.at);
      else this.applyStrike(h.a, h.d, h.move, h.idx, h.at);
    }
  }

  applyProjectileHit(p, d, at) {
    if (p.dead) return;
    p.lastHit.set(d.uid, p.age);
    p.hits += 1;
    const isLast = p.hits >= p.def.hits;
    const props = {
      id: p.moveId,
      kind: p.category === "super" ? "super" : "projectile",
      category: p.category,
      damage: p.def.damage,
      chip: p.def.chip,
      hitstun: p.def.hitstun,
      blockstun: p.def.blockstun,
      hitstop: p.def.hitstop,
      knockback: p.def.knockback,
      level: p.def.level,
      knockdown: isLast && p.def.knockdown,
      meterGain: p.def.meterGain,
      juggle: 1,
    };
    const owner = p.owner;
    this.applyContact(owner, d, props, at, { projectile: p, dir: p.facing });
    if (isLast) {
      p.dead = true;
      this.vfx("projectile_hit", at.x, at.y, { facing: p.facing, side: p.side, vfx: p.vfx });
    } else {
      p.hitstop = 3;
    }
  }

  applyStrike(a, d, move, idx, at) {
    a.hitLog.set(d.uid, idx);
    const isLast = idx === move.hits - 1;
    const over = isLast && move.lastHit ? move.lastHit : null;
    const props = {
      id: move.id,
      kind: move.kind,
      category: move.category,
      damage: move.damage,
      chip: move.chip,
      hitstun: move.hitstun,
      blockstun: move.blockstun,
      hitstop: move.hitstop,
      knockback: over?.knockback ? { x: over.knockback.x ?? move.knockback.x, y: over.knockback.y ?? 0 } : move.knockback,
      level: move.level,
      knockdown: over?.knockdown ?? (isLast && move.knockdown),
      meterGain: move.meterGain,
      juggle: move.juggle,
    };
    const dir = d.x === a.x ? a.facing : Math.sign(d.x - a.x);
    this.applyContact(a, d, props, at, { dir });
  }

  /** Shared hit/block logic for strikes and projectiles. */
  applyContact(a, d, props, at, { projectile = null, dir }) {
    const as = this.sides[a.side];
    const ds = this.sides[d.side];
    const dEnv = this.envFor(d);
    const fromX = projectile ? projectile.x - projectile.vx : a.x;
    const payloadBase = { attacker: a.id, defender: d.id, side: a.side, moveId: props.id, x: at.x, y: at.y };

    if (d.state === "dazed" || (d.dazedPending && d.health <= 0)) {
      this.koFighter(d, a, dir);
      this.setPhase("ko");
      this.phaseFrame = 60;
      a.connected = projectile ? a.connected : true;
      this.emit("hit", { ...payloadBase, kind: props.kind, damage: 0, combo: d.combo.hits + 1, comboDamage: d.combo.damage, counter: false, level: props.level });
      this.vfx(`hit_${props.kind === "light" ? "light" : "heavy"}`, at.x, at.y, { facing: dir, side: a.side, damage: 0, palette: a.def.palette });
      return;
    }

    if (d.hasArmor()) {
      d.armorHits += 1;
      const dealt = applyDamage(d, Math.round(props.damage * 0.5), { redRatio: this.tagMode ? RULES.redRatio : 0 });
      d.hitstop = 6;
      if (!projectile) {
        a.hitstop = 6;
        a.connected = true;
      }
      this.emit("hit", { ...payloadBase, kind: props.kind, damage: dealt, combo: 0, comboDamage: 0, counter: false, level: props.level, armor: true });
      this.vfx("block", at.x, at.y, { facing: dir, side: a.side, chip: dealt });
      return;
    }

    const guard = d.assistMode ? null : d.guardAgainst(fromX, dEnv);
    const airAttack = !projectile && a.airborne;
    const level = airAttack && props.level !== "low" ? "overhead" : props.level;
    if (guard && guardBlocks(level, guard === "low")) {
      const chip = props.chip || 0;
      const dealt = chip > 0 ? applyDamage(d, chip, { redRatio: 0, floor: this.chipFloor(d) }) : 0;
      d.setState("blockstun", { keepAnim: true });
      d.stun = props.blockstun;
      d.stunAnim = guard === "low" ? "crouch_block" : "block";
      d.setAnim(d.stunAnim, false);
      d.facing = fromX >= d.x ? 1 : -1;
      d.vx = dir * props.knockback.x * 0.85;
      d.hitstop = Math.max(4, props.hitstop - 2);
      d.shake = d.hitstop;
      if (!projectile) {
        a.hitstop = d.hitstop;
        a.connected = true;
        if (this.atWall(d) && !a.airborne) a.vx = -a.facing * props.knockback.x * 0.7;
      }
      const m = meterOnBlock(props);
      addMeter(as, m.attacker);
      addMeter(ds, m.defender);
      this.emit("block", { ...payloadBase, chip: dealt });
      this.vfx("block", at.x, at.y, { facing: dir, side: a.side, chip: dealt });
      return;
    }

    const freshCombo = !d.isStunned;
    if (freshCombo) d.combo = { hits: 0, damage: 0 };
    d.combo.hits += 1;
    const counter = freshCombo && d.isAttacking;
    const damage = scaledDamage(props.damage, d.combo.hits, { isSuper: props.category === "super", counter });
    const dealt = applyDamage(d, damage, { redRatio: this.tagMode ? RULES.redRatio : 0, floor: d.assistMode ? 1 : 0 });
    d.combo.damage += dealt;
    const meter = meterOnHit(props, dealt);
    addMeter(as, props.category === "super" ? 0 : meter.attacker);
    addMeter(ds, meter.defender);
    const stop = props.hitstop + (counter ? 3 : 0);
    d.hitstop = stop;
    d.shake = stop;
    if (!projectile) {
      a.hitstop = stop;
      a.connected = true;
    }
    if (props.category === "super" || props.kind === "heavy" || counter) this.shakeFrames = Math.max(this.shakeFrames, props.category === "super" ? 8 : 4);

    const wasCrouching = d.crouching;
    const wasAirborne = d.airborne || d.state === "juggle";
    if (d.assistMode) {
      d.hitstop = 0;
      this.sendAssistHome(d);
    } else {
      const launch = props.knockback.y > 0 || wasAirborne || props.knockdown;
      if (launch) {
        d.juggleCount += props.juggle;
        if (wasAirborne && d.juggleCount > RULES.maxJuggle) d.juggleLocked = true;
        d.setState("juggle", { keepAnim: true });
        d.setAnim("knockdown", !wasAirborne);
        const w = Math.sqrt(d.def.stats.weight || 1);
        const lift = props.knockback.y > 0 ? props.knockback.y : wasAirborne ? 520 : 320;
        d.vy = -lift / w;
        d.vx = dir * Math.max(90, props.knockback.x * 0.55);
        d.y = Math.min(d.y, -2);
      } else {
        d.setState("hitstun", { keepAnim: true });
        d.stun = props.hitstun + (counter ? RULES.counterHitstun : 0);
        d.stunAnim = wasCrouching || level === "low" ? "hit_low" : "hit_high";
        d.setAnim(d.stunAnim, true);
        d.vx = dir * props.knockback.x;
        if (!projectile && this.atWall(d) && !a.airborne) a.vx = -a.facing * props.knockback.x * 0.75;
      }
      if (!d.airborne || d.state === "hitstun") d.facing = -dir;
    }

    this.emit("hit", { ...payloadBase, kind: props.kind, damage: dealt, combo: d.combo.hits, comboDamage: d.combo.damage, counter, level });
    const type = props.category === "super" ? "hit_super" : props.category === "special" || props.kind === "projectile" ? "hit_special" : props.kind === "light" ? "hit_light" : "hit_heavy";
    this.vfx(type, at.x, at.y, { facing: dir, side: a.side, damage: dealt, counter, level, combo: d.combo.hits, palette: a.def.palette });
    if (counter) this.vfx("counter", at.x, at.y - 30, { facing: dir, side: a.side });
  }

  chipFloor(d) {
    return d.assistMode ? 1 : 0;
  }

  // ------------------------------------------------------------------ KO, finish, round end

  koFighter(f, by, dir = null) {
    if (f.ko) return;
    f.ko = true;
    f.health = 0;
    f.dazedPending = false;
    f.grab = null;
    const d = dir ?? (by ? Math.sign(f.x - by.x) || -f.facing : -f.facing);
    f.setState("ko");
    f.vy = f.airborne ? Math.min(f.vy, -300) : -560;
    f.vx = d * 260;
    f.y = Math.min(f.y, -2);
    f.facing = -d;
    this.shakeFrames = Math.max(this.shakeFrames, 12);
    this.emit("ko", { fighter: f.id, side: f.side, by: by?.id ?? null, round: this.round });
    this.vfx("ko", f.x, f.y - 100, { facing: d, side: f.side, characterId: f.id });
  }

  checkKOs() {
    if (this.phase !== "fight") return;
    const downed = this.allFighters.filter((f) => f.health <= 0 && !f.ko && !f.dazedPending);
    if (!downed.length) return;
    const defeated = [false, false];
    for (const f of downed) {
      const s = this.sides[f.side];
      const partnerAlive = s.members.some((m) => m !== f && m.health > 0 && !m.ko);
      if (partnerAlive) {
        this.koFighter(f, this.point(1 - f.side));
        s.forcedTagIn = 70;
      } else {
        defeated[f.side] = true;
      }
    }
    if (defeated[0] && defeated[1]) {
      for (const f of downed) this.koFighter(f, this.point(1 - f.side));
      this.roundWinner = null;
      this.say("DOUBLE K.O.", "", 120);
      this.setPhase("ko");
      return;
    }
    const loserSide = defeated[0] ? 0 : defeated[1] ? 1 : -1;
    if (loserSide < 0) return;
    const winnerSide = 1 - loserSide;
    const loser = downed.find((f) => f.side === loserSide);
    const decides = this.sides[winnerSide].wins + 1 >= this.roundsToWin;
    this.roundWinner = winnerSide;
    if (decides && this.point(winnerSide).def.finisher) {
      loser.dazedPending = true;
      loser.health = 0;
      this.finishSide = winnerSide;
      this.projectiles = [];
      this.setPhase("finish");
      this.say(this.tagMode ? "FINISH THEM!" : "FINISH IT!", `${this.point(winnerSide).def.finisher.input}`, 150);
      this.emit("finish", { side: winnerSide, fighter: this.point(winnerSide).id });
    } else {
      this.koFighter(loser, this.point(winnerSide));
      this.say("K.O.", "", 120);
      this.setPhase("ko");
    }
  }

  startFinisher(winner, loser) {
    const fin = winner.def.finisher;
    this.setPhase("finisher");
    this.finisherLength = fin.frames + 40;
    winner.setState("finisher");
    winner.anim = { name: fin.anim, t: 0 };
    winner.facing = loser.x >= winner.x ? 1 : -1;
    loser.dazedPending = false;
    loser.ko = true;
    loser.setState("finished");
    this.say(fin.name.toUpperCase(), "", fin.frames);
    this.emit("finisher", { side: winner.side, fighter: winner.id, victim: loser.id, id: fin.id, name: fin.name });
    this.vfx("finisher", loser.x, -120, { facing: winner.facing, side: winner.side, characterId: winner.id, finisherId: fin.id, palette: winner.def.palette });
    this.vfx(fin.vfx, loser.x, -120, { facing: winner.facing, side: winner.side, characterId: winner.id, finisherId: fin.id, palette: winner.def.palette });
  }

  timeUp() {
    this.emit("timeUp", {});
    const shares = this.sides.map((s) => {
      const max = s.members.reduce((t, m) => t + m.maxHealth, 0);
      return s.members.reduce((t, m) => t + Math.max(0, m.health), 0) / max;
    });
    this.say("TIME", "", 90);
    this.endRound(timeUpWinner(shares), "time");
  }

  endRound(winner, reason) {
    if (this.phase === "roundEnd" || this.phase === "matchEnd") return;
    this.roundWinner = winner;
    if (winner !== null) this.sides[winner].wins += 1;
    const perfect = winner !== null && this.sides[winner].members.every((m) => m.health >= m.maxHealth);
    this.setPhase("roundEnd");
    if (winner !== null) {
      const name = this.sides[winner].members.map((m) => m.def.name).join(" & ");
      this.say(perfect ? "FLAWLESS VICTORY" : `${name.toUpperCase()} WINS`, perfect ? `${name} wins` : "", 150);
    } else if (reason !== "draw") {
      this.say("DRAW", "", 150);
    }
    this.emit("roundEnd", { round: this.round, winner, reason: winner === null ? "draw" : reason, wins: this.sides.map((s) => s.wins), perfect });
  }

  endMatch() {
    const w = this.sides.findIndex((s) => s.wins >= this.roundsToWin);
    this.winner = w >= 0 ? w : null;
    this.setPhase("matchEnd");
    if (this.winner !== null) {
      const name = this.sides[this.winner].members.map((m) => m.def.name).join(" & ");
      this.say(`${name.toUpperCase()} WINS THE MATCH`, "", 600);
    } else {
      this.say("DRAW GAME", "", 600);
    }
    this.emit("matchEnd", { winner: this.winner, wins: this.sides.map((s) => s.wins) });
  }

  // ------------------------------------------------------------------ combo breaker

  comboBreaker(victim) {
    const s = this.sides[victim.side];
    if (s.breakerUsed || s.meter < RULES.breakerCost) return;
    s.meter -= RULES.breakerCost;
    s.breakerUsed = true;
    s.input.consume();
    victim.combo = { hits: 0, damage: 0 };
    victim.juggleLocked = false;
    victim.setState("breaker", { keepAnim: true });
    victim.setAnim("block", true);
    victim.invulnFrames = 24;
    victim.vx = -victim.facing * 160;
    const attacker = this.point(1 - victim.side);
    if (attacker && attacker.canFight) {
      const dir = Math.sign(attacker.x - victim.x) || attacker.facing * -1;
      attacker.pendingMove = null;
      attacker.setState("hitstun", { keepAnim: true });
      attacker.stun = 24;
      attacker.stunAnim = "hit_high";
      attacker.setAnim("hit_high", true);
      attacker.vx = dir * 560;
      if (attacker.airborne) {
        attacker.setState("juggle", { keepAnim: true });
        attacker.juggleLocked = true;
      }
    }
    this.freezeFrames = Math.max(this.freezeFrames, 12);
    this.emit("breaker", { fighter: victim.id, side: victim.side });
    this.vfx("breaker", victim.x, victim.y - 110, { facing: victim.facing, side: victim.side });
  }

  // ------------------------------------------------------------------ tag and assist

  updateTeams() {
    for (const s of this.sides) {
      if (s.tagCooldown > 0) s.tagCooldown -= 1;
      if (s.assistCooldown > 0) s.assistCooldown -= 1;
      for (const m of s.members) {
        if (!m.onField && !m.ko) regenRed(m, DT);
      }
      if (!this.tagMode) continue;
      if (s.forcedTagIn > 0) {
        s.forcedTagIn -= 1;
        if (s.forcedTagIn === 0) this.forceTag(s);
        continue;
      }
      if (this.phase !== "fight") continue;
      const point = s.members[s.active];
      const partner = s.members[1 - s.active];
      if (!partner || partner.ko || partner.health <= 0) continue;
      const b = s.input;
      if (b.pressedNow(BTN.TAG) && s.tagCooldown === 0 && !partner.onField) {
        const cancel = point.state === "attack" && point.connected && s.meter >= RULES.tagCancelCost;
        if (point.isNeutral || point.state === "run" || cancel) {
          if (cancel && !point.isNeutral) s.meter -= RULES.tagCancelCost;
          b.consume();
          this.tag(s, false);
          continue;
        }
      }
      if (b.pressedNow(BTN.ASSIST) && s.assistCooldown === 0 && !partner.onField && point.canFight) {
        b.consume();
        this.callAssist(s);
      }
    }
  }

  offscreenX(s, behindOf) {
    const enemy = this.point(1 - s.side);
    const away = behindOf.x <= enemy.x ? -1 : 1;
    return behindOf.x + away * 700;
  }

  tag(s, forced) {
    const out = s.members[s.active];
    const incoming = s.members[1 - s.active];
    const enemy = this.point(1 - s.side);
    const fromX = this.offscreenX(s, out);
    const toX = out.x;
    s.active = 1 - s.active;
    s.tagCooldown = RULES.tagCooldown;
    if (!out.ko) {
      out.script = { fromX: out.x, toX: fromX, frames: 22, arc: 60 };
      out.setState("tag_out");
    }
    const { health, red } = incoming;
    incoming.reset(fromX, enemy.x >= toX ? 1 : -1);
    incoming.health = health;
    incoming.red = red;
    incoming.onField = true;
    incoming.script = { fromX, toX, frames: 26, arc: 170 };
    incoming.setState("tag_in");
    this.emit("tag", { side: s.side, out: out.id, in: incoming.id, forced });
    this.vfx("tag_flash", toX, -120, { facing: incoming.facing, side: s.side, characterId: incoming.id });
  }

  forceTag(s) {
    const out = s.members[s.active];
    const incoming = s.members[1 - s.active];
    if (!incoming || incoming.ko || incoming.health <= 0) return;
    out.onField = false;
    out.setState("bench");
    this.tag(s, true);
  }

  callAssist(s) {
    const point = s.members[s.active];
    const partner = s.members[1 - s.active];
    const enemy = this.point(1 - s.side);
    const facing = enemy.x >= point.x ? 1 : -1;
    const fromX = this.offscreenX(s, point);
    const health = partner.health;
    const red = partner.red;
    partner.reset(fromX, facing);
    partner.health = health;
    partner.red = red;
    partner.assistMode = true;
    partner.onField = true;
    partner.script = { fromX, toX: point.x - facing * 70, frames: 20, arc: 130 };
    partner.setState("assist_in");
    s.assist = partner;
    s.assistCooldown = RULES.assistCooldown;
    this.emit("assist", { side: s.side, fighter: partner.id });
    this.vfx("assist_flash", point.x - facing * 70, -120, { facing, side: s.side, characterId: partner.id });
  }

  updateAssists() {
    for (const s of this.sides) {
      const a = s.assist;
      if (!a) continue;
      if (a.state === "attack" || a.state === "assist_in" || a.state === "assist_out") continue;
      this.sendAssistHome(a);
    }
  }

  endAssist(f) {
    this.sendAssistHome(f);
  }

  sendAssistHome(f) {
    if (f.state === "assist_out" || f.state === "bench") return;
    const s = this.sides[f.side];
    f.vx = 0;
    f.vy = 0;
    f.script = { fromX: f.x, toX: this.offscreenX(s, f), frames: 20, arc: 120 };
    f.setState("assist_out");
    if (this.projectiles.some((p) => p.ownerUid === f.uid) && f.health <= 1) {
      this.projectiles = this.projectiles.filter((p) => p.ownerUid !== f.uid);
    }
  }

  bench(f) {
    const s = this.sides[f.side];
    f.onField = false;
    f.assistMode = false;
    f.script = null;
    f.setState("bench");
    if (s.assist === f) s.assist = null;
  }

  updateCombos() {
    for (const f of this.allFighters) {
      if (!f.isStunned && f.state !== "thrown" && f.state !== "knockdown" && f.combo.hits > 0 && f.state !== "ko") {
        f.combo = { hits: 0, damage: 0 };
      }
    }
  }

  // ------------------------------------------------------------------ snapshot

  snapshot() {
    return {
      phase: this.phase,
      mode: this.mode,
      frame: this.frame,
      round: this.round,
      roundsToWin: this.roundsToWin,
      timer: this.timer,
      timerFrames: this.timerFrames,
      stage: this.stage,
      announce: this.announce ? { ...this.announce } : null,
      sides: this.sides.map((s) => {
        const enemy = this.point(1 - s.side);
        return {
          side: s.side,
          control: s.control,
          difficulty: s.difficulty,
          wins: s.wins,
          meter: s.meter,
          meterMax: RULES.meterMax,
          bars: Math.floor(s.meter / RULES.meterBar),
          breakerUsed: s.breakerUsed,
          tagCooldown: s.tagCooldown,
          assistCooldown: s.assistCooldown,
          combo: { hits: enemy.combo.hits, damage: Math.round(enemy.combo.damage) },
          active: s.active,
          members: s.members.map((m) => ({
            id: m.id,
            name: m.def.name,
            health: Math.max(0, Math.round(m.health)),
            maxHealth: m.maxHealth,
            red: Math.round(m.red),
            ko: m.ko,
            onField: m.onField,
          })),
        };
      }),
      fighters: this.fighters.map((f) => ({
        id: f.id,
        side: f.side,
        x: Math.round(f.x * 10) / 10,
        y: Math.round(f.y * 10) / 10,
        facing: f.facing,
        state: f.state,
        anim: f.anim.name,
        health: Math.max(0, Math.round(f.health)),
        maxHealth: f.maxHealth,
        airborne: f.airborne,
        hitstun: f.isStunned,
        invuln: f.invulnTo("strike"),
      })),
      winner: this.winner,
    };
  }
}

export function createMatch(opts) {
  return new Match(opts).start();
}
