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

export const RULES = Object.freeze({
  roundSeconds: 99,
  roundsToWin: 2,
  meterMax: 300,
  meterBar: 100,
  superCost: 200,
  breakerCost: 100,
  tagCancelCost: 100,
  defenderMeterRatio: 0.3,
  blockMeterRatio: 0.5,
  scalingStartHit: 3,
  scalingStep: 0.1,
  scalingMin: 0.3,
  superScalingMin: 0.5,
  counterBonus: 1.2,
  counterHitstun: 4,
  maxJuggle: 6,
  throwRange: 92,
  throwTechWindow: 10,
  throwDamage: 120,
  throwInvulnAfterStun: 5,
  knockdownFrames: 38,
  quickRiseFrames: 16,
  getupFrames: 22,
  redRatio: 0.55,
  redRegenPerSecond: 24,
  tagCooldown: 180,
  assistCooldown: 360,
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
