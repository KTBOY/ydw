// components/game-center/game-center.js 游戏中心（可玩小游戏）
// bed：封面底色（封面比例不统一，磁贴用 aspectFit 留出色底，不裁画）
const GAMES = [
  {
    name: '菇菇合成机',
    desc: '娃娃机夹爪投放蘑菇玩偶，同级相碰不断合成升级，别堆过安全线',
    cover: '/gamehall/images/mushies.png',
    url: '/mushies/pages/index/index',
    tag: '合成',
    accent: '#e0559b',
    bed: 'linear-gradient(135deg,#ffe7f0,#e9dcff)',
    featured: true,
  },
  {
    name: '数独 · 雅集',
    desc: '新中式文人风数独：无限关卡、每日挑战、笔记提示与战绩统计',
    cover: '/gamehall/images/sudoku.png',
    url: '/game/pages/sudoku/index',
    tag: '益智',
    accent: '#b0402f',
    bed: 'linear-gradient(135deg,#f6f0e4,#e6e1d3)',
  },
  {
    name: '箭头逃脱',
    desc: '经典箭头解谜：规划顺序，让每个箭头滑出棋盘',
    cover: '/gamehall/images/arrow-escape.png',
    url: '/game/pages/arrowEscape/index',
    tag: '解谜',
    accent: '#2f5da8',
    bed: 'linear-gradient(135deg,#eef2fb,#dbe4f5)',
  },
];

const hero = GAMES.find((item) => item.featured) || GAMES[0];

Component({
  data: {
    hero,
    games: GAMES.filter((item) => item !== hero),
    total: GAMES.length,
  },

  methods: {
    onPlay(e) {
      const { url } = e.currentTarget.dataset;
      if (!url) return;
      wx.navigateTo({
        url,
      });
    },
  },
});
