// components/image-waterfall/image-waterfall.js
// 通用图片瀑布流组件：预留高度防抖动 + 骨架屏 + 淡入 + 多列分配 + 触底加载 + 点击事件。
// 用法与配置见同目录 README.md。开源协议：MIT。

const DEFAULT_RATIOS = [0.72, 0.86, 1.0, 1.16, 1.3] // 无真实尺寸时的预留宽高比集合
const DESIGN_WIDTH = 750 // rpx 设计基准宽（用于估算单列宽度）
const TITLE_RESERVE = 56 // rpx，标题区高度（仅用于列高平衡）

Component({
  properties: {
    // 数据源：元素可为对象或图片 URL 字符串
    list: { type: Array, value: [] },
    // 列数
    columns: { type: Number, value: 2 },
    // 间距(rpx)：外边距、列间距、卡片下边距统一使用
    gap: { type: Number, value: 20 },
    // 取图片 URL 的字段名（元素为字符串时忽略）
    imageKey: { type: String, value: 'src' },
    // 图片加载失败时回退的字段名
    fallbackKey: { type: String, value: 'thumb' },
    // 标题字段名
    titleKey: { type: String, value: 'title' },
    // 是否展示标题
    showTitle: { type: Boolean, value: true },
    // 预留宽高比集合；留空用内置默认
    ratios: { type: Array, value: [] },
    // 变化即整体重建并回到顶部（用于切换分类/搜索）
    resetToken: { type: null, value: 0 },
    // 触底触发阈值(px)
    lowerThreshold: { type: Number, value: 120 },
  },

  data: {
    cols: [], // [{ list: [cell], h: 0 }]
    scrollTop: 0,
  },

  observers: {
    'list, resetToken': function (list, token) {
      if (!this._colW) this._colW = this._calcColW()
      list = list || []
      if (token !== this._token) {
        // 重建（首次渲染 / 切换分类）
        this._token = token
        this._rebuild(list)
      } else if (list.length > this._count) {
        // 追加（加载更多）
        this._append(list.slice(this._count))
      } else if (list.length < this._count) {
        // 变短/清空 → 重建
        this._rebuild(list)
      }
    },
    'columns, gap': function () {
      this._colW = this._calcColW()
      if (this._token !== undefined) this._rebuild(this.properties.list || [])
    },
  },

  methods: {
    // 估算单列宽度(rpx)：整体两侧留白 + 列间距
    _calcColW() {
      const n = Math.max(1, this.properties.columns)
      const g = this.properties.gap
      return (DESIGN_WIDTH - g * (n + 1)) / n
    },

    _emptyCols() {
      const n = Math.max(1, this.properties.columns)
      const cols = []
      for (let i = 0; i < n; i++) cols.push({ list: [], h: 0 })
      return cols
    },

    _pick(item, key) {
      if (item == null) return ''
      if (typeof item === 'string' || typeof item === 'number') return item
      return item[key] || ''
    },

    _toCell(item) {
      const ratios =
        this.properties.ratios && this.properties.ratios.length
          ? this.properties.ratios
          : DEFAULT_RATIOS
      const idx = this._seq++
      const ratio = ratios[idx % ratios.length]
      const strItem = typeof item === 'string' || typeof item === 'number'
      return {
        _wfId: idx,
        _h: Math.round(this._colW * ratio), // 预留高度：加载前后一致 → 0 抖动
        _loaded: false,
        _src: strItem ? item : this._pick(item, this.properties.imageKey),
        _fallback: strItem ? '' : this._pick(item, this.properties.fallbackKey),
        _title: this.properties.showTitle ? this._pick(item, this.properties.titleKey) : '',
        _raw: item,
      }
    },

    // 把 items 依次分到当前最矮的一列（只计算不 setData）
    _distribute(items, cols) {
      const titleH = this.properties.showTitle ? TITLE_RESERVE : 0
      items.forEach((item) => {
        const cell = this._toCell(item)
        let min = 0
        for (let i = 1; i < cols.length; i++) {
          if (cols[i].h < cols[min].h) min = i
        }
        cols[min].list.push(cell)
        cols[min].h += cell._h + titleH
      })
      return cols
    },

    _rebuild(list) {
      this._seq = 0
      this._count = list.length
      const cols = this._distribute(list, this._emptyCols())
      // 0/1 交替确保 scroll-top 值变化能触发回顶
      this.setData({ cols, scrollTop: this.data.scrollTop ? 0 : 1 })
    },

    _append(tail) {
      const n = Math.max(1, this.properties.columns)
      let cols = this.data.cols
      cols =
        cols && cols.length === n
          ? cols.map((c) => ({ list: c.list.slice(), h: c.h }))
          : this._emptyCols()
      this._distribute(tail, cols)
      this._count += tail.length
      this.setData({ cols })
    },

    onLoad(e) {
      const { ci, index } = e.currentTarget.dataset
      const col = this.data.cols[ci]
      if (col && col.list[index] && !col.list[index]._loaded) {
        this.setData({ [`cols[${ci}].list[${index}]._loaded`]: true })
      }
    },

    onError(e) {
      const { ci, index } = e.currentTarget.dataset
      const col = this.data.cols[ci]
      const cell = col && col.list[index]
      if (!cell) return
      if (cell._fallback && cell._src !== cell._fallback) {
        this.setData({ [`cols[${ci}].list[${index}]._src`]: cell._fallback })
      } else {
        this.setData({ [`cols[${ci}].list[${index}]._loaded`]: true })
      }
    },

    onTap(e) {
      const { ci, index } = e.currentTarget.dataset
      const col = this.data.cols[ci]
      const cell = col && col.list[index]
      if (!cell) return
      this.triggerEvent('itemtap', { item: cell._raw, index: cell._wfId })
    },

    onLower() {
      this.triggerEvent('loadmore')
    },
  },
})
