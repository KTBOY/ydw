// bz/pages/wallpaper/wallpaper.js
import { wallpaperApi } from '../../../api/bi';
import { types } from './data';

const PAGE_NUM = 21; // 每次请求的壁纸数量

Page({
  data: {
    types: types,
    category: types[0].children[0].value,
    wfList: [], // 壁纸图片 URL 列表（传给通用瀑布流组件）
    wfToken: 0, // 变更即重建 + 回顶
    loading: false,
  },

  async load(isLoadMore = false) {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const res = await wallpaperApi({ id: this.data.category || '', num: PAGE_NUM });
      const pics = (res && res.data && res.data.pic) || [];
      if (isLoadMore) {
        this.setData({ wfList: this.data.wfList.concat(pics), loading: false });
      } else {
        // 切换分类：新数据就绪后靠 wfToken 原子重建，避免中间空白闪烁
        this.setData({ wfList: pics, wfToken: this.data.wfToken + 1, loading: false });
      }
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  tabChange(v) {
    this.setData({ category: v.detail.value });
    this.load(false);
  },

  // 点击壁纸：进入详情页（详情页内可左右滑动预览整组，看广告后下载）
  onItemTap(e) {
    const img = e.detail.item; // 壁纸项即图片 URL 字符串
    if (!img) return;
    const idx = typeof e.detail.index === 'number' ? e.detail.index : this.data.wfList.indexOf(img);
    wx.setStorageSync('page-image', img);
    wx.setStorageSync('page-image-list', this.data.wfList);
    wx.setStorageSync('page-image-index', idx >= 0 ? idx : 0);
    wx.navigateTo({ url: '/bz/pages/wallpaperDetail/wallpaperDetail' });
  },

  onLoadMore() {
    this.load(true);
  },

  onLoad(e) {
    if (e && e.category) this.setData({ category: e.category });
    this.load(false);
  },

  onShareAppMessage() {
    return {
      title: '壁纸',
      path: '/bz/pages/wallpaper/wallpaper',
      imageUrl: '/asserts/images/fx.jpg',
    };
  },
});
