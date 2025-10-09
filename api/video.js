import http from "../utils/wxReques/http"


export const videoDyApi = (data) => {
  return http.get('https://parse.shenzjd.com/api/douyin', data, {
    isLoading: true,
    allUrl: true
  })
}