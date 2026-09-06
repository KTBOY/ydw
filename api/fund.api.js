import http from "../utils/wxReques/http"
const base = 'https://fund-cn.chuankangkk.top/api'





export const baseIndices = (data) => {
  return http.get(`${base}/indices`, data, {
    isLoading: true,
    allUrl: true
  })
}

export const baseRanking = (data) => {
  return http.get(`${base}/ranking?type=up&limit=15`, data, {
    isLoading: true,
    allUrl: true
  })
}

export const detail = (data) => {
  return http.get(`${base}/fund/${data}/detail`, data, {
    isLoading: false,
    allUrl: true
  })
}
export const estimate = (data) => {
  return http.get(`${base}/fund/estimate?code=${data}`, data, {
    isLoading: true,
    allUrl: true
  })
}