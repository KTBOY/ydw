// game/pages/detail/index.js 游戏详情
import {
  extractLinkInfo
} from '../../../utils/gameUtils';

Page({
  data: {
    detailsData: {},
  },

  onLoad() {
    const detailsData = JSON.parse(wx.getStorageSync('currentGame') || '{}');

    if (detailsData.urlB) {
      detailsData.urlB = String(detailsData.urlB).replace('链接：', '');
      const newUrlB = extractLinkInfo(detailsData.urlB);
      detailsData.urlBCode = newUrlB.code;
      detailsData.urlB = newUrlB.link;
    }

    // passWord 可能是数字，url-copy 组件属性要求字符串
    if (detailsData.passWord !== undefined && detailsData.passWord !== null) {
      detailsData.passWord = String(detailsData.passWord);
    }

    this.setData({
      detailsData
    });
  },
});
