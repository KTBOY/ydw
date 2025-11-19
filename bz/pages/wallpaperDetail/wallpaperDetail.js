// bz/pages/wallpaperDetail/wallpaperDetail.js

import {
  downLoadImage
} from "../../../utils/downLoadVideo"

let videoAd = null
let rewardedVideoAd = null
Page({

  /**
   * 页面的初始数据
   */
  data: {
    img: ''
  },
  handleImage(v) {
    wx.showLoading({
      title: '正在下载..',
    })


    if (videoAd) {
      videoAd.show().catch(() => {
        // 失败重试
        videoAd.load()
          .then(() => videoAd.show())
          .catch(err => {
            console.error('激励视频 广告显示失败', err)
          })
      })
    }
  },


  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    if (wx.createRewardedVideoAd) {
      videoAd = wx.createRewardedVideoAd({
        adUnitId: 'adunit-3296e83e82b6a87e'
      })
      videoAd.onLoad((v) => {

      })
      videoAd.onError((err) => {
        console.error('激励视频光告加载失败', err)
        videoAd.show()
      })
      videoAd.onClose((res) => {
        // 用户点击了【关闭广告】按钮
        if (res && res.isEnded) {

          downLoadImage(wx.getStorageSync('page-image'))
        } else {
          // 播放中途退出，不下发游戏奖励
          wx.showToast({
            title: '麻烦广告看完先，成本有限 支持一下',
            icon: 'none'
          })
        }
      })
    }
    this.setData({
      img: wx.getStorageSync('page-image')
    })
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  }
})