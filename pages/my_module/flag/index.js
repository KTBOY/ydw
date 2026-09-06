// pages/my_module/flag/index.js
const query = wx.createSelectorQuery()
Page({

  /**
   * 页面的初始数据
   */
  data: {
    prurl: '', //绘制成功的图片
    defaultImg: 0, //默认图
    avatarUrl: '', //上传的头像
    list: [
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11
    ]
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
    this.initCanvas(this.data.defaultImg)
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

  },
  loadImage(img, src) {
    return new Promise((resolve, reject) => {
      img.src = src
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`加载失败: ${src}`));

    });
  },

  // 初始化
  initCanvas(index, img) {
    let that = this;
    wx.createSelectorQuery().select('#myCanvas').node(res => {
      const canvas = res.node
      console.log();
      const ctx = canvas.getContext('2d')
      //const bg = canvas.createImage();
      //  bg.src = 
      const images = [{
          img: canvas.createImage(),
          src: `/asserts/images/gq/hat${index}.png`
        },


      ];
      if (img || that.avatarUrl) {
        images.push({
          img: canvas.createImage(),
          src: img || that.avatarUrl
        }, )
      }

      Promise.all(images.map(image => that.loadImage(image.img, image.src)))
        .then((res) => {
          const aspectRatio = res[0].width / res[0].height; // 计算宽高比
          canvas.height = canvas.width / aspectRatio; // 设置画布的高度以保持宽高比
          ctx.clearRect(0, 0, 150, 150);
          if (img || that.avatarUrl) {
            ctx.drawImage(res[1], 0, 0, canvas.width, canvas.height)
          }
          ctx.drawImage(res[0], 0, 0, canvas.width, canvas.height)
          ctx.stroke()
          wx.canvasToTempFilePath({
            canvas,
            success: function (res) {
              console.log(res);
              that.setData({
                prurl: res.tempFilePath
              })
            },
            fail: function (res) {
              console.log(res);
            }
          }, that)
        })
        .catch(error => {
          console.error(error);
        });

    }).exec()

  },
  selectImg(e) {
    const current = e.target.dataset.id;
    this.setData({
      defaultImg: current,
      prurl: ''
    });
    if (this.data.avatarUrl != '') {
      this.initCanvas(current, this.data.avatarUrl);
    } else {
      this.initCanvas(this.data.defaultImg);
    }
  },

  chooseImage() {
    let that = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success(res) {
        that.setData({
          avatarUrl: res.tempFiles[0].tempFilePath
        })
        that.initCanvas(that.data.defaultImg, res.tempFiles[0].tempFilePath)



      }
    })
  },
  save: function () {
    var that = this;
    console.log(this.data);
    if (!that.data.prurl) {
      wx.showToast({
        title: '请先生成头像!',
      })
      return;
    }
    wx.saveImageToPhotosAlbum({
      filePath: that.data.prurl,
      success(res) {}
    })
  },

})