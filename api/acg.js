import http from '../utils/wxReques/http';

// 栗次元二次元图片 API（内容全绿色无擦边）
// 主页：https://t.alcy.cc/  JSON 文档：https://t.alcy.cc/docs.html
// 批量随机：GET https://t.alcy.cc/json?{分类}={数量}
// 返回：{ code, category, count, data: [{ id, link }], links: ['https://tc.alcy.cc/...'] }
// 注意：图片托管在 tc.alcy.cc，request/downloadFile 合法域名需同时配置 t.alcy.cc 与 tc.alcy.cc
export const acgWallpaperApi = (category, num = 20) => {
  return http.get(
    'https://t.alcy.cc/json',
    { [category]: num },
    {
      isLoading: true,
      allUrl: true,
    },
  );
};
