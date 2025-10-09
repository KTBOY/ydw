// packageA/pages/videoDow/video.js
import {
  videoDyApi
} from "../../../api/video"
import {
  downLoadVideo
} from "../../../utils/downLoadVideo"
Page({

  /**
   * 页面的初始数据
   */
  data: {
    video: {},
    urlText: ''
  },

  handleBlur(v) {

    console.log(v);
    this.setData({
      urlText: v.detail.value
    })

    console.log(this.data.urlText);
  },


  extractAllDouyinLinks(text) {
    if (!text) return [];

    const regex = /https:\/\/v\.douyin\.com\/[a-zA-Z0-9_\-~!@#$%^&*()+=|{}[\]';:,.<>?/]+\//g;
    return text.match(regex) || [];
  },
  isValidDouyinLink(link) {
    // 验证是否是抖音短链接格式
    const douyinRegex = /^https:\/\/v\.douyin\.com\/[A-Za-z0-9]{8,12}\/?$/;
    return douyinRegex.test(link);
  },

  async handDwonBD() {
    setTimeout(async () => {
      const url = await this.extractAllDouyinLinks(this.data.urlText)
      console.log(url)
      if (!url.length) {
        this.setData({
          urlText: ''
        })
        return wx.showToast({
          title: '输入内容无效',
          icon: 'error'
        })

      }
      const res = await videoDyApi({
        url: url[0]
      })

      console.log(res);
      this.setData({
        video: res.data.data
      })
      downLoadVideo(res.data.data.url)
    }, 500);
    console.log(this.data.urlTex);


  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {

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