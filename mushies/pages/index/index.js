// mushies/pages/index/index.js
// 菇菇合成机（Mushies 移植版）：娃娃机夹爪投放 + 同级合成升阶 + 安全线超时判定。
// 规则与手感参数来自 Godot 工程，逐条标注在 rules.js；这里只负责表现与输入。
// 原工程的「同键盘双人」模式在触屏上无法成立，未移植（device_layout.gd:39 在移动端本就禁用）。
import {
  TIERS,
  TOP_TIER,
  BOMB_TIER,
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
const aspectOf = (tier) => (tier === BOMB_TIER ? 0.85 : TIERS[tier].aspect);

Page({
  data: {
    score: 0,
    timeText: '3:00',
    goalText: '',
    nextKey: '',
    nextName: '',
    heldName: '',
    drops: 0,
    discovered: 0,
    hint: '可以投放',
    status: 'playing',
    reasonText: '',
    summary: '',
    merges: 0,
    records: [],
    showRecords: false,
    muted: false,
    bestScore: 0,
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
    this.setData({ muted: audio.isMuted(), bestScore: this.bestScore });
  },

  onReady() {
    this.setupCanvas(0);
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
  computeLayout() {
    const f = Math.min((this.cssW - 16) / BOARD.cabinetW, (this.cssH - 16) / BOARD.cabinetH);
    this.layout = {
      f,
      ox: (this.cssW - BOARD.cabinetW * f) / 2,
      oy: (this.cssH - BOARD.cabinetH * f) / 2,
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
    let pending = TIERS.length;
    const finish = () => {
      pending -= 1;
      if (pending <= 0) done();
    };
    TIERS.forEach((tier) => {
      const img = this.canvas.createImage();
      img.onload = finish;
      img.onerror = finish;
      img.src = `/mushies/images/${tier.key}.png`;
      this.textures[tier.key] = img;
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
    if (force || this._lastDrops !== s.drops) patch.drops = s.drops;
    const found = s.discoveredCount();
    if (force || this._lastFound !== found) patch.discovered = found;
    const goal = `${tierLabel(s.goalTier)}${s.goalTier === TOP_TIER ? ` ×${s.dragons + 1}` : ''}`;
    if (force || this._lastGoal !== goal) patch.goalText = goal;
    if (force || this._lastNext !== nextTier) {
      patch.nextName = tierLabel(nextTier);
      patch.nextKey = nextTier === BOMB_TIER ? '' : TIERS[nextTier].key;
    }
    const heldName = this.held ? tierLabel(this.held.tier) : '装填中';
    if (force || this._lastHeld !== heldName) patch.heldName = heldName;
    const hint =
      this.clawState === 'holding' ? (this.toys.length >= PHYS.maxToys ? '等待玩偶落稳…' : '可以投放') : '夹爪装填中…';
    if (force || this._lastHint !== hint) patch.hint = hint;
    if (patch.score !== undefined) this._lastScore = s.score;
    if (patch.timeText !== undefined) this._lastClock = clock;
    if (patch.drops !== undefined) this._lastDrops = s.drops;
    if (patch.discovered !== undefined) this._lastFound = found;
    if (patch.goalText !== undefined) this._lastGoal = goal;
    if (patch.nextName !== undefined) this._lastNext = nextTier;
    if (patch.heldName !== undefined) this._lastHeld = heldName;
    if (patch.hint !== undefined) this._lastHint = hint;
    if (Object.keys(patch).length) this.setData(patch);
  },

  // ---------- 绘制 ----------
  draw() {
    const { ctx } = this;
    if (!ctx || !this.layout) return;
    const { f } = this.layout;
    ctx.clearRect(0, 0, this.cssW, this.cssH);
    this.drawCabinet(ctx, f);
    this.drawDangerLine(ctx, f);
    for (let i = 0; i < this.toys.length; i++) this.drawToy(ctx, this.toys[i], f);
    this.drawParticles(ctx, f);
    this.drawClaw(ctx, f);
  },

  drawCabinet(ctx, f) {
    const x = this.toPxX(BOARD.cabinetX);
    const y = this.toPxY(BOARD.cabinetY);
    const w = BOARD.cabinetW * f;
    const h = BOARD.cabinetH * f;
    ctx.save();
    this.roundRect(ctx, x, y, w, h, 26 * f);
    ctx.fillStyle = '#fdece2';
    ctx.fill();
    ctx.lineWidth = 10 * f;
    ctx.strokeStyle = '#c9a7dd';
    ctx.stroke();
    const glassX = this.toPxX(BOARD.left);
    const glassY = this.toPxY(BOARD.top);
    const glassW = (BOARD.right - BOARD.left) * f;
    const glassH = (BOARD.floor - BOARD.top) * f;
    ctx.beginPath();
    ctx.rect(glassX, glassY, glassW, glassH);
    ctx.clip();
    const grad = ctx.createLinearGradient(glassX, glassY, glassX, glassY + glassH);
    grad.addColorStop(0, '#fffaf5');
    grad.addColorStop(1, '#f7e3d6');
    ctx.fillStyle = grad;
    ctx.fillRect(glassX, glassY, glassW, glassH);
    ctx.restore();
    // 地板
    ctx.fillStyle = '#e7c9b6';
    ctx.fillRect(glassX, this.toPxY(BOARD.floor), glassW, 6 * f);
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
    const tier = bomb ? null : TIERS[toy.tier];
    const img = bomb ? null : this.textures[tier.key];
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
    if (toy.tier === BOMB_TIER) this.drawFuse(ctx, toy, f);
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

  // 夹爪：横轨 + 吊杆 + 两指，开合度 openness 驱动（vfx/board_ink.gd:8-26）
  drawClaw(ctx, f) {
    const spread = this.openness;
    const { aimX } = this;
    const span = this.held ? this.held.span : spanOf(this.session.next(0));
    const hw = (span * aspectOf(this.held ? this.held.tier : this.session.next(0))) / 2;
    const heldY = CLAW.heldY(span);
    ctx.save();
    ctx.strokeStyle = '#8f7ba8';
    ctx.lineCap = 'round';
    ctx.lineWidth = 4 * f;
    ctx.beginPath();
    ctx.moveTo(this.toPxX(BOARD.left), this.toPxY(193));
    ctx.lineTo(this.toPxX(BOARD.right), this.toPxY(193));
    ctx.stroke();
    ctx.lineWidth = 3.5 * f;
    ctx.beginPath();
    ctx.moveTo(this.toPxX(aimX), this.toPxY(236));
    ctx.lineTo(this.toPxX(aimX), this.toPxY(heldY - span * 0.35));
    ctx.stroke();
    const joints = [
      [aimX - (hw + 9 + spread * 25), 254 + span * 0.16],
      [aimX + (hw + 9 + spread * 25), 254 + span * 0.16],
    ];
    const tips = [
      [aimX - (hw * 0.66 + spread * 54), heldY + span * 0.25 - spread * 17],
      [aimX + (hw * 0.66 + spread * 54), heldY + span * 0.25 - spread * 17],
    ];
    ctx.lineWidth = 4.5 * f;
    ctx.strokeStyle = '#7a6494';
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.moveTo(this.toPxX(aimX), this.toPxY(heldY - span * 0.3));
      ctx.lineTo(this.toPxX(joints[i][0]), this.toPxY(joints[i][1]));
      ctx.lineTo(this.toPxX(tips[i][0]), this.toPxY(tips[i][1]));
      ctx.stroke();
    }
    ctx.restore();
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
  onRestart() {
    audio.play('restart');
    this.startRun();
  },

  onToggleMute() {
    const next = !this.data.muted;
    audio.setMuted(next);
    this.setData({ muted: next });
  },

  onShowRecords() {
    audio.play('open');
    // 记录面板打开时暂停：物理与计时都由渲染循环驱动，停循环即冻结
    this.stopLoop();
    audio.loopStop('carriage');
    this.setData({ showRecords: true, records: this.records });
  },

  onCloseRecords() {
    this.setData({ showRecords: false });
    if (this.data.status === 'playing') this.startLoop();
    else this.draw();
  },

  noop() {},
});
