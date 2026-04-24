// components/fund/fund.js
import {
  baseIndices
} from "../../api/fund.api"
const DEFAULT_FUND_LIST = [{
    code: '000001',
    name: '上证指数',
    current: '3904.86',
    change: '-14.43',
    rate: '-0.37',
  },
  {
    code: '399001',
    name: '深证成指',
    current: '13487.24',
    change: '0.30',
    rate: '0.00',
  },
  {
    code: '399006',
    name: '创业板指',
    current: '3185.88',
    change: '13.23',
    rate: '0.42',
  },
  {
    code: '000688',
    name: '科创50',
    current: '1264.62',
    change: '2.44',
    rate: '0.19',
  },
];

const DEFAULT_MY_FUND_LIST = [{
  code: '002251',
  estimate: '2.1095',
  estimateChange: '0.50',
  estimateTime: '2026-04-07 15:00',
  name: '华夏军工安全混合A',
  netValue: '2.0990',
  netValueDate: '2026-04-03',
}, ];
const allList = [
  'tdesign-vue',
  'tdesign-react',
  'tdesign-miniprogram',
  'tdesign-angular',
  'tdesign-mobile-vue',
  'tdesign-mobile-react',
];
Component({
  properties: {
    fundList: {
      type: Array,
      value: [],
      observer(list) {
        this.setRenderList(list);
      },
    },
    myFundList: {
      type: Array,
      value: [],
      observer(list) {
        this.setMyFundRenderList(list);
      },
    },
  },

  data: {
    renderList: [],
    myFundRenderList: [],
    myFundCount: 0,
    resultList: allList // 搜索结果
  },

  lifetimes: {
    attached() {
      this.setRenderList(this.properties.fundList);
      this.setMyFundRenderList(wx.getStorageSync('fundDetail'));

      console.log();
    },
  },

  methods: {
    async setRenderList() {
      const res = await baseIndices()

      const source = res.data.indices
      const renderList = source.map((item) => {
        const rateNumber = Number(item.rate) || 0;
        const changeNumber = Number(item.change) || 0;
        const trend =
          rateNumber > 0 || changeNumber > 0 ?
          'up' :
          rateNumber < 0 || changeNumber < 0 ?
          'down' :
          'flat';
        const barHeight = 44 + Math.min(Math.abs(rateNumber) * 26, 56);

        return {
          ...item,
          trend,
          changeText: `${changeNumber > 0 ? '+' : ''}${changeNumber.toFixed(2)}`,
          rateText: `${rateNumber > 0 ? '+' : ''}${rateNumber.toFixed(2)}%`,
          barHeight,
        };
      });

      this.setData({
        renderList,
      });
    },

    setMyFundRenderList(list) {
      const sourceList = Array.isArray(list) ?
        list :
        list && typeof list === 'object' ? [list] : [];
      const source = sourceList.length ? sourceList : DEFAULT_MY_FUND_LIST;
      const myFundRenderList = source.map((item) => {
        const estimateChangeNumber = Number(item.estimateChange);
        const hasChangeValue = Number.isFinite(estimateChangeNumber);
        const trend = hasChangeValue ?
          estimateChangeNumber > 0 ?
          'up' :
          estimateChangeNumber < 0 ?
          'down' :
          'flat' :
          'flat';

        const changeText = hasChangeValue ?
          `${estimateChangeNumber > 0 ? '+' : ''}${estimateChangeNumber.toFixed(2)}%` :
          '--';
        const timeText =
          typeof item.estimateTime === 'string' && item.estimateTime.length >= 16 ?
          item.estimateTime.slice(11, 16) :
          '--:--';

        return {
          ...item,
          trend,
          changeText,
          timeText,
        };
      });

      this.setData({
        myFundRenderList,
        myFundCount: myFundRenderList.length,
      });
    },

    onViewDetail() {
      this.triggerEvent('detail', {
        list: this.data.renderList,
      });
    },

    onSearchFundCode(e) {
      const {
        value
      } = e.detail;
      // this.setData({
      //   resultList: value ? allList.filter((v) => v.includes(value)) : allList,
      // });

      wx.navigateTo({
        url: '/packageA/pages/fundPage/fundSearch/fundSearch',
      })


      console.log(this.data.resultList);
    },
  },
});