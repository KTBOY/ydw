import {
  list
} from "./json"
const fs = wx.getFileSystemManager();
const storeKey = 'games'

export const readGameList = () => {
  console.log(wx.env.USER_DATA_PATH, wx)
  fs.readFile({
    filePath: '/utils/gameList/json.js', // 替换为你的 JSON 文件路径
    encoding: 'utf8',
    success: (res) => {
      console.log(res)
      try {
        //  const data = JSON.parse(res.data);



      } catch (e) {
        console.error('解析 JSON 失败', e);
      }
    },
    fail: (err) => {
      console.error('读取文件失败', err);
    }
  });


  // return new Promise((resolve, reject) => {
  //   wx.request({
  //     url: "gemes.json",
  //     success: function (res) {
  //       console.log('666', res.data); // 打印出JSON数据
  //       resolve(res)
  //     }
  //   });
  // })
}


export const getGameList = async () => {
  await wx.setStorageSync(storeKey, JSON.stringify(list))
  const data = JSON.parse(wx.getStorageSync(storeKey));
  return data
}