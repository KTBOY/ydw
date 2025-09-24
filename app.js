 import {
   updateManagerMetods
 } from './utils/gameList/updateManager';
 import {
   readGameList
 } from './utils/gameList/games';
 App({
   onLaunch: function () {
     updateManagerMetods();
     this.globalData = {
       "version": "1.0.0",
       "isRelease": false, //可以网络控制 用于上架屏蔽某些页面不显示

     }
   },
   onShow: function () {
     // updateManager();
   },

 });