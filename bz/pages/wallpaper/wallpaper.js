// bz/pages/wallpaper/wallpaper.js
import {
  wallpaperApi
} from "../../../api/bi"
Page({
  data: {
    leftList: [],
    rightList: [],
    leftH: 0,
    rightH: 0,
    loading: false,
    paseSize: 20,
    category: ''
  },

  async loadMoreWallpapers(isUpdate = false) {
    this.setData({
      loading: true
    })
    let res = await wallpaperApi({
      id: this.data.category || '',
      num: this.data.paseSize
    })

    console.log(res.data.pic);
    console.log(isUpdate);
    if (isUpdate) {
      res.data.pic = [...this.data.list, ...res.data.pic]
    }

    console.log(res);

    res.data.pic.forEach(url => {
      // 临时估一个高度：宽固定 -> 假设所有一样比例
      let fakeH = 600 + Math.random() * 500

      if (this.data.leftH <= this.data.rightH) {
        this.data.leftList.push({
          img: url,
          height: fakeH + Math.random()
        })
        this.data.leftH += fakeH
      } else {
        this.data.rightList.push({
          img: url,
          height: fakeH + Math.random()
        })
        this.data.rightH += fakeH
      }
    })

    this.setData({
      leftList: this.data.leftList,
      rightList: this.data.rightList,
      list: res.data.pic,
      loading: false
    })
  },

  onReachBottom() {

    this.setData({
      paseSize: this.data.paseSize += 5

    })
    this.loadMoreWallpapers(true)
  },

  onLoad(e) {
    this.setData({
      category: e.category

    })
    this.loadMoreWallpapers()
  }
})