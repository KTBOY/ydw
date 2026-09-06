import {
  detail,
  estimate
} from "../../../../api/fund.api"

Page({
  data: {
    detail: {},
    estimateChange: '--',
    estimateTime: '--',
    isRise: true,
    hasEstimate: false,
    isRefreshing: false,
    code: ''

  },

  async getDetail(code, options = {}) {
    const {
      showRefreshState = false
    } = options

    if (!code) {
      return
    }

    if (showRefreshState) {
      this.setData({
        isRefreshing: true
      })
    }

    try {
      const [res, currenRes] = await Promise.all([detail(code), estimate(code)])
      const changeValue = Number(currenRes.data.estimateChange)
      const hasEstimate = !Number.isNaN(changeValue)
      this.setData({
        detail: res.data.detail,
        estimateChange: hasEstimate ? Math.abs(changeValue).toFixed(2) : '--',
        estimateTime: currenRes.data.estimateTime || '--',
        isRise: hasEstimate ? changeValue >= 0 : true,
        hasEstimate,
        code
      })
    } catch (error) {
      wx.showToast({
        title: '刷新失败',
        icon: 'none'
      })
    } finally {
      if (showRefreshState) {
        this.setData({
          isRefreshing: false
        })
      }
      wx.stopPullDownRefresh()
    }
  },
  handleRefresh() {
    if (this.data.isRefreshing) {
      return
    }

    this.getDetail(this.data.code || this.data.detail.code, {
      showRefreshState: true
    })
  },
  handleClick() {
    let storeList = wx.getStorageSync('fundDetail') || []
    const currenDetail = {
      ...this.data.detail,
      estimateChange: this.data.estimateChange,
      estimateTime: this.data.estimateTime,
    }
    if (!storeList || !storeList.length) {

      storeList.push(currenDetail)
    }

    const currenFindIndex = storeList.findIndex((item) => item.code === this.data.detail.code)

    if (currenFindIndex != -1) {
      storeList[currenFindIndex] = currenDetail
    } else {
      storeList.push(currenDetail)
    }

    wx.showToast({
      title: '收藏成功',
    })
    wx.setStorageSync('fundDetail', storeList)

  },
  onLoad(v) {
    this.setData({
      code: v.code || ''
    })
    this.getDetail(v.code)
  },
  onPullDownRefresh() {
    this.getDetail(this.data.code || this.data.detail.code, {
      showRefreshState: true
    })
  }

})
