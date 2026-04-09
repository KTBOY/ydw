// bz/pages/wallpaper/wallpaper.js
import {
  wallpaperApi
} from '../../../api/bi';
import {
  types
} from './data';

import {
  downLoadImage
} from "../../../utils/downLoadVideo"

let videoAd = null
Page({
  data: {
    types: types,
    leftList: [],
    rightList: [],
    leftH: 0,
    rightH: 0,
    loading: false,
    paseSize: 20,
    category: types[0].children[0].value,
    zIndex: 2,

    currenState: {
      visible: false,
      showIndex: false,
      closeBtn: false,
      deleteBtn: false,
      images: [],
    }
  },

  async loadMoreWallpapers(isUpdate = false, isLoadMore = false) {
    this.setData({
      loading: true,
    });

    // 生成缓存key，包含分类和分页大小
    const cacheKey = `wallpaper_${this.data.category}_${this.data.paseSize}`;
    const cachedData = wx.getStorageSync(cacheKey);

    // 如果有缓存且不是强制更新，使用缓存数据
    // if (cachedData && !isUpdate) {
    //   this.processWallpaperData(cachedData, isLoadMore);
    //   this.setData({
    //     loading: false,
    //   });
    //   return;
    // }

    // 没有缓存或强制更新时请求API
    // {
    //   id: this.data.category || '',
    //   num: this.data.paseSize,
    // }
    const res = await wallpaperApi();

    // 缓存新数据
    if (res && res.data) {
      wx.setStorage({
        key: cacheKey,
        data: res.data,
        success: () => {
          this.processWallpaperData(res.data, isLoadMore);
        },
        fail: (err) => {
          this.processWallpaperData(res.data, isLoadMore);
        },
      });
    } else {
      this.setData({
        loading: false,
      });
    }
  },

  // 处理壁纸数据，分离到单独方法
  processWallpaperData(data, isLoadMore = false) {
    if (!data || !data.pic) {
      this.setData({
        loading: false,
      });
      return;
    }

    // 如果是加载更多，保留原有数据；否则重置列表
    const picList = data.pic;
    const leftList = isLoadMore ? [...this.data.leftList] : [];
    const rightList = isLoadMore ? [...this.data.rightList] : [];
    let leftH = isLoadMore ? this.data.leftH : 0;
    let rightH = isLoadMore ? this.data.rightH : 0;
    const list = isLoadMore ? (this.data.list ? [...this.data.list, ...data.pic] : data.pic) : data.pic;

    picList.forEach((url) => {
      // 临时估一个高度：宽固定 -> 假设所有一样比例
      const fakeH = 600 + Math.random() * 500;

      if (leftH <= rightH) {
        leftList.push({
          img: url,
          height: fakeH + Math.random(),
        });
        leftH += fakeH;
      } else {
        rightList.push({
          img: url,
          height: fakeH + Math.random(),
        });
        rightH += fakeH;
      }
    });

    this.setData({
      leftList: leftList,
      rightList: rightList,
      leftH: leftH,
      rightH: rightH,
      list: list,
      loading: false,
    });

  },

  tabChange(v) {
    const newCategory = v.detail.value;

    // 切换分类时，重置分页和数据
    this.setData({
      category: newCategory,
      paseSize: 20,
      leftList: [],
      rightList: [],
      leftH: 0,
      rightH: 0,
      list: [],
    });

    // 切换分类时，先检查缓存，如果有缓存则使用，没有则请求
    this.loadMoreWallpapers(false, false);
  },

  handleImage(v) {
    const {
      img
    } = v.currentTarget.dataset;
    wx.setStorageSync('page-image', img)

    wx.navigateTo({
      url: `/bz/pages/wallpaperDetail/wallpaperDetail?img=${img}`,
    })


    return
    this.setData({
      images: [
        'https://tdesign.gtimg.com/mobile/demos/swiper1.png',
        'https://tdesign.gtimg.com/mobile/demos/swiper2.png',
      ],
      showIndex: true,
      visible: true,
      closeBtn: true,
      deleteBtn: true,
    });




    // 若在开发者工具中无法预览广告，请切换开发者工具中的基础库版本
    // 在页面中定义激励视频广告


    // 在页面onLoad回调事件中创建激励视频广告实例
    if (wx.createRewardedVideoAd) {
      videoAd = wx.createRewardedVideoAd({
        adUnitId: 'adunit-3296e83e82b6a87e'
      })
      videoAd.onLoad(() => {})
      videoAd.onError((err) => {
        console.error('激励视频光告加载失败', err)
        videoAd.show()
      })
      videoAd.onClose((res) => {
        // 用户点击了【关闭广告】按钮
        if (res && res.isEnded) {
          const {
            img
          } = v.currentTarget.dataset;
          wx.showLoading({
            title: '正在下载..',
          })
          downLoadImage(img)
        } else {
          // 播放中途退出，不下发游戏奖励
          wx.showToast({
            title: '麻烦广告看完先，成本有限 支持一下',
            icon: 'none'
          })
        }
      })
    }



  },



  bindscrolltolower() {
    // 加载更多时，增加分页大小
    const newPaseSize = this.data.paseSize + 5;
    this.setData({
      paseSize: newPaseSize,
    });
    // 加载更多时，先检查缓存，如果有缓存则使用，没有则请求
    this.loadMoreWallpapers(false, true);
  },
  onReachBottom() {},

  onLoad(e) {
    // 如果传入了category，使用传入的值，否则使用默认值
    if (e && e.category) {
      this.setData({
        category: e.category,
        paseSize: 20,
        leftList: [],
        rightList: [],
        leftH: 0,
        rightH: 0,
        list: [],
      });
    }
    // 首次加载时，先检查缓存，如果有缓存则使用，没有则请求
    this.loadMoreWallpapers(false, false);
  },
});