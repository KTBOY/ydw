import http from "../utils/wxReques/http"
import { getCache, setCache, clearByPrefix } from "../utils/storageCache"

// NASA Image and Video Library —— 官方开放接口，无需 API key
// 文档：https://images.nasa.gov  /  https://api.nasa.gov
// 说明：images-api.nasa.gov 为境外域名。开发期请在开发者工具勾选
// 「不校验合法域名」；正式发布需通过自有【已备案】域名做代理转发。
const SEARCH_URL = 'https://images-api.nasa.gov/search'

// 本地缓存策略：按「关键词+每页数+页码」缓存解析后的紧凑结果，降低接口请求次数
const CACHE_PREFIX = 'nasa_img_v2_' // 版本前缀：解析结构变更时改版即可整体失效
const CACHE_TTL = 24 * 60 * 60 * 1000 // 有效期 24h（图库内容基本静态）
const CACHE_MAX = 80 // 最多缓存的「关键词+页码」组合数（近似 LRU）

const keyOf = (q, page, pageSize) => `${CACHE_PREFIX}${q}_${pageSize}_${page}`

// 把接口原始响应解析为紧凑结构，减小缓存体积
function normalize(res) {
  const col = res && res.data && res.data.collection
  const items = (col && col.items) || []
  const total = (col && col.metadata && col.metadata.total_hits) || 0
  const list = items
    .filter(
      (it) =>
        it.links &&
        it.links.length &&
        it.links[0].href &&
        it.data &&
        it.data.length
    )
    .map((it) => {
      const d = it.data[0]
      const thumb = it.links[0].href
      return {
        id: d.nasa_id,
        title: d.title || '',
        // 列表用标准版（medium），失败回退缩略图；详情用 ~large 展示、~orig 下载
        img: thumb.replace('~thumb', '~medium'),
        thumb,
        desc: d.description || d.description_508 || '',
        date: (d.date_created || '').slice(0, 10),
        center: d.center || '',
      }
    })
  return { total, list }
}

/**
 * 搜索 NASA 图片（带本地缓存）
 * @param {Object} opt
 * @param {string} opt.q 关键词（英文效果最好）
 * @param {number} opt.page 页码，从 1 开始
 * @param {number} opt.pageSize 每页数量（1~100）
 * @param {boolean} opt.forceRefresh 跳过缓存强制请求
 * @returns {Promise<{total:number, list:Array}>}
 */
export const searchNasaImages = async ({
  q = 'galaxy',
  page = 1,
  pageSize = 40,
  forceRefresh = false,
} = {}) => {
  const key = keyOf(q, page, pageSize)

  // 命中且未过期 → 零请求返回
  if (!forceRefresh) {
    const cached = getCache(key, CACHE_TTL)
    if (cached) return cached
  }

  const res = await http.get(
    SEARCH_URL,
    { q, media_type: 'image', page, page_size: pageSize },
    { isLoading: false, allUrl: true }
  )

  // 结构异常 / 限流（无 collection 或 4xx+）时不写缓存，抛错交由上层处理
  if (!res || res.statusCode >= 400 || !(res.data && res.data.collection)) {
    throw new Error('NASA 接口异常或被限流')
  }

  const data = normalize(res)
  setCache(key, data, { prefix: CACHE_PREFIX, max: CACHE_MAX })
  return data
}

// 清空 NASA 图片缓存（可用于「强制刷新」入口）
export const clearNasaCache = () => clearByPrefix(CACHE_PREFIX)
