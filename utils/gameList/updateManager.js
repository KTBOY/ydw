export const updateManagerMetods = () => {
  const updateManager = wx.getUpdateManager();
  // 检查小程序是否有新版本发布
  updateManager.onCheckForUpdate((result) => {
    if (result.hasUpdate) {
      // 小程序有新版本，则静默下载新版本，做好更新准备
      updateManager.onUpdateReady(() => {
        wx.showModal({
          title: '更新提示',
          content: '新版本已经准备好，是否重启应用？',
          success: (res) => {
            if (res.confirm) {
              // 新的版本已经下载好，调用 applyUpdate 应用新版本并重启
              updateManager.applyUpdate();
            } else if (res.cancel) {
              // 需要强制更新，则给出二次弹窗
              wx.showModal({
                title: '温馨提示',
                content: '本次版本更新涉及到新的功能添加，旧版本无法正常访问的哦~',
                success: (r) => {
                  if (r.confirm) {
                    updateManager.applyUpdate();
                  } else if (r.cancel) {
                    // 重新回到版本更新提示
                    updateManagerMetods();
                  }
                },
              });
            }
          },
        });
      });
    }
  });
  updateManager.onUpdateFailed((err) => {
    wx.showModal({
      title: '温馨提示',
      content: '当前微信版本过低，无法使用该功能，请升级到最新微信版本后重试~',
    });
  });
};