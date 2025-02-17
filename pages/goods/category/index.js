// pages/goods/category/index.js
import {
  getGameList,
  readGameList,
} from "../../../utils/gameList/games"
import {
  fuzzySearch
} from "../../../utils/gameUtils"
Page({

  /**
   * 页面的初始数据
   */
  data: {
    list: [],
    loading: true
  },

  onChangeValue(v) {
    if (!v.detail.value) {
      this.setData({
        list: getGameList()
      })
      return
    }

    this.setData({
      list: fuzzySearch(v.detail.value, this.data.list, 'name')
    })

  },

  onClose() {
    console.log('关闭')
    this.setData({
      list: getGameList()
    })
  },

  navToDetailsPage(v) {
    wx.setStorageSync('game', JSON.stringify(v.currentTarget.dataset.item))
    wx.navigateTo({
      url: `/pages/goods/details/index`,
    });
  },

  /**
   * 生命周期函数--监听页面加载
   */
  async onLoad(options) {
    const res = await getGameList()
    this.setData({
      list: res
    })
    setTimeout(() => {
      this.setData({
        loading: false
      })
    }, 1500)
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