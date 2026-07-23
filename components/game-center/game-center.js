// components/game-center/game-center.js 游戏中心（可玩小游戏）
Component({
  data: {
    games: [{
      name: '箭头逃脱',
      desc: '经典箭头解谜：规划顺序，让每个箭头滑出棋盘',
      cover: '/game/images/arrow-escape.png',
      url: '/game/pages/arrowEscape/index',
    }],
  },

  methods: {
    onPlay(e) {
      const {
        url
      } = e.currentTarget.dataset;
      if (!url) return;
      wx.navigateTo({
        url
      });
    },
  },
});
