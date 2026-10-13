import TabMenu from './data';

/**
 * 自定义 tabBar（首页内容切换器）
 *
 * mode 属性控制凹槽实现方式：
 * - 'canvas'（默认）：底栏剪影（顶部圆角 + 相切凹唇 + 半圆缺口）与选中圆钮在
 *   canvas 2d 上同帧绘制，缺口以外全部透明，页面背景（纯色/图片/渐变）直接透出，
 *   不依赖外光圈颜色与页面背景一致；切 tab 时圆钮与缺口由同一个 rAF 补间驱动
 *   （缓动取 CSS ease 的贝塞尔曲线，与图标上浮的 CSS 过渡同拍），不会脱节。
 *   开发者工具模拟器里 canvas 2d 非同层、恒盖在 view 之上，DOM 图标会被剪影遮没，
 *   故该环境下把图标与文字一并画进画布（_glyphs），真机仍走 DOM 图标 + 画布剪影。
 * - 'concave'：旧版伪类 + box-shadow 光圈方案，要求 pageBg 与页面背景同色。
 *
 * filletRpx 属性：凹唇内凹半径（rpx），软化凹口两翼与栏顶相交的直角；
 * 过大会吃掉圆钮与凹口间的均匀缝隙，0 = 纯半圆直角；绘制时 clamp 到有解范围。
 *
 * item 可选字段：activeBg（圆钮背景色）、barBg（canvas 模式底栏底色，默认 #fff）、
 * pageBg（仅 concave 模式的外光圈色）。
 */
const DURATION = 500;
/**
 * 打断补间时的最短时长（ms）。走满一个相邻位用 DURATION，剩余距离按等比取时，
 * 否则每次重点击都从零重跑整条 ease（前 100ms 只走完约 10% 距离），圆钮会在两个
 * tab 间来回折返、永远落不到目标 —— 即频繁点击时的滑动抖动。
 */
const MIN_DURATION = 180;
/* 画布向上扩展 70rpx 容纳圆钮露出栏外的上半部分（wxss .tabbar-canvas top:-70rpx）；
   JS 侧不依赖该值：栏顶边 y 由 canvasRect/rootRect 实测得出 */
/** 底栏顶部圆角，rpx */
const CORNER_RPX = 10;
/** 凹口/圆钮几何，rpx：外径 120（半沉入栏内），可见圆钮 = 外径 - 10rpx 缝 */
const KNOB_DIAMETER_RPX = 120;
const NOTCH_GAP_RPX = 10;
/** DPR 上限，tabBar 面积小，2 倍足够锐利 */
const MAX_DPR = 2;
/** item.activeBg 缺省色，参与插值时需先解析 */
const DEFAULT_ACTIVE_BG = 'rgb(3, 3, 3)';
const DEFAULT_BAR_BG = '#fff';
/**
 * 开发者工具自绘 tab 项的排版规格（rpx），对齐 index.wxss 里 .menu-item 的尺寸：
 * 图标 60rpx 居中于 120rpx 栏高（中心距栏顶 60rpx），选中上浮 60rpx 落进圆钮，
 * 文字 26rpx 加粗，选中时浮现在栏下部、未选中时沉底并透明。
 */
const ICON_SIZE_RPX = 60;
const ICON_Y_RPX = 60;
const ICON_LIFT_RPX = 60;
const LABEL_SIZE_RPX = 26;
const LABEL_Y_RPX = 95;
const LABEL_SINK_RPX = 123;
const IDLE_COLOR = '#222';
const ACTIVE_ICON_COLOR = '#fff';
/**
 * 画布自绘图标的字体：模拟器的 canvas 2d 与页面 WXSS @font-face 不是同一套字体集，
 * 不显式加载就画成豆腐块。src 与 asserts/wxss/iconFont.wxss 保持一致（改了要同步改）。
 * 只在 devtools 分支调用，不给真机添 downloadFile 域名白名单负担。
 */
const GLYPH_FONT_FAMILY = 'iconfont';
const GLYPH_FONT_URL = 'https://at.alicdn.com/t/c/font_2229158_2y5i2ydf3uc.woff2?t=1784698118373';

/** CSS ease = cubic-bezier(0.25, 0.1, 0.25, 1)，牛顿迭代反解使 canvas 与 CSS 过渡同拍 */
function easeCss(t) {
  const x1 = 0.25;
  const y1 = 0.1;
  const x2 = 0.25;
  const y2 = 1;
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  let u = t;
  for (let i = 0; i < 8; i += 1) {
    const x = 3 * u * (1 - u) * (1 - u) * x1 + 3 * u * u * (1 - u) * x2 + u * u * u;
    const dx = 3 * (1 - u) * (1 - u) * x1 + 6 * u * (1 - u) * (x2 - x1) + 3 * u * u * (1 - x2);
    if (Math.abs(dx) < 1e-6) break;
    u -= (x - t) / dx;
  }
  return 3 * u * (1 - u) * (1 - u) * y1 + 3 * u * u * (1 - u) * y2 + u * u * u;
}

/** #rgb / #rrggbb / rgb(...) / rgba(...) → [r, g, b]；其它写法（hsl、命名色）返回 null */
function parseColor(input) {
  const s = String(input || '').trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (hex) {
    const h = hex[1];
    const digits = h.length === 3 ? h.replace(/./g, (c) => c + c) : h;
    return [0, 2, 4].map((i) => parseInt(digits.substr(i, 2), 16));
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(s);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return null;
}

/**
 * 按补间小数位在相邻两项配色间插值
 * 直接用 Math.round(n) 取整项配色，圆钮滑到两 tab 正中间时会整帧换色（闪烁）
 */
function mixColor(from, to, t) {
  const a = parseColor(from);
  const b = parseColor(to);
  if (!a || !b) return t < 0.5 ? from : to;
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

Component({
  /**
   * 组件的属性列表
   */
  properties: {
    indexTab: {
      type: Number,
    },
    mode: {
      type: String,
      value: 'canvas',
    },
    /** 凹唇内凹半径（rpx），软化凹口两翼直角；过大吃缝、0 = 纯半圆直角 */
    filletRpx: {
      type: Number,
      value: 28,
    },
  },

  data: {
    active: 0,
    currIndex: 0,
    list: TabMenu,
  },

  observers: {
    indexTab(v) {
      this.setData({
        currIndex: v,
      });
    },
    // 圆钮与缺口同帧绘制，共用这一个补间入口
    currIndex(v) {
      this.animateTo(v);
    },
    // 形态/唇半径变化都需要重建画布几何
    'mode, filletRpx'() {
      this.initCanvas();
    },
  },

  methods: {
    tabClick(event) {
      const { index, item } = event.currentTarget.dataset.params;
      this.setData({
        currIndex: index,
      });
      this.triggerEvent('tabClick', {
        index,
        item,
      });
    },

    init() {
      const page = getCurrentPages().pop();
      const route = page ? page.route.split('?')[0] : '';
      const currIndex = this.data.list.findIndex(
        (item) => (item.url.startsWith('/') ? item.url.substr(1) : item.url) === `${route}`,
      );

      this.setData({
        currIndex,
      });
    },

    /** 开发者工具模拟器检测：模拟器里 canvas（含 2d）非同层、恒盖在 view 之上，真机无此问题 */
    isDevtoolsSimulator() {
      try {
        if (typeof wx.getDeviceInfo === 'function') {
          return wx.getDeviceInfo().platform === 'devtools';
        }
        return wx.getSystemInfoSync().platform === 'devtools';
      } catch (e) {
        return false;
      }
    },

    /** 把 iconfont 显式加载进 webview，供画布 fillText 取用（WXSS @font-face 对模拟器 canvas 不生效） */
    ensureGlyphFont() {
      if (this._glyphFontLoaded || typeof wx.loadFontFace !== 'function') {
        return;
      }
      this._glyphFontLoaded = true;
      wx.loadFontFace({
        global: true,
        family: GLYPH_FONT_FAMILY,
        source: `url("${GLYPH_FONT_URL}")`,
        success: () => {
          if (typeof this._pos === 'number') {
            this.drawFrame(this._pos);
          }
        },
        fail: (e) =>
          console.warn('[custom-tab-bar] 模拟器加载图标字体失败，底栏图标会显示为方块：', (e && e.errMsg) || e),
      });
    },

    /** 初始化 canvas 2d：实测节点几何 + dpr 设置物理像素，随后画一帧静态画面 */
    initCanvas() {
      if (this.data.mode !== 'canvas') {
        return;
      }
      // 模拟器里画布会遮住 DOM 图标，改由画布自绘 tab 项补偿；真机画布在图标下层，不画
      this._glyphs = this.isDevtoolsSimulator();
      if (this._glyphs) {
        this.ensureGlyphFont();
      }
      wx.createSelectorQuery()
        .in(this)
        .select('#tabbarCanvas')
        .fields({ node: true, size: true })
        .select('#tabbarCanvas')
        .boundingClientRect()
        .select('.tabbar-box')
        .boundingClientRect()
        .exec((res) => {
          const nodeField = res && res[0];
          const canvasRect = res && res[1];
          const rootRect = res && res[2];
          // 节点未挂载完成（如 mode 动态切换）时小步重试
          if (!nodeField || !nodeField.node || !canvasRect || !rootRect || !canvasRect.width) {
            this._initRetry = (this._initRetry || 0) + 1;
            if (this._initRetry <= 5) {
              setTimeout(() => this.initCanvas(), 100);
            }
            return;
          }
          const { width: W, height: H } = canvasRect;
          const info = typeof wx.getWindowInfo === 'function' ? wx.getWindowInfo() : {};
          const dpr = Math.min(info.pixelRatio || 2, MAX_DPR);
          const canvas = nodeField.node;
          this._initRetry = 0;
          // 给 width/height 赋值会清空整幅画布，而这次重绘要等 selectorQuery 异步回来，
          // 中间那一帧底栏剪影是空的（闪白）。几何没变就别重写，末尾照旧补画一帧。
          const pw = Math.round(W * dpr);
          const ph = Math.round(H * dpr);
          if (canvas.width !== pw || canvas.height !== ph) {
            canvas.width = pw;
            canvas.height = ph;
          }
          const ctx = canvas.getContext('2d');
          // 画布 CSS 宽即 750rpx，据此换算 rpx → px
          const k = W / 750;
          const barTop = rootRect.top - canvasRect.top;
          this._canvas = { canvas, ctx, dpr };
          this._geo = {
            W,
            H,
            k,
            barTop,
            // 圆心在栏顶边（CSS 几何：圆钮 top -50% + safe-area/2，圆心恰落在栏顶）
            knobCy: barTop,
            // 凹口半径贴住圆钮外缘，与可见圆钮间留 NOTCH_GAP 透明缝，透出页面背景
            knobR: (KNOB_DIAMETER_RPX / 2) * k,
            btnR: (KNOB_DIAMETER_RPX / 2 - NOTCH_GAP_RPX) * k,
            filletR: Math.max((this.data.filletRpx || 0) * k, 0),
            cornerR: CORNER_RPX * k,
          };
          // 补间在飞时保留插值位置，由那条链继续画（resize 不该把圆钮瞬移到终点）
          if (!this._anim || typeof this._pos !== 'number') {
            this._pos = this.data.currIndex;
          }
          this.drawFrame(this._pos);
        });
    },

    /**
     * 绘制一帧：底栏剪影（顶部圆角 + 相切凹唇 + 半圆缺口）+ 选中圆钮，二者同帧故严格同步
     * 路径：左下 → 左上圆角 → 顶边 → [左凹唇] → 凹口半圆弧(口底) → [右凹唇] → 右上圆角 → 右下
     * 凹唇与凹口圆外切、与栏顶边相切（唇圆心在栏顶下方 f 处、距凹口圆心 Rb+f），
     * 把缺口两翼舀成喇叭口；f = 0 退化为纯半圆直角
     * @param {Number} n 当前选中下标（可为补间小数）
     */
    drawFrame(n) {
      const info = this._canvas;
      if (!info) {
        return;
      }
      const { ctx, dpr } = info;
      const { W, H, k, barTop: T, knobCy: cy, knobR: Rb, btnR, filletR: fr, cornerR: r0 } = this._geo;
      const len = this.data.list.length || 1;
      const cx = ((n + 0.5) / len) * W;
      // 凹唇 fillet 半径；过大时收窄保证相切有解
      const f = Math.max(Math.min(fr, Rb * 0.9), 0);
      const g = cy - (T + f);
      const d = f > 0 ? Math.sqrt(Math.max((Rb + f) * (Rb + f) - g * g, 0)) : Rb;
      const Fy = T + f;
      const Fl = cx - d;
      const Fr = cx + d;
      // 凹口圆上的左右切点角（指向凹唇圆心）
      const pL = Math.atan2(Fy - cy, Fl - cx);
      const pR = Math.atan2(Fy - cy, Fr - cx);
      // 凹唇圆上指向凹口圆心的方向角
      const qL = Math.atan2(cy - Fy, cx - Fl);
      const qR = Math.atan2(cy - Fy, cx - Fr);
      const lo = Math.min(Math.max(Math.floor(n), 0), len - 1);
      const hi = Math.min(lo + 1, len - 1);
      const frac = Math.min(Math.max(n - lo, 0), 1);
      const item = this.data.list[lo] || {};
      const next = this.data.list[hi] || item;
      const barBg = mixColor(item.barBg || DEFAULT_BAR_BG, next.barBg || DEFAULT_BAR_BG, frac);
      const activeBg = mixColor(item.activeBg || DEFAULT_ACTIVE_BG, next.activeBg || DEFAULT_ACTIVE_BG, frac);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.beginPath();
      ctx.moveTo(0, H);
      ctx.lineTo(0, T + r0);
      ctx.arcTo(0, T, r0, T, r0);
      ctx.lineTo(Fl, T);
      if (f > 0) ctx.arc(Fl, Fy, f, -Math.PI / 2, qL, false);
      ctx.arc(cx, cy, Rb, pL, pR, true);
      if (f > 0) ctx.arc(Fr, Fy, f, qR, -Math.PI / 2, false);
      ctx.lineTo(W - r0, T);
      ctx.arcTo(W, T, W, T + r0, r0);
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fillStyle = barBg;
      ctx.fill();
      // 圆钮（与缺口同帧，平移时严格同步）
      ctx.beginPath();
      ctx.arc(cx, cy, btnR, 0, Math.PI * 2);
      ctx.fillStyle = activeBg;
      ctx.fill();
      if (this._glyphs) {
        this.drawGlyphs(ctx, { W, T, k, n, len });
      }
    },

    /**
     * 画图标与文字（仅开发者工具）：模拟器里原生画布恒在 view 之上，DOM 图标会被剪影遮没，
     * 于是按同一份补间小数 n 把 .menu-item 的上浮/显隐画进画布，与真机观感对齐
     */
    drawGlyphs(ctx, { W, T, k, n, len }) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      this.data.list.forEach((item, i) => {
        // 距选中位越近越激活：1 = 完全选中，0 = 相隔一位以上
        const m = Math.max(0, 1 - Math.abs(n - i));
        const cx = ((i + 0.5) / len) * W;
        if (item.glyph) {
          ctx.font = `${ICON_SIZE_RPX * k}px ${GLYPH_FONT_FAMILY}`;
          ctx.fillStyle = mixColor(IDLE_COLOR, ACTIVE_ICON_COLOR, m);
          ctx.fillText(item.glyph, cx, T + (ICON_Y_RPX - ICON_LIFT_RPX * m) * k);
        }
        if (m > 0.01) {
          ctx.globalAlpha = m;
          ctx.font = `bold ${LABEL_SIZE_RPX * k}px sans-serif`;
          ctx.fillStyle = IDLE_COLOR;
          ctx.fillText(item.text, cx, T + (LABEL_SINK_RPX - (LABEL_SINK_RPX - LABEL_Y_RPX) * m) * k);
          ctx.globalAlpha = 1;
        }
      });
    },

    /** 停掉在飞补间：dead 令牌让已入队但尚未执行的那一帧作废，杜绝孤儿链继续覆写位置 */
    stopTween() {
      const anim = this._anim;
      if (!anim) {
        return;
      }
      this._anim = null;
      anim.dead = true;
      if (anim.raf) {
        anim.canvas.cancelAnimationFrame(anim.raf);
      }
    },

    /**
     * 补间：仅在动画期间占用 rAF，结束即停（见 AGENTS.md Canvas 约定）
     * 起点取当前插值位置，时长按剩余距离等比取时：连点时若每次重跑整条 500ms ease，
     * 圆钮会来回折返、永远落不到目标；走满一个相邻位仍是 DURATION，观感不变。
     */
    animateTo(target) {
      if (this.data.mode !== 'canvas' || !this._canvas) {
        this.stopTween();
        return;
      }
      const from = typeof this._pos === 'number' ? this._pos : target;
      const dist = Math.abs(target - from);
      this.stopTween();
      if (dist < 0.001) {
        this._pos = target;
        this.drawFrame(target);
        return;
      }
      const anim = {
        canvas: this._canvas.canvas,
        from,
        to: target,
        start: Date.now(),
        dur: Math.max(MIN_DURATION, Math.min(DURATION, dist * DURATION)),
        raf: 0,
        dead: false,
      };
      this._anim = anim;
      const step = () => {
        if (anim.dead) {
          anim.raf = 0;
          return;
        }
        const t = Math.min(1, (Date.now() - anim.start) / anim.dur);
        this._pos = anim.from + (anim.to - anim.from) * easeCss(t);
        this.drawFrame(this._pos);
        if (t < 1) {
          anim.raf = anim.canvas.requestAnimationFrame(step);
        } else {
          anim.raf = 0;
          if (this._anim === anim) {
            this._anim = null;
          }
        }
      };
      anim.raf = anim.canvas.requestAnimationFrame(step);
    },
  },

  lifetimes: {
    ready() {
      this.initCanvas();
      // this.init()
    },
    detached() {
      this.stopTween();
      this._canvas = null;
      this._geo = null;
      this._pos = null;
    },
  },
  pageLifetimes: {
    show() {},

    hide() {},

    resize() {
      // 屏幕尺寸变化（旋转/分屏）后重新量取画布尺寸并重绘
      this.initCanvas();
    },
  },
});
