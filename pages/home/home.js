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
    list: []
  },

  tabClick(v) {
    console.log(v);
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

  async onLoad(options) {
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