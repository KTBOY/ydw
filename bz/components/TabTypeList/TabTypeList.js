// bz/components/TabTypeList/TabTypeList.js

import { types } from './data';

Component({
  /**
   * 组件的初始数据
   */
  data: {
    types,
    activeIndex: 0,
    navScrollLeft: 0, // 一级分类滚动位置（配合 scroll-with-animation 平滑居中）
    indicator: { x: 0, w: 0 }, // 下划线指示器：相对列表左端的坐标
    gridScrollLeft: 0, // 二级分类滚动位置
    gridState: {
      list: types[0].children,
      gridActiveIndex: 0,
    },
  },

  lifetimes: {
    ready() {
      // 渲染完成后测量两级分类各项位置，未就绪时内部自动重试
      wx.nextTick(() => {
        this.measureNav();
        this.measureGrid();
      });
    },
  },

  /**
   * 组件的方法列表
   */
  methods: {
    // 测量视口宽度与各 nav 项的相对坐标，缓存在 this 上（纯 JS 数据不进 data，减少 setData 传输）
    measureNav(retry = 0) {
      this.createSelectorQuery()
        .select('.left-scroll')
        .boundingClientRect()
        .select('.left-list')
        .boundingClientRect()
        .selectAll('.nav-item')
        .boundingClientRect()
        .exec((res) => {
          const viewRect = res[0];
          const listRect = res[1];
          const itemRects = res[2];
          if (!viewRect || !listRect || !itemRects || !itemRects.length) {
            if (retry < 3) setTimeout(() => this.measureNav(retry + 1), 200);
            return;
          }
          this._viewWidth = viewRect.width;
          // 转成相对列表左端的坐标：与 scroll-view 当前滚动位置无关，滚动后点击也不会错位
          this._navRects = itemRects.map((r) => ({
            left: r.left - listRect.left,
            width: r.width,
          }));
          this.moveIndicator(this.data.activeIndex, false);
        });
    },

    // 指示器移动 + 选中项滚动居中
    moveIndicator(index, center = true) {
      const rect = this._navRects && this._navRects[index];
      if (!rect) return;
      const patch = {
        'indicator.x': rect.left,
        'indicator.w': rect.width,
      };
      if (center) {
        const target = Math.max(0, rect.left + rect.width / 2 - this._viewWidth / 2);
        patch.navScrollLeft = this._nudge(this.data.navScrollLeft, target);
      }
      this.setData(patch);
    },

    // 测量二级分类各项的相对坐标（列表内容随一级分类变化，切换后需重新测量）
    measureGrid(retry = 0) {
      this.createSelectorQuery()
        .select('.grid-scroll')
        .boundingClientRect()
        .select('.grid-list')
        .boundingClientRect()
        .selectAll('.grid-item')
        .boundingClientRect()
        .exec((res) => {
          const viewRect = res[0];
          const listRect = res[1];
          const itemRects = res[2];
          if (!viewRect || !listRect || !itemRects || !itemRects.length) {
            if (retry < 3) setTimeout(() => this.measureGrid(retry + 1), 200);
            return;
          }
          this._gridViewWidth = viewRect.width;
          this._gridRects = itemRects.map((r) => ({
            left: r.left - listRect.left,
            width: r.width,
          }));
        });
    },

    // 二级分类选中项滚动居中
    centerGridItem(index) {
      const rect = this._gridRects && this._gridRects[index];
      if (!rect) return;
      const target = Math.max(0, rect.left + rect.width / 2 - this._gridViewWidth / 2);
      this.setData({
        gridScrollLeft: this._nudge(this.data.gridScrollLeft, target),
      });
    },

    // 同值 setData 不会触发 scroll-view 滚动（如手动滑走后再点同一项），差 0.5px 强制生效
    _nudge(current, target) {
      return Math.abs(current - target) < 0.5 ? target + 0.5 : target;
    },

    switchCategory(e) {
      const { index } = e.currentTarget.dataset;
      this.setData(
        {
          activeIndex: index,
          ['gridState.list']: this.data.types[index].children,
          ['gridState.gridActiveIndex']: 0,
          // 切换分类：二级列表回到起点
          gridScrollLeft: this._nudge(this.data.gridScrollLeft, 0),
        },
        // 新列表渲染完成后重新测量二级各项位置
        () => this.measureGrid(),
      );
      this.moveIndicator(index);
      this.triggerEvent('change', this.data.types[index].children[0]);
    },

    gridSwitchCategory(e) {
      const { index } = e.currentTarget.dataset;
      this.setData({
        ['gridState.gridActiveIndex']: index,
      });
      // 点击项滚动居中
      this.centerGridItem(index);
      this.triggerEvent('change', this.data.gridState.list[index]);
    },
  },
});
