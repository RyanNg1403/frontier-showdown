import { ATTACK_BUTTONS, BTN, DT, PHYS, RULES } from "./constants.js";
import { isBack, isDown, isFwd, isUp, matchDoubleTap, matchMotion } from "./input.js";
import { DEFAULT_HURTBOXES, DEFAULT_PUSHBOX, toWorld } from "./boxes.js";
import { LOCOMOTION, attackFrameIndex, cycleFrameIndex, resolveAnim } from "./anim.js";
import { passiveFor } from "./passives.js";
import { fighterMechanics, moveMechanic } from "./mechanics.js";

const NEUTRAL = new Set(["idle", "walk_fwd", "walk_back", "crouch", "block", "crouch_block"]);
const STUNNED = new Set(["hitstun", "juggle"]);
const CROUCHING = new Set(["crouch", "crouch_block"]);
const LYING = new Set(["knockdown", "getup", "ko"]);
const SCRIPTED = new Set(["tag_in", "tag_out", "assist_in", "assist_out"]);
const OFF_FIELD = "bench";

const STATE_ANIMS = {
  idle: "idle",
  walk_fwd: "walk_fwd",
  walk_back: "walk_back",
  crouch: "crouch",
  block: "block",
  crouch_block: "crouch_block",
  run: "run",
  dash_fwd: "dash_fwd",
  dash_back: "dash_back",
  jump_start: "jump_start",
  jump: "jump_air",
  jump_land: "jump_land",
  throwing: "throw",
  thrown: "thrown",
  tech: "block",
  breaker: "block",
  juggle: "knockdown",
  knockdown: "knockdown",
  getup: "getup",
  roll: "dash_back",
  ko: "ko",
  dazed: "dazed",
  finisher: "finisher",
  finished: "finished",
  victory: "victory",
  intro: "intro",
  tag_in: "tag_in",
  tag_out: "tag_out",
  assist_in: "tag_in",
  assist_out: "tag_out",
  bench: "idle",
};

const NORMAL_BY_BUTTON = [
  [BTN.HK, "hk"],
  [BTN.HP, "hp"],
  [BTN.LK, "lk"],
  [BTN.LP, "lp"],
];
const BUTTON_NAME = [
  [BTN.HP, "HP"],
  [BTN.HK, "HK"],
  [BTN.LP, "LP"],
  [BTN.LK, "LK"],
];

let nextUid = 1;

export class Fighter {
  constructor(def, { side = 0, slot = 0, atlas = null } = {}) {
    this.def = def;
    this.id = def.id;
    this.uid = nextUid++;
    this.side = side;
    this.slot = slot;
    this.atlas = atlas;
    this.maxHealth = def.stats.health;
    this.passiveDef = passiveFor(def);
    this.reset(0, 1);
  }

  reset(x, facing) {
    this.x = x;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.facing = facing;
    this.health = this.maxHealth;
    this.red = 0;
    this.state = "idle";
    this.stateFrame = 0;
    this.move = null;
    this.moveFrame = 0;
    this.connected = false;
    this.hitLog = new Map();
    this.hitstop = 0;
    this.stun = 0;
    this.stunAnim = "hit_high";
    this.juggleCount = 0;
    this.juggleHits = 0;
    this.juggleLocked = false;
    this.combo = { hits: 0, damage: 0 };
    this.invulnFrames = 0;
    this.strikeInvulnFrames = 0;
    this.throwInvuln = 0;
    this.airAttackUsed = false;
    this.landingRecovery = 0;
    this.pendingMove = null;
    this.armorHits = 0;
    this.grab = null;
    this.script = null;
    this.ko = false;
    this.onField = true;
    this.assistMode = false;
    this.knockdownLength = RULES.knockdownFrames;
    this.delayedWakeupUsed = false;
    this.anim = { name: "idle", t: 0 };
    this.lastDx = 0;
    this.shake = 0;
    this.dazedPending = false;
    this.pendingLanding = null;
    this.jumpDir = 0;
    this.runJump = false;
    this.hidden = false;
    this.aslLevel = 0;
    this.damageMul = 1;
    this.regenPause = 0;
    this.passive = {};
    this.mech = {};
    this.noBlockFrames = 0;
    this.chainCount = 0;
    this.entryInvuln = false;
  }

  /** Fighter-level mechanic hooks from `def.mechanics` (see mechanics.js). */
  get mechanicHooks() {
    if (!this._mechanicHooks) this._mechanicHooks = fighterMechanics(this.def);
    return this._mechanicHooks;
  }

  // ------------------------------------------------------------------ queries

  get airborne() {
    return this.y < -0.01 || this.vy < 0;
  }

  get crouching() {
    return CROUCHING.has(this.state) || (this.state === "attack" && this.move?.id.startsWith("c_")) ||
      (this.state === "blockstun" && this.stunAnim === "crouch_block") || this.state === "jump_start";
  }

  get isNeutral() {
    return NEUTRAL.has(this.state);
  }

  get isStunned() {
    return STUNNED.has(this.state);
  }

  get isLying() {
    return LYING.has(this.state);
  }

  get canFight() {
    return this.onField && !this.ko && !SCRIPTED.has(this.state) && this.state !== OFF_FIELD;
  }

  /** In the startup or active part of an attack (counter-hit window). */
  get isAttacking() {
    return (this.state === "attack" && this.move && this.moveFrame < this.move.startup + this.move.active) || this.state === "throwing";
  }

  /** In the recovery of an attack, or landing from one (punish-counter window). */
  get isRecovering() {
    if (this.state === "attack" && this.move) return this.moveFrame >= this.move.startup + this.move.active;
    return this.state === "jump_land" && this.landingRecovery > 3;
  }

  get inParry() {
    const p = this.state === "attack" ? this.move?.parry : null;
    return Boolean(p && this.moveFrame >= p.from && this.moveFrame <= p.to);
  }

  invulnTo(kind) {
    if (!this.onField || this.ko || this.state === OFF_FIELD) return true;
    if (this.isLying || this.state === "thrown" || this.state === "tech" || this.state === "finisher" || this.state === "finished" || this.state === "roll") return true;
    if (SCRIPTED.has(this.state) && this.state !== "assist_in" && !(this.state === "tag_in" && !this.entryInvuln)) return true;
    if (this.invulnFrames > 0 || this.hidden || this.juggleLocked) return true;
    if (this.strikeInvulnFrames > 0 && kind !== "throw") return true;
    if (kind === "throw") {
      if (this.throwInvuln > 0 || this.airborne || this.isStunned || this.state === "blockstun" || this.state === "jump_start") return true;
    }
    const inv = this.state === "attack" ? this.move?.invuln : null;
    if (inv && this.moveFrame >= inv.from && this.moveFrame <= inv.to) {
      if (inv.type === "all" || inv.type === kind) return true;
      if (inv.type === "strike" && kind === "projectile") return true;
    }
    return false;
  }

  hasArmor() {
    const a = this.state === "attack" ? this.move?.armor : null;
    return Boolean(a && this.moveFrame >= a.from && this.moveFrame <= a.to && this.armorHits < a.hits);
  }

  pushbox() {
    const p = this.def.pushbox || DEFAULT_PUSHBOX;
    if (this.airborne) return p.air || DEFAULT_PUSHBOX.air;
    if (this.crouching) return p.crouch || DEFAULT_PUSHBOX.crouch;
    return p.stand || DEFAULT_PUSHBOX.stand;
  }

  get push() {
    return this.pushbox();
  }

  localHurtboxes() {
    const set = this.def.hurtboxes || DEFAULT_HURTBOXES;
    const frameBoxes = this.atlasFrameBoxes("hurtboxes");
    if (frameBoxes) return frameBoxes;
    if (this.isLying) return set.down || DEFAULT_HURTBOXES.down;
    if (this.airborne) return set.air || DEFAULT_HURTBOXES.air;
    if (this.crouching) return set.crouch || DEFAULT_HURTBOXES.crouch;
    return set.stand || DEFAULT_HURTBOXES.stand;
  }

  hurtboxes() {
    const boxes = this.localHurtboxes().map((b) => toWorld(b, this.x, this.y, this.facing));
    const m = this.state === "attack" ? this.move : null;
    if (m?.hitbox && !m.projectile && !m.grab && !m.parry && this.moveFrame >= m.startup) {
      const hb = m.hitbox;
      const ext = { x: hb.x, y: hb.y + 4, w: Math.max(8, hb.w - 12), h: Math.max(8, hb.h - 8) };
      boxes.push(toWorld(ext, this.x, this.y, this.facing));
    }
    return boxes;
  }

  /** Index of the active hit within a multi-hit move, or -1 when not active. */
  activeHitIndex() {
    const m = this.move;
    if ((this.state !== "attack" && this.state !== "tag_in") || !m || !m.hitbox || m.projectile || m.grab || m.parry || this.hidden) return -1;
    const f = this.moveFrame;
    if (f < m.startup || f >= m.startup + m.active) return -1;
    return Math.min(m.hits - 1, Math.floor((f - m.startup) / m.hitInterval));
  }

  hitboxes() {
    if (this.activeHitIndex() < 0) return [];
    const frameBoxes = this.atlasFrameBoxes("hitboxes");
    const local = frameBoxes || [this.move.hitbox];
    return local.map((b) => toWorld(b, this.x, this.y, this.facing));
  }

  atlasFrameBoxes(kind) {
    const frame = this.atlasFrame;
    return frame && Array.isArray(frame[kind]) && frame[kind].length ? frame[kind] : null;
  }

  /** Atlas animation actually drawn (after fallbacks). */
  get drawAnim() {
    return resolveAnim(this.atlas, this.anim.name);
  }

  frameIndex() {
    const name = this.drawAnim;
    const def = this.atlas?.animations?.[name];
    if (!def) return 0;
    if (this.state === "attack" && this.move && this.anim.name === this.move.anim) {
      return attackFrameIndex(def, this.move, this.moveFrame);
    }
    return cycleFrameIndex(def, this.anim.t, name);
  }

  get atlasFrame() {
    const def = this.atlas?.animations?.[this.drawAnim];
    return def ? def.frames[this.frameIndex()] : null;
  }

  /** Locomotion speed: the atlas `strideSpeed` when present, so feet never slide. */
  locomotionSpeed(animName) {
    const stride = this.atlas?.animations?.[animName]?.strideSpeed;
    if (Number.isFinite(stride) && stride > 0) return stride;
    const s = this.def.stats;
    if (animName === "walk_back") return s.backWalkSpeed;
    if (animName === "run") return s.runSpeed;
    return s.walkSpeed;
  }

  // ------------------------------------------------------------------ state changes

  setState(name, { keepAnim = false } = {}) {
    const changed = this.state !== name;
    this.state = name;
    this.stateFrame = 0;
    if (name !== "attack") {
      this.move = null;
      this.hidden = false;
    }
    if (!keepAnim) this.setAnim(STATE_ANIMS[name] || name, changed);
  }

  setAnim(name, restart = true) {
    if (this.anim.name !== name || restart) this.anim = { name, t: 0 };
  }

  /** Enter a neutral state without restarting a looping animation that is already playing. */
  setNeutral(name) {
    if (this.state !== name) {
      this.state = name;
      this.stateFrame = 0;
      this.move = null;
      this.hidden = false;
      const anim = STATE_ANIMS[name];
      if (this.anim.name !== anim) this.anim = { name: anim, t: 0 };
    }
  }

  faceToward(target) {
    if (!target || this.airborne) return;
    const dx = target.x - this.x;
    if (Math.abs(dx) > 2) this.facing = dx > 0 ? 1 : -1;
  }

  toNeutral(env) {
    this.vy = 0;
    this.y = Math.min(0, this.y);
    if (this.dazedPending) {
      this.vx = 0;
      this.setState("dazed");
      return;
    }
    if (this.assistMode) {
      env.endAssist?.(this);
      return;
    }
    const d = env.input ? env.input.dir(this.facing) : 5;
    this.setState(isDown(d) ? "crouch" : "idle");
  }

  canSuper(env, sup) {
    const team = env.team;
    if (team.meter >= sup.meterCost) return true;
    return !team.lastCheckpointUsed && this.health / this.maxHealth < RULES.lastCheckpointHealth;
  }

  startMove(move, env, { cancel = false } = {}) {
    if (move.category === "super") {
      if (env.team.meter >= move.meterCost) {
        env.team.meter -= move.meterCost;
      } else {
        env.team.lastCheckpointUsed = true;
        env.emit("lastCheckpoint", { fighter: this.id, side: this.side });
      }
      env.freeze?.(move.freeze, this);
      env.emit("super", { fighter: this.id, side: this.side, moveId: move.id, name: move.name, x: this.x });
      env.vfx("super_flash", this.x, this.y - 120, { characterId: this.id, palette: this.def.palette });
    } else if (move.category === "special") {
      env.emit("special", { fighter: this.id, side: this.side, moveId: move.id, name: move.name, button: move.button, assist: this.assistMode, x: this.x });
    }
    if (move.category === "special" || move.category === "super") {
      env.vfx("special_cast", this.x + this.facing * 50, this.y - 120, { characterId: this.id, moveId: move.id, vfx: move.vfx, palette: this.def.palette });
    }
    env.input?.consume();
    this.chainCount = cancel && this.move?.id === move.id ? this.chainCount + 1 : 1;
    if (move.hitbox && !move.grab && !move.parry) {
      env.emit("attack", { fighter: this.id, side: this.side, moveId: move.id, kind: move.kind, weight: move.kind === "light" ? "light" : move.category === "normal" ? "heavy" : move.category, x: this.x });
    }
    const keepVx = this.state === "run" ? this.vx * 0.5 : 0;
    this.setState("attack", { keepAnim: true });
    this.move = move;
    this.moveFrame = 1;
    this.connected = false;
    this.hitLog = new Map();
    this.armorHits = 0;
    this.pendingMove = null;
    this.damageMul = this.assistMode ? RULES.assistDamageScale : 1;
    this.anim = { name: move.anim, t: 0 };
    if (!this.airborne) this.vx = keepVx;
    if (move.air) this.airAttackUsed = true;
    if (cancel) env.vfx("dust_dash", this.x, this.y, {});
    moveMechanic(move)?.onStart?.(this, move, env);
    for (const h of this.mechanicHooks) h.onMoveStart?.(this, move, env);
  }

  // ------------------------------------------------------------------ per-frame update

  update(env) {
    if (this.hitstop > 0) {
      this.hitstop -= 1;
      if (this.state === "attack" && this.connected && !this.pendingMove && env.canAct) {
        this.pendingMove = this.findCancel(env);
        if (this.pendingMove) env.input?.consume();
      }
      return;
    }
    if (this.invulnFrames > 0) this.invulnFrames -= 1;
    if (this.strikeInvulnFrames > 0) this.strikeInvulnFrames -= 1;
    if (this.throwInvuln > 0) this.throwInvuln -= 1;
    if (this.noBlockFrames > 0) this.noBlockFrames -= 1;
    if (this.shake > 0) this.shake -= 1;
    for (const h of this.mechanicHooks) h.update?.(this, env);
    this.stateFrame += 1;
    const x0 = this.x;
    const handler = this[`st_${this.state}`];
    if (handler) handler.call(this, env);
    if (!SCRIPTED.has(this.state) && this.state !== OFF_FIELD) this.integrate(env);
    this.lastDx = this.x - x0;
    this.advanceAnim();
  }

  integrate(env) {
    let g = PHYS.gravity * (this.def.stats.weight || 1);
    if (this.state === "juggle") g *= 1 + RULES.juggleGravityStep * this.juggleHits;
    const lockedVy = this.velocityWindow()?.vy !== undefined;
    if (this.airborne || this.y < 0) {
      if (!lockedVy) this.vy += g * DT;
    } else if (this.friction) {
      const dec = PHYS.groundFriction * DT;
      this.vx = Math.abs(this.vx) <= dec ? 0 : this.vx - Math.sign(this.vx) * dec;
    }
    this.x += this.vx * DT;
    this.y += this.vy * DT;
    if (this.y >= 0 && (this.vy > 0 || this.y > 0)) {
      const wasAir = this.y > 0 || this.vy > 0;
      this.y = 0;
      const impact = this.vy;
      this.vy = 0;
      if (wasAir) this.land(env, impact);
    }
  }

  get friction() {
    return !(["walk_fwd", "walk_back", "run", "dash_fwd", "dash_back", "roll"].includes(this.state)) && !this.velocityWindow();
  }

  velocityWindow() {
    if (this.state !== "attack" || !this.move) return null;
    for (const v of this.move.velocity) {
      if (this.moveFrame >= v.from && this.moveFrame <= v.to) return v;
    }
    return null;
  }

  land(env, impact) {
    switch (this.state) {
      case "jump":
        this.vx = 0;
        env.emit("land", { fighter: this.id, side: this.side, x: this.x });
        this.setState("jump_land");
        this.landingRecovery = this.pendingLanding ?? 3;
        this.pendingLanding = null;
        env.vfx("dust_land", this.x, 0, { facing: this.facing, side: this.side });
        break;
      case "attack":
        if (this.move?.air || this.move?.velocity.some((v) => v.vy !== undefined)) {
          this.vx = 0;
          const rec = this.move.landingRecovery;
          env.emit("land", { fighter: this.id, side: this.side, x: this.x });
          this.setState("jump_land");
          this.landingRecovery = rec;
          env.vfx("dust_land", this.x, 0, { facing: this.facing, side: this.side });
        }
        break;
      case "juggle":
        this.vx *= 0.3;
        this.juggleCount = 0;
        this.juggleHits = 0;
        this.juggleLocked = false;
        this.delayedWakeupUsed = false;
        this.setState("knockdown", { keepAnim: true });
        this.knockdownLength = RULES.knockdownFrames;
        this.passiveDef?.onKnockdown?.(this);
        env.emit("knockdown", { fighter: this.id, side: this.side, x: this.x });
        env.vfx("knockdown_impact", this.x, 0, { facing: this.facing, side: this.side, impact });
        env.shake?.(4);
        break;
      case "ko":
        this.vx *= 0.25;
        env.vfx("knockdown_impact", this.x, 0, { facing: this.facing, side: this.side, impact });
        env.shake?.(6);
        break;
      case "breaker":
        this.toNeutral(env);
        break;
      default:
        break;
    }
  }

  advanceAnim() {
    const name = this.anim.name;
    const def = this.atlas?.animations?.[name];
    const fps = def?.fps || 10;
    if (LOCOMOTION.has(name)) {
      const speed = this.locomotionSpeed(name);
      const moved = Math.abs(this.lastDx);
      const expected = speed * DT;
      const pushing = moved < expected * 0.25;
      const ratio = pushing ? 1 : moved / expected;
      this.anim.t += ratio * fps * DT;
    } else if (this.state !== "attack") {
      this.anim.t += fps * DT;
    }
  }

  // ------------------------------------------------------------------ actions

  throwInput(b) {
    if (!b) return false;
    const both = BTN.LP | BTN.LK;
    return (b.current.buttons & both) === both && Boolean(b.findPress(both, 3));
  }

  allowedBy(filter, move) {
    if (!filter) return true;
    if (move.kind === "light" && move.id === this.move?.id && this.chainCount >= 2) return false;
    if (filter.includes(move.id)) return true;
    if (move.category === "special" && filter.includes("special")) return true;
    if (move.category === "super" && filter.includes("super")) return true;
    return false;
  }

  /** Pick the button-specific variant of a special (LP/HP, LK/HK) from the press that triggered it. */
  variantFor(move, b, pressAge) {
    if (!move.variants) return move;
    const pressed = b.at(pressAge)?.pressed ?? 0;
    for (const [bit, name] of BUTTON_NAME) {
      if (pressed & bit && move.variants[name]) return move.variants[name];
    }
    return move;
  }

  /** Find the move the current inputs ask for. `filter` restricts to cancel targets. */
  pickMove(env, { filter = null, normals = true, throws = true } = {}) {
    const b = env.input;
    if (!b) return null;
    const def = this.def;
    const air = this.airborne;
    const sup = def.super;
    if (sup && (!air || sup.air) && this.allowedBy(filter, sup) && this.canSuper(env, sup)) {
      const age = matchMotion(b, sup.motion, this.facing);
      if (age >= 0) return sup;
    }
    for (const sp of def.specialsByRank) {
      if (air && !sp.air) continue;
      if (!this.allowedBy(filter, sp)) continue;
      if (sp.projectile && env.hasProjectile?.(this)) continue;
      const age = matchMotion(b, sp.motion, this.facing);
      if (age >= 0) return this.variantFor(sp, b, age);
    }
    if (throws && !air && !filter && this.throwInput(b)) return def.throw;
    if (!normals) return null;
    const press = b.findPress(ATTACK_BUTTONS);
    if (!press) return null;
    const d = b.dir(this.facing);
    for (const [bit, key] of NORMAL_BY_BUTTON) {
      if (!(press.entry.pressed & bit)) continue;
      let move;
      if (air) {
        if (this.airAttackUsed) return null;
        move = def.normals[bit === BTN.LP || bit === BTN.HP ? "j_p" : "j_k"];
      } else if (isDown(d)) {
        move = def.normals[`c_${key}`];
      } else if (isFwd(d) && def.normals[`f_${key}`]) {
        move = def.normals[`f_${key}`];
      } else if (isBack(d) && def.normals[`b_${key}`]) {
        move = def.normals[`b_${key}`];
      }
      move = move || def.normals[key];
      if (move && this.allowedBy(filter, move)) return move;
    }
    return null;
  }

  tryAct(env, opts) {
    if (!env.canAct || !env.input) return false;
    const move = this.pickMove(env, opts);
    if (!move) return false;
    this.startMove(move, env, { cancel: Boolean(opts?.filter) });
    return true;
  }

  findCancel(env) {
    const m = this.move;
    if (!m || !m.cancelInto.length) return null;
    return this.pickMove(env, { filter: m.cancelInto, throws: false });
  }

  /** Rollback breaker: Forward+BLK in hitstun from the 2nd hit; 2 bars and a full Runway. */
  breakerInput(env) {
    const b = env.input;
    if (!b || !env.canAct) return false;
    const team = env.team;
    const cost = this.passiveDef?.breakerCost ?? RULES.breakerCost;
    if (team.breakerUsed || team.meter < cost || team.runway < RULES.runwayMax || this.combo.hits < 2) return false;
    const opp = env.opponent;
    if (opp && opp.state === "attack" && opp.move?.category === "super") return false;
    return b.pressedNow(BTN.BLOCK) && isFwd(b.dir(this.facing));
  }

  /** Is the defender guarding against an attacker at `fromX`? Returns "high", "low" or null. */
  guardAgainst(fromX, env) {
    const b = env?.input;
    if (!b || !this.onField || this.ko) return null;
    if (!(this.isNeutral || this.state === "blockstun")) return null;
    if (this.noBlockFrames > 0 && this.state !== "blockstun") return null;
    const away = fromX >= this.x ? 1 : -1;
    const d = b.dir(away);
    const guarding = this.state === "blockstun" || b.held(BTN.BLOCK) || (env.backBlocks && isBack(d));
    if (!guarding) return null;
    return isDown(d) ? "low" : "high";
  }

  threatNear(env) {
    return Boolean(env.threat?.(this));
  }

  spendRunway(env, amount) {
    env.team.runway = Math.max(0, env.team.runway - amount);
    env.team.runwaySpentFrame = env.frame ?? 0;
  }

  // ------------------------------------------------------------------ states

  st_idle(env) {
    this.neutral(env);
  }

  st_walk_fwd(env) {
    this.neutral(env);
  }

  st_walk_back(env) {
    this.neutral(env);
  }

  st_crouch(env) {
    this.neutral(env);
  }

  st_block(env) {
    this.neutral(env);
  }

  st_crouch_block(env) {
    this.neutral(env);
  }

  neutral(env) {
    this.faceToward(env.opponent);
    this.airAttackUsed = false;
    const b = env.input;
    if (!env.canAct || !b) {
      this.vx = 0;
      this.setNeutral("idle");
      return;
    }
    if (this.tryAct(env)) return;
    if (matchDoubleTap(b, 6, this.facing)) {
      b.consume();
      this.setState("dash_fwd");
      env.emit("dash", { fighter: this.id, side: this.side, x: this.x, dir: 1 });
      env.vfx("dust_dash", this.x, 0, { facing: this.facing, side: this.side });
      return;
    }
    if (matchDoubleTap(b, 4, this.facing)) {
      b.consume();
      this.setState("dash_back");
      env.emit("dash", { fighter: this.id, side: this.side, x: this.x, dir: -1 });
      this.strikeInvulnFrames = 5;
      env.vfx("dust_dash", this.x, 0, { facing: -this.facing, side: this.side });
      return;
    }
    const d = b.dir(this.facing);
    if (isUp(d)) {
      this.jumpDir = d === 9 ? 1 : d === 7 ? -1 : 0;
      this.vx = 0;
      this.setState("jump_start");
      return;
    }
    const down = isDown(d);
    if (b.held(BTN.BLOCK) && this.noBlockFrames === 0) {
      this.vx = 0;
      this.setNeutral(down ? "crouch_block" : "block");
      return;
    }
    const proximity = env.backBlocks && isBack(d) && this.threatNear(env);
    if (down) {
      this.vx = 0;
      this.setNeutral(proximity ? "crouch_block" : "crouch");
      return;
    }
    if (isBack(d)) {
      if (proximity) {
        this.vx = 0;
        this.setNeutral("block");
      } else {
        this.setNeutral("walk_back");
        this.vx = -this.facing * this.locomotionSpeed("walk_back");
      }
      return;
    }
    if (isFwd(d)) {
      this.setNeutral("walk_fwd");
      this.vx = this.facing * this.locomotionSpeed("walk_fwd");
      return;
    }
    this.vx = 0;
    this.setNeutral("idle");
  }

  st_dash_fwd(env) {
    const total = 18 - (this.passiveDef?.dashFramesCut ?? 0);
    const run = this.locomotionSpeed("run");
    const t = this.stateFrame / total;
    this.vx = this.facing * run * (1.05 - 0.55 * t);
    if (this.stateFrame >= 8 && env.canAct && this.tryAct(env)) return;
    if (this.stateFrame >= total) {
      const d = env.input ? env.input.dir(this.facing) : 5;
      if (isFwd(d) && !isDown(d) && env.team.runway > 0) {
        this.setState("run");
      } else {
        this.toNeutral(env);
      }
    }
  }

  st_dash_back(env) {
    const total = 22;
    const speed = this.locomotionSpeed("run") * 1.7;
    this.vx = -this.facing * speed * Math.max(0, 1 - this.stateFrame / total);
    if (this.stateFrame >= total) this.toNeutral(env);
  }

  st_run(env) {
    this.faceToward(env.opponent);
    const b = env.input;
    if (!env.canAct || !b) {
      this.toNeutral(env);
      return;
    }
    if (this.tryAct(env)) return;
    const d = b.dir(this.facing);
    if (b.held(BTN.BLOCK)) {
      this.vx = 0;
      this.setState("block");
      return;
    }
    if (isUp(d)) {
      this.jumpDir = 1;
      this.runJump = true;
      this.setState("jump_start");
      return;
    }
    if (isFwd(d) && !isDown(d) && env.team.runway > 0) {
      this.vx = this.facing * this.locomotionSpeed("run");
      this.spendRunway(env, RULES.runDrain * DT);
      if (this.stateFrame % 16 === 1) env.vfx("dust_run", this.x - this.facing * 20, 0, { facing: this.facing, side: this.side });
      return;
    }
    this.vx *= 0.4;
    this.noBlockFrames = RULES.noBlockAfterRun;
    env.vfx("dust_skid", this.x, 0, { facing: this.facing, side: this.side });
    this.toNeutral(env);
  }

  st_jump_start(env) {
    if (this.stateFrame >= 4) {
      const stats = this.def.stats;
      const g = PHYS.gravity * (stats.weight || 1);
      this.vy = -Math.sqrt(2 * g * stats.jumpHeight);
      const run = this.runJump ? 1.45 : 1;
      this.vx = (this.jumpDir || 0) * this.facing * PHYS.jumpSpeedX * run;
      this.runJump = false;
      this.airAttackUsed = false;
      this.setState("jump");
      this.y = -0.02;
      env.emit("jump", { fighter: this.id, side: this.side, x: this.x });
      env.vfx("dust_jump", this.x, 0, { facing: this.facing, side: this.side });
    }
  }

  st_jump(env) {
    if (env.canAct) this.tryAct(env, { throws: false });
  }

  st_jump_land(env) {
    this.vx = 0;
    if (this.stateFrame >= (this.landingRecovery || 3)) {
      this.faceToward(env.opponent);
      this.toNeutral(env);
      if (this.isNeutral) this.neutral(env);
    }
  }

  st_attack(env) {
    let m = this.move;
    this.moveFrame += 1;
    if (this.pendingMove && env.canAct) {
      const next = this.pendingMove;
      this.pendingMove = null;
      this.startMove(next, env, { cancel: true });
      return;
    }
    if (m.scaled && !m.isScaled && this.moveFrame <= RULES.scaleUpWindow && env.input?.pressedNow(BTN.BLOCK) && env.team.meter >= (this.passiveDef?.scaleUpCost ?? RULES.scaleUpCost) && !this.assistMode) {
      env.team.meter -= this.passiveDef?.scaleUpCost ?? RULES.scaleUpCost;
      this.move = m = m.scaled;
      env.emit("scaleUp", { fighter: this.id, side: this.side, moveId: m.id });
      env.vfx("scale_up", this.x, this.y - 110, { characterId: this.id, palette: this.def.palette });
    }
    const v = this.velocityWindow();
    if (v) {
      if (v.vx !== undefined) this.vx = v.vx * this.facing;
      if (v.vy !== undefined) this.vy = v.vy;
    }
    if (m.teleport) this.runTeleport(env, m.teleport);
    moveMechanic(m)?.onFrame?.(this, m, env);
    if (this.state !== "attack" || this.move !== m) return;
    if (m.projectile && this.moveFrame === m.projectile.spawnFrame) env.spawnProjectile(this, m);
    if (m.barrier && this.moveFrame === m.barrier.frame) env.spawnBarrier?.(this, m);
    if (env.canAct && env.input) {
      if (m.kind === "light" && this.moveFrame <= 2 && !this.airborne && this.throwInput(env.input)) {
        this.startMove(this.def.throw, env);
        return;
      }
      const window = m.startup + m.active + Math.min(12, m.recovery);
      if (this.connected && this.moveFrame <= window && m.cancelInto.length) {
        const next = this.findCancel(env);
        if (next) {
          this.startMove(next, env, { cancel: true });
          return;
        }
      }
    }
    if (this.moveFrame >= m.total) {
      if (this.airborne) {
        this.pendingLanding = m.landingRecovery;
        this.setState("jump");
        this.airAttackUsed = true;
      } else {
        this.toNeutral(env);
        if (this.isNeutral) this.neutral(env);
      }
    }
  }

  runTeleport(env, tp) {
    if (this.moveFrame === tp.vanish) {
      this.hidden = true;
      env.vfx("tag_flash", this.x, this.y - 100, { facing: this.facing, side: this.side, characterId: this.id });
    }
    if (this.moveFrame === tp.frame) {
      const opp = env.opponent;
      if (opp) {
        const toward = Math.sign(opp.x - this.x) || this.facing;
        const target = tp.to === "behind" ? opp.x + toward * tp.distance : opp.x - toward * tp.distance;
        const { left, right } = env.bounds || { left: -900, right: 900 };
        const hw = this.push.w / 2;
        this.x = Math.max(left + hw, Math.min(right - hw, target));
        this.facing = Math.sign(opp.x - this.x) || this.facing;
      }
      this.hidden = false;
      env.vfx("tag_flash", this.x, this.y - 100, { facing: this.facing, side: this.side, characterId: this.id });
    }
  }

  st_throwing(env) {
    const g = this.grab;
    if (!g) {
      this.toNeutral(env);
      return;
    }
    this.vx = 0;
    if (this.stateFrame >= g.length) {
      this.grab = null;
      this.toNeutral(env);
    }
  }

  st_thrown(env) {
    const g = this.grab;
    if (!g || !g.by) {
      this.toNeutral(env);
      return;
    }
    const by = g.by;
    this.vx = 0;
    this.vy = 0;
    const lift = Math.min(1, this.stateFrame / 6);
    this.x = by.x + by.facing * 58;
    this.y = -30 * lift;
    this.facing = -by.facing;
    if (g.techable && this.stateFrame <= RULES.throwTechWindow && this.throwInput(env.input)) {
      env.input.consume();
      env.techThrow(by, this);
      return;
    }
    if (this.stateFrame >= g.release) env.releaseThrow(by, this);
  }

  st_tech() {
    if (this.stateFrame >= 18) {
      this.vx = 0;
      this.setState("idle");
      this.throwInvuln = 4;
    }
  }

  st_breaker(env) {
    if (this.stateFrame >= 14 && !this.airborne) this.toNeutral(env);
  }

  st_hitstun(env) {
    if (this.breakerInput(env)) {
      env.breaker(this);
      return;
    }
    this.stun -= 1;
    if (this.stun <= 0) {
      this.throwInvuln = RULES.throwInvulnAfterStun;
      this.faceToward(env.opponent);
      this.toNeutral(env);
      if (this.isNeutral) this.neutral(env);
    }
  }

  st_blockstun(env) {
    const b = env.input;
    if (b) {
      const away = env.opponent ? (env.opponent.x >= this.x ? 1 : -1) : this.facing;
      const down = isDown(b.dir(away));
      const anim = down ? "crouch_block" : "block";
      if (this.stunAnim !== anim) {
        this.stunAnim = anim;
        this.setAnim(anim, false);
      }
      const push = BTN.HP | BTN.HK;
      if (env.canAct && (b.current.buttons & push) === push && b.findPress(push, 3) && env.team.runway >= RULES.guardrailCost) {
        b.consume();
        this.spendRunway(env, RULES.guardrailCost);
        env.guardrail?.(this);
        return;
      }
    }
    this.stun -= 1;
    if (this.stun <= 0) {
      this.throwInvuln = RULES.throwInvulnAfterStun;
      this.toNeutral(env);
      if (this.isNeutral) this.neutral(env);
    }
  }

  st_juggle(env) {
    if (this.breakerInput(env)) {
      env.breaker(this);
      return;
    }
    const b = env.input;
    if (this.juggleLocked && this.vy > 0 && b && env.canAct && b.findPress(ATTACK_BUTTONS, 2)) {
      b.consume();
      this.juggleLocked = false;
      this.juggleCount = 0;
      this.juggleHits = 0;
      this.invulnFrames = RULES.airRecoveryInvuln;
      this.airAttackUsed = true;
      this.pendingLanding = 4;
      this.vx = -this.facing * 120;
      this.setState("jump");
      env.emit("airRecovery", { fighter: this.id, side: this.side });
      env.vfx("tag_flash", this.x, this.y - 100, { facing: this.facing, side: this.side, characterId: this.id });
    }
  }

  st_knockdown(env) {
    this.vx = 0;
    const b = env.input;
    if (b && !this.delayedWakeupUsed && this.stateFrame === this.knockdownLength - 1 && isDown(b.dir(this.facing))) {
      this.delayedWakeupUsed = true;
      this.knockdownLength += RULES.delayedWakeup;
    }
    if (this.stateFrame < this.knockdownLength) return;
    const team = env.team;
    if (b && env.canAct && !this.dazedPending) {
      const d = b.dir(this.facing);
      if ((b.held(BTN.BLOCK) && b.findPress(BTN.LP | BTN.HP, 10)) && team.meter >= RULES.getupAttackCost && team.runway >= RULES.getupAttackRunway) {
        team.meter -= RULES.getupAttackCost;
        this.spendRunway(env, RULES.getupAttackRunway);
        this.faceToward(env.opponent);
        this.startMove(this.def.getupAttack, env);
        return;
      }
      if ((isFwd(d) || isBack(d)) && !isDown(d) && team.runway >= RULES.rollCost) {
        this.spendRunway(env, RULES.rollCost);
        this.rollDir = isFwd(d) ? this.facing : -this.facing;
        this.setState("roll");
        return;
      }
    }
    this.setState("getup");
  }

  st_roll(env) {
    this.vx = this.rollDir * 150 / (RULES.rollFrames / 60);
    if (this.stateFrame >= RULES.rollFrames) {
      this.vx = 0;
      this.throwInvuln = RULES.throwInvulnAfterStun;
      this.faceToward(env.opponent);
      this.toNeutral(env);
    }
  }

  st_getup(env) {
    if (this.stateFrame >= RULES.getupFrames) {
      this.throwInvuln = RULES.throwInvulnAfterStun;
      this.faceToward(env.opponent);
      this.toNeutral(env);
    }
  }

  st_ko() {
    if (!this.airborne) this.vx *= 0.85;
  }

  st_dazed() {
    this.vx = 0;
  }

  st_finisher() {
    this.vx = 0;
  }

  st_finished() {
    this.vx = 0;
  }

  st_victory() {
    this.vx = 0;
  }

  st_intro() {
    this.vx = 0;
  }

  // Scripted entrances and exits for tag and assist.
  runScript() {
    const s = this.script;
    if (!s) return true;
    const t = Math.min(1, this.stateFrame / s.frames);
    const ease = 1 - (1 - t) * (1 - t);
    this.x = s.fromX + (s.toX - s.fromX) * ease;
    this.y = -Math.sin(Math.PI * t) * (s.arc ?? 140);
    this.lastDx = 0;
    if (t >= 1) {
      this.y = 0;
      this.script = null;
      return true;
    }
    return false;
  }

  st_tag_in(env) {
    if (this.move) this.moveFrame = this.stateFrame;
    if (this.runScript(env)) {
      this.move = null;
      env.vfx("dust_land", this.x, 0, { facing: this.facing, side: this.side });
      this.invulnFrames = 8;
      const entry = this.entryMove;
      this.entryMove = null;
      if (entry) {
        this.faceToward(env.opponent);
        this.startMove(entry, { ...env, input: null });
      } else {
        this.toNeutral(env);
      }
    }
  }

  st_assist_in(env) {
    if (this.runScript(env)) {
      this.faceToward(env.opponent);
      const move = this.def.moves.get(this.assistMove || this.def.assists.a);
      if (move) this.startMove(move, { ...env, input: null, canAct: true });
      else env.endAssist(this);
    }
  }

  st_tag_out(env) {
    if (this.runScript(env)) env.benched(this);
  }

  st_assist_out(env) {
    if (this.runScript(env)) env.benched(this);
  }

  st_bench() {}
}
