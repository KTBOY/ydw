import http from "../utils/wxReques/http"

// 接口文档：https://qqlykm.cn/doc/155

export const xingzuoApi = (data) => {
  return http.get('https://qqlykm.cn/api/xingzuo/get', data, {
    isLoading: true,
    allUrl: true
  })
}