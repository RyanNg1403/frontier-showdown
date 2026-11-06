import { BTN, DT, PHYS, RULES } from "./constants.js";
import { Fighter } from "./fighter.js";
import { InputBuffer, NEUTRAL_INPUT, isBack, matchMotion } from "./input.js";
import { anyOverlap, intersectionCenter, overlaps, resolvePush, toWorld } from "./boxes.js";
import { addMeter, applyDamage, guardBlocks, meterOnHit, regenRed, scaledDamage, timeUpWinner } from "./rules.js";
import { createRng } from "./rng.js";
import { createMechanics } from "./mechanics/index.js";
import { fighterMechanics, moveMechanic, systems } from "./mechanics.js";

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
  constructor({ mode = "1v1", sides, atlases = new Map(), bounds, roundsToWin = RULES.roundsToWin, timer = null, stage = "default", emit = () => {}, seed = 7, skipIntro = false, backBlocks = false } = {}) {
    this.mode = mode;
    this.tagMode = mode === "2v2";
    this.backBlocks = backBlocks;
    timer = timer ?? (this.tagMode ? RULES.tagRoundSeconds : RULES.roundSeconds);
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
      runway: RULES.runwayMax,
      runwaySpentFrame: -9999,
      breakerUsed: false,
      lastCheckpointUsed: false,
      lastStanding: false,
      tagHold: 0,
      tagHoldBack: false,
      tagHandled: false,
      tagCooldown: 0,
      assistCooldown: 0,
      forcedTagIn: 0,
      input: new InputBuffer(),
      assist: null,
    }));
    this.projectiles = [];
    this.barriers = [];
    this.entities = [];
    this.slowmo = null;
    this.nextBarrierId = 1;
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
    this.mech = createMechanics(this);
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
    this.barriers = [];
    this.mech.reset();
    this.entities = [];
    this.timerFrames = this.roundSeconds * 60;
    this.roundWinner = null;
    this.finishSide = null;
    for (const s of this.sides) {
      s.active = 0;
      s.breakerUsed = false;
      s.lastStanding = false;
      s.runway = RULES.runwayMax;
      s.runwaySpentFrame = -9999;
      s.tagHold = 0;
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
        for (const h of m.mechanicHooks) h.init?.(m);
      });
    }
    this.setPhase("intro");
    this.emit("roundStart", {
      round: this.round,
      final: this.isFinalRound(),
      maxRounds: this.roundsToWin * 2 - 1,
      fightDelay: this.skipIntro ? 0 : (this.introLength() - 45) / 60,
      announceFight: false,
    });
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
  step(inputs = [], { hold = false } = {}) {
    if (this.round === 0) this.start();
    if (hold) {
      for (const s of this.sides) s.input.push(inputs[s.side] || (s.cpu ? s.cpu.think(this, s.side) : null) || NEUTRAL_INPUT);
      this.vfxTick(DT, true);
      return;
    }
    this.frame += 1;
    this.phaseFrame += 1;
    if (this.announce && --this.announce.frames <= 0) this.announce = null;
    if (this.shakeFrames > 0) this.shakeFrames -= 1;
    if (this.slowmo && --this.slowmo.frames <= 0) {
      this.slowmo = null;
      this.emit("slowmo", { active: false, rate: 1 });
    }

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
      this.vfxTick(DT, true);
      return;
    }

    const hitstop = this.fighters.some((f) => f.hitstop > 0);
    this.mech.preStep();
    for (const f of this.fighters) f.floorY = this.floorAt(f);
    for (const f of [...this.fighters]) f.update(this.envFor(f));
    this.updateAssists();
    this.updateRunway();
    this.updateProjectiles();
    this.updateBarriers();
    this.updateEntities();
    this.resolvePushboxes();
    this.resolveThrows();
    this.resolveHits();
    this.mech.update();
    this.checkKOs();
    this.updateTeams();
    this.updateCombos();
    this.emitFrameEvents();
    this.vfxTick(DT, hitstop);
  }

  vfxTick(dt, frozen = false) {
    this.emitFn("tick", { dt, frozen });
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
        const free = winner.isNeutral || winner.state === "run" || winner.state === "dash_fwd";
        if (loser.state === "dazed" && free && !winner.airborne) {
          const fin = winner.def.finisher;
          const s = this.sides[this.finishSide];
          if (fin && Math.abs(winner.x - loser.x) <= fin.range && matchMotion(s.input, fin.motion, winner.facing, 8) >= 0) {
            s.input.consume();
            this.startFinisher(winner, loser);
            break;
          }
        }
        if (this.phaseFrame >= RULES.finishWindow + 30) {
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
        spawnBarrier: (owner, move) => this.spawnBarrier(owner, move),
        guardrail: (defender) => this.guardrail(defender),
      };
      this.envs.set(f.uid, env);
    }
    const s = this.sides[f.side];
    const isPoint = s.members[s.active] === f && !f.assistMode;
    env.team = s;
    env.opponent = this.point(1 - f.side);
    env.input = isPoint ? s.input : null;
    env.canAct = isPoint ? this.canAct(f.side) : f.assistMode;
    env.frame = this.frame;
    env.match = this;
    env.bounds = this.bounds;
    env.backBlocks = this.backBlocks;
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
    const out = [];
    for (const vy of p.spread) {
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
        vy,
        facing: owner.facing,
        age: 0,
        hits: 0,
        durability: p.durability,
        damageMul: owner.damageMul,
        lastHit: new Map(),
        vfx: p.vfx,
        palette: owner.def.palette,
        dead: false,
      };
      this.projectiles.push(proj);
      out.push(proj);
    }
    this.mech.onSpawnProjectile(owner, move, out);
    return out;
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
      if (p.def.gravity) p.vy += p.def.gravity * DT;
      p.x += p.vx * DT;
      p.y += p.vy * DT;
      p.age += 1;
      if (this.mech.projectileTick(p)) continue;
      const grounded = p.def.gravity && p.y > -8;
      if (grounded || p.age > p.def.lifetime || p.x < this.bounds.left - 200 || p.x > this.bounds.right + 200) {
        p.dead = true;
        this.vfx("projectile_fizzle", p.x, Math.min(p.y, -8), { facing: p.facing, side: p.side, vfx: p.vfx });
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
    for (const p of this.projectiles) {
      if (p.dead) continue;
      const box = this.projectileBox(p);
      for (const w of this.barriers) {
        if (w.side === p.side || w.dead || !overlaps(box, this.barrierBox(w))) continue;
        p.dead = true;
        w.projectiles -= 1;
        this.vfx("projectile_hit", p.x, p.y, { facing: p.facing, side: p.side, vfx: p.vfx });
        if (w.projectiles <= 0) this.breakBarrier(w);
        break;
      }
    }
    this.projectiles = this.projectiles.filter((p) => !p.dead);
  }

  // ------------------------------------------------------------------ barriers

  spawnBarrier(owner, move) {
    const b = move.barrier;
    this.barriers = this.barriers.filter((w) => w.ownerUid !== owner.uid);
    const w = {
      id: this.nextBarrierId++,
      ownerUid: owner.uid,
      ownerId: owner.id,
      side: owner.side,
      facing: owner.facing,
      x: Math.max(this.bounds.left, Math.min(this.bounds.right, owner.x + owner.facing * b.offset)),
      w: b.width,
      h: b.height,
      life: Math.round(b.lifetime * (owner.passiveDef?.objectLifetimeMul ?? 1)),
      maxLife: Math.round(b.lifetime * (owner.passiveDef?.objectLifetimeMul ?? 1)),
      strikes: b.strikes,
      projectiles: b.projectiles,
      palette: owner.def.palette,
      labId: owner.def.labId,
      vfx: b.vfx,
      hitBy: new Set(),
      dead: false,
    };
    this.barriers.push(w);
    this.emit("barrier", { fighter: owner.id, side: owner.side, x: w.x });
    this.vfx(b.vfx, w.x, -w.h / 2, { facing: owner.facing, side: owner.side, height: w.h });
    if (b.pulse) {
      const box = this.barrierBox(w);
      for (const d of this.fighters) {
        if (d.side === owner.side || d.invulnTo("strike")) continue;
        const pair = anyOverlap([{ x: box.x - 30, y: box.y, w: box.w + 60, h: box.h }], d.hurtboxes());
        if (!pair) continue;
        const props = { id: `${move.id}_pulse`, kind: "special", category: "special", damage: b.pulse.damage, chip: 4, hitstun: 18, blockstun: 14, hitstop: 8, knockback: b.pulse.knockback, level: "mid", knockdown: false, meterGain: 4, juggle: 1 };
        this.applyContact(owner, d, props, intersectionCenter(pair[0], pair[1]), { projectile: { x: w.x, vx: 0 }, dir: owner.facing });
      }
    }
    return w;
  }

  barrierBox(w) {
    return { x: w.x - w.w / 2, y: -w.h, w: w.w, h: w.h };
  }

  breakBarrier(w) {
    w.dead = true;
    this.vfx("barrier_break", w.x, -w.h / 2, { facing: w.facing, side: w.side });
  }

  updateBarriers() {
    for (const w of this.barriers) {
      w.life -= 1;
      if (w.life <= 0 && !w.dead) this.breakBarrier(w);
    }
    this.barriers = this.barriers.filter((w) => !w.dead);
  }

  // ------------------------------------------------------------------ runway

  updateRunway() {
    for (const s of this.sides) {
      const p = s.members[s.active];
      const busy = p.state === "run" || p.state === "block" || p.state === "crouch_block" || p.state === "blockstun";
      const enemy = this.point(1 - s.side);
      const underSuper = enemy.state === "attack" && enemy.move?.category === "super";
      if (busy || underSuper || this.frame - s.runwaySpentFrame < RULES.runwayDelay) continue;
      const mul = p.passiveDef?.runwayRegenMul ?? 1;
      s.runway = Math.min(RULES.runwayMax, s.runway + RULES.runwayRegen * mul * DT);
    }
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
    if (a.canFight && b.canFight && a.state !== "thrown" && b.state !== "thrown" && !a.isLying && !b.isLying && !a.passesThrough && !b.passesThrough) {
      resolvePush(a, b, left, right);
    }
    this.resolveWalls();
    const half = PHYS.maxSeparation / 2;
    if (a.canFight && b.canFight) {
      for (const f of [a, b]) {
        f.x = Math.max(prevMid - half, Math.min(prevMid + half, f.x));
      }
    }
  }

  /** Solid rects from entities: `solid: {x, y, w, h, platform?: true, wall?: false}` or a function returning rect(s). */
  solids() {
    const out = [];
    for (const sys of systems()) {
      const s = sys.solids?.(this.mech.ctx);
      if (Array.isArray(s)) out.push(...s);
      else if (s) out.push(s);
    }
    for (const e of this.entities) {
      if (e.dead || !e.solid) continue;
      const s = typeof e.solid === "function" ? e.solid(this) : e.solid;
      if (Array.isArray(s)) out.push(...s);
      else if (s) out.push(s);
    }
    return out;
  }

  /** Highest standable surface at or below the fighter's feet (stage floor is 0). */
  floorAt(f) {
    let floor = 0;
    for (const r of this.solids()) {
      if (r.platform === false || f.x < r.x || f.x > r.x + r.w) continue;
      if (r.y >= f.y - 2 && r.y < floor) floor = r.y;
    }
    return floor;
  }

  /** Push fighters out of `wall: true` solids horizontally. */
  resolveWalls() {
    for (const r of this.solids()) {
      if (!r.wall) continue;
      for (const f of this.fighters) {
        if (f.state === "bench" || f.passesThrough) continue;
        const hw = f.push.w / 2;
        if (f.y - f.push.h >= r.y + r.h || f.y <= r.y + 0.5) continue;
        if (f.x + hw <= r.x || f.x - hw >= r.x + r.w) continue;
        f.x = f.x < r.x + r.w / 2 ? r.x - hw : r.x + r.w + hw;
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
      const auto = d.passiveDef?.autoTechThrows ?? 0;
      if (m.grab.techable && (d.passive.autoTeched ?? 0) < auto) {
        d.passive.autoTeched = (d.passive.autoTeched ?? 0) + 1;
        this.techThrow(a, d);
        continue;
      }
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
      this.emit("throw", { attacker: a.id, defender: d.id, side: a.side, moveId: m.id, x: (a.x + d.x) / 2 });
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
    this.emit("tech", { fighter: d.id, side: d.side, x: (a.x + d.x) / 2 });
    this.emit("throwBreak", { fighter: d.id, side: d.side, x: (a.x + d.x) / 2 });
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
    this.emit("hit", { attacker: a.id, defender: d.id, side: a.side, moveId: g.move.id, kind: "throw", weight: "heavy", throw: true, damage: dealt, combo: 1, comboDamage: dealt, counter: false, level: "unblockable", x: d.x, y: -100 });
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
      if (this.strikeBarrier(a, idx, boxes)) continue;
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
      else if (h.a.parriedFrame !== this.frame) this.applyStrike(h.a, h.d, h.move, h.idx, h.at);
    }
  }

  /** An enemy barrier in the way soaks the strike. Returns true when absorbed. */
  strikeBarrier(a, idx, boxes) {
    for (const w of this.barriers) {
      if (w.side === a.side || w.dead) continue;
      const key = `${a.uid}:${a.move.id}:${a.moveFrame - idx}:${idx}`;
      if (w.hitBy.has(key)) continue;
      const box = this.barrierBox(w);
      if (!boxes.some((b) => overlaps(b, box))) continue;
      w.hitBy.add(key);
      w.strikes -= 1;
      for (const d of this.allFighters) if (d.side !== a.side) a.hitLog.set(d.uid, idx);
      a.connected = true;
      a.hitstop = 7;
      this.vfx("block", w.x, -120, { facing: a.facing, side: w.side, chip: 0 });
      if (w.strikes <= 0) this.breakBarrier(w);
      return true;
    }
    return false;
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
      damage: p.def.damage * (p.damageMul ?? 1),
      chip: p.def.chip,
      hitstun: p.def.hitstun,
      blockstun: p.def.blockstun,
      hitstop: p.def.hitstop,
      knockback: p.def.knockback,
      level: p.def.level,
      knockdown: isLast && p.def.knockdown,
      meterGain: p.def.meterGain,
      juggle: 2,
      special: p.category === "special",
    };
    this.applyContact(p.owner, d, props, at, { projectile: p, dir: p.facing });
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
      damage: move.damage * (a.damageMul ?? 1),
      chip: move.chip,
      hitstun: move.hitstun,
      blockstun: move.blockstun,
      hitstop: move.hitstop,
      knockback: over?.knockback ? { x: over.knockback.x ?? move.knockback.x, y: over.knockback.y ?? 0 } : move.knockback,
      level: move.level,
      knockdown: over?.knockdown ?? (isLast && move.knockdown),
      meterGain: move.meterGain,
      juggle: idx === 0 ? move.juggle : 0,
      special: move.category === "special",
    };
    const dir = d.x === a.x ? a.facing : Math.sign(d.x - a.x);
    this.applyContact(a, d, props, at, { dir, move, idx });
  }

  /** Damage multiplier from passives and team state for an attacker. */
  attackMultiplier(a, d, props, antiAir) {
    const team = this.sides[a.side];
    const ctx = { match: this, attacker: a, defender: d, props, team, antiAir };
    let mul = a.passiveDef?.damageMul?.(a, ctx) ?? 1;
    if (antiAir && a.passiveDef?.antiAir) mul *= a.passiveDef.antiAir.damage;
    if (team.lastStanding) mul *= RULES.lastStandingDamage;
    for (const h of a.mechanicHooks) mul *= h.damageMul?.(a, ctx) ?? 1;
    for (const h of d.mechanicHooks) mul *= h.damageTakenMul?.(d, ctx) ?? 1;
    return mul;
  }

  runHitHooks(a, d, props, blocked, damage) {
    const ctx = { match: this, attacker: a, defender: d, props, blocked, damage };
    const move = a.state === "attack" && a.move?.id === props.id ? a.move : null;
    moveMechanic(move)?.onHit?.(ctx);
    for (const h of a.mechanicHooks) h.onHit?.(ctx);
    for (const h of d.mechanicHooks) h.onHurt?.(ctx);
  }

  /** Shared hit/block logic for strikes and projectiles. */
  applyContact(a, d, props, at, { projectile = null, dir, move = null, idx = 0 }) {
    const as = this.sides[a.side];
    const ds = this.sides[d.side];
    const dEnv = this.envFor(d);
    const fromX = projectile ? projectile.x - projectile.vx * DT * 4 : a.x;
    const payloadBase = { attacker: a.id, defender: d.id, side: a.side, moveId: props.id, x: at.x, y: at.y };
    const meterMul = as.lastStanding ? RULES.lastStandingMeter : 1;

    if (d.state === "dazed" || (d.dazedPending && d.health <= 0)) {
      this.koFighter(d, a, dir);
      this.setPhase("ko");
      this.phaseFrame = 60;
      if (!projectile) a.connected = true;
      this.emit("hit", { ...payloadBase, kind: props.kind, damage: 0, combo: d.combo.hits + 1, comboDamage: d.combo.damage, counter: false, punish: false, level: props.level });
      this.vfx(`hit_${props.kind === "light" ? "light" : "heavy"}`, at.x, at.y, { facing: dir, side: a.side, damage: 0, palette: a.def.palette });
      return;
    }

    const airAttack = !projectile && a.airborne;
    if (this.mech.beforeContact(a, d, props, at, { projectile, dir, move, idx, level: airAttack && props.level !== "low" ? "overhead" : props.level })) {
      this.emit("absorb", { ...payloadBase, fighter: d.id });
      return;
    }
    const level = airAttack && props.level !== "low" ? "overhead" : props.level;

    if (!projectile && d.inParry && d.move.parry.levels.includes(level) && a.canFight) {
      this.parry(a, d, at);
      return;
    }

    if (d.hasArmor()) {
      d.armorHits += 1;
      const dealt = applyDamage(d, Math.round(props.damage * 0.5), { redRatio: this.tagMode ? RULES.redRatio : 0, floor: 1 });
      d.hitstop = 6;
      if (!projectile) {
        a.hitstop = 6;
        a.connected = true;
      }
      this.emit("hit", { ...payloadBase, kind: props.kind, damage: dealt, combo: 0, comboDamage: 0, counter: false, punish: false, level, armor: true });
      this.vfx("armor", at.x, at.y, { facing: dir, side: a.side, chip: dealt });
      return;
    }

    const guard = d.assistMode ? null : d.guardAgainst(fromX, dEnv);
    if (guard && guardBlocks(level, guard === "low")) {
      const window = d.passiveDef?.alignmentWindow?.(d) ?? RULES.alignmentWindow;
      const aligned = Boolean(dEnv.input?.pressedWithin(BTN.BLOCK, window + 1)) && d.state !== "blockstun";
      const chipMul = d.passiveDef?.chipTakenMul?.(d) ?? 1;
      const chip = aligned ? 0 : Math.round((props.chip || 0) * chipMul);
      const floor = props.category === "super" ? 0 : 1;
      const dealt = chip > 0 ? applyDamage(d, chip, { redRatio: 0, floor: Math.min(floor, d.health) }) : 0;
      d.setState("blockstun", { keepAnim: true });
      d.stun = Math.max(1, props.blockstun - (aligned ? RULES.alignmentBlockstunCut : 0));
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
      addMeter(as, RULES.blockMeterAttacker * meterMul);
      addMeter(ds, RULES.blockMeterDefender + (aligned ? RULES.alignmentMeter : 0));
      if (props.category === "special" || props.category === "super") d.passiveDef?.onBlockedSpecial?.(d, props.id);
      this.runHitHooks(a, d, props, true, dealt);
      this.emit("block", { ...payloadBase, chip: dealt, aligned });
      this.vfx(aligned ? "alignment_block" : "block", at.x, at.y, { facing: dir, side: a.side, chip: dealt });
      if (aligned) this.emit("alignmentBlock", { fighter: d.id, side: d.side });
      return;
    }

    const freshCombo = !d.isStunned;
    if (freshCombo) d.combo = { hits: 0, damage: 0 };
    d.combo.hits += 1;
    const counter = freshCombo && d.isAttacking;
    const punish = freshCombo && !counter && d.isRecovering;
    const isSuper = props.category === "super";
    const antiAir = !projectile && !a.airborne && (d.airborne || d.state === "juggle") && freshCombo;
    const scaleIndex = Math.max(1, d.combo.hits - (a.passiveDef?.scalingOffset ?? 0));
    let damage = scaledDamage(props.damage * this.attackMultiplier(a, d, props, antiAir), scaleIndex, { isSuper, counter });
    if (punish && d.combo.hits === 1) damage = Math.round(damage * RULES.punishBonus);
    if (d.assistMode) damage = Math.round(damage * RULES.assistDamageTaken);
    const dealt = d.assistMode
      ? applyDamage(d, damage, { redRatio: 1, floor: 1 })
      : applyDamage(d, damage, { redRatio: this.tagMode ? RULES.redRatio : 0, replaceRed: this.tagMode });
    d.combo.damage += dealt;
    if (props.special && !projectile?.owner?.assistMode && !a.assistMode) a.passiveDef?.onSpecialHit?.(a, props.id);
    const meter = meterOnHit(props, dealt);
    addMeter(as, isSuper ? 0 : meter.attacker * meterMul * (a.passiveDef?.meterGainMul?.(a, as) ?? 1));
    a.passiveDef?.onHitLanded?.(a, { defender: d, props });
    addMeter(ds, meter.defender);
    const stop = props.hitstop + (counter || punish ? 3 : 0);
    d.hitstop = stop;
    d.shake = stop;
    if (!projectile) {
      a.hitstop = stop;
      a.connected = true;
    }
    if (isSuper || props.kind === "heavy" || counter || punish) this.shakeFrames = Math.max(this.shakeFrames, isSuper ? 8 : 4);

    const wasCrouching = d.crouching;
    const wasAirborne = d.airborne || d.state === "juggle";
    if (d.assistMode) {
      d.hitstop = 0;
      d.regenPause = RULES.redRegenPause;
      this.sendAssistHome(d);
    } else {
      const launch = props.knockback.y > 0 || wasAirborne || props.knockdown;
      if (launch) {
        d.juggleCount += props.juggle;
        if (wasAirborne) d.juggleHits += 1;
        if (wasAirborne && d.juggleCount > RULES.maxJuggle) d.juggleLocked = true;
        d.setState("juggle", { keepAnim: true });
        d.setAnim("knockdown", !wasAirborne);
        const w = Math.sqrt(d.def.stats.weight || 1);
        const lift = props.knockback.y > 0 ? props.knockback.y : wasAirborne ? 520 : 320;
        d.vy = -lift / w;
        d.vx = dir * Math.max(90, props.knockback.x * 0.55) / w;
        d.y = Math.min(d.y, -2);
      } else {
        d.setState("hitstun", { keepAnim: true });
        d.stun = props.hitstun + (counter ? RULES.counterHitstun : 0) + (punish ? RULES.punishHitstun : 0) + (antiAir ? a.passiveDef?.antiAir?.hitstun ?? 0 : 0);
        d.stunAnim = wasCrouching || level === "low" ? "hit_low" : "hit_high";
        d.setAnim(d.stunAnim, true);
        d.vx = dir * props.knockback.x / Math.sqrt(d.def.stats.weight || 1);
        if (!projectile && this.atWall(d) && !a.airborne) a.vx = -a.facing * props.knockback.x * 0.75;
      }
      if (!d.airborne || d.state === "hitstun") d.facing = -dir;
    }

    this.runHitHooks(a, d, props, false, dealt);
    const weight = props.kind === "light" ? "light" : props.category === "normal" || props.category === "throw" ? "heavy" : props.category === "super" ? "super" : "special";
    this.emit("hit", { ...payloadBase, kind: props.kind, weight, damage: dealt, combo: d.combo.hits, comboDamage: d.combo.damage, counter, punish, level, maxHealth: d.maxHealth });
    const type = isSuper ? "hit_super" : props.category === "special" || props.kind === "projectile" ? "hit_special" : props.kind === "light" ? "hit_light" : "hit_heavy";
    this.vfx(type, at.x, at.y, { facing: dir, side: a.side, damage: dealt, counter, punish, level, combo: d.combo.hits, palette: a.def.palette });
    if (counter || punish) this.vfx("counter", at.x, at.y - 30, { facing: dir, side: a.side, punish });
    this.mech.onHit(a, d, props, { projectile, move, idx, counter, punish });
  }

  parry(a, d, at) {
    const p = d.move.parry;
    d.aslLevel = Math.min(p.maxLevel, d.aslLevel + 1);
    a.parriedFrame = this.frame;
    a.pendingMove = null;
    a.setState("hitstun", { keepAnim: true });
    a.stun = p.lock;
    a.stunAnim = "hit_high";
    a.setAnim("hit_high", true);
    a.vx = 0;
    a.combo = { hits: 0, damage: 0 };
    d.faceToward(a);
    d.startMove(p.counter, this.envFor(d));
    d.damageMul = 1 + p.levelBonus * d.aslLevel;
    a.hitstop = 10;
    d.hitstop = 10;
    this.emit("parry", { fighter: d.id, side: d.side, attacker: a.id, level: d.aslLevel });
    this.vfx("parry", at.x, at.y, { facing: d.facing, side: d.side, level: d.aslLevel });
  }

  guardrail(defender) {
    const attacker = this.point(1 - defender.side);
    const dir = Math.sign(attacker.x - defender.x) || -defender.facing;
    if (attacker.canFight && !attacker.airborne) {
      attacker.vx = dir * RULES.guardrailPush;
      if (attacker.state === "attack") attacker.pendingMove = null;
    }
    defender.stun = Math.min(defender.stun, 2);
    defender.vx = -dir * 60;
    this.emit("guardrail", { fighter: defender.id, side: defender.side });
    this.vfx("guardrail", defender.x + dir * 40, defender.y - 110, { facing: dir, side: defender.side });
  }

  chipFloor(d) {
    return d.assistMode ? 1 : 0;
  }

  // ------------------------------------------------------------------ KO, finish, round end

  koFighter(f, by, dir = null, double = false) {
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
    this.emit("ko", { fighter: f.id, side: f.side, by: by?.id ?? null, round: this.round, x: f.x, double });
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
        s.lastStanding = true;
        this.emit("lastStanding", { side: f.side, fighter: s.members.find((m) => m !== f).id });
      } else {
        defeated[f.side] = true;
      }
    }
    if (defeated[0] && defeated[1]) {
      this.startSlowmo(0.35, 45);
      for (const f of downed) this.koFighter(f, this.point(1 - f.side), null, true);
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
      this.say("FINAL COMMIT!", `${this.point(winnerSide).def.finisher.input}`, 150);
      this.startSlowmo(0.4, 40);
      this.emit("finishThem", { side: winnerSide, fighter: this.point(winnerSide).id, x: loser.x });
    } else {
      this.startSlowmo(0.35, 45);
      this.koFighter(loser, this.point(winnerSide));
      this.say("K.O.", "", 120);
      this.setPhase("ko");
    }
  }

  /** Engine-owned slow motion: `rate` is the game-time multiplier for `frames` simulated frames. */
  startSlowmo(rate, frames) {
    this.slowmo = { rate, frames, seconds: frames / 60 / rate };
    this.emit("slowmo", { active: true, rate, seconds: this.slowmo.seconds });
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
    const matchOver = this.sides.some((s) => s.wins >= this.roundsToWin) || this.round >= 9;
    const winnerLab = winner !== null ? this.point(winner).def.labId : null;
    this.emit("roundEnd", { round: this.round, winner, reason: winner === null ? "draw" : reason, wins: this.sides.map((s) => s.wins), perfect, matchOver, matchWinner: matchOver ? winner : null, winnerLab });
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
    this.emit("matchEnd", { winner: this.winner, wins: this.sides.map((s) => s.wins), winnerLab: this.winner !== null ? this.point(this.winner).def.labId : null });
  }

  // ------------------------------------------------------------------ combo breaker

  comboBreaker(victim) {
    const s = this.sides[victim.side];
    const cost = victim.passiveDef?.breakerCost ?? RULES.breakerCost;
    if (s.breakerUsed || s.meter < cost) return;
    s.meter -= cost;
    s.runway = 0;
    s.runwaySpentFrame = this.frame;
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
      attacker.stun = 14;
      attacker.stunAnim = "hit_high";
      attacker.setAnim("hit_high", true);
      attacker.vx = dir * RULES.breakerPush;
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
      if (s.assistCooldown > 0 && !s.assist) s.assistCooldown -= 1;
      for (const m of s.members) {
        if (m.regenPause > 0) m.regenPause -= 1;
        else if (!m.onField && !m.ko) regenRed(m, DT);
      }
      if (!this.tagMode) continue;
      if (s.forcedTagIn > 0) {
        s.forcedTagIn -= 1;
        if (s.forcedTagIn === 0) this.forceTag(s);
        continue;
      }
      if (this.phase !== "fight") {
        s.tagHold = 0;
        continue;
      }
      this.tagInput(s);
    }
  }

  partnerReady(s) {
    const partner = s.members[1 - s.active];
    return Boolean(partner && !partner.ko && partner.health > 0 && !partner.onField);
  }

  /** TAG tap = assist (B+TAG = assist B), TAG held 10 f = hand-off, TAG+BLK in blockstun = Swap Guard. */
  tagInput(s) {
    const b = s.input;
    const point = s.members[s.active];
    const ready = this.partnerReady(s);
    const canAssist = ready && s.assistCooldown === 0 && !s.lastStanding && point.canFight;
    if (b.pressedNow(BTN.ASSIST) && canAssist) {
      this.callAssist(s, isBack(b.dir(point.facing)) ? "b" : "a");
      return;
    }
    if (b.pressedNow(BTN.TAG)) {
      s.tagHold = 1;
      s.tagHoldBack = isBack(b.dir(point.facing));
      s.tagHandled = false;
      if (point.state === "blockstun" && b.held(BTN.BLOCK) && ready && !s.lastStanding && s.meter >= RULES.swapGuardCost && s.runway >= RULES.swapGuardRunway) {
        s.meter -= RULES.swapGuardCost;
        s.runway -= RULES.swapGuardRunway;
        s.runwaySpentFrame = this.frame;
        s.tagHandled = true;
        this.tag(s, false, { swapGuard: true });
      } else if (point.state === "attack" && point.move?.category === "special" && point.connected && ready && s.meter >= RULES.handoffCancelCost) {
        s.meter -= RULES.handoffCancelCost;
        s.tagHandled = true;
        this.tag(s, false, { cancel: true });
      }
      return;
    }
    if (s.tagHold > 0 && b.held(BTN.TAG)) {
      s.tagHold += 1;
      const free = point.isNeutral || point.state === "run";
      if (!s.tagHandled && s.tagHold >= RULES.tagHoldFrames && free && ready && s.tagCooldown === 0) {
        s.tagHandled = true;
        this.tag(s, false);
      }
      return;
    }
    if (s.tagHold > 0) {
      if (!s.tagHandled && s.tagHold < RULES.tagHoldFrames && canAssist) this.callAssist(s, s.tagHoldBack ? "b" : "a");
      s.tagHold = 0;
    }
  }

  offscreenX(s, behindOf) {
    const enemy = this.point(1 - s.side);
    const away = behindOf.x <= enemy.x ? -1 : 1;
    return behindOf.x + away * 700;
  }

  tag(s, forced, { swapGuard = false, cancel = false } = {}) {
    const out = s.members[s.active];
    const incoming = s.members[1 - s.active];
    const enemy = this.point(1 - s.side);
    const fromX = this.offscreenX(s, out);
    const toX = out.x;
    s.active = 1 - s.active;
    s.tagCooldown = RULES.tagCooldown;
    if (!out.ko) {
      out.pendingMove = null;
      out.script = { fromX: out.x, toX: fromX, frames: 22, arc: 60 };
      out.setState("tag_out");
    }
    const { health, red } = incoming;
    incoming.reset(fromX, enemy.x >= toX ? 1 : -1);
    incoming.health = health;
    incoming.red = swapGuard ? red / 2 : red;
    incoming.onField = true;
    const cut = incoming.passiveDef?.tagEntryCut ?? 0;
    incoming.script = { fromX, toX, frames: (cancel ? 14 : swapGuard ? 18 : 24) - cut, arc: 170 };
    incoming.entryMove = swapGuard ? incoming.def.moves.get(incoming.def.assists.a) : null;
    incoming.entryInvuln = forced || swapGuard;
    incoming.setState("tag_in");
    if (!incoming.entryInvuln && incoming.def.tagEntry) {
      incoming.move = incoming.def.tagEntry;
      incoming.moveFrame = 0;
      incoming.hitLog = new Map();
      incoming.connected = false;
      incoming.damageMul = 1;
    }
    this.emit("tag", { side: s.side, out: out.id, in: incoming.id, forced, swapGuard, cancel, x: toX });
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

  callAssist(s, which = "a") {
    const point = s.members[s.active];
    const partner = s.members[1 - s.active];
    const enemy = this.point(1 - s.side);
    const facing = enemy.x >= point.x ? 1 : -1;
    const fromX = this.offscreenX(s, point);
    const { health, red } = partner;
    partner.reset(fromX, facing);
    partner.health = health;
    partner.red = red;
    partner.assistMode = true;
    partner.assistMove = partner.def.assists[which] || partner.def.assists.a;
    partner.onField = true;
    partner.script = { fromX, toX: point.x - facing * 70, frames: 20, arc: 130 };
    partner.setState("assist_in");
    s.assist = partner;
    s.assistCooldown = RULES.assistCooldown;
    this.emit("assist", { side: s.side, fighter: partner.id, assist: which, moveId: partner.assistMove });
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
    if (s.assist === f) {
      s.assist = null;
      const p = f.passiveDef;
      s.assistCooldown = Math.round(RULES.assistCooldown * (p?.assistCooldownMul ?? 1) + (p?.assistCooldownAdd ?? 0));
    }
  }

  // ------------------------------------------------------------------ entities (mechanics)

  /** Generic entity for character mechanics: `{ side, update(match) -> false to remove, draw?(ctx) }`. */
  spawnEntity(entity) {
    const e = { id: this.nextBarrierId++, dead: false, ...entity };
    this.entities.push(e);
    return e;
  }

  updateEntities() {
    for (const e of this.entities) {
      if (e.dead) continue;
      if (e.update?.(this) === false) e.dead = true;
    }
    this.entities = this.entities.filter((e) => !e.dead);
  }

  /**
   * Forward atlas frame events as `animEvent { type, anim, x, fighter, side, frame }` when a
   * fighter's displayed frame changes. Fighters without atlas events get footsteps on the
   * contact frames (0 and n/2) of walk and run cycles.
   */
  emitFrameEvents() {
    for (const f of this.fighters) {
      const anim = f.drawAnim;
      const def = f.atlas?.animations?.[anim];
      const idx = def ? f.frameIndex() : Math.floor(f.anim.t) % 8;
      const key = `${anim}:${idx}`;
      if (f.lastFrameKey === key) continue;
      const entered = !f.lastFrameKey || !f.lastFrameKey.startsWith(`${anim}:`);
      f.lastFrameKey = key;
      const types = [];
      if (def) {
        for (const e of def.events || []) if (e.frame === idx && e.type !== "hit" && e.type !== "active") types.push(e.type);
        for (const e of def.frames?.[idx]?.events || []) if (e.type !== "hit" && e.type !== "active") types.push(e.type);
      }
      const locomotion = anim === "walk_fwd" || anim === "walk_back" || anim === "run";
      const n = def?.frames?.length || 8;
      const hasEvents = def && ((def.events || []).length || (def.frames || []).some((fr) => fr.events?.length));
      if (locomotion && !hasEvents && (idx === 0 || idx === Math.floor(n / 2)) && !entered) types.push("step");
      for (const type of types) this.emit("animEvent", { type, anim, x: f.x, fighter: f.id, side: f.side, frame: idx, run: anim === "run" });
    }
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
          runway: Math.round(s.runway),
          runwayMax: RULES.runwayMax,
          breakerUsed: s.breakerUsed,
          lastCheckpoint: !s.lastCheckpointUsed,
          lastStanding: s.lastStanding,
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
            aslLevel: m.aslLevel,
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
        anim: f.drawAnim,
        frame: f.frameIndex(),
        character: f.id,
        health: Math.max(0, Math.round(f.health)),
        maxHealth: f.maxHealth,
        airborne: f.airborne,
        hitstun: f.isStunned,
        invuln: f.invulnTo("strike"),
        hidden: f.hidden,
        assist: f.assistMode,
        moveId: f.state === "attack" ? f.move?.id ?? null : null,
      })),
      mechanics: this.mech.snapshot(),
      entities: this.entities.length,
      slowmo: this.slowmo ? { rate: this.slowmo.rate } : null,
      barriers: this.barriers.map((w) => ({ id: w.id, side: w.side, owner: w.ownerId, x: w.x, w: w.w, h: w.h, life: w.life, maxLife: w.maxLife })),
      winner: this.winner,
    };
  }
}

export function createMatch(opts) {
  return new Match(opts).start();
}
