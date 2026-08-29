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
} from '../../utils/tarot';
import { getCardById, cardImage } from '../../data/cards';

const MONTH_CN = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
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

    months: [],
    yearLabel: '',
    viewMonth: 0,
    isCurrentMonth: true,
    monthScrollLeft: 0,

    card: null,
    img: '',
    numeral: '0',
    isRevealed: false,
    animating: false,
    cardAnim: true,
    saved: false,
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
    detailAction: '',

    stats: { total: 0, savedCount: 0, streak: 0 },
  },

  onLoad() {
    const now = new Date();
    const viewMonth = now.getMonth() + 1;
    this.setData({
      months: MONTH_CN.map((name, index) => ({ name: `${name}月`, index: index + 1 })),
      yearLabel: `${now.getFullYear()}年`,
      viewMonth,
      stats: getStats(),
    });
    this.loadMonthCard(viewMonth);
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

  /* ===== 首页面板 ===== */

  loadMonthCard(month) {
    const now = new Date();
    const isCurrentMonth = month === now.getMonth() + 1;
    if (isCurrentMonth) {
      const dateStr = todayStr();
      const drawn = getDraw(dateStr);
      const card = drawn ? { ...drawn.card, isReversed: drawn.reversed } : getDailyCard(dateStr);
      this.setData({
        isCurrentMonth: true,
        card,
        img: cardImage(card),
        numeral: ROMAN[card.id] || String(card.id),
        isRevealed: !!drawn,
        saved: isSaved(card.id),
        viewMonth: month,
        monthScrollLeft: this.calcScrollLeft(month - 1),
      });
      this.updateClock();
    } else {
      const seedDate = `${now.getFullYear()}-${String(month).padStart(2, '0')}-01`;
      const card = getDailyCard(seedDate);
      this.setData({
        isCurrentMonth: false,
        card,
        img: cardImage(card),
        numeral: ROMAN[card.id] || String(card.id),
        isRevealed: true,
        dateLine: `${now.getFullYear()}年${month}月`,
        timeLine: '本月指引',
        viewMonth: month,
        monthScrollLeft: this.calcScrollLeft(month - 1),
      });
    }
    this.setData({ cardAnim: false });
    if (this._dealTimer) clearTimeout(this._dealTimer);
    this._dealTimer = setTimeout(() => this.setData({ cardAnim: true }), 60);
  },

  calcScrollLeft(index) {
    const win = wx.getWindowInfo();
    const itemPx = (180 * win.windowWidth) / 750;
    return Math.max(0, Math.round(index * itemPx + itemPx / 2 - win.windowWidth / 2));
  },

  onPickMonth(e) {
    const month = Number(e.currentTarget.dataset.m);
    if (month === this.data.viewMonth) return;
    this.loadMonthCard(month);
  },

  onCardTap() {
    const { isCurrentMonth, isRevealed, animating, card } = this.data;
    if (animating) return;
    if (isCurrentMonth && !isRevealed) {
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
      detailAction: isSaved(card.id) ? '已收藏' : '收藏此牌',
    });
  },

  onDetailAction() {
    const { detailCard } = this.data;
    if (!detailCard) return;
    const saved = toggleSave(detailCard.id);
    this.setData({
      saved,
      detailAction: saved ? '已收藏' : '收藏此牌',
      stats: getStats(),
    });
    wx.showToast({ title: saved ? '已收藏' : '已取消收藏', icon: 'none' });
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
    if (!this.data.isCurrentMonth) return;
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
      detailAction: isSaved(cell.cardId) ? '已收藏' : '收藏此牌',
    });
  },

  closeDetail() {
    this.setData({ showDetail: false });
  },

  /* ===== 我的面板 ===== */

  goSaved() {
    wx.navigateTo({ url: '/tarot/pages/saved/index' });
  },

  goMember() {
    wx.navigateTo({ url: '/tarot/pages/member/index' });
  },
});
