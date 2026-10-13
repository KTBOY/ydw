// mushies/pages/index/index.js
// 菇菇合成机（Mushies 移植版）：娃娃机夹爪投放 + 同级合成升阶 + 安全线超时判定。
// 规则与手感参数来自 Godot 工程，逐条标注在 rules.js；这里只负责表现与输入。
// 原工程的「同键盘双人」模式在触屏上无法成立，未移植（device_layout.gd:39 在移动端本就禁用）。
import {
  TIERS,
  TOP_TIER,
  BOMB_TIER,
  BOMB_ASPECT,
  BOARD,
  PHYS,
  CLAW,
  MERGE,
  SQUISH,
  RULES,
  spanOf,
  radiusOf,
  clamp,
  Session,
} from './rules';
import { Body, World } from './physics';
import audio from './audio';

const STORE_KEY = 'mushiesScores';
const MAX_RECORDS = 10;
const FIXED_DT = 1 / 60;
const CHAIN_WINDOW = 1.2; // game_audio.gd:13

const REASON_TEXT = {
  overflow: 'Mushies 堆超出安全线',
  timeout: '时间已用完',
  drops: '可投放的 Mushies 已用完',
};

const RM_KEY = 'mushiesReducedMotion';

// ---------- 主菜单装饰（原版 title_fx.gd / title_marquee.gd 的确定性参数） ----------
const HEART_COLORS = ['#f59ab4', '#d7bdf0', '#fff4f7', '#ffc9a6', '#f7b8cc'];
const TAU = Math.PI * 2;

// Godot 侧用 seed=1811 的 PCG32，这里用同样确定性的 mulberry32 复现「同参数区间、可复现」
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 9 颗上升爱心：rise = fmod(y + t*speed*0.035, 1)，x 摆动 = sin(t*sway + phase)
// 取数顺序与 title_fx.gd 一致（x,y,size,speed,phase,sway），区间同 randf_range
function buildHearts() {
  const rand = rng(1811);
  const list = [];
  for (let i = 0; i < 9; i++) {
    const x = rand();
    const y = rand();
    const size = 0.6 + rand() * 0.65;
    const speed = 0.8 + rand() * 1.1;
    const phase = rand() * TAU;
    const sway = 0.6 + rand() * 0.8;
    const riseDur = 1 / (0.035 * speed);
    list.push({
      left: `${(x * 100).toFixed(1)}%`,
      color: HEART_COLORS[i % HEART_COLORS.length],
      size: Math.round(34 * size),
      riseDur: riseDur.toFixed(1),
      riseDelay: (y * riseDur).toFixed(1),
      swayDur: (TAU / sway).toFixed(2),
      swayDelay: (phase / sway).toFixed(2),
    });
  }
  return list;
}

// 灯牌灯泡：沿圆角矩形轮廓等距排布，(i + t*6) % 3 == 0 时熄灭，形成 6 步/秒的追逐
function buildBulbs() {
  const x = 25;
  const y = 25;
  const w = 638;
  const h = 188;
  const r = 33;
  const arc = (Math.PI / 2) * r;
  const segs = [
    { kind: 'line', from: [x + r, y], to: [x + w - r, y], len: w - 2 * r },
    { kind: 'arc', c: [x + w - r, y + r], a0: -Math.PI / 2, len: arc },
    { kind: 'line', from: [x + w, y + r], to: [x + w, y + h - r], len: h - 2 * r },
    { kind: 'arc', c: [x + w - r, y + h - r], a0: 0, len: arc },
    { kind: 'line', from: [x + w - r, y + h], to: [x + r, y + h], len: w - 2 * r },
    { kind: 'arc', c: [x + r, y + h - r], a0: Math.PI / 2, len: arc },
    { kind: 'line', from: [x, y + h - r], to: [x, y + r], len: h - 2 * r },
    { kind: 'arc', c: [x + r, y + r], a0: Math.PI, len: arc },
  ];
  const perimeter = segs.reduce((sum, s) => sum + s.len, 0);
  const count = Math.min(200, Math.max(12, Math.floor(perimeter / 58)));
  const spacing = perimeter / count;
  const at = (d) => {
    let walked = d % perimeter;
    for (const s of segs) {
      if (walked > s.len) {
        walked -= s.len;
        continue;
      }
      const t = s.len === 0 ? 0 : walked / s.len;
      if (s.kind === 'line') {
        return [s.from[0] + (s.to[0] - s.from[0]) * t, s.from[1] + (s.to[1] - s.from[1]) * t];
      }
      const a = s.a0 + t * (Math.PI / 2);
      return [s.c[0] + Math.cos(a) * r, s.c[1] + Math.sin(a) * r];
    }
    return [x, y];
  };
  const list = [];
  for (let i = 0; i < count; i++) {
    const p = at(spacing * 0.5 + i * spacing);
    list.push({
      x: p[0].toFixed(1),
      y: p[1].toFixed(1),
      delay: ((i * 0.5) / 3).toFixed(3),
    });
  }
  return list;
}

const pad2 = (n) => (n < 10 ? `0${n}` : `${n}`);
const formatClock = (seconds) => {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${pad2(s % 60)}`;
};
const formatTime = (ts) => {
  const d = new Date(ts);
  return `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};
const tierLabel = (tier) => (tier === BOMB_TIER ? '清场孢子' : TIERS[tier].name);
// 炸弹没有独立贴图，用一个中性宽高比画占位圆
const aspectOf = (tier) => (tier === BOMB_TIER ? BOMB_ASPECT : TIERS[tier].aspect);

// 玩偶之外的场景贴图：[this.textures 键名, 文件名]
const EXTRA_TEXTURES = [
  ['bomb', 'puff-bomb.png'],
  ['trim', 'cabinet-trim.png'],
  ['arcade', 'arcade.jpg'],
  ['clawRail', 'claw-rail.png'],
  ['clawRope', 'claw-rope.png'],
  ['clawHub', 'claw-hub.png'],
  ['clawArm', 'claw-arm.png'],
];

Page({
  data: {
    score: 0,
    timeText: '3:00',
    goalText: '',
    goalKey: '',
    nextKey: '',
    nextName: '',
    hint: '可以投放',
    status: 'title',
    reasonText: '',
    summary: '',
    merges: 0,
    records: [],
    showRecords: false,
    showPause: false,
    showHelp: false,
    muted: false,
    bestScore: 0,
    showSettings: false,
    reducedMotion: false,
    hearts: buildHearts(),
    bulbs: buildBulbs(),
  },

  onLoad() {
    this.world = null;
    this.toys = [];
    this.particles = [];
    this.pendingMerges = [];
    this.session = new Session();
    this.clawState = 'holding';
    this.openness = 0;
    this.stateTimer = 0;
    this.held = null;
    this.aimX = (BOARD.left + BOARD.right) / 2;
    this.touchId = null;
    this.overflowTime = 0;
    this.dangerCueArmed = true;
    this.exhaustedTime = 0;
    this.impactCooldown = 0;
    this.chainCount = 0;
    this.chainAt = 0;
    this.impactAlt = false;
    this.rafId = null;
    this.lastTs = 0;
    this.accumulator = 0;
    this.pageShown = false;
    this.textures = {};
    this.layout = null;
    this.runId = `r${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
    this.loadRecords();
    audio.init();
    let reducedMotion = false;
    try {
      reducedMotion = !!wx.getStorageSync(RM_KEY);
    } catch (e) {
      reducedMotion = false;
    }
    this.setData({ muted: audio.isMuted(), bestScore: this.bestScore, reducedMotion });
  },

  onReady() {
    // 首页时画布 hidden（尺寸为 0），延迟到点「开始合成」再初始化
    if (this.data.status === 'playing') this.setupCanvas(0);
  },

  onShow() {
    this.pageShown = true;
    if (this.canvas) {
      this.draw();
      if (this.data.status === 'playing' && !this.data.showRecords) this.startLoop();
    }
  },

  onHide() {
    this.pageShown = false;
    this.stopLoop();
    audio.loopStop('carriage');
  },

  onUnload() {
    this.pageShown = false;
    this.stopLoop();
    audio.destroy();
  },

  // ---------- 画布与素材 ----------
  setupCanvas(retry) {
    const query = wx.createSelectorQuery().in(this);
    query
      .select('#gameCanvas')
      .fields({ node: true, size: true, rect: true })
      .exec((res) => {
        const info = res && res[0];
        if (!info || !info.node || !info.width || !info.height) {
          if (retry < 5) setTimeout(() => this.setupCanvas(retry + 1), 60);
          return;
        }
        if (this.canvas) return;
        const canvas = info.node;
        const ctx = canvas.getContext('2d');
        let dpr = 2;
        try {
          dpr = (wx.getWindowInfo && wx.getWindowInfo().pixelRatio) || wx.getSystemInfoSync().pixelRatio || 2;
        } catch (e) {
          dpr = 2;
        }
        canvas.width = info.width * dpr;
        canvas.height = info.height * dpr;
        ctx.scale(dpr, dpr);
        this.canvas = canvas;
        this.ctx = ctx;
        this.cssW = info.width;
        this.cssH = info.height;
        this.canvasRect = { left: info.left, top: info.top };
        this.computeLayout();
        this.loadTextures(() => this.startRun());
      });
  },

  // 柜体 712x777 等比映射到画布（对应 project_board 的 factor 计算）
  // 原版 project_board（plushie_main.gd:231-239）：factor 取宽/高双约束的较小值，
  // 再用 _resize_tank 把底板下推，让机柜正好吃满画布高度 ——
  // 竖屏多出来的高度于是变成堆叠深度而不是上下留白。高宽比足够大时 floor 恰好回到 floorMin。
  computeLayout() {
    const f = Math.min(this.cssW / BOARD.cabinetW, this.cssH / BOARD.cabinetH);
    BOARD.floor = BOARD.cabinetY + this.cssH / f - BOARD.floorTrim;
    this.layout = {
      f,
      ox: (this.cssW - BOARD.cabinetW * f) / 2,
      oy: 0,
    };
  },

  toPxX(lx) {
    return this.layout.ox + (lx - BOARD.cabinetX) * this.layout.f;
  },

  toPxY(ly) {
    return this.layout.oy + (ly - BOARD.cabinetY) * this.layout.f;
  },

  toLogicX(px) {
    return (px - this.layout.ox) / this.layout.f + BOARD.cabinetX;
  },

  loadTextures(done) {
    // 玩偶 + 场景件：炸弹贴图、机柜唇边、照片底图、夹爪机构四件
    const jobs = TIERS.map((t) => [t.key, `${t.key}.png`]).concat(EXTRA_TEXTURES);
    let pending = jobs.length;
    const finish = () => {
      pending -= 1;
      if (pending <= 0) done();
    };
    jobs.forEach(([name, file]) => {
      const img = this.canvas.createImage();
      img.onload = finish;
      img.onerror = finish;
      img.src = `/mushies/images/${file}`;
      this.textures[name] = img;
    });
  },

  // ---------- 一局流程 ----------
  startRun() {
    this.stopLoop();
    this.world = new World({
      gravity: PHYS.gravity,
      bounds: { left: BOARD.left, right: BOARD.right, floor: BOARD.floor },
    });
    this.toys = [];
    this.particles = [];
    this.pendingMerges = [];
    this.session = new Session();
    this.clawState = 'holding';
    this.openness = 0;
    this.stateTimer = 0;
    this.overflowTime = 0;
    this.dangerCueArmed = true;
    this.exhaustedTime = 0;
    this.impactCooldown = 0;
    this.chainCount = 0;
    this.accumulator = 0;
    this.lastTs = 0;
    this.loadHeld();
    this.setData({
      status: 'playing',
      score: 0,
      merges: 0,
      drops: 0,
      discovered: 0,
      reasonText: '',
      summary: '',
      showRecords: false,
    });
    this.syncHud(true);
    this.startLoop();
  },

  loadHeld() {
    const tier = this.session.next(0);
    const span = spanOf(tier);
    this.held = { tier, span };
    this.aimX = clamp(this.aimX, BOARD.left + CLAW.clampHeld(span), BOARD.right - CLAW.clampHeld(span));
    this.clawState = 'holding';
    this.openness = 0;
    this.stateTimer = 0;
  },

  canDrop() {
    return this.clawState === 'holding' && this.toys.length < PHYS.maxToys;
  },

  requestDrop() {
    if (this.data.status !== 'playing' || !this.canDrop() || !this.held) return;
    this.clawState = 'opening';
    this.stateTimer = 0;
    audio.play('clawOpen');
  },

  releaseHeld() {
    const { held } = this;
    this.held = null;
    const { span } = held;
    const body = new Body(this.aimX, CLAW.heldY(span), radiusOf(held.tier), {
      mass: held.tier === BOMB_TIER ? PHYS.bombMass : PHYS.massOf(held.tier),
      restitution: PHYS.bounce,
      friction: PHYS.friction,
      linearDamp: PHYS.linearDamp,
      angularDamp: PHYS.angularDamp,
      vy: PHYS.releaseVy,
      angular: (Math.random() * 2 - 1) * PHYS.spin,
    });
    const toy = this.makeToy(held.tier, body);
    toy.age = 0;
    this.world.add(body);
    this.toys.push(toy);
    if (held.tier === BOMB_TIER) toy.armed = true;
    audio.play('release');
    this.session.advance();
    this.clawState = 'reloading';
    this.stateTimer = 0;
    audio.play('clawClose');
  },

  makeToy(tier, body) {
    const toy = {
      tier,
      body,
      age: 0,
      squish: 0,
      squishVel: 0,
      halo: 0,
      dangerTime: 0,
      impactCooldown: 0,
      mergeLocked: false,
      destroyPending: false,
      fuse: tier === BOMB_TIER ? RULES.fuse : 0,
      armed: false,
    };
    body.tag = toy;
    return toy;
  },

  updateClaw(dt) {
    if (this.clawState === 'opening') {
      this.stateTimer += dt;
      this.openness = clamp(this.stateTimer / CLAW.openTime, 0, 1);
      if (this.stateTimer >= CLAW.openTime) this.releaseHeld();
    } else if (this.clawState === 'reloading') {
      this.stateTimer += dt;
      this.openness = clamp(1 - this.stateTimer / CLAW.reloadTime, 0, 1);
      if (this.stateTimer >= CLAW.reloadTime) this.loadHeld();
    } else if (this.held) {
      this.openness = 0;
    }
  },

  // ---------- 物理与世界约束 ----------
  stepWorld(dt) {
    this.world.step(dt);
    this.handleContacts();
    // 原工程用 call_deferred 延一帧合并：先处理上一帧收集到的配对，再收集新的
    this.applyMerges();
    this.collectMerges();
    this.updateBombs();
  },

  // 撞击反馈：墙体与玩偶互撞都按接近速度（等价原工程 delta_v）驱动音效与挤压
  handleContacts() {
    const walls = this.world.wallImpacts;
    for (let i = 0; i < walls.length; i++) {
      const hit = walls[i];
      if (hit.body.tag) this.impact(hit.body.tag, hit.approach, hit.side !== 'floor');
    }
    const pairs = this.world.impacts;
    for (let i = 0; i < pairs.length; i++) {
      const hit = pairs[i];
      if (hit.a.tag) this.impact(hit.a.tag, hit.impulse, false);
      if (hit.b.tag) this.impact(hit.b.tag, hit.impulse, false);
    }
  },

  // strength 与冷却沿用原工程分级：delta_v>55 才响，墙体走 wall_tap
  impact(toy, deltaV, isWall) {
    if (deltaV < RULES.impactThreshold || toy.impactCooldown > 0) return;
    toy.impactCooldown = 0.15;
    const strength = Math.min(deltaV / 600, 1);
    toy.squishVel += clamp(strength, 0, 1) * SQUISH.impactGain;
    if (strength <= 0.2 || this.impactCooldown > 0) return;
    this.impactCooldown = 0.18;
    if (isWall) {
      audio.play('wall');
    } else if (toy.tier >= 6 || strength > 0.8) {
      audio.play('impactHeavy');
    } else {
      this.impactAlt = !this.impactAlt;
      audio.play(this.impactAlt ? 'impactA' : 'impactB');
    }
  },

  collectMerges() {
    const list = this.toys;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (a.mergeLocked || a.destroyPending || a.tier >= TOP_TIER) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (b.tier !== a.tier || b.mergeLocked || b.destroyPending) continue;
        const dx = b.body.x - a.body.x;
        const dy = b.body.y - a.body.y;
        const sum = a.body.r + b.body.r;
        if (dx * dx + dy * dy > sum * sum) continue;
        a.mergeLocked = true;
        b.mergeLocked = true;
        this.pendingMerges.push({ a, b });
      }
    }
  },

  // 原工程用 call_deferred 延一帧处理，这里等价的「本帧收集、下帧执行」
  applyMerges() {
    if (!this.pendingMerges.length) return;
    const queue = this.pendingMerges;
    this.pendingMerges = [];
    for (let i = 0; i < queue.length; i++) {
      const { a, b } = queue[i];
      if (a.body.removed || b.body.removed) {
        a.mergeLocked = false;
        b.mergeLocked = false;
        continue;
      }
      const tier = a.tier + 1;
      const span = spanOf(tier);
      const r = radiusOf(tier);
      let x = (a.body.x + b.body.x) / 2;
      let y = (a.body.y + b.body.y) / 2;
      const extentX = span * aspectOf(tier) * 0.5;
      x = clamp(x, BOARD.left + extentX + 4, BOARD.right - extentX - 4);
      y = Math.min(y, BOARD.floor - r - 4);
      const body = new Body(x, y, r, {
        mass: PHYS.massOf(tier),
        restitution: PHYS.bounce,
        friction: PHYS.friction,
        linearDamp: PHYS.linearDamp,
        angularDamp: PHYS.angularDamp,
        vx: (a.body.vx + b.body.vx) * MERGE.velFactor,
        vy: (a.body.vy + b.body.vy) * MERGE.velFactor + MERGE.popY,
      });
      const toy = this.makeToy(tier, body);
      toy.squishVel = MERGE.squishVelocity;
      toy.halo = MERGE.halo;
      this.world.remove(a.body);
      this.world.remove(b.body);
      this.dropToy(a);
      this.dropToy(b);
      this.world.add(body);
      this.toys.push(toy);
      this.onMerged(tier, x, y);
    }
  },

  dropToy(toy) {
    const idx = this.toys.indexOf(toy);
    if (idx >= 0) this.toys.splice(idx, 1);
  },

  onMerged(tier, x, y) {
    const now = this.session.elapsed;
    this.chainCount = now - this.chainAt <= CHAIN_WINDOW ? this.chainCount + 1 : 1;
    this.chainAt = now;
    const isNew = !this.session.discovered[tier];
    this.session.merge(tier);
    this.session.mark(tier);
    audio.play(tier >= 5 ? 'mergeLarge' : 'mergeSmall');
    if (this.chainCount >= 3) audio.play('chain');
    if (isNew) audio.play('discovery');
    this.burst(x, y, tier >= 6 ? 24 : 12, tier);
  },

  burst(x, y, count, tier) {
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const speed = 90 + Math.random() * 150;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - 40,
        life: 0.55,
        ttl: 0.55,
        tier,
      });
    }
  },

  // ---------- 炸弹 / 危险 / 结算 ----------
  updateBombs() {
    for (let i = 0; i < this.toys.length; i++) {
      const toy = this.toys[i];
      if (toy.tier !== BOMB_TIER || toy.destroyPending) continue;
      if (!toy.armed || toy.body.removed) continue;
      toy.fuse -= FIXED_DT;
      if (toy.fuse > 0) continue;
      toy.destroyPending = true;
      const margin = RULES.blastMargin;
      const victims = [toy];
      for (let j = 0; j < this.toys.length; j++) {
        const other = this.toys[j];
        if (other === toy || other.destroyPending) continue;
        const dx = other.body.x - toy.body.x;
        const dy = other.body.y - toy.body.y;
        const reach = toy.body.r + other.body.r + margin;
        if (dx * dx + dy * dy <= reach * reach) victims.push(other);
      }
      audio.play('bomb');
      for (let k = 0; k < victims.length; k++) {
        this.burst(victims[k].body.x, victims[k].body.y, 8, BOMB_TIER);
        this.world.remove(victims[k].body);
        this.dropToy(victims[k]);
      }
    }
  },

  updateDanger(dt) {
    const limit = BOARD.dangerY;
    let overflow = 0;
    let settled = this.toys.length > 0;
    for (let i = 0; i < this.toys.length; i++) {
      const toy = this.toys[i];
      const b = toy.body;
      toy.age += dt;
      toy.impactCooldown = Math.max(0, toy.impactCooldown - dt);
      const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      if (speed > RULES.settleSpeed || toy.mergeLocked) settled = false;
      const topY = b.y - b.r;
      const risky = toy.age > RULES.rescueAge && speed < RULES.rescueSpeed && topY < limit;
      toy.dangerTime = risky ? toy.dangerTime + dt : 0;
      if (toy.dangerTime > overflow) overflow = toy.dangerTime;
      // 每局一次的救援炸弹：越过安全线附近但还没判负时补给玩家
      if (risky && topY <= limit + RULES.rescueDistance) {
        this.session.grantRescueBomb(this.clawState === 'reloading' ? 0 : 1);
      }
    }
    this.overflowTime = overflow;
    if (overflow > RULES.dangerCue && this.dangerCueArmed) {
      this.dangerCueArmed = false;
      audio.play('danger');
    }
    if (overflow < RULES.dangerReset) this.dangerCueArmed = true;

    const canDrop = this.canDrop();
    this.exhaustedTime = !canDrop && !this.held ? this.exhaustedTime + dt : 0;
    if (overflow >= RULES.gameOverAt) return this.endRun('overflow');
    if (this.session.remaining() <= 0) return this.endRun('timeout');
    if (this.exhaustedTime >= RULES.exhaustedHard) return this.endRun('drops');
    if (settled && this.exhaustedTime >= RULES.exhaustedSettled) return this.endRun('drops');
    return undefined;
  },

  endRun(reason) {
    this.session.finish('defeat', reason);
    this.stopLoop();
    audio.loopStop('carriage');
    audio.play('gameOver');
    this.addRecord(reason);
    this.setData({
      status: 'lose',
      reasonText: REASON_TEXT[reason] || '游戏结束',
      summary: `${this.session.score} 分 · 合成 ${this.session.merges} 次 · ${Math.round(this.session.elapsed)} 秒`,
      merges: this.session.merges,
      bestScore: this.bestScore,
    });
  },

  // ---------- 记录（对应 leaderboard.gd：按分数降序，最多 10 条）----------
  loadRecords() {
    let rows = [];
    try {
      const raw = wx.getStorageSync(STORE_KEY);
      rows = raw ? JSON.parse(raw) : [];
    } catch (e) {
      rows = [];
    }
    this.records = Array.isArray(rows) ? rows.slice(0, MAX_RECORDS) : [];
    this.bestScore = this.records.length ? this.records[0].score : 0;
  },

  sortRecords() {
    this.records.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.duration !== b.duration) return a.duration - b.duration;
      return a.timestamp - b.timestamp;
    });
    this.records = this.records.slice(0, MAX_RECORDS);
  },

  addRecord(reason) {
    const row = {
      runId: this.runId,
      name: '我',
      score: this.session.score,
      stage: 1,
      outcome: 'defeat',
      reason,
      timestamp: Date.now(),
      duration: Math.round(this.session.elapsed * 10) / 10,
      config: '标准规则',
      eligible: true,
      merges: this.session.merges,
      timeText: formatTime(Date.now()),
    };
    const existed = this.records.some((item) => item.runId === row.runId);
    if (existed) return false;
    this.records.push(row);
    this.sortRecords();
    this.bestScore = this.records[0].score;
    try {
      wx.setStorageSync(STORE_KEY, JSON.stringify(this.records));
    } catch (e) {
      /* 存储失败时本局成绩仍可见 */
    }
    return true;
  },

  // ---------- 主循环 ----------
  startLoop() {
    if (this.rafId || !this.pageShown) return;
    const tick = (ts) => {
      this.rafId = this.canvas.requestAnimationFrame(tick);
      const now = ts / 1000;
      if (!this.lastTs) this.lastTs = now;
      let frame = now - this.lastTs;
      this.lastTs = now;
      if (frame > 0.05) frame = 0.05;
      this.update(frame);
      this.draw();
    };
    this.rafId = this.canvas.requestAnimationFrame(tick);
  },

  stopLoop() {
    if (this.rafId && this.canvas && this.canvas.cancelAnimationFrame) {
      this.canvas.cancelAnimationFrame(this.rafId);
    }
    this.rafId = null;
    this.lastTs = 0;
  },

  update(frame) {
    this.accumulator += frame;
    let guard = 0;
    while (this.accumulator >= FIXED_DT && guard < 5) {
      this.accumulator -= FIXED_DT;
      guard += 1;
      this.session.tick(FIXED_DT);
      this.updateClaw(FIXED_DT);
      this.stepWorld(FIXED_DT);
    }
    this.impactCooldown = Math.max(0, this.impactCooldown - frame);
    this.updateSquish(frame);
    this.updateParticles(frame);
    this.updateDanger(frame);
    if (this.session.outcome) return;
    this.syncHud(false);
  },

  updateSquish(dt) {
    const step = Math.min(dt, 0.033);
    for (let i = 0; i < this.toys.length; i++) {
      const toy = this.toys[i];
      toy.squishVel += (-SQUISH.k * toy.squish - SQUISH.c * toy.squishVel) * step;
      toy.squish = clamp(toy.squish + toy.squishVel * step, SQUISH.min, SQUISH.max);
      toy.halo = Math.max(0, toy.halo - dt * 1.6);
    }
  },

  updateParticles(dt) {
    const kept = [];
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) continue;
      p.vy += 420 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      kept.push(p);
    }
    this.particles = kept;
  },

  syncHud(force) {
    const s = this.session;
    const nextTier = s.next(1);
    const patch = {};
    if (force || this._lastScore !== s.score) patch.score = s.score;
    const clock = formatClock(s.remaining());
    if (force || this._lastClock !== clock) patch.timeText = clock;
    const goal = `${tierLabel(s.goalTier)}${s.goalTier === TOP_TIER ? ` ×${s.dragons + 1}` : ''}`;
    if (force || this._lastGoal !== goal) {
      patch.goalText = goal;
      patch.goalKey = TIERS[s.goalTier].key;
    }
    if (force || this._lastNext !== nextTier) {
      patch.nextName = tierLabel(nextTier);
      patch.nextKey = nextTier === BOMB_TIER ? 'puff-bomb' : TIERS[nextTier].key;
    }
    const hint =
      this.clawState === 'holding' ? (this.toys.length >= PHYS.maxToys ? '等待玩偶落稳…' : '可以投放') : '夹爪装填中…';
    if (force || this._lastHint !== hint) patch.hint = hint;
    if (patch.score !== undefined) this._lastScore = s.score;
    if (patch.timeText !== undefined) this._lastClock = clock;
    if (patch.goalText !== undefined) this._lastGoal = goal;
    if (patch.nextName !== undefined) this._lastNext = nextTier;
    if (patch.hint !== undefined) this._lastHint = hint;
    if (Object.keys(patch).length) this.setData(patch);
  },

  // ---------- 绘制 ----------
  // 层序照原版：底图 → 机柜 → 导轨吊索 → 危险线 → 后臂 → 玩偶 → 唇边（原版 z7 在玩偶之上）
  // → 粒子 → 爪毂 → 前臂 → 暖色滤镜。拆成后臂/前臂两次绘制才能把手里那个玩偶夹住。
  draw() {
    const { ctx } = this;
    if (!ctx || !this.layout) return;
    const { f } = this.layout;
    ctx.clearRect(0, 0, this.cssW, this.cssH);
    this.drawBackground(ctx);
    this.drawCabinet(ctx, f);
    this.drawRig(ctx, f);
    this.drawDangerLine(ctx, f);
    const g = this.clawGeom();
    this.drawClawArm(ctx, f, g, -1);
    for (let i = 0; i < this.toys.length; i++) this.drawToy(ctx, this.toys[i], f);
    this.drawHeld(ctx, f);
    this.drawTrim(ctx, f);
    this.drawParticles(ctx, f);
    this.drawClawHub(ctx, f, g);
    this.drawClawArm(ctx, f, g, 1);
    this.drawFilter(ctx);
  },

  // 原版背景三层：照片底图（cover 铺满）+ 奶白罩色 + 紫红椭圆暗角
  drawBackground(ctx) {
    const w = this.cssW;
    const h = this.cssH;
    const img = this.textures.arcade;
    if (img && img.width) {
      const k = Math.max(w / img.width, h / img.height);
      const dw = img.width * k;
      const dh = img.height * k;
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    }
    ctx.fillStyle = 'rgba(250,240,230,0.68)';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(1, h / w);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.58);
    g.addColorStop(0, 'rgba(74,42,63,0)');
    g.addColorStop(0.62, 'rgba(74,42,63,0)');
    g.addColorStop(1, 'rgba(74,42,63,0.34)');
    ctx.fillStyle = g;
    ctx.fillRect(-w, -w, w * 2, w * 2);
    ctx.restore();
  },

  // 机柜：原版是 4 层嵌套圆角矩形（外壳→奶白软包→深紫内壁→玻璃），全部代码绘制、无贴图
  drawCabinet(ctx, f) {
    const ext = BOARD.floor - BOARD.floorMin; // 原版 tank_rect 的纵向延伸量，默认 80
    const box = (x, y, w, h, r, fill, border, bw) => {
      this.roundRect(ctx, this.toPxX(x), this.toPxY(y), w * f, h * f, r * f);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = bw * f;
      ctx.strokeStyle = border;
      ctx.stroke();
    };
    box(365, 128, 710, 760 + ext, 40, '#cbb1db', '#aa8fb9', 3);
    box(378, 140, 684, 730 + ext, 32, '#eee1f0', '#f8f0f7', 3);
    box(390, 162, 660, 700 + ext, 24, '#9e7c96', '#b095a5', 3);
    box(400, 176, 640, 676 + ext, 16, '#f9ecdf', '#d9b8a9', 2);

    // 玻璃只有两条竖反光：没有渐变、灯晕、帷幔与小装饰，也没有两侧暗角
    const vline = (x, y1, y2, color, w) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = w * f;
      ctx.beginPath();
      ctx.moveTo(this.toPxX(x), this.toPxY(y1));
      ctx.lineTo(this.toPxX(x), this.toPxY(y2));
      ctx.stroke();
    };
    vline(411, 216, 730 + ext, 'rgba(255,255,255,0.62)', 4);
    vline(1028, 246, 729 + ext, 'rgba(255,255,255,0.45)', 2);
  },

  // 底部唇边：336×70 贴图三段拼接（两端原样、中段横向拉伸），画在玩偶之上才压得住堆底
  drawTrim(ctx, f) {
    const img = this.textures.trim;
    if (!img || !img.width) return;
    const y = this.toPxY(BOARD.floor - 17);
    const parts = [
      [364, 84, 0],
      [448, 544, 84],
      [992, 84, 252],
    ];
    parts.forEach((p) => {
      ctx.drawImage(img, p[2], 0, 84, 70, this.toPxX(p[0]), y, p[1] * f, 70 * f);
    });
  },

  // 暖色滤镜：原版是 HUD 之上的全屏 ColorRect，intensity 0.18 ⇒ alpha 0.0216
  drawFilter(ctx) {
    ctx.fillStyle = 'rgba(224,140,87,0.0216)';
    ctx.fillRect(0, 0, this.cssW, this.cssH);
  },

  drawDangerLine(ctx, f) {
    const alpha = clamp(this.overflowTime / RULES.gameOverAt, 0, 1) * 0.85;
    if (alpha <= 0.02) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#e0607a';
    ctx.lineWidth = 2.5 * f;
    ctx.setLineDash([10 * f, 8 * f]);
    const y = this.toPxY(BOARD.dangerY);
    ctx.beginPath();
    ctx.moveTo(this.toPxX(BOARD.left), y);
    ctx.lineTo(this.toPxX(BOARD.right), y);
    ctx.stroke();
    ctx.restore();
  },

  drawToy(ctx, toy, f) {
    const bomb = toy.tier === BOMB_TIER;
    const img = this.textures[bomb ? 'bomb' : TIERS[toy.tier].key];
    const b = toy.body;
    const span = spanOf(toy.tier);
    const w = span * aspectOf(toy.tier) * f;
    const h = span * f;
    const visual = 1 + toy.squish * SQUISH.amount;
    ctx.save();
    ctx.translate(this.toPxX(b.x), this.toPxY(b.y));
    ctx.rotate(b.angle);
    ctx.scale(visual, 1 / visual);
    if (toy.halo > 0) {
      ctx.globalAlpha = clamp(toy.halo, 0, 1) * 0.5;
      ctx.beginPath();
      ctx.arc(0, 0, b.r * f * 1.25, 0, Math.PI * 2);
      ctx.fillStyle = '#fff2b0';
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (img && img.width) {
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, b.r * f, 0, Math.PI * 2);
      ctx.fillStyle = '#d9b7e8';
      ctx.fill();
    }
    ctx.restore();
    // 引信徽章只在松手后出现：原版 held_toy 不计时、不显示倒计时
    if (toy.tier === BOMB_TIER && toy.armed) this.drawFuse(ctx, toy, f);
  },

  // 手里那个玩偶：原版是真实节点 held_toy（plushie_main.gd:361、:273），每帧钉在
  // (aim_x, held_y()) 并 freeze，所以要画在夹爪之下、跟着瞄准一起移动
  drawHeld(ctx, f) {
    if (!this.held) return;
    const { tier, span } = this.held;
    this.drawToy(
      ctx,
      {
        tier,
        body: { x: this.aimX, y: CLAW.heldY(span), angle: 0, r: radiusOf(tier) },
        squish: SQUISH.heldValue,
        halo: 0,
        armed: false,
      },
      f,
    );
  },

  drawFuse(ctx, toy, f) {
    const b = toy.body;
    const cx = this.toPxX(b.x);
    const cy = this.toPxY(b.y - b.r) - 14 * f;
    const ratio = clamp(toy.fuse / RULES.fuse, 0, 1);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 11 * f, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(60,40,70,0.75)';
    ctx.fill();
    ctx.beginPath();
    ctx.strokeStyle = '#ffd76e';
    ctx.lineWidth = 2.5 * f;
    ctx.arc(cx, cy, 11 * f, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = `${Math.round(11 * f)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(Math.ceil(toy.fuse)), cx, cy + 0.5 * f);
    ctx.restore();
  },

  drawParticles(ctx, f) {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      ctx.save();
      ctx.globalAlpha = clamp(p.life / p.ttl, 0, 1) * 0.8;
      ctx.fillStyle = p.tier === BOMB_TIER ? '#c39ad9' : '#ffcf6b';
      ctx.beginPath();
      ctx.arc(this.toPxX(p.x), this.toPxY(p.y), 3.2 * f, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  },

  // ---------- 夹爪机构 ----------
  // 抓臂几何只用「距瞄准中心的横向偏移」表达，左臂由 scale(-1,1) 镜像得到，两臂严格对称。
  // 各件位置沿用原版灰色金属件的坐标，只换材质，投放手感（aimX / heldY）不受影响。
  clawGeom() {
    const spread = this.openness;
    const tier = this.held ? this.held.tier : this.session.next(0);
    const span = this.held ? this.held.span : spanOf(tier);
    const halfW = (span * aspectOf(tier)) / 2;
    return {
      aimX: this.aimX,
      rootX: 15,
      rootY: 246,
      // 指尖收进玩偶轮廓内侧才像夹住，张开时摆到外缘
      tipX: halfW * (0.8 + spread * 0.62),
      tipY: CLAW.heldY(span) + span * 0.22,
      // 粗细跟着玩偶走，大菇配粗爪
      thick: span * 0.26,
    };
  },

  // 吊索 + 导轨，画在玩偶之下。奶白编绳压在奶白内衬上对比不足，先垫一条深紫芯当描边。
  drawRig(ctx, f) {
    const { aimX } = this;
    const rope = this.textures.clawRope;
    if (rope && rope.width) {
      const y1 = this.toPxY(195);
      const y2 = this.toPxY(248);
      const rw = 14 * f;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#8a6f8a';
      ctx.lineWidth = rw + 2.5 * f;
      ctx.beginPath();
      ctx.moveTo(this.toPxX(aimX), y1);
      ctx.lineTo(this.toPxX(aimX), y2);
      ctx.stroke();
      ctx.drawImage(rope, this.toPxX(aimX) - rw / 2, y1, rw, y2 - y1);
      ctx.restore();
    }
    const rail = this.textures.clawRail;
    if (rail && rail.width) {
      // 导轨贴图是「奶白滚边 + 绗缝」的横截面带，按自身宽高比铺满轨长不拉伸，
      // 再用胶囊形圆角裁掉两端的硬切边
      const w = 610 * f;
      const h = (w * rail.height) / rail.width;
      const x = this.toPxX(415);
      const y = this.toPxY(186) - h / 2;
      ctx.save();
      this.roundRect(ctx, x, y, w, h, h / 2);
      ctx.clip();
      ctx.drawImage(rail, x, y, w, h);
      ctx.restore();
    }
  },

  // 一根抓臂 = 一次贴图：关节盘落在爪毂下缘，圆头落在指尖，弧度由贴图自带
  drawClawArm(ctx, f, g, side) {
    const img = this.textures.clawArm;
    if (!img || !img.width) return;
    const cx = this.toPxX(g.aimX);
    ctx.save();
    ctx.translate(cx, 0);
    ctx.scale(side, 1);
    ctx.translate(-cx, 0);
    const x1 = this.toPxX(g.aimX + g.rootX);
    const y1 = this.toPxY(g.rootY);
    const dx = this.toPxX(g.aimX + g.tipX) - x1;
    const dy = this.toPxY(g.tipY) - y1;
    const len = Math.hypot(dx, dy);
    if (len < 1) {
      ctx.restore();
      return;
    }
    const th = g.thick * f;
    ctx.translate(x1, y1);
    ctx.rotate(Math.atan2(dy, dx));
    ctx.drawImage(img, 0, -th / 2, len, th);
    ctx.restore();
  },

  drawClawHub(ctx, f, g) {
    const img = this.textures.clawHub;
    if (!img || !img.width) return;
    const w = 48 * f;
    const h = (w * img.height) / img.width;
    ctx.drawImage(img, this.toPxX(g.aimX) - w / 2, this.toPxY(244) - h / 2, w, h);
  },

  roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  },

  // ---------- 输入 ----------
  aimFromTouch(touch) {
    if (!touch || !this.layout) return;
    const px = touch.clientX - this.canvasRect.left;
    const span = this.held ? this.held.span : spanOf(this.session.next(0));
    const limit = CLAW.clampHeld(span);
    this.aimX = clamp(this.toLogicX(px), BOARD.left + limit, BOARD.right - limit);
  },

  onTouch(e) {
    if (this.data.status !== 'playing') return;
    const touches = e.touches && e.touches.length ? e.touches : e.changedTouches;
    const t = touches && touches[0];
    if (!t) return;
    if (e.type === 'touchstart') {
      if (this.touchId !== null) return;
      this.touchId = t.identifier;
      audio.play('click');
      audio.loopPlay('carriage');
      this.aimFromTouch(t);
    } else if (e.type === 'touchmove') {
      if (this.touchId !== null && t.identifier !== this.touchId) return;
      this.aimFromTouch(t);
    } else {
      if (this.touchId !== null && t.identifier !== this.touchId) return;
      this.touchId = null;
      audio.loopStop('carriage');
      this.aimFromTouch(t);
      this.requestDrop();
    }
  },

  onTouchCancel() {
    this.touchId = null;
    audio.loopStop('carriage');
  },

  // ---------- 界面按钮 ----------
  // 弹层关闭后决定是否恢复渲染循环：只有「对局中且没有任何弹层」才跑，否则补一帧静态绘制
  afterModal() {
    const d = this.data;
    const blocked = d.showRecords || d.showPause || d.showHelp || d.showSettings;
    if (d.status === 'playing' && !blocked) this.startLoop();
    else this.draw();
  },

  // PC 端/模拟器会把一次鼠标点击合成两次 tap，第二次落在刚挂载的遮罩上，
  // 弹框刚开就被关掉、循环刚停就复活 —— 表现为「点暂停没反应、计时没停」。
  // 所以遮罩只认落在自己身上的 touchstart：打开弹层时解除武装，收到 touchstart 才允许关闭一次。
  onMaskTouchStart() {
    this._maskArmed = true;
  },

  // 消费一次武装：未武装说明是同一次点击的重复 tap，忽略
  maskCloseArmed() {
    const ok = !!this._maskArmed;
    this._maskArmed = false;
    return ok;
  },

  onStart() {
    audio.play('open');
    if (this.canvas) {
      this.startRun();
    } else {
      // 首页时画布 hidden 未初始化：先显示画布再 setupCanvas（贴图加载完会自动 startRun）
      this.setData({ status: 'playing', showHelp: false }, () => this.setupCanvas(0));
    }
  },

  onGoHome() {
    audio.play('click');
    this.stopLoop();
    audio.loopStop('carriage');
    this.setData({
      status: 'title',
      showRecords: false,
      showHelp: false,
      showSettings: false,
      showPause: false,
    });
  },

  // 原版对局中没有底部按钮条，暂停键在 HUD 右上角；停循环即冻结物理、计时与引信
  onPause() {
    if (this.data.status !== 'playing') return;
    audio.play('open');
    this.stopLoop();
    audio.loopStop('carriage');
    this._maskArmed = false;
    this.setData({ showPause: true });
  },

  onResume() {
    if (!this.maskCloseArmed()) return;
    this.setData({ showPause: false }, () => this.afterModal());
  },

  onShowHelp() {
    audio.play('open');
    this._maskArmed = false;
    this.setData({ showHelp: true });
  },

  onCloseHelp() {
    if (!this.maskCloseArmed()) return;
    this.setData({ showHelp: false }, () => this.afterModal());
  },

  onShowSettings() {
    audio.play('open');
    this._maskArmed = false;
    this.setData({ showSettings: true, showPause: false });
  },

  onCloseSettings() {
    if (!this.maskCloseArmed()) return;
    this.setData({ showSettings: false }, () => this.afterModal());
  },

  onToggleReducedMotion(e) {
    const next = !!(e.detail && e.detail.value);
    this.setData({ reducedMotion: next });
    try {
      wx.setStorageSync(RM_KEY, next ? 1 : 0);
    } catch (err) {
      /* 存储失败只影响下次进入 */
    }
  },

  onRestart() {
    audio.play('restart');
    this.setData({ showPause: false });
    this.startRun();
  },

  onToggleMute(e) {
    // 图标/按钮是 tap（取反），设置弹框里是 switch 的 change（用事件值）
    const fromSwitch = !!(e && e.detail && typeof e.detail.value === 'boolean');
    const next = fromSwitch ? e.detail.value : !this.data.muted;
    audio.setMuted(next);
    this.setData({ muted: next });
  },

  onShowRecords() {
    audio.play('open');
    // 记录面板打开时暂停：物理与计时都由渲染循环驱动，停循环即冻结
    this.stopLoop();
    audio.loopStop('carriage');
    this._maskArmed = false;
    this.setData({ showRecords: true, records: this.records });
  },

  onCloseRecords() {
    if (!this.maskCloseArmed()) return;
    this.setData({ showRecords: false }, () => this.afterModal());
  },

  // ---------- 分享（转发好友 / 朋友圈）：优先报本局战绩，无本局则报历史最佳 ----------
  shareTitle() {
    const s = this.session;
    if (s && s.score > 0) {
      const top = s.highest >= 0 ? `，合成了${tierLabel(s.highest)}` : '';
      return `我在菇菇合成机拿下 ${s.score} 分${top}，来比比？`;
    }
    if (this.bestScore) return `我在菇菇合成机最高 ${this.bestScore} 分，来比比？`;
    return '菇菇合成机：夹一只 Mushies，两只相同就能合成更大的！';
  },

  onShareAppMessage() {
    return { title: this.shareTitle(), path: '/mushies/pages/index/index' };
  },

  onShareTimeline() {
    return { title: this.shareTitle(), query: '' };
  },

  noop() {},
});
