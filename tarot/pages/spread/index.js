import { drawThreeSpread, recordSpread, isSaved, toggleSave } from '../../utils/tarot';
import { cardImage, getCardById } from '../../data/cards';

Page({
  data: {
    question: '',
    spread: null,
    revealedCount: 0,
    done: false,
    showDetail: false,
    detailCard: null,
    detailReversed: false,
    detailSaved: false,
  },

  onUnload() {
    if (this._timers) this._timers.forEach((t) => clearTimeout(t));
  },

  onQuestion(e) {
    this.setData({ question: e.detail.value });
  },

  onDraw() {
    if (this.data.spread) return;
    const spread = drawThreeSpread(this.data.question.trim());
    spread.draws = spread.draws.map((d) => ({ ...d, img: cardImage(d.card) }));
    recordSpread(spread);
    this.setData({ spread, revealedCount: 0, done: false });
    this._timers = [0, 1, 2].map((i) => setTimeout(() => this.setData({ revealedCount: i + 1 }), 420 * (i + 1)));
    this._timers.push(setTimeout(() => this.setData({ done: true }), 420 * 4));
  },

  onCard(e) {
    const { idx } = e.currentTarget.dataset;
    const d = this.data.spread.draws[idx];
    if (!d) return;
    this.setData({
      showDetail: true,
      detailCard: getCardById(d.card.id),
      detailReversed: d.isReversed,
      detailSaved: isSaved(d.card.id),
    });
  },

  closeDetail() {
    this.setData({ showDetail: false });
  },

  onDetailAction() {
    const { detailCard } = this.data;
    if (!detailCard) return;
    const saved = toggleSave(detailCard.id);
    this.setData({ detailSaved: saved });
    wx.showToast({ title: saved ? '已收藏' : '已取消收藏', icon: 'none' });
  },

  onAgain() {
    this.setData({ spread: null, done: false, revealedCount: 0 });
  },
});
