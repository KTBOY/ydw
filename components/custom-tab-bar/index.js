import TabMenu from './data';

/**
 * 自定义 tabBar（首页内容切换器）
 *
 * mode 属性控制凹槽实现方式：
 * - 'canvas'（默认）：底栏剪影（顶部圆角 + 相切凹唇 + 半圆缺口）与选中圆钮在
 *   canvas 2d 上同帧绘制，缺口以外全部透明，页面背景（纯色/图片/渐变）直接透出，
 *   不依赖外光圈颜色与页面背景一致；切 tab 时圆钮与缺口由同一个 rAF 补间驱动
 *   （缓动取 CSS ease 的贝塞尔曲线，与图标上浮的 CSS 过渡同拍），不会脱节。
 *   开发者工具模拟器里 canvas 2d 非同层、会盖住 tab 项，自动降级为 concave 观感。
 * - 'concave'：旧版伪类 + box-shadow 光圈方案，要求 pageBg 与页面背景同色。
 *
 * filletRpx 属性：凹唇内凹半径（rpx），软化凹口两翼与栏顶相交的直角；
 * 过大会吃掉圆钮与凹口间的均匀缝隙，0 = 纯半圆直角；绘制时 clamp 到有解范围。
 *
 * item 可选字段：activeBg（圆钮背景色）、barBg（canvas 模式底栏底色，默认 #fff）、
 * pageBg（仅 concave 模式的外光圈色）。
 */
const DURATION = 500;
/* 画布向上扩展 70rpx 容纳圆钮露出栏外的上半部分（wxss .tabbar-canvas top:-70rpx）；
   JS 侧不依赖该值：栏顶边 y 由 canvasRect/rootRect 实测得出 */
/** 底栏顶部圆角，rpx */
const CORNER_RPX = 10;
/** 凹口/圆钮几何，rpx：外径 120（半沉入栏内），可见圆钮 = 外径 - 10rpx 缝 */
const KNOB_DIAMETER_RPX = 120;
const NOTCH_GAP_RPX = 10;
/** DPR 上限，tabBar 面积小，2 倍足够锐利 */
const MAX_DPR = 2;

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
    /** 开发者工具模拟器里 canvas 非同层，置 true 后回退 concave 观感 */
    canvasDegraded: false,
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

    /** 初始化 canvas 2d：实测节点几何 + dpr 设置物理像素，随后画一帧静态画面 */
    initCanvas() {
      if (this.data.mode !== 'canvas') {
        return;
      }
      if (this.isDevtoolsSimulator()) {
        if (!this.data.canvasDegraded) {
          console.warn(
            '[custom-tab-bar] 开发者工具模拟器不支持 canvas 2d 同层渲染，画布会盖住 tab 项，已降级为 concave 观感；真机不受影响。',
          );
        }
        this.setData({
          canvasDegraded: true,
        });
        return;
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
          canvas.width = Math.round(W * dpr);
          canvas.height = Math.round(H * dpr);
          const ctx = canvas.getContext('2d');
          // 画布 CSS 宽即 750rpx，据此换算 rpx → px
          const k = W / 750;
          const barTop = rootRect.top - canvasRect.top;
          this._canvas = { canvas, ctx, dpr };
          this._geo = {
            W,
            H,
            barTop,
            // 圆心在栏顶边（CSS 几何：圆钮 top -50% + safe-area/2，圆心恰落在栏顶）
            knobCy: barTop,
            // 凹口半径贴住圆钮外缘，与可见圆钮间留 NOTCH_GAP 透明缝，透出页面背景
            knobR: (KNOB_DIAMETER_RPX / 2) * k,
            btnR: (KNOB_DIAMETER_RPX / 2 - NOTCH_GAP_RPX) * k,
            filletR: Math.max((this.data.filletRpx || 0) * k, 0),
            cornerR: CORNER_RPX * k,
          };
          this._n = this.data.currIndex;
          this.drawFrame(this._n);
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
      const { W, H, barTop: T, knobCy: cy, knobR: Rb, btnR, filletR: fr, cornerR: r0 } = this._geo;
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
      const idx = Math.min(Math.max(Math.round(n), 0), len - 1);
      const item = this.data.list[idx] || {};

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
      ctx.fillStyle = item.barBg || '#fff';
      ctx.fill();
      // 圆钮（与缺口同帧，平移时严格同步）
      ctx.beginPath();
      ctx.arc(cx, cy, btnR, 0, Math.PI * 2);
      ctx.fillStyle = item.activeBg || 'rgb(3, 3, 3)';
      ctx.fill();
    },

    /** 补间：仅在动画期间占用 rAF，结束即停（见 AGENTS.md Canvas 约定） */
    animateTo(target) {
      if (this.data.mode !== 'canvas' || !this._canvas) {
        return;
      }
      const from = typeof this._n === 'number' ? this._n : target;
      this._n = target;
      if (Math.abs(target - from) < 0.001) {
        this.drawFrame(target);
        return;
      }
      if (this._raf) {
        this._canvas.canvas.cancelAnimationFrame(this._raf);
        this._raf = null;
      }
      const start = Date.now();
      const step = () => {
        const t = Math.min(1, (Date.now() - start) / DURATION);
        const n = from + (target - from) * easeCss(t);
        this._n = n;
        this.drawFrame(n);
        if (t < 1) {
          this._raf = this._canvas.canvas.requestAnimationFrame(step);
        } else {
          this._raf = null;
        }
      };
      this._raf = this._canvas.canvas.requestAnimationFrame(step);
    },
  },

  lifetimes: {
    ready() {
      this.initCanvas();
      // this.init()
    },
    detached() {
      if (this._raf && this._canvas) {
        this._canvas.canvas.cancelAnimationFrame(this._raf);
        this._raf = null;
      }
      this._canvas = null;
      this._geo = null;
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
