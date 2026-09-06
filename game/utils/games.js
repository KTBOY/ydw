// game/utils/games.js
// 游戏数据加载：统一使用 asserts/json/gemes.json 作为数据源，避免重复维护
let cache = null;

const load = () => {
  if (cache) return cache;
  let games = [];
  try {
    // 编译期直接打包 JSON 数据
    games = require('../../asserts/json/gemes.json');
  } catch (e) {
    // 兜底：运行期从代码包读取
    try {
      const fs = wx.getFileSystemManager();
      games = JSON.parse(fs.readFileSync('asserts/json/gemes.json', 'utf-8'));
    } catch (err) {
      games = [];
    }
  }
  // 过滤脏数据（存在个别只有 passWord 而无 name 的条目）
  cache = (games || []).filter((item) => item && item.name);
  return cache;
};

export const getGameList = () => load();
