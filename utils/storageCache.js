// utils/storageCache.js
// 基于 wx.storage 的轻量缓存：支持 TTL 过期 + 按前缀的容量上限（近似 LRU，超限清理最旧）。
// 仅存可 JSON 序列化的数据；写入失败（如超配额）自动降级为不缓存，不影响主流程。

/**
 * 读取缓存
 * @param {string} key 缓存键
 * @param {number} [ttl] 有效期(ms)，超过则视为过期并清除，返回 null
 * @returns {*|null} 命中返回原数据，否则 null
 */
export function getCache(key, ttl) {
  try {
    const raw = wx.getStorageSync(key)
    if (!raw || typeof raw.t !== 'number') return null
    if (ttl && Date.now() - raw.t > ttl) {
      wx.removeStorageSync(key)
      return null
    }
    return raw.d
  } catch (e) {
    return null
  }
}

/**
 * 写入缓存
 * @param {string} key 缓存键
 * @param {*} data 需缓存的数据
 * @param {{prefix?:string, max?:number}} [opt] 传 prefix+max 时按前缀做容量上限清理
 */
export function setCache(key, data, opt = {}) {
  try {
    wx.setStorageSync(key, { t: Date.now(), d: data })
    if (opt.prefix && opt.max) evict(opt.prefix, opt.max)
  } catch (e) {
    // 超配额等：先清同前缀旧缓存再重试一次，仍失败则放弃缓存（不影响功能）
    if (opt.prefix) {
      try {
        clearByPrefix(opt.prefix)
        wx.setStorageSync(key, { t: Date.now(), d: data })
      } catch (e2) {
        // ignore
      }
    }
  }
}

/**
 * 清除某前缀下的全部缓存
 * @param {string} prefix
 */
export function clearByPrefix(prefix) {
  try {
    const info = wx.getStorageInfoSync()
    ;(info.keys || [])
      .filter((k) => k.indexOf(prefix) === 0)
      .forEach((k) => {
        try {
          wx.removeStorageSync(k)
        } catch (e) {
          // ignore
        }
      })
  } catch (e) {
    // ignore
  }
}

// 按前缀清理超出 max 的最旧条目（近似 LRU）
function evict(prefix, max) {
  try {
    const info = wx.getStorageInfoSync()
    const keys = (info.keys || []).filter((k) => k.indexOf(prefix) === 0)
    if (keys.length <= max) return

    const withTime = keys.map((k) => {
      let t = 0
      try {
        t = (wx.getStorageSync(k) || {}).t || 0
      } catch (e) {
        // ignore
      }
      return { k, t }
    })
    withTime.sort((a, b) => a.t - b.t) // 最旧在前

    const removeCount = withTime.length - max
    for (let i = 0; i < removeCount; i++) {
      try {
        wx.removeStorageSync(withTime[i].k)
      } catch (e) {
        // ignore
      }
    }
  } catch (e) {
    // ignore
  }
}
