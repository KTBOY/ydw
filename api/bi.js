import http from "../utils/wxReques/http"

// 接口文档https://www.cnblogs.com/AngelTp/p/13578156.html#_label0

// 壁纸接口2：https://img.moehu.org/
//https: //blog.csdn.net/weixin_51635312/article/details/144133666
//https://imgapi.cn/wiki.html


// 接口文档：https://qqlykm.cn/doc/155
//https://api.lolicon.app/setu/v2?num=20
//https://docs.api.lolicon.app/#/setu?id=tag
// V1.0'https://img.moehu.org/pic.php?return=json'
export const wallpaperApi = (data) => {
  return http.get('https://api.btstu.cn/sjbz/api.php?lx=dongman&format=json', data, {
    isLoading: true,
    allUrl: true,
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  })
}