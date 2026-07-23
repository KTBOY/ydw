// nasa/pages/detail/detail.js
import { downLoadImage } from '../../../utils/downLoadVideo'

let rewardAd = null

Page({
  data: {
    id: '',
    title: 'NASA 影像',
    desc: '',
    date: '',
    center: '',
    displayUrl: '', // 展示用 ~large
    origUrl: '', // 下载用 ~orig
    fallbackStep: 0,
  },

  onLoad(options) {
    const item = wx.getStorageSync('nasa_detail_item') || {}
    const thumb = item.thumb || ''
    const displayUrl = thumb ? thumb.replace('~thumb', '~large') : item.img || ''
    const origUrl = thumb ? thumb.replace('~thumb', '~orig') : item.img || ''

    this.setData({
      id: item.id || options.id || '',
      title: item.title || 'NASA 影像',
      desc: item.desc || '',
      date: item.date || '',
      center: item.center || '',
      displayUrl,
      origUrl,
      fallbackStep: 0,
    })

    if (item.title) {
      wx.setNavigationBarTitle({ title: item.title })
    }

    // 激励视频广告：看完后下载
    if (wx.createRewardedVideoAd) {
      rewardAd = wx.createRewardedVideoAd({ adUnitId: 'adunit-3296e83e82b6a87e' })
      rewardAd.onError((err) => {
        console.error('激励视频加载失败', err)
      })
      rewardAd.onClose((res) => {
        if (res && res.isEnded) {
          wx.showLoading({ title: '正在下载..', mask: true })
          downLoadImage(this.data.origUrl)
        } else {
          wx.showToast({ title: '看完广告才能下载哦，支持一下~', icon: 'none' })
        }
      })
    }
  },

  onDownload() {
    if (!this.data.origUrl) {
      wx.showToast({ title: '图片地址无效', icon: 'none' })
      return
    }
    if (rewardAd) {
      rewardAd.show().catch(() => {
        rewardAd
          .load()
          .then(() => rewardAd.show())
          .catch((err) => {
            console.error('激励视频显示失败', err)
            // 广告不可用兜底：直接下载
            wx.showLoading({ title: '正在下载..', mask: true })
            downLoadImage(this.data.origUrl)
          })
      })
    } else {
      wx.showLoading({ title: '正在下载..', mask: true })
      downLoadImage(this.data.origUrl)
    }
  },

  // 展示图回退：~large -> ~medium(img) -> ~thumb
  onImgError() {
    const item = wx.getStorageSync('nasa_detail_item') || {}
    const step = this.data.fallbackStep
    if (step === 0 && item.img) {
      this.setData({ displayUrl: item.img, fallbackStep: 1 })
    } else if (step <= 1 && item.thumb) {
      this.setData({ displayUrl: item.thumb, fallbackStep: 2 })
    }
  },

  onShareAppMessage() {
    return {
      title: this.data.title || 'NASA 影像',
      path: '/pages/home/home',
    }
  },
})
