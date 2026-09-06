import { cardImage } from '../../data/cards';

Component({
  properties: {
    show: { type: Boolean, value: false },
    card: { type: Object, value: null },
    isReversed: { type: Boolean, value: false },
    showSave: { type: Boolean, value: false },
    saved: { type: Boolean, value: false },
  },
  data: {
    img: '',
  },
  observers: {
    card(val) {
      this.setData({ img: val ? cardImage(val) : '' });
    },
  },
  methods: {
    onClose() {
      this.triggerEvent('close');
    },
    onAction() {
      this.triggerEvent('action', { cardId: this.properties.card ? this.properties.card.id : null });
    },
    noop() {},
  },
});
