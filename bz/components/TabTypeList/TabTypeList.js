// bz/pages/components/TabTypeList/TabTypeList.js

import {
  types
} from "./data"
const query = wx.createSelectorQuery()
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
    types,
    activeIndex: 0,


    leftVesselState: {
      activeWidth: 0,
      moveX: 0,

    },
    gridState: {
      list: types[0].children,
      gridActiveIndex: 0
    }

  },

  /**
   * 组件的方法列表
   */
  methods: {

    switchCategory(v) {

      // rightVesselState.scrollTop = rightVesselState.topArrList[value]
      let leftVesselState = {}
      const activeIndex = v.currentTarget.dataset.index
      const activeWidth = this.data.leftVesselState.itemHeightList[activeIndex].width
      const moveXRpx = this.data.leftVesselState.itemHeightList[activeIndex].left

      this.setData({
        activeIndex,
        ['leftVesselState.moveX']: moveXRpx,
        ['leftVesselState.activeWidth']: activeWidth,
        ['gridState.list']: this.data.types[activeIndex].children,
        ['gridState.gridActiveIndex']: 0

      })

      const trgItem = this.data.gridState.list[0]

      this.triggerEvent('change', trgItem)

    },

    gridSwitchCategory(v) {
      const gridActiveIndex = v.currentTarget.dataset.index
      this.setData({


        ['gridState.gridActiveIndex']: gridActiveIndex
      })
      const trgItem = this.data.gridState.list[gridActiveIndex]

      this.triggerEvent('change', trgItem)
    },
    getLeftItemRect() {

      this.createSelectorQuery().selectAll(`.nav-item`).boundingClientRect((rect) => {
        let leftVesselState = {}
        leftVesselState.itemHeightList = rect
        leftVesselState.activeWidth = rect[0].width
        leftVesselState.moveX = rect[0].left
        this.setData({
          leftVesselState
        })
        console.log(this.data.leftVesselState);

      }).exec()



    }

  },
  lifetimes: {

    ready() {
      setTimeout(() => {
        this.getLeftItemRect()
      }, 1000)

    }
  }
})