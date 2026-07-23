// game/pages/arrowEscape/index.js 箭头逃脱
import {
  getLevel,
  TOTAL_LEVELS,
  DIR_VEC,
  PALETTE
} from './levels';
import audio from './audio';

const MAX_LIVES = 5;
// 像素坐标下的方向向量（x 右为正，y 下为正）
const DIR_PIX = {
  U: [0, -1],
  D: [0, 1],
  L: [-1, 0],
  R: [1, 0]
};

// 游玩记录（最多保留 10 条）
const SCORE_KEY = 'arrowEscapeScores';
const MAX_RECORDS = 10;
const pad2 = (n) => (n < 10 ? '0' + n : '' + n);
const formatTime = (ts) => {
  const d = new Date(ts);
  return `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

// 将十六进制颜色加深，用于箭头描边
const darken = (hex, f) => {
  const h = hex.replace('#', '');
  const r = parseInt(h.substr(0, 2), 16);
  const g = parseInt(h.substr(2, 2), 16);
  const b = parseInt(h.substr(4, 2), 16);
  const d = (v) => Math.max(0, Math.round(v * (1 - f)));
  const to2 = (v) => ('0' + v.toString(16)).slice(-2);
  return '#' + to2(d(r)) + to2(d(g)) + to2(d(b));
};

Page({
  data: {
    level: 1,
    total: TOTAL_LEVELS,
    lives: MAX_LIVES,
    maxLives: MAX_LIVES,
    hearts: [],
    status: 'playing', // playing | win | lose
    isLastLevel: false,
    records: [],
    showRecords: false,
    muted: false,
  },

  onLoad() {
    const saved = wx.getStorageSync('arrowEscapeLevel');
    this.levelIndex = Number.isInteger(saved) ? Math.min(saved, TOTAL_LEVELS - 1) : 0;
    this.arrows = [];
    this.layoutInfo = null;
    this.rafId = null;
    this.lastTs = 0;
    this.pageShown = true;
    this._nextTimer = null;
    this.loadRecords();
    audio.init();
    this.setData({ muted: audio.isMuted() });
  },

  onReady() {
    this.setupCanvas(0);
  },

  setupCanvas(retry) {
    const query = wx.createSelectorQuery().in(this);
    query.select('#gameCanvas').fields({
      node: true,
      size: true,
      rect: true,
    }).exec((res) => {
      const info = res && res[0];
      // 布局未就绪（宽高为 0）时稍后重试，避免画布空白不显示
      if (!info || !info.node || !info.width || !info.height) {
        if (retry < 5) setTimeout(() => this.setupCanvas(retry + 1), 60);
        return;
      }
      if (this.canvas) return; // 已初始化，避免重复 scale

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
      this.dpr = dpr;
      this.cssW = info.width;
      this.cssH = info.height;
      this.canvasRect = { left: info.left, top: info.top };

      this.initLevel(this.levelIndex);
    });
  },

  onShow() {
    this.pageShown = true;
    if (this.canvas) {
      this.draw();
      if (this.hasActiveAnim()) this.startLoop();
    }
  },

  onHide() {
    this.pageShown = false;
    this.stopLoop();
    this.clearNextTimer();
  },

  onUnload() {
    this.pageShown = false;
    this.stopLoop();
    this.clearNextTimer();
    audio.destroy();
  },

  // ---------- 关卡初始化 ----------
  initLevel(index) {
    const lv = getLevel(index);
    this.cols = lv.cols;
    this.rows = lv.rows;
    this.arrows = lv.arrows.map((a, i) => {
      const color = PALETTE[i % PALETTE.length];
      return {
        id: i,
        cells: a.cells.map((c) => [c[0], c[1]]),
        dir: a.dir,
        color,
        outline: darken(color, 0.4),
        removed: false,
        exiting: false,
        prog: 0,
        exitTarget: 0,
        shakeT: 0,
        pressT: 0,
      };
    });
    this.winHandled = false;

    this.computeLayout();
    this.setData({
      level: index + 1,
      lives: MAX_LIVES,
      status: 'playing',
      isLastLevel: index >= TOTAL_LEVELS - 1,
      hearts: this.buildHearts(MAX_LIVES),
    }, () => this.draw());
  },

  buildHearts(lives) {
    const arr = [];
    for (let i = 0; i < MAX_LIVES; i++) arr.push(i < lives ? 1 : 0);
    return arr;
  },

  computeLayout() {
    const pad = 14;
    const availW = this.cssW - pad * 2;
    const availH = this.cssH - pad * 2;
    const cell = Math.floor(Math.min(availW / this.cols, availH / this.rows));
    const boardW = cell * this.cols;
    const boardH = cell * this.rows;
    const originX = (this.cssW - boardW) / 2;
    const originY = (this.cssH - boardH) / 2;
    this.layoutInfo = {
      cell,
      originX,
      originY,
      boardW,
      boardH,
      pad
    };
  },

  // ---------- 主循环 ----------
  startLoop() {
    if (this.rafId || !this.canvas) return;
    this.lastTs = 0;
    const loop = (ts) => {
      if (!this.pageShown) {
        this.rafId = null;
        return;
      }
      if (!this.lastTs) this.lastTs = ts;
      let dt = (ts - this.lastTs) / 1000;
      this.lastTs = ts;
      if (dt > 0.05) dt = 0.05;
      const active = this.update(dt);
      this.draw();
      // 仅在有动画时持续渲染，空闲即停，避免持续占用 CPU / 耗电
      if (active) {
        this.rafId = this.canvas.requestAnimationFrame(loop);
      } else {
        this.rafId = null;
      }
    };
    this.rafId = this.canvas.requestAnimationFrame(loop);
  },

  hasActiveAnim() {
    return this.arrows.some((a) => !a.removed && (a.exiting || a.shakeT > 0 || a.pressT > 0));
  },

  stopLoop() {
    if (this.rafId && this.canvas) {
      this.canvas.cancelAnimationFrame(this.rafId);
    }
    this.rafId = null;
  },

  update(dt) {
    const speed = 16; // 每秒滑动格数
    let removedNow = false;
    let active = false;
    for (const a of this.arrows) {
      if (a.removed) continue;
      if (a.pressT > 0) {
        a.pressT = Math.max(0, a.pressT - dt);
        if (a.pressT > 0) active = true;
      }
      if (a.exiting) {
        a.prog += speed * dt;
        if (a.prog >= a.exitTarget) {
          a.removed = true;
          removedNow = true;
        } else {
          active = true;
        }
      } else if (a.shakeT > 0) {
        a.shakeT = Math.max(0, a.shakeT - dt);
        if (a.shakeT > 0) active = true;
      }
    }
    if (removedNow) this.checkWin();
    return active;
  },

  checkWin() {
    if (this.winHandled) return;
    const allGone = this.arrows.every((a) => a.removed);
    if (allGone) {
      this.winHandled = true;
      const nextIdx = Math.min(this.levelIndex + 1, TOTAL_LEVELS - 1);
      const unlocked = wx.getStorageSync('arrowEscapeLevel') || 0;
      if (nextIdx > unlocked) wx.setStorageSync('arrowEscapeLevel', nextIdx);
      this.addRecord(this.data.level, 'win');
      audio.play('win');
      try {
        wx.vibrateShort({
          type: 'medium'
        });
      } catch (e) {}
      this.setData({
        status: 'win'
      });
      // 过关后自动进入下一关（不依赖点击可能被遮挡的按钮）；最后一关不自动跳转
      this.clearNextTimer();
      if (this.levelIndex < TOTAL_LEVELS - 1) {
        this._nextTimer = setTimeout(() => {
          this._nextTimer = null;
          this.goNextLevel();
        }, 1100);
      }
    }
  },

  clearNextTimer() {
    if (this._nextTimer) {
      clearTimeout(this._nextTimer);
      this._nextTimer = null;
    }
  },

  // ---------- 交互 ----------
  onTouch(e) {
    if (this.data.status !== 'playing') return;
    if (!this.layoutInfo) return;
    const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
    if (!t) return;
    const {
      cell,
      originX,
      originY
    } = this.layoutInfo;
    // 用 clientX/clientY 减去画布在视口中的位置，得到相对画布坐标（比 t.x/t.y 更可靠）
    const rect = this.canvasRect || { left: 0, top: 0 };
    const clientX = t.clientX != null ? t.clientX : t.x;
    const clientY = t.clientY != null ? t.clientY : t.y;
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const c = Math.floor((px - originX) / cell);
    const r = Math.floor((py - originY) / cell);
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return;

    const arrow = this.arrows.find(
      (a) => !a.removed && !a.exiting && a.cells.some((cc) => cc[0] === r && cc[1] === c)
    );
    if (!arrow) return;
    this.attemptMove(arrow);
  },

  attemptMove(arrow) {
    arrow.pressT = 0.16;
    const others = new Set();
    for (const a of this.arrows) {
      if (a === arrow || a.removed) continue;
      for (const [r, c] of a.cells) others.add(r + ',' + c);
    }
    if (this.canExit(arrow.cells, arrow.dir, others)) {
      arrow.exiting = true;
      arrow.prog = 0;
      arrow.exitTarget = this.computeExitTarget(arrow);
      audio.play('move');
      try {
        wx.vibrateShort({
          type: 'light'
        });
      } catch (e) {}
    } else {
      arrow.shakeT = 0.36;
      this.loseLife();
      audio.play('blocked');
      try {
        wx.vibrateShort({
          type: 'heavy'
        });
      } catch (e) {}
    }
    this.startLoop();
  },

  canExit(cells, dir, othersSet) {
    const [dr, dc] = DIR_VEC[dir];
    for (let k = 1; ; k++) {
      let anyIn = false;
      for (const [r, c] of cells) {
        const nr = r + dr * k;
        const nc = c + dc * k;
        if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
          anyIn = true;
          if (othersSet.has(nr + ',' + nc)) return false;
        }
      }
      if (!anyIn) return true;
    }
  },

  computeExitTarget(arrow) {
    let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
    for (const [r, c] of arrow.cells) {
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
      if (c < minC) minC = c;
      if (c > maxC) maxC = c;
    }
    const margin = 0.9;
    switch (arrow.dir) {
      case 'R': return this.cols - minC + margin;
      case 'L': return maxC + 1 + margin;
      case 'D': return this.rows - minR + margin;
      case 'U': return maxR + 1 + margin;
      default: return this.cols + margin;
    }
  },

  loseLife() {
    const lives = Math.max(0, this.data.lives - 1);
    this.setData({
      lives,
      hearts: this.buildHearts(lives)
    });
    if (lives <= 0) {
      this.addRecord(this.data.level, 'lose');
      audio.play('lose');
      this.setData({
        status: 'lose'
      });
    }
  },

  // ---------- 绘制 ----------
  draw() {
    const ctx = this.ctx;
    if (!ctx || !this.layoutInfo) return;
    const {
      cell,
      originX,
      originY,
      boardW,
      boardH
    } = this.layoutInfo;

    ctx.clearRect(0, 0, this.cssW, this.cssH);

    // 棋盘底板（柔和投影）
    ctx.save();
    ctx.shadowColor = 'rgba(27, 39, 64, 0.10)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
    this.roundRect(ctx, originX - 10, originY - 10, boardW + 20, boardH + 20, 20);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();

    // 网格格子（圆角凹槽）
    const gap = Math.max(2, Math.floor(cell * 0.07));
    const rad = Math.floor(cell * 0.2);
    ctx.fillStyle = '#e9edf3';
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const x = originX + c * cell + gap;
        const y = originY + r * cell + gap;
        const w = cell - gap * 2;
        this.roundRect(ctx, x, y, w, w, rad);
        ctx.fill();
      }
    }

    // 先画静止箭头，动画中的绘制在上层
    for (const a of this.arrows) if (!a.removed && !a.exiting) this.drawArrow(ctx, a);
    for (const a of this.arrows) if (!a.removed && a.exiting) this.drawArrow(ctx, a);
  },

  drawArrow(ctx, a) {
    const { cell, originX, originY } = this.layoutInfo;
    const [dx, dy] = DIR_PIX[a.dir];

    // 位移与透明度：滑出 ease-in 加速 + 起手回拉；受阻阻尼摆动
    let ox = 0, oy = 0, alpha = 1;
    if (a.exiting) {
      const u = Math.min(1, a.prog / a.exitTarget);
      let dist = a.exitTarget * u * u;
      if (u < 0.16) dist -= 0.16 * Math.sin((u / 0.16) * Math.PI);
      ox = dx * dist * cell;
      oy = dy * dist * cell;
      alpha = u > 0.72 ? Math.max(0, 1 - (u - 0.72) / 0.28) : 1;
    } else if (a.shakeT > 0) {
      const k = a.shakeT / 0.36;
      const amp = cell * 0.16 * k * Math.sin(a.shakeT * 55);
      ox = dx * amp;
      oy = dy * amp;
    }

    let pts = a.cells.map(([r, c]) => [
      originX + c * cell + cell / 2 + ox,
      originY + r * cell + cell / 2 + oy,
    ]);

    // 点击按压回弹缩放
    if (a.pressT > 0 && !a.exiting) {
      const k = a.pressT / 0.16;
      const scale = 1 - 0.08 * Math.sin(k * Math.PI);
      let cx = 0, cy = 0;
      pts.forEach((p) => { cx += p[0]; cy += p[1]; });
      cx /= pts.length;
      cy /= pts.length;
      pts = pts.map(([x, y]) => [cx + (x - cx) * scale, cy + (y - cy) * scale]);
    }

    // 滑出残影拖尾
    if (a.exiting) {
      const u = Math.min(1, a.prog / a.exitTarget);
      if (u > 0.1) {
        for (let g = 1; g <= 3; g++) {
          const gp = pts.map(([x, y]) => [x - dx * g * 0.16 * cell, y - dy * g * 0.16 * cell]);
          this.paintArrow(ctx, gp, a, cell, alpha * (0.16 - g * 0.04), false, false);
        }
      }
    }

    this.paintArrow(ctx, pts, a, cell, alpha, true, true);
  },

  // 绘制一枚箭头：描边 + 主体 + 高光 + 尾点
  paintArrow(ctx, pts, a, cell, alpha, outline, highlight) {
    const [dx, dy] = DIR_PIX[a.dir];
    const px = -dy, py = dx;
    const bodyW = cell * 0.4;
    const head = pts[pts.length - 1];
    const tip = [head[0] + dx * cell * 0.34, head[1] + dy * cell * 0.34];
    const arm = cell * 0.3;
    const a1 = [tip[0] + (-dx + px) * arm, tip[1] + (-dy + py) * arm];
    const a2 = [tip[0] + (-dx - px) * arm, tip[1] + (-dy - py) * arm];
    const bodyPts = pts.concat([tip]);

    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const drawSet = (w, color) => {
      this.polyline(ctx, bodyPts, w, color);
      this.segment(ctx, tip, a1, w, color);
      this.segment(ctx, tip, a2, w, color);
    };

    if (outline) drawSet(bodyW + Math.max(3, cell * 0.07), a.outline);
    drawSet(bodyW, a.color);

    if (highlight) {
      ctx.globalAlpha = Math.max(0, alpha) * 0.22;
      this.polyline(ctx, bodyPts, bodyW * 0.32, '#ffffff');
      ctx.globalAlpha = Math.max(0, alpha);
    }

    ctx.beginPath();
    ctx.arc(pts[0][0], pts[0][1], bodyW * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = a.color;
    ctx.fill();

    ctx.restore();
  },

  polyline(ctx, pts, w, color) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.lineWidth = w;
    ctx.strokeStyle = color;
    ctx.stroke();
  },

  segment(ctx, p, q, w, color) {
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    ctx.lineTo(q[0], q[1]);
    ctx.lineWidth = w;
    ctx.strokeStyle = color;
    ctx.stroke();
  },

  roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  },

  // ---------- 按钮 ----------
  onRestart() {
    this.clearNextTimer();
    audio.play('button');
    this.initLevel(this.levelIndex);
  },

  onNextLevel() {
    audio.play('button');
    this.goNextLevel();
  },

  goNextLevel() {
    this.clearNextTimer();
    if (this.levelIndex < TOTAL_LEVELS - 1) {
      this.levelIndex += 1;
      this.initLevel(this.levelIndex);
    } else {
      wx.showToast({
        title: '已通关全部关卡',
        icon: 'none'
      });
      this.initLevel(this.levelIndex);
    }
  },

  onHint() {
    if (this.data.status !== 'playing') return;
    // 找到一个当前可逃脱的箭头并轻微闪烁提示
    for (const arrow of this.arrows) {
      if (arrow.removed || arrow.exiting) continue;
      const others = new Set();
      for (const a of this.arrows) {
        if (a === arrow || a.removed) continue;
        for (const [r, c] of a.cells) others.add(r + ',' + c);
      }
      if (this.canExit(arrow.cells, arrow.dir, others)) {
        arrow.shakeT = 0.5;
        this.startLoop();
        wx.showToast({
          title: '试试闪烁的箭头',
          icon: 'none',
          duration: 1200
        });
        return;
      }
    }
  },

  // ---------- 游玩记录 ----------
  loadRecords() {
    let list = [];
    try {
      list = wx.getStorageSync(SCORE_KEY) || [];
    } catch (e) {
      list = [];
    }
    if (!Array.isArray(list)) list = [];
    this._records = list;
    this.refreshRecords();
  },

  refreshRecords() {
    const records = (this._records || []).map((r) => ({
      timeText: formatTime(r.time),
      level: r.level,
      result: r.result,
      resultText: r.result === 'win' ? '过关' : '失败',
    }));
    this.setData({ records });
  },

  addRecord(level, result) {
    const rec = { time: Date.now(), level, result };
    this._records = [rec, ...(this._records || [])].slice(0, MAX_RECORDS);
    try {
      wx.setStorageSync(SCORE_KEY, this._records);
    } catch (e) {}
    this.refreshRecords();
  },

  onShowRecords() {
    audio.play('button');
    this.loadRecords();
    this.setData({ showRecords: true });
  },

  onCloseRecords() {
    audio.play('button');
    this.setData({ showRecords: false }, () => this.draw());
  },

  onToggleMute() {
    const m = audio.toggle();
    this.setData({ muted: m });
    if (!m) audio.play('button');
  },

  onBack() {
    wx.navigateBack({
      fail() {
        wx.switchTab({
          url: '/pages/home/home',
          fail() {}
        });
      }
    });
  },

  noop() {},
});
