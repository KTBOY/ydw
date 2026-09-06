import { getSavedIds, toggleSave } from '../../utils/tarot';
import { getCardById, cardImage } from '../../data/cards';

Page({
  data: {
    list: [],
    showDetail: false,
    detailCard: null,
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const list = getSavedIds()
      .map((id) => {
        const card = getCardById(id);
        return card ? { ...card, img: cardImage(card) } : null;
      })
      .filter((c) => c !== null);
    this.setData({ list });
  },

  onCard(e) {
    const { id } = e.currentTarget.dataset;
    this.setData({ showDetail: true, detailCard: getCardById(id) });
  },

  closeDetail() {
    this.setData({ showDetail: false });
  },

  onUnsave(e) {
    toggleSave(e.detail.cardId);
    this.setData({ showDetail: false });
    wx.showToast({ title: '已取消收藏', icon: 'none' });
    this.refresh();
  },

  onLongUnsave(e) {
    const { id } = e.currentTarget.dataset;
    const card = getCardById(id);
    wx.showModal({
      title: '取消收藏',
      content: `将「${card ? card.nameCn : ''}」移出收藏？`,
      success: (res) => {
        if (!res.confirm) return;
        toggleSave(id);
        wx.showToast({ title: '已取消收藏', icon: 'none' });
        this.refresh();
      },
    });
  },
});
