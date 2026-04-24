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
    hasEstimate: false

  },

  async getDetail(code) {
    const res = await detail(code)
    const currenRes = await estimate(code)
    const changeValue = Number(currenRes.data.estimateChange)
    const hasEstimate = !Number.isNaN(changeValue)
    this.setData({
      detail: res.data.detail,
      estimateChange: hasEstimate ? Math.abs(changeValue).toFixed(2) : '--',
      estimateTime: currenRes.data.estimateTime || '--',
      isRise: hasEstimate ? changeValue >= 0 : true,
      hasEstimate
      // rate: res.rate ?? this.data.rate,
      // netValue: res.netValue ?? this.data.netValue,
      // profits: res.profits || this.data.profits
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
      console.log(this.data.detail);
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

    this.getDetail(v.code)
  },

})