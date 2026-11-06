export const FPS = 60;
export const DT = 1 / FPS;

export const BTN = Object.freeze({
  LP: 1,
  HP: 2,
  LK: 4,
  HK: 8,
  BLOCK: 16,
  TAG: 32,
  ASSIST: 64,
  START: 128,
});
export const BUTTON_NAMES = Object.freeze(Object.keys(BTN));
export const ATTACK_BUTTONS = BTN.LP | BTN.HP | BTN.LK | BTN.HK;

export const PHYS = Object.freeze({
  gravity: 3000,
  jumpHeight: 230,
  jumpSpeedX: 270,
  groundFriction: 2600,
  airFriction: 0,
  stageLeft: -900,
  stageRight: 900,
  maxSeparation: 1180,
  defaultPushWidth: 64,
});

/** Shared system numbers. Sources: docs/roster-and-moves.md section 2 (first balance pass). */
export const RULES = Object.freeze({
  roundSeconds: 99,
  tagRoundSeconds: 120,
  roundsToWin: 2,
  // Compute (offensive meter)
  meterMax: 300,
  meterBar: 100,
  superCost: 300,
  breakerCost: 200,
  scaleUpCost: 100,
  handoffCancelCost: 100,
  swapGuardCost: 100,
  getupAttackCost: 100,
  defenderMeterRatio: 0.08,
  blockMeterAttacker: 2,
  blockMeterDefender: 2,
  // Runway (defensive stamina)
  runwayMax: 200,
  runwayRegen: 30,
  runwayDelay: 60,
  runDrain: 40,
  guardrailCost: 50,
  rollCost: 50,
  swapGuardRunway: 50,
  getupAttackRunway: 50,
  // Damage
  scalingStartHit: 3,
  scalingStep: 0.1,
  scalingMin: 0.3,
  superScalingMin: 0.6,
  counterBonus: 1.2,
  counterHitstun: 4,
  punishBonus: 1.3,
  punishHitstun: 8,
  scaleUpDamage: 1.3,
  scaleUpWindow: 8,
  maxJuggle: 8,
  juggleGravityStep: 0.06,
  // Defense
  alignmentWindow: 3,
  alignmentMeter: 8,
  alignmentBlockstunCut: 3,
  guardrailPush: 420,
  throwRange: 80,
  throwTechWindow: 10,
  throwDamage: 110,
  throwInvulnAfterStun: 5,
  knockdownFrames: 38,
  quickRiseFrames: 16,
  delayedWakeup: 18,
  getupFrames: 26,
  rollFrames: 30,
  airRecoveryInvuln: 8,
  // 2v2
  redRatio: 0.4,
  redRegenPerSecond: 12,
  redRegenPause: 120,
  assistDamageScale: 0.7,
  assistDamageTaken: 1.5,
  tagCooldown: 180,
  tagHoldFrames: 10,
  assistCooldown: 300,
  lastStandingDamage: 1.1,
  lastStandingMeter: 1.25,
  // Comeback and finish
  lastCheckpointHealth: 0.3,
  finishWindow: 300,
  // Input
  bufferFrames: 6,
  chargeFrames: 40,
  proximityGuard: 280,
});

export const REQUIRED_ANIMS = Object.freeze([
  "idle", "walk_fwd", "walk_back", "run", "dash_back", "jump_start", "jump_air", "jump_land",
  "crouch", "block", "crouch_block", "light_punch", "heavy_punch", "light_kick", "heavy_kick",
  "crouch_light", "crouch_heavy", "air_attack", "throw", "special_1", "special_2", "special_3",
  "super", "hit_high", "hit_low", "knockdown", "getup", "ko", "victory", "intro", "tag_in",
]);

export const ANIM_FALLBACKS = Object.freeze({
  dash_fwd: ["run", "walk_fwd"],
  dazed: ["hit_high"],
  finished: ["dazed", "hit_high"],
  finisher: ["super", "special_1"],
  assist: ["special_1"],
  tag_out: ["dash_back", "walk_back"],
  thrown: ["hit_high"],
  run: ["walk_fwd"],
  dash_back: ["walk_back"],
  crouch_block: ["block"],
  jump_start: ["crouch"],
  jump_land: ["crouch"],
});
