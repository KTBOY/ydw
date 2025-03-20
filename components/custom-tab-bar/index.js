import TabMenu from './data';
Component({
  data: {
    active: 0,
    currIndex: 0,
    list: TabMenu,
  },

  methods: {
    tabClick(event) {
      console.log(this.data.currIndex)

      const {
        index,
        item
      } = event.currentTarget.dataset.params
      this.setData({
        currIndex: index
      });
      // wx.switchTab({
      //   url: this.data.list[index].url.startsWith('/') ?
      //     this.data.list[index].url : `/${this.data.list[index].url}`,
      // });
      this.triggerEvent('tabClick', {
        index
      })


    },

    init() {
      const page = getCurrentPages().pop();
      const route = page ? page.route.split('?')[0] : '';
      const currIndex = this.data.list.findIndex(
        (item) =>
        (item.url.startsWith('/') ? item.url.substr(1) : item.url) ===
        `${route}`,
      );

      this.setData({
        currIndex
      });
    },

  },
  lifetimes: {
    ready() {
      // this.init()

    },
    detached() {
      console.log(22)
    },
  },
  pageLifetimes: {
    show: function () {
      console.log(this.data.currIndex)
    },
    hide: function () {
      // 页面被隐藏
      console.log(页面被隐藏)
    },
    resize: function (size) {
      // 页面尺寸变化
      console.log(页面尺寸变化)
    }
  }
});