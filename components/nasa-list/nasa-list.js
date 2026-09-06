// components/nasa-list/nasa-list.js
import { searchNasaImages } from '../../api/nasa'

// 预设分类（NASA 图库以英文关键词检索）
const PRESETS = [
  { label: '星系', q: 'galaxy' },
  { label: '星云', q: 'nebula' },
  { label: '火星', q: 'mars' },
  { label: '地球', q: 'earth' },
  { label: '月球', q: 'moon' },
  { label: '土星', q: 'saturn' },
  { label: '宇航员', q: 'astronaut' },
  { label: '哈勃', q: 'hubble' },
]

// 头图轮播（3 张）：组件在主包、受 2MB 限制，图片请上传到你自己的 COS/OSS 后填入远程地址；
// 全部留空则使用纯 CSS 太空风占位，不影响功能。
const HERO_IMAGES = [
  '', // 图1：The Grand Tour 海报
  '', // 图2：太空殖民地
  '', // 图3：火星宇航员
].filter(Boolean)

const EMPTY_IMG = '' // 空状态插图，例：'https://your-cos.com/nasa/empty.png'

const PAGE_SIZE = 40

Component({
  data: {
    presets: PRESETS,
    activeQ: 'galaxy',
    keyword: '',
    wfList: [], // 传给通用瀑布流组件的数据
    wfToken: 0, // 变更即让组件重建并回顶
    page: 1,
    total: 0,
    hasMore: true,
    loading: false,
    inited: false,
    heroImages: HERO_IMAGES,
    emptyImg: EMPTY_IMG,
  },

  lifetimes: {
    attached() {
      this.reload(this.data.activeQ)
    },
  },

  methods: {
    // 切换分类/搜索：不清空旧数据，待新数据就绪后靠 wfToken 触发原子重建，避免闪烁
    reload(q) {
      // 递增请求序号：用于丢弃在途的过期响应
      this._seq = (this._seq || 0) + 1
      this.setData({
        activeQ: q || 'galaxy',
        page: 1,
        hasMore: true,
        loading: false,
      })
      this.fetch(true)
    },

    // reset=true 替换（切换分类/搜索），否则追加（触底加载更多）
    async fetch(reset = false) {
      if (this.data.loading || (!reset && !this.data.hasMore)) return
      const seq = this._seq || 0
      this.setData({ loading: true })

      try {
        // 已带本地缓存：命中则零请求；解析/校验在 api 层完成
        const { list, total } = await searchNasaImages({
          q: this.data.activeQ,
          page: this.data.page,
          pageSize: PAGE_SIZE,
        })

        // 已切换查询，丢弃过期响应
        if (seq !== (this._seq || 0)) return

        const wfList = reset ? list : this.data.wfList.concat(list)

        this.setData({
          wfList,
          total,
          inited: true,
          loading: false,
          page: this.data.page + 1,
          hasMore: list.length > 0 && wfList.length < total,
          // 切换分类/搜索：变更 token 让瀑布流组件整体重建并回顶
          ...(reset ? { wfToken: (this.data.wfToken || 0) + 1 } : {}),
        })
      } catch (e) {
        if (seq !== (this._seq || 0)) return
        this.setData({ loading: false, inited: true })
        wx.showToast({ title: '加载失败，请检查网络或合法域名', icon: 'none' })
      }
    },

    onScrollLower() {
      this.fetch()
    },

    onSearchChange(e) {
      this.setData({ keyword: (e.detail && e.detail.value) || '' })
    },

    onSearchSubmit(e) {
      const kw = ((e.detail && e.detail.value) || this.data.keyword || '').trim()
      this.reload(kw || 'galaxy')
    },

    onSearchClear() {
      this.setData({ keyword: '' })
      this.reload('galaxy')
    },

    onPresetTap(e) {
      const q = e.currentTarget.dataset.q
      this.setData({ keyword: '' })
      this.reload(q)
    },

    // 瀑布流点击：打开详情页（分包），把原始项存入本地供详情读取
    onItemTap(e) {
      const item = e.detail.item
      if (!item) return
      wx.setStorageSync('nasa_detail_item', item)
      wx.navigateTo({ url: `/nasa/pages/detail/detail?id=${item.id}` })
    },
  },
})
