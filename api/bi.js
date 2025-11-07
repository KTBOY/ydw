import http from "../utils/wxReques/http"

// 接口文档https://www.cnblogs.com/AngelTp/p/13578156.html#_label0

// 壁纸接口2：https://img.moehu.org/
//https: //blog.csdn.net/weixin_51635312/article/details/144133666
//https://img.moehu.org/pic.php?return=json&id=img1&num=5
/// http: //wp.birdpaper.com.cn/intf/getCategory


// 接口文档：https://qqlykm.cn/doc/155

export const wallpaperApi = (data) => {
  return http.get('https://img.moehu.org/pic.php?return=json', data, {
    isLoading: true,
    allUrl: true
  })
}