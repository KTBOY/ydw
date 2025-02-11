// pages/goods/details/index.js

import {
  extractLinkInfo
} from "../../../utils/gameUtils"
Page({

  /**
   * 页面的初始数据
   */
  data: {
    detailsData: {}
  },

  handCopyBD({
    currentTarget
  }) {
    console.log(currentTarget.dataset.url)
    var _this = this
    wx.setClipboardData({
      data: currentTarget.dataset.url,
      success: function (res) {
        wx.getClipboardData({
          success: function (res) {
            wx.showToast({
              title: '复制成功'
            })
          }
        })
      }
    })
  },
  handCopyKK({
    currentTarget
  }) {
    console.log(currentTarget.dataset.url)
    var _this = this
    wx.setClipboardData({
      data: currentTarget.dataset.url,
      success: function (res) {
        wx.getClipboardData({
          success: function (res) {
            wx.showToast({
              title: '复制成功'
            })
          }
        })
      }
    })
  },
  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {

    const detailsData = JSON.parse(wx.getStorageSync('game'))
    console.log(detailsData)
    if (detailsData.urlB) {
      detailsData.urlB = detailsData.urlB.replace('链接：', '')
      const newUrlB = extractLinkInfo(detailsData.urlB)
      detailsData.urlBCode = newUrlB.code
      detailsData.urlB = newUrlB.link
    }

    this.setData({
      detailsData
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