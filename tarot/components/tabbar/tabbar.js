Component({
  properties: {
    active: { type: String, value: 'home' },
    // true 时只抛出 change 事件（由宿主页面做面板切换动画），默认保持 redirectTo 跳转
    useEvent: { type: Boolean, value: false },
  },
  data: {
    items: [
      {
        key: 'home',
        label: '首页',
        icon: '/tarot/images/decor/coin-home.png',
        iconActive: '/tarot/images/decor/coin-home-gold.png',
      },
      {
        key: 'history',
        label: '历史',
        icon: '/tarot/images/decor/coin-history-dark.png',
        iconActive: '/tarot/images/decor/coin-history.png',
      },
      {
        key: 'profile',
        label: '我的',
        icon: '/tarot/images/decor/coin-profile.png',
        iconActive: '/tarot/images/decor/coin-profile-gold.png',
      },
    ],
  },
  methods: {
    onTap(e) {
      const { key } = e.currentTarget.dataset;
      if (key === this.properties.active) return;
      if (this.properties.useEvent) {
        this.triggerEvent('change', { key });
      } else {
        wx.redirectTo({ url: `/tarot/pages/${key}/index` });
      }
    },
  },
});
