/**
 * 模糊查询函数
 * @param {string} query - 查询字符串
 * @param {Array} data - 数据数组
 * @param {string} key - 对象属性键名
 * @returns {Array} - 匹配结果数组
 */
export const fuzzySearch = (query, data, key) => {
  const regex = new RegExp(query.split('').join('.*'), 'i');
  return data.filter(item => regex.test(item[key]));
}
/**
 * 提取链接和提取码
 * @param {string} text - 包含链接和提取码的文本
 * @returns {Object} - 包含链接和提取码的对象
 */
export const extractLinkInfo = (text) => {
  const linkRegex = /(https:\/\/pan\.baidu\.com\/s\/[a-zA-Z0-9_-]+)/;
  const codeRegex = /提取码：(\w+)/;

  const linkMatch = text.match(linkRegex);
  const codeMatch = text.match(codeRegex);

  return {
    link: linkMatch ? linkMatch[0] : null,
    code: codeMatch ? codeMatch[1] : null
  };
}