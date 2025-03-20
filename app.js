 import updateManager from './utils/gameList/updateManager';
 import {
   readGameList
 } from './utils/gameList/games';
 App({
   onLaunch: function () {
     updateManager();
   },
   onShow: function () {
     // updateManager();
   },
 });