import {
  getDailyCard,
  todayStr,
  recordDraw,
  getDraw,
  isSaved,
  toggleSave,
  getHistoryByMonth,
  buildMonthGrid,
  getStats,
  isRedrawUsed,
  redrawDaily,
} from '../../utils/tarot';
import { getCardById, cardImage } from '../../data/cards';

const WEEK_CN = ['日', '一', '二', '三', '四', '五', '六'];
const ROMAN = [
  '0',
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
  'XI',
  'XII',
  'XIII',
  'XIV',
  'XV',
  'XVI',
  'XVII',
  'XVIII',
  'XIX',
  'XX',
  'XXI',
];
const WEEK_HEAD = WEEK_CN.slice();
const TAB_ORDER = ['home', 'history', 'profile'];

Page({
  data: {
    tab: 'home',
    panels: { home: 'on', history: 'off-r', profile: 'off-r' },

    card: null,
    img: '',
    numeral: '0',
    isRevealed: false,
    animating: false,
    cardAnim: true,
    slideDir: 'enter',
    saved: false,
    redrawUsed: false,
    dateLine: '',
    timeLine: '',

    weekDays: WEEK_HEAD,
    histYear: 0,
    histMonth: 0,
    monthLabel: '',
    grid: [],
    histBuilt: false,
    showDetail: false,
    detailCard: null,
    detailReversed: false,
    detailSaved: false,

    stats: { total: 0, savedCount: 0, streak: 0 },
  },

  onLoad() {
    this.loadTodayCard();
    this.startClock();
  },

  onShow() {
    this.startClock();
    this.setData({ stats: getStats() });
    if (this.data.histBuilt) {
      this.buildHistory(this.data.histYear, this.data.histMonth);
    }
  },

  onHide() {
    this.stopClock();
  },

  onUnload() {
    this.stopClock();
    if (this._dealTimer) clearTimeout(this._dealTimer);
  },

  /* ===== 底部切换（页内面板，带过渡动画） ===== */

  onTabChange(e) {
    const { key } = e.detail;
    if (key === this.data.tab) return;
    const to = TAB_ORDER.indexOf(key);
    const panels = {};
    TAB_ORDER.forEach((p) => {
      if (p === key) {
        panels[p] = 'on';
      } else {
        panels[p] = TAB_ORDER.indexOf(p) < to ? 'off-l' : 'off-r';
      }
    });
    this.setData({ tab: key, panels });
    if (key === 'history' && !this.data.histBuilt) {
      const now = new Date();
      this.buildHistory(now.getFullYear(), now.getMonth() + 1);
    }
    if (key === 'profile') {
      this.setData({ stats: getStats() });
    }
  },

  /* ===== 首页面板：每天仅一张牌 ===== */

  loadTodayCard() {
    const dateStr = todayStr();
    const drawn = getDraw(dateStr);
    const card = drawn ? { ...drawn.card, isReversed: drawn.reversed } : getDailyCard(dateStr);
    this.setData({
      card,
      img: cardImage(card),
      numeral: ROMAN[card.id] || String(card.id),
      isRevealed: !!drawn,
      saved: isSaved(card.id),
      redrawUsed: isRedrawUsed(dateStr),
      slideDir: 'enter',
    });
    this.updateClock();
    this.setData({ cardAnim: false });
    if (this._dealTimer) clearTimeout(this._dealTimer);
    this._dealTimer = setTimeout(() => this.setData({ cardAnim: true }), 60);
  },

  onRedraw() {
    if (this.data.redrawUsed || this.data.animating) return;
    wx.showModal({
      title: '重新抽牌',
      content: '今日重抽机会仅一次，使用后不可恢复，确定？',
      success: (res) => {
        if (!res.confirm) return;
        const card = redrawDaily(todayStr());
        this.setData({
          card,
          img: cardImage(card),
          numeral: ROMAN[card.id] || String(card.id),
          isRevealed: false,
          saved: isSaved(card.id),
          redrawUsed: true,
          cardAnim: false,
          slideDir: 'enter',
        });
        if (this._dealTimer) clearTimeout(this._dealTimer);
        this._dealTimer = setTimeout(() => this.setData({ cardAnim: true }), 60);
        wx.showToast({ title: '新牌已就位，轻触揭示', icon: 'none' });
      },
    });
  },

  onCardTap() {
    const { isRevealed, animating, card } = this.data;
    if (animating) return;
    if (!isRevealed) {
      this.setData({ animating: true });
      setTimeout(() => {
        recordDraw(todayStr(), { cardId: card.id, reversed: card.isReversed });
        this.setData({
          isRevealed: true,
          animating: false,
          saved: isSaved(card.id),
          stats: getStats(),
        });
      }, 620);
      return;
    }
    this.setData({
      showDetail: true,
      detailCard: getCardById(card.id),
      detailReversed: card.isReversed,
      detailSaved: isSaved(card.id),
    });
  },

  onDetailAction() {
    const { detailCard } = this.data;
    if (!detailCard) return;
    const saved = toggleSave(detailCard.id);
    this.setData({
      saved,
      detailSaved: saved,
      stats: getStats(),
    });
    wx.showToast({ title: saved ? '已收藏' : '已取消收藏', icon: 'none' });
  },

  goSpread() {
    wx.navigateTo({ url: '/tarot/pages/spread/index' });
  },

  startClock() {
    this.stopClock();
    this.updateClock();
    this._clock = setInterval(() => this.updateClock(), 30 * 1000);
  },

  stopClock() {
    if (this._clock) {
      clearInterval(this._clock);
      this._clock = null;
    }
  },

  updateClock() {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    this.setData({
      dateLine: `${now.getMonth() + 1}月${now.getDate()}日 星期${WEEK_CN[now.getDay()]}`,
      timeLine: time,
    });
  },

  /* ===== 历史面板 ===== */

  buildHistory(year, month) {
    const grid = buildMonthGrid(year, month, getHistoryByMonth(year, month));
    this.setData({
      histBuilt: true,
      histYear: year,
      histMonth: month,
      monthLabel: `${year}年${month}月`,
      grid,
    });
  },

  prevMonth() {
    let { histYear: year, histMonth: month } = this.data;
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
    this.buildHistory(year, month);
  },

  nextMonth() {
    let { histYear: year, histMonth: month } = this.data;
    month += 1;
    if (month === 13) {
      month = 1;
      year += 1;
    }
    this.buildHistory(year, month);
  },

  onDay(e) {
    const { cell } = e.currentTarget.dataset;
    if (!cell || !cell.hasRecord) return;
    this.setData({
      showDetail: true,
      detailCard: getCardById(cell.cardId),
      detailReversed: cell.reversed,
      detailSaved: isSaved(cell.cardId),
    });
  },

  closeDetail() {
    this.setData({ showDetail: false });
  },

  /* ===== 我的面板 ===== */

  goSaved() {
    wx.navigateTo({ url: '/tarot/pages/saved/index' });
  },
});
