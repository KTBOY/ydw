// acg/pages/wallpaper/wallpaper.js
import { acgWallpaperApi } from '../../../api/acg';
import { types } from './data';

const PAGE_NUM = 20; // 每次请求的壁纸数量

Page({
  data: {
    types: types,
    category: types[0].value,
    activeIndex: 0,
    wfList: [], // 壁纸图片 URL 列表（传给通用瀑布流组件）
    wfToken: 0, // 变更即重建 + 回顶
    loading: false,
  },

  async load(isLoadMore = false) {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const res = await acgWallpaperApi(this.data.category, PAGE_NUM);
      const pics = (res && res.data && res.data.links) || [];
      if (isLoadMore) {
        // 随机接口可能返回重复图片，加载更多时去重
        const exist = new Set(this.data.wfList);
        const fresh = pics.filter((url) => !exist.has(url));
        this.setData({ wfList: this.data.wfList.concat(fresh), loading: false });
      } else {
        // 切换分类：新数据就绪后靠 wfToken 原子重建，避免中间空白闪烁
        this.setData({ wfList: pics, wfToken: this.data.wfToken + 1, loading: false });
      }
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  tabChange(e) {
    const { index } = e.currentTarget.dataset;
    if (index === this.data.activeIndex) return;
    this.setData({ activeIndex: index, category: this.data.types[index].value });
    this.load(false);
  },

  // 点击壁纸：进入详情页（详情页内可左右滑动预览整组，看广告后下载）
  onItemTap(e) {
    const img = e.detail.item; // 壁纸项即图片 URL 字符串
    if (!img) return;
    const idx = typeof e.detail.index === 'number' ? e.detail.index : this.data.wfList.indexOf(img);
    wx.setStorageSync('acg-image-list', this.data.wfList);
    wx.setStorageSync('acg-image-index', idx >= 0 ? idx : 0);
    wx.navigateTo({ url: '/acg/pages/wallpaperDetail/wallpaperDetail' });
  },

  onLoadMore() {
    this.load(true);
  },

  onLoad(e) {
    if (e && e.category) {
      const index = this.data.types.findIndex((t) => t.value === e.category);
      if (index >= 0) this.setData({ activeIndex: index, category: e.category });
    }
    this.load(false);
  },

  onShareAppMessage() {
    return {
      title: '二次元壁纸',
      path: '/acg/pages/wallpaper/wallpaper',
      imageUrl: '/asserts/images/fx.jpg',
    };
  },
});
