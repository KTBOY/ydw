// nasa/pages/detail/detail.js
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
    // flash 模式：隐藏「看广告下载」文案并免广告直接下载（默认关闭）
    flash: false,
  },

  onLoad(options) {
    const item = wx.getStorageSync('nasa_detail_item') || {}
    // flash 模式开关：默认 false，可通过跳转参数 ?flash=1 开启
    const flash = options.flash === '1' || options.flash === 'true'
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
      flash,
    })

    if (item.title) {
      wx.setNavigationBarTitle({
        title: item.title
      })
    }

    // 激励视频广告：看完后下载（flash 模式免广告，不创建）
    if (!flash && wx.createRewardedVideoAd) {
      rewardAd = wx.createRewardedVideoAd({
        adUnitId: 'adunit-3296e83e82b6a87e'
      })
      rewardAd.onError((err) => {
        console.error('激励视频加载失败', err)
      })
      rewardAd.onClose((res) => {
        if (res && res.isEnded) {
          this.saveImage()
        } else {
          wx.showToast({
            title: '看完广告才能下载哦，支持一下~',
            icon: 'none'
          })
        }
      })
    }
  },

  onDownload() {

    if (!this.data.origUrl && !this.data.displayUrl) {
      wx.showToast({
        title: '图片地址无效',
        icon: 'none'
      })
      return
    }
    // flash 模式：免广告直接下载原图
    if (this.data.flash) {
      this.saveImage()
      return
    }
    if (rewardAd) {
      rewardAd.show().catch(() => {
        rewardAd
          .load()
          .then(() => rewardAd.show())
          .catch((err) => {
            console.error('激励视频显示失败', err)
            this.saveImage() // 广告不可用兜底：直接下载
          })
      })
    } else {
      this.saveImage()
    }
  },

  // 下载并保存到相册：原图优先，失败自动回退大图；全程有可见反馈
  saveImage() {
    const urls = [this.data.origUrl, this.data.displayUrl].filter(Boolean)
    this._download(urls, 0)
  },

  _download(urls, i) {
    if (i >= urls.length) {
      wx.hideLoading()
      wx.showToast({
        title: '下载失败，请检查网络或合法域名',
        icon: 'none'
      })
      return
    }
    wx.showLoading({
      title: '正在下载..',
      mask: true
    })
    wx.downloadFile({
      url: urls[i],
      success: (res) => {
        // 非 200 或无临时文件 → 换下一档清晰度重试
        if (res.statusCode !== 200 || !res.tempFilePath) {
          this._download(urls, i + 1)
          return
        }
        wx.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => {
            wx.hideLoading()
            wx.showToast({
              title: '已保存到相册'
            })
          },
          fail: (err) => {
            wx.hideLoading()
            const msg = (err && err.errMsg) || ''
            if (msg.indexOf('auth') > -1 || msg.indexOf('deny') > -1) {
              wx.showModal({
                title: '提示',
                content: '保存到相册需要你的授权',
                confirmText: '去授权',
                success: (r) => {
                  if (r.confirm) wx.openSetting()
                },
              })
            } else {
              wx.showToast({
                title: '保存失败',
                icon: 'none'
              })
            }
          },
        })
      },
      fail: () => {
        // 该地址下载失败（如域名未配/网络） → 尝试下一档，均失败则提示
        this._download(urls, i + 1)
      },
    })
  },

  // 展示图回退：~large -> ~medium(img) -> ~thumb
  onImgError() {
    const item = wx.getStorageSync('nasa_detail_item') || {}
    const step = this.data.fallbackStep
    if (step === 0 && item.img) {
      this.setData({
        displayUrl: item.img,
        fallbackStep: 1
      })
    } else if (step <= 1 && item.thumb) {
      this.setData({
        displayUrl: item.thumb,
        fallbackStep: 2
      })
    }
  },

  onShareAppMessage() {
    return {
      title: this.data.title || 'NASA 影像',
      path: '/pages/home/home',
    }
  },
})