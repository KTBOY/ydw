import TabMenu from './data';
Component({
  data: {
    active: 0,
    currIndex: 0,
    list: TabMenu,
  },

  methods: {
    tabClick(event) {
      let {
        index
      } = e.currentTarget.dataset;
      this.setData({
        currIndex: event.detail.value
      });
      // wx.switchTab({
      //   url: this.data.list[event.detail.value].url.startsWith('/') ?
      //     this.data.list[event.detail.value].url : `/${this.data.list[event.detail.value].url}`,
      // });
    },

    init() {
      const page = getCurrentPages().pop();
      const route = page ? page.route.split('?')[0] : '';
      const active = this.data.list.findIndex(
        (item) =>
        (item.url.startsWith('/') ? item.url.substr(1) : item.url) ===
        `${route}`,
      );
      this.setData({
        active
      });
    },
  },
});