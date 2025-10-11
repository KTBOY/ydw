import http from "../utils/wxReques/http"


export const xingzuoApi = (data) => {
  return http.get('https://qqlykm.cn/api/xingzuo/get', data, {
    isLoading: true,
    allUrl: true
  })
}