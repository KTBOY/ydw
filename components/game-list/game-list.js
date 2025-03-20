// components/game-list.js
import {
  getGameList
} from "../../utils/gameList/games"
import {
  fuzzySearch
} from "../../utils/gameUtils"
Component({

  /**
   * 组件的属性列表
   */
  properties: {

  },

  /**
   * 组件的初始数据
   */
  data: {
    list: [],
    loading: true
  },

  /**
   * 组件的方法列表
   */
  methods: {
    async onChangeValue(v) {
      if (!v.detail?.value) {
        const res = await getGameList()
        this.setData({
          list: res
        })

        return


      }
      console.log(v)
      this.setData({
        list: fuzzySearch(v.detail.value, this.data.list, 'name')
      })

    },

    async onClose() {
      const res = await getGameList()
      this.setData({
        list: res
      })
    },

    navToDetailsPage(v) {
      wx.setStorageSync('game', JSON.stringify(v.currentTarget.dataset.item))
      wx.navigateTo({
        url: `/pages/goods/details/index`,
      });
    },
  },
  lifetimes: {
    async ready() {
      const res = await getGameList()
      this.setData({
        list: res
      })
      setTimeout(() => {
        this.setData({
          loading: false
        })
      }, 10)
    },
    detached() {
      console.log(22)
    },
  },
})