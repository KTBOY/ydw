// components/urlCopy/url.js
Component({

  /**
   * 组件的属性列表
   */
  properties: {
    url: {
      type: String,
      value: ''
    },
    code: {
      type: String,
      value: ''
    },
    passWord: {
      type: String,
      value: ''
    }
  },

  /**
   * 组件的初始数据
   */
  data: {

  },

  /**
   * 组件的方法列表
   */
  methods: {
    handCopyBD({
      currentTarget
    }) {
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
    }
  }
})