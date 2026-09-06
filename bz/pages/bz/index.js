import {
  types
} from "./data"

Page({
  data: {
    types: types,
    activeIndex: 0, // 当前选中一级分类的索引
    activeChildren: types[0].children, // 当前选中一级分类对应的子分类数据
  },

  /**
   * 切换一级分类
   * @param {Object} e 事件对象
   */
  switchCategory(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      activeIndex: index,
      activeChildren: this.data.types[index].children,
    });
  },

  /**
   * 点击二级标签
   * @param {Object} e 事件对象
   */
  selectTag(e) {
    const {
      label,
      value
    } = e.currentTarget.dataset;
    // 实际应用中：可以在这里进行跳转或触发搜索API
    // wx.showToast({
    //   title: `选择了: ${label} (Value: ${value})`,
    //   icon: 'none',
    // });

    // 示例：跳转到壁纸列表页
    wx.navigateTo({
      url: `/bz/pages/wallpaper/wallpaper?category=${value}&name=${label}`
    })
  },
});