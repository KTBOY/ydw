import { getStats } from '../../utils/tarot';

Page({
  data: {
    stats: { total: 0, savedCount: 0, streak: 0 },
  },

  onShow() {
    this.setData({ stats: getStats() });
  },

  goSaved() {
    wx.navigateTo({ url: '/tarot/pages/saved/index' });
  },
});
