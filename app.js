import updateManager from './common/updateManager';
import {
  readGameList
} from "common/games"
App({
  onLaunch: function () {
    readGameList()
  },
  onShow: function () {
    updateManager();
  },
});