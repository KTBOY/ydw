export default [{
    icon: 'icon-xingzhuang-sanjiaoxing',
    // glyph = iconfont 码点，供开发者工具里画布自绘图标用（见 index.js drawGlyphs），真机走 DOM 图标
    glyph: '\ueb99',
    text: '首页',
    url: 'pages/home/home',
    // 圆钮用 Aurora 主紫；pageBg 对齐首页渐变底最上沿（仅 concave 降级模式的外光圈用到）
    pageBg: '#f6f1ff',
    activeBg: '#7c5cff',
  },
  {
    icon: 'icon-fighting-game',
    glyph: '\ue690',
    text: '游戏中心',
    url: '',
    pageBg: '#f2f3f7',
    activeBg: '#7c5cff',
  },
  {
    icon: 'icon-tubiao',
    glyph: '\ue636',
    text: 'NASA',
    url: 'pages/goods/category/index',
    // 深色页：activeBg 圆钮用 NASA 蓝；pageBg 仅 concave 模式外光圈使用（notch 模式为真实镂空，无需同色）
    pageBg: '#070b16',
    activeBg: '#0b3d91',
  },
  // {
  //   icon: 'icon-tubiao',
  //   text: '基金',
  //   url: 'pages/goods/category/index',
  // },
  // {
  //   icon: 'icon-fighting-game',
  //   text: '游戏中心',
  //   url: '',
  // },

  // {
  //   icon: 'cart',
  //   text: '购物车',
  //   url: 'pages/cart/index',
  // },
  // {
  //   icon: 'person',
  //   text: '个人中心',
  //   url: 'pages/usercenter/index',
  // },
];