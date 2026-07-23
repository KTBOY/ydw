// game/pages/list/index.js 游戏列表
import {
  getGameList
} from '../../utils/games';
import {
  fuzzySearch
} from '../../../utils/gameUtils';

Page({
  data: {
    keyword: '',
    list: [],
  },

  onLoad() {
    this.allGames = getGameList();
    this.setData({
      list: this.allGames
    });
  },

  onSearch(e) {
    const keyword = (e.detail && e.detail.value) || '';
    this.setData({
      keyword,
      list: keyword ? fuzzySearch(keyword, this.allGames, 'name') : this.allGames,
    });
  },

  onClear() {
    this.setData({
      keyword: '',
      list: this.allGames
    });
  },

  navToDetail(e) {
    const {
      item
    } = e.currentTarget.dataset;
    wx.setStorageSync('currentGame', JSON.stringify(item));
    wx.navigateTo({
      url: '/game/pages/detail/index'
    });
  },
});
