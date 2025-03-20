const imageCdn = 'https://tdesign.gtimg.com/mobile/demos';
const swiperList = [
  `${imageCdn}/swiper1.png`,
  `${imageCdn}/swiper2.png`,
  `${imageCdn}/swiper1.png`,
  `${imageCdn}/swiper2.png`,
  `${imageCdn}/swiper1.png`,
];

Page({
  data: {
    currIndex: 0,
    swiperList
  },

  tabClick(v) {
    console.log(v);
    this.setData({
      currIndex: v.detail.index
    })

  },
  onChange(e) {
    const {
      detail: {
        current,
        source
      },
    } = e;
    console.log(current, source);
  },

})