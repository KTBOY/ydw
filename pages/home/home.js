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

Page({
  data: {
    currIndex: 0,
    swiperList,
    list: [],
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
    // this.setData({
    //   currIndex: 1
    // })
    wx.navigateTo({
      url: '/bz/pages/wallpaper/wallpaper'
    })
  },
  load(v) {
    console.log(v)
    console.log('555');

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