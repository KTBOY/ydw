// game/pages/arrowEscape/index.js 箭头逃脱（QQ农场风格）
// 美术规格见同目录 DESIGN.md：天空/绿丘/篱笆/菜畦棋盘 + 糖果质感箭头。
import { getLevel, TOTAL_LEVELS, DIR_VEC, PALETTE } from './levels';
import audio from './audio';

const MAX_LIVES = 5;
// 像素坐标下的方向向量（x 右为正，y 下为正）
const DIR_PIX = {
  U: [0, -1],
  D: [0, 1],
  L: [-1, 0],
  R: [1, 0],
};

// 游玩记录（最多保留 10 条）
const SCORE_KEY = 'arrowEscapeScores';
// 每关最高星级（1~3，按过关剩余生命评定）
const STARS_KEY = 'arrowEscapeStars';
const MAX_RECORDS = 10;

// —— QQ 农场场景色板 ——
const SKY_TOP = '#7fd4f6';
const SKY_BOTTOM = '#c7effc';
const HILL_BACK = '#b9e286';
const HILL_FRONT = '#9ed367';
const GRASS_TOP = '#96d45f';
const GRASS_BOTTOM = '#7fc74b';
const CANOPY = '#55af49';
const CANOPY_LIGHT = '#7ccb60';
const TRUNK = '#9a6a38';
const SOIL_FRAME = '#9a6a38';
const SOIL_FRAME_LIGHT = '#c98d4e';
const TILE_LIGHT = '#daa469';
const TILE_DARK = '#d09a58';
const TILE_EDGE = '#8a5c2e';

const pad2 = (n) => (n < 10 ? `0${n}` : `${n}`);
const formatTime = (ts) => {
  const d = new Date(ts);
  return `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

// 颜色加深/提亮：用于箭头描边与顶部高光
const darken = (hex, f) => {
  const h = hex.replace('#', '');
  const r = parseInt(h.substr(0, 2), 16);
  const g = parseInt(h.substr(2, 2), 16);
  const b = parseInt(h.substr(4, 2), 16);
  const d = (v) => Math.max(0, Math.round(v * (1 - f)));
  const to2 = (v) => `0${v.toString(16)}`.slice(-2);
  return `#${to2(d(r))}${to2(d(g))}${to2(d(b))}`;
};
const lighten = (hex, f) => {
  const h = hex.replace('#', '');
  const r = parseInt(h.substr(0, 2), 16);
  const g = parseInt(h.substr(2, 2), 16);
  const b = parseInt(h.substr(4, 2), 16);
  const u = (v) => Math.min(255, Math.round(v + (255 - v) * f));
  const to2 = (v) => `0${v.toString(16)}`.slice(-2);
  return `#${to2(u(r))}${to2(u(g))}${to2(u(b))}`;
};

// 固定种子伪随机：保证背景花草每次绘制完全一致（离屏缓存失效重绘时不跳变）
const seeded = (i, salt) => {
  const v = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return v - Math.floor(v);
};

Page({
  data: {
    level: 1,
    total: TOTAL_LEVELS,
    lives: MAX_LIVES,
    status: 'playing', // playing | win | lose
    isLastLevel: false,
    starCount: 0,
    records: [],
    showRecords: false,
    showLevels: false,
    levelList: [],
    scrollToN: 1,
    totalStars: 0,
    muted: false,
  },

  onLoad() {
    let saved = Number(wx.getStorageSync('arrowEscapeLevel'));
    if (!Number.isInteger(saved) || saved < 0 || saved >= TOTAL_LEVELS) saved = 0;
    this.levelIndex = saved;
    this.unlockedIdx = saved;
    let stars = {};
    try {
      stars = wx.getStorageSync(STARS_KEY) || {};
    } catch (e) {
      stars = {};
    }
    this.starsMap = stars && typeof stars === 'object' && !Array.isArray(stars) ? stars : {};
    this.arrows = [];
    this.layoutInfo = null;
    this.rafId = null;
    this.lastTs = 0;
    this.pageShown = true;
    this._nextTimer = null;
    this.bgCanvas = null;
    this.bgKey = '';
    this.loadRecords();
    audio.init();
    this.setData({ muted: audio.isMuted() });
  },

  onReady() {
    this.setupCanvas(0);
  },

  setupCanvas(retry) {
    const query = wx.createSelectorQuery().in(this);
    query
      .select('#gameCanvas')
      .fields({
        node: true,
        size: true,
        rect: true,
      })
      .exec((res) => {
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
    this.bgCanvas = null;
    audio.destroy();
  },

  // ---------- 关卡初始化 ----------
  initLevel(index) {
    this.stopLoop();
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
        outline: darken(color, 0.42),
        removed: false,
        exiting: false,
        prog: 0,
        exitTarget: 0,
        shakeT: 0,
        pressT: 0,
        hintT: 0,
        age: 0,
        spawn: Math.min(i * 0.035, 0.6), // 入场错峰延迟
      };
    });
    this.winHandled = false;

    this.computeLayout();
    this.ensureBackground();
    this.setData(
      {
        level: index + 1,
        lives: MAX_LIVES,
        status: 'playing',
        isLastLevel: index >= TOTAL_LEVELS - 1,
        starCount: 0,
      },
      () => {
        this.draw();
        this.startLoop(); // 入场弹跳动画
      },
    );
  },

  computeLayout() {
    const pad = 14;
    // 上部留出天空/远山，棋盘落在草地中央
    const skyH = Math.round(this.cssH * 0.26);
    const top = skyH + 12;
    const bottom = this.cssH - 12;
    const availW = this.cssW - pad * 2;
    const availH = bottom - top;
    const cell = Math.floor(Math.min(availW / this.cols, availH / this.rows));
    const boardW = cell * this.cols;
    const boardH = cell * this.rows;
    const originX = Math.round((this.cssW - boardW) / 2);
    const originY = Math.round(top + (availH - boardH) / 2);
    this.layoutInfo = {
      cell,
      originX,
      originY,
      boardW,
      boardH,
      pad,
      skyH,
    };
  },

  // ---------- 场景背景（静态部分离屏缓存，仅尺寸/关卡变化时重建） ----------
  ensureBackground() {
    const key = [this.cssW, this.cssH, this.cols, this.rows].join(':');
    if (this.bgKey === key && this.bgCanvas) return;
    this.bgKey = key;
    this.bgCanvas = null;
    try {
      const off = wx.createOffscreenCanvas({
        type: '2d',
        width: Math.round(this.cssW * this.dpr),
        height: Math.round(this.cssH * this.dpr),
      });
      const octx = off.getContext('2d');
      octx.scale(this.dpr, this.dpr);
      this.paintScene(octx);
      if (off.width && off.height) this.bgCanvas = off;
    } catch (e) {
      // 低版本基础库不支持离屏画布时，退化为每帧直接绘制
      this.bgCanvas = null;
    }
  },

  paintScene(ctx) {
    const W = this.cssW;
    const H = this.cssH;
    const { skyH } = this.layoutInfo;

    // 天空
    const sky = ctx.createLinearGradient(0, 0, 0, skyH + 30);
    sky.addColorStop(0, SKY_TOP);
    sky.addColorStop(1, SKY_BOTTOM);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, skyH + 30);

    // 太阳光晕
    const sun = ctx.createRadialGradient(W - 54, 44, 6, W - 54, 44, 72);
    sun.addColorStop(0, 'rgba(255, 246, 190, 0.95)');
    sun.addColorStop(1, 'rgba(255, 246, 190, 0)');
    ctx.fillStyle = sun;
    ctx.fillRect(W - 140, 0, 140, 140);

    // 草地
    const grass = ctx.createLinearGradient(0, skyH - 20, 0, H);
    grass.addColorStop(0, GRASS_TOP);
    grass.addColorStop(1, GRASS_BOTTOM);
    ctx.fillStyle = grass;
    ctx.fillRect(0, skyH - 20, W, H - skyH + 20);

    // 远山两层
    ctx.fillStyle = HILL_BACK;
    this.mound(ctx, W * 0.2, skyH + 8, W * 0.34, 40);
    this.mound(ctx, W * 0.78, skyH + 8, W * 0.42, 52);
    ctx.fillStyle = HILL_FRONT;
    this.mound(ctx, W * 0.5, skyH + 10, W * 0.46, 26);

    // 云
    this.cloud(ctx, 56, 40, 1);
    this.cloud(ctx, W * 0.55, 22, 0.75);
    this.cloud(ctx, W * 0.32, 74, 0.6);

    // 树
    this.tree(ctx, W * 0.1, skyH + 6, 1);
    this.tree(ctx, W * 0.88, skyH + 2, 1.2);
    this.tree(ctx, W * 0.66, skyH + 14, 0.7);

    // 篱笆（地平线两侧，棋盘压住中部）
    this.fence(ctx, 6, skyH + 34, 3);
    this.fence(ctx, W - 70, skyH + 34, 3);

    // 花草点缀（避开棋盘区域）
    const l = this.layoutInfo;
    for (let i = 0; i < 30; i++) {
      const x = seeded(i, 1) * W;
      const y = skyH + 26 + seeded(i, 2) * (H - skyH - 40);
      const insideBoard =
        x > l.originX - 18 && x < l.originX + l.boardW + 18 && y > l.originY - 18 && y < l.originY + l.boardH + 18;
      if (insideBoard) continue;
      if (i % 3 === 0) this.flower(ctx, x, y, i % 2 === 0);
      else this.tuft(ctx, x, y);
    }

    // 田地：土框 + 菜畦格子
    this.paintBed(ctx, l);
  },

  mound(ctx, cx, baseY, rw, rh) {
    ctx.beginPath();
    ctx.ellipse(cx, baseY, rw, rh, 0, Math.PI, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
  },

  cloud(ctx, x, y, s) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(x, y, 30 * s, 15 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x - 22 * s, y + 5 * s, 17 * s, 11 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 22 * s, y + 5 * s, 18 * s, 11 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(210, 238, 252, 0.85)';
    ctx.beginPath();
    ctx.ellipse(x, y + 9 * s, 26 * s, 7 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  },

  tree(ctx, x, y, s) {
    ctx.fillStyle = TRUNK;
    this.roundRect(ctx, x - 3 * s, y - 14 * s, 6 * s, 16 * s, 2 * s);
    ctx.fill();
    ctx.fillStyle = CANOPY;
    ctx.beginPath();
    ctx.arc(x, y - 24 * s, 13 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - 10 * s, y - 16 * s, 9 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 10 * s, y - 16 * s, 9 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = CANOPY_LIGHT;
    ctx.beginPath();
    ctx.arc(x - 4 * s, y - 27 * s, 6 * s, 0, Math.PI * 2);
    ctx.fill();
  },

  fence(ctx, x, y, n) {
    ctx.fillStyle = '#b87f42';
    for (let i = 0; i < n; i++) {
      this.roundRect(ctx, x + i * 24, y - 18, 8, 26, 3);
      ctx.fill();
    }
    ctx.fillStyle = SOIL_FRAME_LIGHT;
    this.roundRect(ctx, x - 5, y - 13, n * 24 + 5, 5, 2);
    ctx.fill();
    this.roundRect(ctx, x - 5, y - 3, n * 24 + 5, 5, 2);
    ctx.fill();
  },

  flower(ctx, x, y, yellow) {
    ctx.fillStyle = yellow ? '#ffd83e' : '#ffffff';
    for (let k = 0; k < 5; k++) {
      const ang = (k / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(x + Math.cos(ang) * 3.2, y + Math.sin(ang) * 3.2, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = yellow ? '#f08c1e' : '#ffd23e';
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
  },

  tuft(ctx, x, y) {
    ctx.strokeStyle = 'rgba(90, 158, 60, 0.9)';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.moveTo(x + k * 3, y);
      ctx.lineTo(x + k * 4, y - 8);
      ctx.stroke();
    }
  },

  // 田地：土框 + 菜畦格子（圆角土面 + 底部厚度 + 犁沟纹理 + 顶部受光）
  paintBed(ctx, l) {
    const { cell, originX, originY, boardW, boardH } = l;

    ctx.save();
    ctx.shadowColor = 'rgba(60, 40, 10, 0.22)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 8;
    this.roundRect(ctx, originX - 12, originY - 12, boardW + 24, boardH + 24, 22);
    ctx.fillStyle = SOIL_FRAME;
    ctx.fill();
    ctx.restore();

    this.roundRect(ctx, originX - 6, originY - 6, boardW + 12, boardH + 12, 17);
    ctx.fillStyle = SOIL_FRAME_LIGHT;
    ctx.fill();

    const gap = Math.max(2, Math.floor(cell * 0.08));
    const rad = Math.floor(cell * 0.22);
    const bevel = Math.max(3, Math.round(cell * 0.1));
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const x = originX + c * cell + gap;
        const y = originY + r * cell + gap;
        const w = cell - gap * 2;
        this.roundRect(ctx, x, y + bevel, w, w, rad);
        ctx.fillStyle = TILE_EDGE;
        ctx.fill();
        this.roundRect(ctx, x, y, w, w, rad);
        ctx.fillStyle = (r + c) % 2 === 0 ? TILE_LIGHT : TILE_DARK;
        ctx.fill();
        if ((r * 7 + c * 13) % 5 === 0) {
          ctx.strokeStyle = 'rgba(122, 79, 32, 0.22)';
          ctx.lineWidth = Math.max(1.5, cell * 0.045);
          ctx.lineCap = 'round';
          for (let f = 1; f <= 2; f++) {
            const fy = y + (w * f) / 3;
            ctx.beginPath();
            ctx.moveTo(x + w * 0.18, fy);
            ctx.lineTo(x + w * 0.82, fy);
            ctx.stroke();
          }
        }
        this.roundRect(ctx, x + 2, y + 2, w - 4, w * 0.4, rad * 0.8);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.fill();
      }
    }
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
    return this.arrows.some(
      (a) => !a.removed && (a.exiting || a.shakeT > 0 || a.pressT > 0 || a.hintT > 0 || a.age < a.spawn + 0.22),
    );
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
      if (!a.exiting && a.age < a.spawn + 0.22) {
        a.age += dt;
        active = true;
      }
      if (a.hintT > 0) {
        a.hintT = Math.max(0, a.hintT - dt);
        if (a.hintT > 0) active = true;
      }
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
      if (nextIdx > this.unlockedIdx) {
        this.unlockedIdx = nextIdx;
        try {
          wx.setStorageSync('arrowEscapeLevel', nextIdx);
        } catch (e) {}
      }
      // 星级：剩余生命 >=4 得 3 星，>=2 得 2 星，其余 1 星
      const stars = this.data.lives >= 4 ? 3 : this.data.lives >= 2 ? 2 : 1;
      this.saveStars(this.levelIndex, stars);
      this.addRecord(this.data.level, 'win');
      audio.play('win');
      try {
        wx.vibrateShort({
          type: 'medium',
        });
      } catch (e) {}
      this.setData({
        status: 'win',
        starCount: stars,
      });
      // 过关后自动进入下一关（不依赖点击可能被遮挡的按钮）；最后一关不自动跳转
      this.clearNextTimer();
      if (this.levelIndex < TOTAL_LEVELS - 1) {
        this._nextTimer = setTimeout(() => {
          this._nextTimer = null;
          this.goNextLevel();
        }, 1300);
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
    const { cell, originX, originY } = this.layoutInfo;
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
      (a) => !a.removed && !a.exiting && a.age >= a.spawn + 0.2 && a.cells.some((cc) => cc[0] === r && cc[1] === c),
    );
    if (!arrow) return;
    this.attemptMove(arrow);
  },

  attemptMove(arrow) {
    arrow.pressT = 0.16;
    const others = new Set();
    for (const a of this.arrows) {
      if (a === arrow || a.removed) continue;
      for (const [r, c] of a.cells) others.add(`${r},${c}`);
    }
    if (this.canExit(arrow.cells, arrow.dir, others)) {
      arrow.exiting = true;
      arrow.prog = 0;
      arrow.exitTarget = this.computeExitTarget(arrow);
      audio.play('move');
      try {
        wx.vibrateShort({
          type: 'light',
        });
      } catch (e) {}
    } else {
      arrow.shakeT = 0.36;
      this.loseLife();
      audio.play('blocked');
      try {
        wx.vibrateShort({
          type: 'heavy',
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
          if (othersSet.has(`${nr},${nc}`)) return false;
        }
      }
      if (!anyIn) return true;
    }
  },

  computeExitTarget(arrow) {
    let minR = Infinity;
    let maxR = -Infinity;
    let minC = Infinity;
    let maxC = -Infinity;
    for (const [r, c] of arrow.cells) {
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
      if (c < minC) minC = c;
      if (c > maxC) maxC = c;
    }
    const margin = 0.9;
    switch (arrow.dir) {
      case 'R':
        return this.cols - minC + margin;
      case 'L':
        return maxC + 1 + margin;
      case 'D':
        return this.rows - minR + margin;
      case 'U':
        return maxR + 1 + margin;
      default:
        return this.cols + margin;
    }
  },

  loseLife() {
    const lives = Math.max(0, this.data.lives - 1);
    this.setData({
      lives,
    });
    if (lives <= 0) {
      this.addRecord(this.data.level, 'lose');
      audio.play('lose');
      this.setData({
        status: 'lose',
      });
      this.stopLoop(); // 画布即将隐藏，停掉残余动画循环
    }
  },

  // ---------- 绘制 ----------
  draw() {
    const { ctx } = this;
    if (!ctx || !this.layoutInfo) return;

    if (this.bgCanvas) {
      try {
        ctx.drawImage(this.bgCanvas, 0, 0, this.cssW, this.cssH);
      } catch (e) {
        this.bgCanvas = null;
        this.paintScene(ctx);
      }
    } else {
      this.paintScene(ctx);
    }

    this.drawSign(ctx);
    // 先画静止箭头，动画中的绘制在上层
    for (const a of this.arrows) if (!a.removed && !a.exiting) this.drawArrow(ctx, a);
    for (const a of this.arrows) if (!a.removed && a.exiting) this.drawArrow(ctx, a);
  },

  // 木牌：剩余箭头数（仿农场「劳动光荣」木牌）
  drawSign(ctx) {
    const l = this.layoutInfo;
    let remaining = 0;
    for (const a of this.arrows) if (!a.removed) remaining++;
    const sw = 104;
    const sh = 34;
    let sx = l.originX - 2;
    let sy = l.originY - sh - 16;
    if (sy < l.skyH + 26) {
      // 竖向空间不足时移入棋盘内左上角
      sx = l.originX + 6;
      sy = l.originY + 6;
    } else {
      ctx.fillStyle = '#8a5c2e';
      this.roundRect(ctx, sx + 14, sy + sh - 2, 8, l.originY - sy - sh + 10, 3);
      ctx.fill();
    }
    this.roundRect(ctx, sx, sy, sw, sh, 10);
    ctx.fillStyle = SOIL_FRAME_LIGHT;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = TILE_EDGE;
    ctx.stroke();
    ctx.fillStyle = TILE_EDGE;
    ctx.beginPath();
    ctx.arc(sx + 9, sy + 8, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx + sw - 9, sy + sh - 8, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5b3a17';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`剩余 ${remaining}`, sx + sw / 2, sy + sh / 2 + 1);
  },

  drawArrow(ctx, a) {
    const { cell, originX, originY } = this.layoutInfo;
    const [dx, dy] = DIR_PIX[a.dir];

    // 入场延迟期内不绘制
    if (!a.exiting && a.age < a.spawn) return;

    // 位移与透明度：滑出 ease-in 加速 + 起手回拉；受阻阻尼摆动
    let ox = 0;
    let oy = 0;
    let alpha = 1;
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

    let pts = a.cells.map(([r, c]) => [originX + c * cell + cell / 2 + ox, originY + r * cell + cell / 2 + oy]);

    // 点击按压回弹缩放
    if (a.pressT > 0 && !a.exiting) {
      const k = a.pressT / 0.16;
      const scale = 1 - 0.08 * Math.sin(k * Math.PI);
      let cx = 0;
      let cy = 0;
      pts.forEach((p) => {
        cx += p[0];
        cy += p[1];
      });
      cx /= pts.length;
      cy /= pts.length;
      pts = pts.map(([x, y]) => [cx + (x - cx) * scale, cy + (y - cy) * scale]);
    }

    // 入场弹跳（easeOutBack，逐个错峰出现）
    if (!a.exiting && a.age < a.spawn + 0.22) {
      const t = Math.min(1, Math.max(0, (a.age - a.spawn) / 0.22));
      const c1 = 1.70158;
      const c3 = c1 + 1;
      const scale = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
      let cx = 0;
      let cy = 0;
      pts.forEach((p) => {
        cx += p[0];
        cy += p[1];
      });
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

  // 绘制一枚箭头：糖果玩具质感（整体明暗渐变填充 + 深描边 + 高光 + 尾部圆钮）
  paintArrow(ctx, pts, a, cell, alpha, outline, highlight) {
    const [dx, dy] = DIR_PIX[a.dir];
    const px = -dy;
    const py = dx;
    const bodyW = cell * 0.5; // 身体粗细
    const ot = Math.max(3, cell * 0.09); // 描边厚度
    const knobR = bodyW * 0.62; // 尾部圆钮
    const head = pts[pts.length - 1];
    const headBase = [head[0] + dx * cell * 0.04, head[1] + dy * cell * 0.04];
    const tip = [headBase[0] + dx * cell * 0.4, headBase[1] + dy * cell * 0.4];
    const hb = cell * 0.52; // 大头半宽
    const c1 = [headBase[0] + px * hb, headBase[1] + py * hb];
    const c2 = [headBase[0] - px * hb, headBase[1] - py * hb];
    const bodyPts = pts.concat([headBase]);

    // 顶部受光、底部加深的整体渐变（按几何包围盒，弯箭头同样自然）
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of [...bodyPts, tip, c1, c2]) {
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
    }
    const grad = ctx.createLinearGradient(0, minY - cell * 0.15, 0, maxY + cell * 0.15);
    grad.addColorStop(0, lighten(a.color, 0.36));
    grad.addColorStop(0.55, a.color);
    grad.addColorStop(1, darken(a.color, 0.24));

    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const drawBody = (w, style) => this.polyline(ctx, bodyPts, w, style);
    // fill + 同色描边让三角获得圆角
    const drawHead = (style, lw) => {
      ctx.beginPath();
      ctx.moveTo(c1[0], c1[1]);
      ctx.lineTo(tip[0], tip[1]);
      ctx.lineTo(c2[0], c2[1]);
      ctx.closePath();
      ctx.fillStyle = style;
      ctx.fill();
      if (lw > 0) {
        ctx.lineWidth = lw;
        ctx.strokeStyle = style;
        ctx.stroke();
      }
    };
    const drawKnob = (r, style) => {
      ctx.beginPath();
      ctx.arc(pts[0][0], pts[0][1], r, 0, Math.PI * 2);
      ctx.fillStyle = style;
      ctx.fill();
    };

    if (outline) {
      // 提示呼吸光晕（径向渐变）
      if (a.hintT > 0) {
        const pulse = 0.55 + 0.45 * Math.sin((1.8 - a.hintT) * 9);
        let cx = 0;
        let cy = 0;
        pts.forEach((p) => {
          cx += p[0];
          cy += p[1];
        });
        cx /= pts.length;
        cy /= pts.length;
        const baseR = cell * (0.8 + pts.length * 0.16);
        const glow = ctx.createRadialGradient(cx, cy, baseR * 0.2, cx, cy, baseR * 1.9);
        glow.addColorStop(0, `rgba(255, 214, 64, ${0.5 * pulse})`);
        glow.addColorStop(1, 'rgba(255, 214, 64, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.ellipse(cx, cy, baseR * 2.1, baseR * 1.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = Math.max(0, alpha);
      }
      // 落地投影（身体 + 大头 + 尾钮一起外扩下沉）
      ctx.save();
      ctx.translate(cell * 0.02, cell * 0.09);
      ctx.globalAlpha = Math.max(0, alpha) * 0.28;
      const shadow = 'rgba(70, 45, 12, 0.6)';
      drawBody(bodyW + ot * 2, shadow);
      drawHead(shadow, ot * 2);
      drawKnob(knobR + ot, shadow);
      ctx.restore();
      ctx.globalAlpha = Math.max(0, alpha);
      // 深色描边
      drawBody(bodyW + ot * 2, a.outline);
      drawHead(a.outline, ot * 2);
      drawKnob(knobR + ot, a.outline);
    }

    // 渐变主体：身体 + 圆角大头 + 尾钮
    drawBody(bodyW, grad);
    drawHead(grad, Math.max(2, cell * 0.05));
    drawKnob(knobR, grad);

    if (highlight) {
      // 顶部白色高光线 + 尾钮/大头高光点
      ctx.save();
      ctx.translate(-cell * 0.03, -cell * 0.08);
      ctx.globalAlpha = Math.max(0, alpha) * 0.35;
      this.polyline(ctx, bodyPts, bodyW * 0.2, '#ffffff');
      ctx.restore();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.beginPath();
      ctx.arc(pts[0][0] - bodyW * 0.18, pts[0][1] - bodyW * 0.18, bodyW * 0.16, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(
        headBase[0] + dx * cell * 0.12 + px * hb * 0.35,
        headBase[1] + dy * cell * 0.12 + py * hb * 0.35,
        cell * 0.05,
        0,
        Math.PI * 2,
      );
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.fill();
    }

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
        icon: 'none',
      });
      this.initLevel(this.levelIndex);
    }
  },

  onHint() {
    if (this.data.status !== 'playing') return;
    // 找到一个当前可逃脱的箭头，金色光晕呼吸提示（移除障碍只会解锁更多箭头，必有解）
    for (const arrow of this.arrows) {
      if (arrow.removed || arrow.exiting) continue;
      const others = new Set();
      for (const a of this.arrows) {
        if (a === arrow || a.removed) continue;
        for (const [r, c] of a.cells) others.add(`${r},${c}`);
      }
      if (this.canExit(arrow.cells, arrow.dir, others)) {
        arrow.hintT = 1.8;
        audio.play('button');
        this.startLoop();
        wx.showToast({
          title: '试试发光的箭头',
          icon: 'none',
          duration: 1200,
        });
        return;
      }
    }
  },

  // ---------- 关卡选择 ----------
  onShowLevels() {
    audio.play('button');
    this.refreshLevelList();
    this.setData({
      showLevels: true,
      scrollToN: this.levelIndex + 1,
    });
  },

  onCloseLevels() {
    audio.play('button');
    this.setData({ showLevels: false }, () => this.draw());
  },

  refreshLevelList() {
    let totalStars = 0;
    const list = [];
    for (let i = 0; i < TOTAL_LEVELS; i++) {
      const stars = this.starsMap[i] || 0;
      totalStars += stars;
      list.push({
        idx: i,
        n: i + 1,
        unlocked: i <= this.unlockedIdx,
        current: i === this.levelIndex,
        starText: stars > 0 ? '★★★'.slice(0, stars) + '☆☆☆'.slice(0, 3 - stars) : '',
      });
    }
    this.setData({
      levelList: list,
      totalStars,
    });
  },

  onPickLevel(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    if (!Number.isInteger(idx) || idx < 0 || idx >= TOTAL_LEVELS) return;
    if (idx > this.unlockedIdx) {
      wx.showToast({
        title: '先通过前面的关卡吧',
        icon: 'none',
      });
      return;
    }
    audio.play('button');
    this.clearNextTimer();
    this.levelIndex = idx;
    this.setData({ showLevels: false });
    this.initLevel(idx);
  },

  // ---------- 星级 ----------
  saveStars(levelIdx, stars) {
    if ((this.starsMap[levelIdx] || 0) >= stars) return;
    this.starsMap[levelIdx] = stars;
    try {
      wx.setStorageSync(STARS_KEY, this.starsMap);
    } catch (e) {}
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
          fail() {},
        });
      },
    });
  },

  noop() {},
});
