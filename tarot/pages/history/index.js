import { getHistoryByMonth, buildMonthGrid } from '../../utils/tarot';
import { getCardById } from '../../data/cards';

Page({
  data: {
    weekDays: ['日', '一', '二', '三', '四', '五', '六'],
    year: 0,
    month: 0,
    monthLabel: '',
    grid: [],
    showDetail: false,
    detailCard: null,
    detailReversed: false,
  },

  onLoad() {
    const now = new Date();
    this.build(now.getFullYear(), now.getMonth() + 1);
  },

  build(year, month) {
    const grid = buildMonthGrid(year, month, getHistoryByMonth(year, month));
    this.setData({ year, month, monthLabel: `${year}年${month}月`, grid });
  },

  prevMonth() {
    let { year, month } = this.data;
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
    this.build(year, month);
  },

  nextMonth() {
    let { year, month } = this.data;
    month += 1;
    if (month === 13) {
      month = 1;
      year += 1;
    }
    this.build(year, month);
  },

  onDay(e) {
    const { cell } = e.currentTarget.dataset;
    if (!cell || !cell.hasRecord) return;
    this.setData({
      showDetail: true,
      detailCard: getCardById(cell.cardId),
      detailReversed: cell.reversed,
    });
  },

  closeDetail() {
    this.setData({ showDetail: false });
  },
});
