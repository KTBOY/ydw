/* eslint-disable no-param-reassign */
import {
  config
} from '../../config/index';


/** 搜索游戏 */
export function getSearchResult(params) {
  if (config.useMock) {
    return mockSearchResult(params);
  }
  return new Promise((resolve) => {
    resolve('real api');
  });
}