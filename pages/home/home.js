import {
  getGameList
} from "../../utils/gameList/games"
import {
  fuzzySearch
} from "../../utils/gameUtils"
let interstitialAd = null

const imageCdn = 'https://tdesign.gtimg.com/mobile/demos';
const swiperList = [
  `${imageCdn}/swiper1.png`,
  `${imageCdn}/swiper2.png`,
  `${imageCdn}/swiper1.png`,
  `${imageCdn}/swiper2.png`,
  `${imageCdn}/swiper1.png`,
];

// 首页开了 navigationStyle: custom（沉浸式），内容会顶到状态栏底下。
// 这里按系统胶囊位置量出导航高度，以 CSS 变量下发给三个 tab 内容各自让位。
function measureNav() {
  const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
  const statusH = info.statusBarHeight || 0;
  let barH = 44;
  try {
    const cap = wx.getMenuButtonBoundingClientRect();
    if (cap && cap.height) barH = (cap.top - statusH) * 2 + cap.height;
  } catch (err) {
    /* 取不到胶囊就用默认 44 */
  }
  return { statusH, navH: statusH + barH };
}

const NAV = measureNav();

Page({
  data: {
    currIndex: 0,
    swiperList,
    list: [],
    statusH: NAV.statusH,
    navH: NAV.navH,
    userId: 'u_123456', // 假设从缓存获取用户ID
    h5Url: '' // 动态拼接H5地址
  },
  onH5Load() {
    const webView = this.selectComponent('#test'); // 获取web-view组件实例（可选）
    console.log(webView);
    wx.postMessage({
      data: {
        foo: 'bar'
      }
    })
  },

  onH5Message(e) {
    const h5Message = e.detail.data[0]; // 消息存储在detail.data数组中
    console.log('收到H5消息：', h5Message);

  },
  tabClick(v) {
    this.setData({
      currIndex: v.detail.index
    })

  },
  onChangeMenu(e) {
    this.setData({
      currIndex: 1
    })
    // wx.navigateTo({
    //   url: '/bz/pages/wallpaper/wallpaper'
    // })
  },
  load(v) {


    wx.miniProgram.postMessage({
      data: {
        foo: 'bar'
      }
    })
  },
  onH5Message(e) {
    const message = e.detail.data[0];
    if (message.type === 'requestPay') {
      this.handlePay(message.orderId); // 调用支付逻辑
    }
  },

  async onLoad(options) {

    const res = await getGameList()
    res.reverse()
    this.setData({
      list: res
    })








  },


})