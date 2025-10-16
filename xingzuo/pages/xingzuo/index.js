import {
  starNavData,
  dateNavData
} from './initData'
import dayjs from 'dayjs'
import {
  xingzuoApi
} from "../../../api/xingzuo"
//获取应用实例
const app = getApp()


Page({
  data: {
    navOpacity: 0, // 背景透明度
    loading: false,
    starNavData, // 十二星座列表
    starActiveIndex: 0, // 选中的当前星座下标
    dateNavData,
    dateActiveIndex: 0, // 选中的当前日期下标
    starData: [],
    starInfo: {},
    isDescExpanded: false, // 描述文本展开状态

  },

  onLoad() {
    const key = wx.getStorageSync('starKey')
    this.changeStar({
      detail: key || 0
    })
  },
  // 页面滚动时候触发
  onPageScroll(e) {
    let {
      scrollTop
    } = e
    let navOpacity = 0
    let maxDistance = 60
    navOpacity = parseFloat(scrollTop / maxDistance).toFixed(2)
    if (navOpacity >= 1) {
      navOpacity = 1
    }
    if (navOpacity <= 0.1) {
      navOpacity = 0
    }
    // 这里设置<100是减少setData次数，节省内存
    if (
      (scrollTop < 100 && this.data.navOpacity != navOpacity) ||
      (navOpacity == 1 && this.data.navOpacity != 1)
    ) {
      this.setData({
        navOpacity,
      })
    }
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {
    return {
      title: '快来看看你的今日运势~',
      path: '/xingzuo/pages/xingzuo/index',
      imageUrl: `../../assets/images/share.png`,
    }
  },
  /**
   * 朋友圈分享
   */
  onShareTimeline() {
    return {
      title: '快来看看你的今日运势~',
      imageUrl: `../../assets/images/share.png`,
    }
  },

  /**
   * 动画实现
   * @method animationShow
   * @param {that} 当前卡片
   * @param {opacity} 透明度
   * @param {delay} 延迟
   */
  animationShow(px, opacity, delay, duration = 500) {
    let animation = wx.createAnimation({
      duration,
      timingFunction: 'ease',
      delay: delay,
    })
    animation.opacity(opacity).translateX(px).step().translateX(0).step()
    let params = ''
    params = animation.export()
    console.log(params, 'params')
    return params
  },

  // 广告点击
  showAd() {
    let videoAd = null

    // 在页面onLoad回调事件中创建激励视频广告实例
    if (wx.createRewardedVideoAd) {
      videoAd = wx.createRewardedVideoAd({
        adUnitId: 'adunit-2fd3a00e3a6a93df',
      })
      videoAd.onLoad(() => {})
      videoAd.onError((err) => {
        console.error('激励视频光告加载失败', err)
      })
      videoAd.onClose((res) => {})
    }

    // 用户触发广告后，显示激励视频广告
    if (videoAd) {
      videoAd.show().catch(() => {
        // 失败重试
        videoAd
          .load()
          .then(() => videoAd.show())
          .catch((err) => {
            console.error('激励视频 广告显示失败', err)
          })
      })
    }
  },
  //切换点击
  tipCilck() {
    this.selectComponent('#tip-dialog').open(this.data.starActiveIndex)
  },

  // 改变星座
  changeStar(e) {
    let index = e ? e.detail : 0
    this.setData({
      starActiveIndex: index,
    })
    wx.setStorageSync('starKey', index)
    this.getData()
    console.log(this.data.starActiveIndex);
  },

  // 改变日期
  changeDate({
    target
  }) {
    const index = target ? target.dataset.index : 0
    this.setData({
      dateActiveIndex: index,
    })
    const info = this.data.starData[index]
    for (let i = 0; i < info.content.length; i++) {
      info.content[i].animation = this.animationShow(i * -50, 0, 0, 0)
    }

    this.setData({
      starInfo: info,
    })
    setTimeout(() => {
      for (let i = 0; i < info.content.length; i++) {
        info.content[i].animation = this.animationShow(0, 1, (i + 1) * 20)
      }
      this.setData({
        starInfo: info,
      })
    }, 100)
  },
  // 数据请求
  async getData() {
    this.setData({
      loading: true,
    })
    const {
      starActiveIndex,
      dateActiveIndex,
      starNavData
    } = this.data

    let res, currentData
    const storeData = wx.getStorageSync('xingzuo')
    const getApi = async () => {
      res = await xingzuoApi({
        code: starNavData[starActiveIndex].code,
        key: 'CNXd86VHqqal3RuuHcnRBengAf'
      })
      currentData = res.data.data;
      wx.setStorageSync('time', currentData.date)
      if (storeData) {

        const findCun = wx.getStorageSync('xingzuo').find((item) => item.star == currentData.star)
        console.log('aaaaa', findCun);
        if (!findCun) {
          storeData.push(currentData)
          console.log('storeData', storeData);
          wx.setStorageSync('xingzuo', storeData)
        }

      } else {
        wx.setStorageSync('xingzuo', [currentData])
      }


    }

    console.log('a', storeData);
    try {

      if (!storeData && !storeData.length) {
        await getApi()

      } else {
        console.log(starNavData[starActiveIndex]);
        console.log(wx.getStorageSync('xingzuo'));
        const findCun = wx.getStorageSync('xingzuo').find((item) => item.star == starNavData[starActiveIndex].astroname)
        if (dayjs().format('YYYY-MM-DD') != wx.getStorageSync('time')) {
          await getApi()
          console.log('999');
        } else {
          console.log('aa', findCun);
          if (!findCun) {
            await getApi()

          } else {
            currentData = findCun
          }

        }
      }




      console.log(currentData);



      let starInfo = {
        vdate: currentData.date,
        desc: currentData.today.day_notice,
        exponents: currentData.today.exponents,
        lucky_time: currentData.today.lucky_time,
        lucky_color: currentData.today.lucky_color,
        lucky_num: currentData.today.lucky_num,
        grxz: currentData.today.grxz,
        content: [{
            t: '综合运势',
            v: currentData.today.exponents.zonghe.content
          },
          {
            t: '财运运势',
            v: currentData.today.exponents.caiyun.content
          },
          {
            t: '爱情运势',
            v: currentData.today.exponents.aiqing.content
          },
          {
            t: '工作运势',
            v: currentData.today.exponents.gongzuo.content
          }
        ],
        month: currentData.this_month,
        week: currentData.this_week,
        year: currentData.this_year,
        tomorrow: currentData.tomorrow
      };

      this.setData({
        starInfo: starInfo,
        loading: false
      });

    } catch (error) {
      console.error('获取星座数据失败:', error);
      this.setData({
        loading: false
      });
    }
  },

  // 改变日期
  changeDate({
    target
  }) {
    const index = target ? target.dataset.index : 0;
    this.setData({
      dateActiveIndex: index,
    });

    // 这里需要根据index切换today/tomorrow/this_week等数据
    this.getData();
  },
})