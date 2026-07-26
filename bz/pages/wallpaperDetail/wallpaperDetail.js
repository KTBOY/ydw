// bz/pages/wallpaperDetail/wallpaperDetail.js

import { downLoadImage } from '../../../utils/downLoadVideo';

let videoAd = null;

Page({
  /**
   * 页面的初始数据
   */
  data: {
    list: [], // 壁纸 URL 列表（卡片轮播）
    current: 0, // 当前卡片索引
    bgA: '', // 模糊背景双缓冲层 A
    bgB: '', // 模糊背景双缓冲层 B
    showA: true, // 当前显示的背景层
  },

  // 滑动切换卡片：更新索引并交叉渐变背景
  onSwiperChange(e) {
    const { current } = e.detail;
    if (current === this.data.current) return;
    this.setData({ current });
    this.switchBg(this.data.list[current]);
  },

  // 背景双层交叉渐变：新图先放到隐藏层，再翻转两层透明度
  switchBg(img) {
    if (!img) return;
    if (this.data.showA) {
      this.setData({ bgB: img, showA: false });
    } else {
      this.setData({ bgA: img, showA: true });
    }
  },

  handleImage() {
    wx.showLoading({
      title: '正在下载..',
    });

    if (videoAd) {
      videoAd.show().catch(() => {
        // 失败重试
        videoAd
          .load()
          .then(() => videoAd.show())
          .catch((err) => {
            console.error('激励视频 广告显示失败', err);
          });
      });
    }
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad() {
    if (wx.createRewardedVideoAd) {
      videoAd = wx.createRewardedVideoAd({
        adUnitId: 'adunit-3296e83e82b6a87e',
      });
      videoAd.onLoad(() => {});
      videoAd.onError((err) => {
        console.error('激励视频广告加载失败', err);
        videoAd.show();
      });
      videoAd.onClose((res) => {
        // 用户点击了【关闭广告】按钮
        if (res && res.isEnded) {
          // 下载当前卡片对应的壁纸
          downLoadImage(this.data.list[this.data.current]);
        } else {
          // 播放中途退出，不下发游戏奖励
          wx.showToast({
            title: '麻烦广告看完先，成本有限 支持一下',
            icon: 'none',
          });
        }
      });
    }

    // 列表页存入整组壁纸 + 起始索引；旧入口只存单张时退化为单卡片
    const list = wx.getStorageSync('page-image-list');
    const single = wx.getStorageSync('page-image');
    if (Array.isArray(list) && list.length) {
      const index = Number(wx.getStorageSync('page-image-index')) || 0;
      const current = Math.min(Math.max(index, 0), list.length - 1);
      this.setData({ list, current, bgA: list[current] });
    } else if (single) {
      this.setData({ list: [single], current: 0, bgA: single });
    }
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {
    videoAd = null;
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {
    return {
      title: '壁纸',
      path: '/bz/pages/wallpaper/wallpaper',
      imageUrl: '/asserts/images/fx.jpg',
    };
  },
});
