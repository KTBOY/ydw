 import {
   updateManagerMetods
 } from './utils/gameList/updateManager';
 import {
   getMianSystemInfo
 } from './utils/util';
 App({
   globalData: {
     systemInfo: {},
   },
   onLaunch: function () {
     const systemInfo = getMianSystemInfo()
     this.globalData.systemInfo = systemInfo // 将信息保存到全局变量中
     console.log(this.globalData);
     // 获取当前版本环境
     const {
       miniProgram
     } = wx.getAccountInfoSync()

     wx.setStorageSync('envVersion', miniProgram.envVersion || 'develop')
     updateManagerMetods();

   },
   onShow: function () {
     // updateManager();
   },

 });