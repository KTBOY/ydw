import {
  list,
  listRj,
  listPhone,
  listCg
} from "./json"
const fs = wx.getFileSystemManager();
const storeKey = 'games'
const storeKey2 = 'games-Rj'
const storeKey3 = 'games-phone'
const storeKey5 = 'game-cg'
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

export const getRjList = async () => {
  await wx.setStorageSync(storeKey2, JSON.stringify(listRj))
  const data = JSON.parse(wx.getStorageSync(storeKey2));
  return data
}
export const getPhoneList = async () => {
  await wx.setStorageSync(storeKey3, JSON.stringify(listPhone))
  const data = JSON.parse(wx.getStorageSync(storeKey3));
  return data
}

export const getCgList = async () => {
  await wx.setStorageSync(storeKey5, JSON.stringify(listCg))
  const data = JSON.parse(wx.getStorageSync(storeKey5));
  return data
}