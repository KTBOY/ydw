// components/menu/menu.js

const imageCdn = 'https://tdesign.gtimg.com/mobile/demos';
const swiperList = [

  `${imageCdn}/swiper1.png`,
  `/asserts/images/wp.png`,
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
        show: true
      }, {
        image: '/asserts/images/caid/cg.png',
        name: '橙光资源',
        router: '/pages/goods/cgDetails/index',
        show: true
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
      console.log(v);
      const {
        item
      } = v.currentTarget.dataset.params
      wx.navigateTo({
        url: item.router
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