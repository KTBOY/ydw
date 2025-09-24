// components/menu/menu.js

const imageCdn = 'https://tdesign.gtimg.com/mobile/demos';
const swiperList = [

  `${imageCdn}/swiper1.png`,

  // `/asserts/images/pass.jpg`,
];

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
    list: [{
        image: '/asserts/images/caid/logoko.png',
        name: '头像制作',
        router: '/pages/my_module/flag/index',
        show: false
      },
      {
        image: '/asserts/images/caid/fam.png',
        name: '亲戚关系计算器',
        router: '/pages/my_module/calc_relative/index',
        show: true,
        style: {
          width: '70rpx',
          height: '70rpx'
        }
      }, {
        image: '/asserts/images/caid/cg.png',
        name: '橙光资源',
        router: '/pages/goods/cgDetails/index',
        show: false,
        style: {
          width: '110rpx',
          height: '76rpx'
        }
      },
      {
        image: '/asserts/images/caid/rj.png',
        name: '软件资源',
        router: '/pages/rj/index',
        show: false,
        style: {
          width: '70rpx',
          height: '70rpx'
        }
      },
      {
        image: '/asserts/images/caid/az.png',
        name: '手机资源',
        router: '/pages/phone/index',
        show: false,
        style: {
          width: '70rpx',
          height: '70rpx'
        }
      },
      {
        image: '/asserts/images/caid/steam.png',
        name: '电脑资源',
        router: '',
        show: false,
        style: {
          width: '90rpx',
          height: '86rpx'
        }
      },

      {
        image: '/asserts/images/smcs.png',
        name: '色盲测试',
        router: '/packageA/pages/bind/bind',
        show: true,
        style: {
          width: '70rpx',
          height: '70rpx'
        }
      },
      {
        image: '/asserts/images/bz.png',
        name: '手持弹幕',
        router: '/packageA/pages/danmu/danmu',
        show: true,
        style: {
          width: '70rpx',
          height: '70rpx'
        }
      },
      {
        image: '/asserts/images/bcz.png',
        name: '量尺子',
        router: '/packageA/pages/ruler/ruler',
        show: true,
        style: {
          width: '70rpx',
          height: '70rpx'
        }
      },

      {
        image: '/asserts/images/caid/az.png',
        name: '房贷计算器',
        router: '/pages/phone/index',
        show: false,
        style: {
          width: '70rpx',
          height: '70rpx'
        }
      },

      {
        image: '/asserts/images/caid/steam.png',
        name: '网站收录',
        router: '',
        show: true,
        style: {
          width: '90rpx',
          height: '86rpx'
        }
      }


    ],
    current: 1,
    autoplay: true,
    duration: 500,
    interval: 5000,
    swiperList,
  },

  /**
   * 组件的方法列表
   */
  methods: {
    handlerPageRouter(v) {
      const {
        item
      } = v.currentTarget.dataset.params
      if (item.router) {
        wx.navigateTo({
          url: item.router
        })
        return
      }


      this.triggerEvent('change', {
        item
      })
    },

    handlerSwiper(v) {
      console.log('555', v)
      if (v.detail.index === 1) {
        wx.navigateTo({
          url: '/pages/order/baidu/index'
        })
      }



    }
  }
})