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
    this.setData({
      currIndex: 1
    })
    console.log('555');
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
    this.setData({
      h5Url: `http://127.0.0.1:8848/test/333.html?userId=${this.data.userId}`
    });
    const res = await getGameList()
    res.reverse()
    this.setData({
      list: res
    })
    if (wx.createInterstitialAd) {
      interstitialAd = wx.createInterstitialAd({
        adUnitId: 'adunit-73225c369f75b51c'
      })
      interstitialAd.onLoad(() => {})
      interstitialAd.onError((err) => {
        console.error('插屏广告加载失败', err)
      })
      interstitialAd.onClose(() => {})
    }

    // 在适合的场景显示插屏广告
    if (interstitialAd) {
      interstitialAd.show().catch((err) => {
        console.error('插屏广告显示失败', err)
      })
    }
  },


})