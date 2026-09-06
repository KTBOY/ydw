import dayjs from 'dayjs';

const formatTime = (date, template) => dayjs(date).format(template);

/**
 * 格式化价格数额为字符串
 * 可对小数部分进行填充，默认不填充
 * @param price 价格数额，以分为单位!
 * @param fill 是否填充小数部分 0-不填充 1-填充第一位小数 2-填充两位小数
 */
function priceFormat(price, fill = 0) {
  if (isNaN(price) || price === null || price === Infinity) {
    return price;
  }

  let priceFormatValue = Math.round(parseFloat(`${price}`) * 10 ** 8) / 10 ** 8; // 恢复精度丢失
  priceFormatValue = `${Math.ceil(priceFormatValue) / 100}`; // 向上取整，单位转换为元，转换为字符串
  if (fill > 0) {
    // 补充小数位数
    if (priceFormatValue.indexOf('.') === -1) {
      priceFormatValue = `${priceFormatValue}.`;
    }
    const n = fill - priceFormatValue.split('.')[1]?.length;
    for (let i = 0; i < n; i++) {
      priceFormatValue = `${priceFormatValue}0`;
    }
  }
  return priceFormatValue;
}

/**
 * 获取cdn裁剪后链接
 *
 * @param {string} url 基础链接
 * @param {number} width 宽度，单位px
 * @param {number} [height] 可选，高度，不填时与width同值
 */
const cosThumb = (url, width, height = width) => {
  if (url.indexOf('?') > -1) {
    return url;
  }

  if (url.indexOf('http://') === 0) {
    url = url.replace('http://', 'https://');
  }

  return `${url}?imageMogr2/thumbnail/${~~width}x${~~height}`;
};

const get = (source, paths, defaultValue) => {
  if (typeof paths === 'string') {
    paths = paths
      .replace(/\[/g, '.')
      .replace(/\]/g, '')
      .split('.')
      .filter(Boolean);
  }
  const {
    length
  } = paths;
  let index = 0;
  while (source != null && index < length) {
    source = source[paths[index++]];
  }
  return source === undefined || index === 0 ? defaultValue : source;
};
let systemWidth = 0;
/** 获取系统宽度，为了减少启动消耗所以在函数里边做初始化 */
export const loadSystemWidth = () => {
  if (systemWidth) {
    return systemWidth;
  }

  try {
    ({
      screenWidth: systemWidth,
      pixelRatio
    } = wx.getSystemInfoSync());
  } catch (e) {
    systemWidth = 0;
  }
  return systemWidth;
};

/**
 * 转换rpx为px
 *
 * @description
 * 什么时候用？
 * - 布局(width: 172rpx)已经写好, 某些组件只接受px作为style或者prop指定
 *
 */
const rpx2px = (rpx, round = false) => {
  loadSystemWidth();

  // px / systemWidth = rpx / 750
  const result = (rpx * systemWidth) / 750;

  if (round) {
    return Math.floor(result);
  }

  return result;
};

/**
 * 手机号码*加密函数
 * @param {string} phone 电话号
 * @returns
 */
const phoneEncryption = (phone) => {
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
};

// 内置手机号正则字符串
const innerPhoneReg =
  '^1(?:3\\d|4[4-9]|5[0-35-9]|6[67]|7[0-8]|8\\d|9\\d)\\d{8}$';

/**
 * 手机号正则校验
 * @param phone 手机号
 * @param phoneReg 正则字符串
 * @returns true - 校验通过 false - 校验失败
 */
const phoneRegCheck = (phone) => {
  const phoneRegExp = new RegExp(innerPhoneReg);
  return phoneRegExp.test(phone);
};
// 获取系统信息
const getMianSystemInfo = () => {
  // 获取系统信息
  let systemInfo = wx.getSystemInfoSync() || {
    model: '',
    system: '',
  }
  let rect
  // 校验是否是ios手机 和 是否是iPhone X手机
  let ios = !!(systemInfo.system.toLowerCase().search('ios') + 1)
  let iosX = !!(systemInfo.model.toLowerCase().search('iphone x') + 1)
  try {
    // 获取右上角胶囊位置信息
    rect = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
    if (rect === null) {
      throw 'getMenuButtonBoundingClientRect error'
    }
    //取值为0的情况  有可能width不为0 top为0的情况
    if (!rect.width || !rect.top || !rect.left || !rect.height) {
      throw 'getMenuButtonBoundingClientRect error'
    }
  } catch (error) {
    let gap = '' //胶囊按钮上下间距 使导航内容居中
    let width = 96 //胶囊的宽度
    if (systemInfo.platform === 'android') {
      gap = 8
      width = 96
    } else if (systemInfo.platform === 'devtools') {
      if (ios) {
        gap = 5.5 //开发工具中ios手机
      } else {
        gap = 7.5 //开发工具中android和其他手机
      }
    } else {
      gap = 4
      width = 88
    }

    if (!systemInfo.statusBarHeight) {
      //开启wifi的情况下修复statusBarHeight值获取不到
      systemInfo.statusBarHeight = systemInfo.screenHeight - systemInfo.windowHeight - 20
    }

    rect = {
      //获取不到胶囊信息就自定义重置一个
      bottom: systemInfo.statusBarHeight + gap + 32,
      height: 32,
      left: systemInfo.windowWidth - width - 10,
      right: systemInfo.windowWidth - 10,
      top: systemInfo.statusBarHeight + gap,
      width: width,
    }
  }

  // 导航栏高度
  let navBarHeight = ''

  if (!systemInfo.statusBarHeight) {
    systemInfo.statusBarHeight = 0
    systemInfo.navBarExtendHeight = 0 //下方扩展4像素高度 防止下方边距太小

    //开启wifi和打电话下
    systemInfo.statusBarHeight = systemInfo.screenHeight - systemInfo.windowHeight - 20
    navBarHeight = (function () {
      let gap = rect.top - systemInfo.statusBarHeight
      return 2 * gap + rect.height
    })()
  } else {
    if (ios && systemInfo.platform !== 'devtools') {
      systemInfo.navBarExtendHeight = 4 // 下方扩展4像素高度 防止下方边距太小
    } else {
      systemInfo.navBarExtendHeight = 0
    }

    navBarHeight = (function () {
      let gap = rect.top - systemInfo.statusBarHeight
      return systemInfo.statusBarHeight + 2 * gap + rect.height
    })()
  }

  systemInfo.navBarHeight = navBarHeight + systemInfo.navBarExtendHeight // 导航栏高度不包括statusBarHeight
  systemInfo.capsulePosition = rect // 右上角胶囊按钮信息bottom: 58 height: 32 left: 317 right: 404 top: 26 width: 87
  systemInfo.ios = ios // 是否ios
  systemInfo.iosX = iosX // 是否iPhone X类型手机
  systemInfo.customTabbar = iosX ? 82 : 48 // iPhone X手机定义table高度
  return systemInfo
}

const getEnvToken = () => {
  const envVersion = wx.getStorageSync('envVersion') || 'develop'
  const data = require(`./${envVersion}.config.js`)
  console.log(data)
  return data
}
// utils/debounce.js
/**
 * 防抖函数
 * @param {Function} fn 需要防抖的函数
 * @param {Number} delay 延迟时间(ms)
 * @returns {Function} 防抖后的函数，附带 cancel 方法
 */
function debounce(fn, delay = 300) {
  let timer = null;

  const debounced = function (...args) {
    // 清除上一次定时器
    if (timer) clearTimeout(timer);
    // 重新设定定时器
    timer = setTimeout(() => {
      fn.apply(this, args);
      timer = null;
    }, delay);
  };

  // 取消定时器（用于页面卸载时清理）
  debounced.cancel = function () {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return debounced;
}




module.exports = {
  formatTime,
  priceFormat,
  cosThumb,
  get,
  rpx2px,
  phoneEncryption,
  phoneRegCheck,
  getMianSystemInfo,
  getEnvToken,
  debounce
};