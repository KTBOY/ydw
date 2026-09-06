// promise风格

//检查权限
function checkAuth() {
  //查询权限
  return new Promise((resolve, reject) => {
    wx.showLoading({
      title: '检查授权情况',
      mask: true
    })
    wx.getSetting({
      success(res) {
        wx.hideLoading();
        if (!res.authSetting['scope.writePhotosAlbum']) {
          //请求授权
          wx.authorize({
            scope: 'scope.writePhotosAlbum',
            success() {
              //获得授权，开始下载
              resolve("授权成功")
            },
            fail() {
              wx.showModal({
                title: '',
                content: '保存到系统相册需要授权',
                confirmText: '授权',
                success(res) {
                  if (res.confirm) {
                    wx.openSetting({
                      success(res) {
                        if (res.authSetting['scope.writePhotosAlbum'] === true) {
                          resolve("授权成功")
                        }
                      }
                    })
                  }
                },
                fail() {
                  wx.showToast({
                    title: '打开设置页失败',
                    icon: 'none',
                  })
                }
              })
            }
          })
        } else {
          //已有授权
          resolve("授权成功")
        }
      },
      fail() {
        wx.hideLoading();
        wx.showToast({
          title: '获取授权失败',
          icon: 'none',
        })
        reject("获取授权失败")
      }
    })
  })
}


export const downLoadVideo = function (url) {
  checkAuth()
    .then(() => {
      wx.showLoading({
        title: '正在下载',
        mask: true
      });
      wx.downloadFile({
        url: url, //url,
        header: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1',
        },
        success: res => {
          console.log(res);
          if (res.statusCode === 200) {
            console.log(res.tempFilePath)
            //类型为视频
            wx.saveVideoToPhotosAlbum({
              filePath: res.tempFilePath,
              success: res => {
                console.log(res);
                wx.hideLoading();
                wx.showToast({
                  title: '下载成功',
                })

              },
              fail: err => {
                console.log(err);
                wx.hideLoading();
                wx.showToast({
                  title: err
                })
              }
            })
          }
        },
        fail: res => {
          console.log(res);
          wx.hideLoading();
          wx.showToast({
            title: '下载失败'
          })
        }
      })
    })
    .catch(() => {
      // 授权失败
      wx.showToast({
        title: '授权失败'
      })
    })
}


export const downLoadImage = (img) => {
  wx.downloadFile({
    url: img, //图片地址
    success: function (res) {
      //wx.saveImageToPhotosAlbum方法：保存图片到系统相册
      wx.saveImageToPhotosAlbum({
        filePath: res.tempFilePath, //图片文件路径
        success: function (data) {
          wx.hideLoading(); //隐藏 loading 提示框
          wx.showModal({
            title: '提示',
            content: '保存成功',
            modalType: false,
          });
        },
        // 接口调用失败的回调函数
        fail: function (err) {
          if (
            err.errMsg === 'saveImageToPhotosAlbum:fail:auth denied' ||
            err.errMsg === 'saveImageToPhotosAlbum:fail auth deny' ||
            err.errMsg === 'saveImageToPhotosAlbum:fail authorize no response'
          ) {
            wx.showModal({
              title: '提示',
              content: '需要您授权保存相册',
              modalType: false,
              success: (modalSuccess) => {
                wx.openSetting({
                  success(settingdata) {
                    console.log('settingdata', settingdata);
                    if (settingdata.authSetting['scope.writePhotosAlbum']) {
                      wx.showModal({
                        title: '提示',
                        content: '获取权限成功,再次点击图片即可保存',
                        modalType: false,
                      });
                    } else {
                      wx.showModal({
                        title: '提示',
                        content: '获取权限失败，将无法保存到相册哦~',
                        modalType: false,
                      });
                    }
                  },
                  fail(failData) {
                    console.log('failData', failData);
                  },
                  complete(finishData) {
                    console.log('finishData', finishData);
                  },
                });
              },
            });
          }
        },
        complete(res) {
          wx.hideLoading(); //隐藏 loading 提示框
        },
      });
    },
  });
}