 import {
   updateManagerMetods
 } from './utils/gameList/updateManager';
 import {
   readGameList
 } from './utils/gameList/games';
 App({
   onLaunch: function () {
     updateManagerMetods();
   },
   onShow: function () {
     // updateManager();
   },

 });