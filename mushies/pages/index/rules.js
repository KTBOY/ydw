// mushies/pages/index/rules.js
// 玩法规则层：从 Godot 工程 scripts/ 逐条移植，纯数据 + 纯函数，可在 Node 里直接跑校验。
// 每条后面的「来源」是原工程文件:行号，改数值前先回去核对。

const SIZE_MULTIPLIER = 1.2; // plushie_body.gd:6
const RAW_SPANS = [88, 102, 118, 134, 150, 168, 188, 210, 236, 270, 306]; // plushie_body.gd:7

// aspect = alpha 包围盒宽/高，与原工程 render_size.x = span * aspect 一致
// （由 assets/mushies/source/*.png 离线测量得出，贴图已按包围盒裁剪导出）
const TIERS = [
  { key: 'spore', name: '孢子菇', aspect: 0.831 },
  { key: 'button', name: '纽扣菇', aspect: 0.949 },
  { key: 'sprout', name: '小芽菇', aspect: 0.851 },
  { key: 'puff', name: '绒绒菇', aspect: 0.904 },
  { key: 'bloom', name: '开花菇', aspect: 0.86 },
  { key: 'nectar', name: '蜜环菇', aspect: 0.853 },
  { key: 'mooncap', name: '月帽菇', aspect: 0.877 },
  { key: 'mossy', name: '苔藓菇', aspect: 0.869 },
  { key: 'ember', name: '余烬菇', aspect: 0.892 },
  { key: 'royal', name: '皇冠菇', aspect: 0.775 },
  { key: 'aurora', name: '极光菇', aspect: 0.923 },
].map((t, i) => ({ ...t, tier: i, span: RAW_SPANS[i] * SIZE_MULTIPLIER }));

const TOP_TIER = TIERS.length - 1; // 10 = 极光菇，不再向上合成
const BOMB_TIER = 11; // data/actors/bomb.gd:3
const BOMB_SPAN = 148; // data/actors/bomb.gd:9
// 炸弹贴图按 alpha 包围盒（424×503）裁剪导出，宽高比与 TIERS[].aspect 同一口径
const BOMB_ASPECT = 0.843;

// 圆体半径系数：原工程用贴图 alpha 轮廓做凸分解，等效半径约 0.44~0.49×span；
// 但可见菌盖宽仅 0.69×span，取 0.40 让「看起来贴上」和「堆得稳」平衡。调这一处即可。
const RADIUS_FACTOR = 0.4;

// 棋盘（逻辑像素，y 向下）——plushie_main.gd:21-25, :231-242, :730-747
const BOARD = {
  cabinetX: 364,
  cabinetY: 128,
  cabinetW: 712, // CABINET_WIDTH
  cabinetH: 777, // TANK.end.y + EXTRA_PILE_DEPTH + FLOOR_TRIM - CABINET_TOP，投影的最小高度
  left: 400,
  right: 1040,
  top: 176,
  floorMin: 852, // 默认底板位置（原版 TANK.end.y + EXTRA_PILE_DEPTH）
  floor: 852, // 运行期由 computeLayout 按可用高度下推，等价原版 _resize_tank
  floorTrim: 53, // FLOOR_TRIM
  dangerY: 354, // environment.danger.line，catalog.generated.json:438
};

const spanOf = (tier) => (tier === BOMB_TIER ? BOMB_SPAN : TIERS[tier].span);
const radiusOf = (tier) => spanOf(tier) * RADIUS_FACTOR;

// 手感参数
const PHYS = {
  gravity: 820, // project.godot:51
  linearDamp: 0.32, // plushie_body.gd:85
  angularDamp: 1.2, // plushie_body.gd:86
  bounce: 0.46, // catalog:294
  friction: 0.68, // catalog:312
  releaseVy: 35, // plushie_body.gd:165
  spin: 0.35, // catalog:276 rad/s
  maxToys: 80, // plushie_main.gd:28
  massOf: (tier) => 0.6 + tier * 0.3, // plushie_body.gd:64
  bombMass: 1.2, // bomb_plushie.gd:28
};

// 夹爪（娃娃机）机构 —— plushie_main.gd:30, :259-268, :312-350, :392-395
const CLAW = {
  openTime: 0.18,
  reloadTime: 0.55,
  aimSpeed: 420,
  spawnY: 280,
  heldY: (span) => 242 + span * 0.46,
  clampHeld: (span) => span * 0.56 + 12,
  clampIdle: (span) => span * 0.5 + 16,
};

// 合成结果 —— plushie_main.gd:417-431
const MERGE = {
  velFactor: 0.35,
  popY: -90,
  squishVelocity: 4.5,
  halo: 0.6,
};

// 挤压形变弹簧 —— plushie_body.gd:112-136
const SQUISH = {
  k: 120,
  c: 13,
  min: -0.1,
  max: 0.18,
  amount: 0.5,
  heldValue: 0.035,
  impactGain: 5,
};

const RULES = {
  stageSeed: 104729, // data/stages/registry.gd:3
  targetTier: 3, // 第 1 关目标：开出「绒绒菇」
  timeLimit: 180, // session.gd:59
  goalBonus: 60, // GOAL_TIME_BONUS_SECONDS，session.gd:6
  goalStep: 1, // 达成后目标上调 tier+1，上限 TOP_TIER
  bombChance: 0.01, // bomb.gd:4 CHANCE_PERCENT
  rescueAge: 1.35, // plushie_main.gd:290
  rescueSpeed: 55,
  rescueDistance: 80, // session.gd:6
  fuse: 5, // bomb.gd:5
  blastMargin: 30, // bomb.gd:8
  dangerCue: 0.8, // plushie_main.gd:300
  dangerReset: 0.15,
  gameOverAt: 2.8, // catalog:132
  exhaustedSettled: 3, // plushie_main.gd:306-309
  exhaustedHard: 12,
  settleSpeed: 25,
  scoreCap: 1e7,
  impactThreshold: 55, // plushie_body.gd:99 delta_v 门槛
};

// score/score_service.gd:19-22
const scoreForMerge = (tier) => Math.round(10 * Math.pow(2, tier));
const GOAL_BONUS_SCORE = 1000;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// 确定性随机：原工程用 Godot RandomNumberGenerator + 固定 seed，这里换成 mulberry32，
// 保证同一 seed 下投放序列可复现（序列内容与 Godot 不逐位相同，规则一致）。
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Session {
  constructor(seed) {
    const base = seed === undefined ? RULES.stageSeed : seed;
    this.dropRng = makeRng((base ^ 0x44524f50) >>> 0); // session.gd:45
    this.bombRng = makeRng((base ^ 0x424f4d42) >>> 0); // session.gd:46
    this.goalTier = RULES.targetTier;
    this.goalsReached = 0;
    this.merges = 0;
    this.highest = -1;
    this.dragons = 0;
    this.score = 0;
    this.drops = 0;
    this.elapsed = 0;
    this.outcome = '';
    this.reason = '';
    this.rescueDropIndex = -1;
    this.rescueUsed = false;
    this.discovered = {};
    this.queue = [this.roll(), this.roll()]; // session.gd:49-51, 85-90
    this.mark(this.queue[0]);
  }

  // session.gd:95-97：只开到 goal_tier-2（上限 8），1% 概率换成炸弹
  roll() {
    const hi = clamp(this.goalTier - 2, 0, 8);
    const tier = Math.floor(this.dropRng() * (hi + 1));
    return this.bombRng() < RULES.bombChance ? BOMB_TIER : tier;
  }

  next(index) {
    const abs = this.drops + index;
    if (this.rescueDropIndex === abs) return BOMB_TIER;
    return this.queue[index];
  }

  advance() {
    const dropped = this.next(0);
    this.queue.shift();
    this.queue.push(this.roll());
    this.drops += 1;
    this.mark(dropped);
    if (this.queue[0] !== BOMB_TIER) this.mark(this.queue[0]);
    return dropped;
  }

  mark(tier) {
    if (tier !== BOMB_TIER) this.discovered[tier] = true;
  }

  discoveredCount() {
    return Object.keys(this.discovered).length;
  }

  // session.gd:110-114：一局只发一次救援炸弹
  grantRescueBomb(offset) {
    if (this.rescueUsed) return false;
    this.rescueUsed = true;
    this.rescueDropIndex = this.drops + offset;
    return true;
  }

  timeBudget() {
    return RULES.timeLimit + this.goalsReached * RULES.goalBonus; // session.gd:59-61
  }

  remaining() {
    return Math.max(0, this.timeBudget() - this.elapsed);
  }

  tick(delta) {
    this.elapsed += Math.max(0, delta); // session.gd:5-8
  }

  // session.gd:66-78 + score_service.gd:19-22
  merge(tier) {
    this.merges += 1;
    this.highest = Math.max(this.highest, tier);
    this.award(scoreForMerge(tier));
    if (tier === TOP_TIER) this.dragons += 1;
    let reached = false;
    if (tier >= this.goalTier) {
      this.goalsReached += 1;
      this.award(GOAL_BONUS_SCORE);
      this.goalTier = Math.min(TOP_TIER, tier + RULES.goalStep);
      reached = true;
    }
    return reached;
  }

  award(points) {
    this.score = Math.min(RULES.scoreCap, this.score + points);
  }

  finish(outcome, reason) {
    if (this.outcome) return;
    this.outcome = outcome;
    this.reason = reason;
  }
}

export {
  TIERS,
  TOP_TIER,
  BOMB_TIER,
  BOMB_SPAN,
  BOMB_ASPECT,
  BOARD,
  PHYS,
  CLAW,
  MERGE,
  SQUISH,
  RULES,
  RADIUS_FACTOR,
  spanOf,
  radiusOf,
  scoreForMerge,
  clamp,
  makeRng,
  Session,
};
