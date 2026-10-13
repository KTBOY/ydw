// components/menu/menu.js

// 背景 = 静帧打底 + 回文循环视频盖在上头。
// 视频源：vibe_images/8be41300c22957ae44de3ad8ca03d776.mp4（720×1280 · 24fps · 8.04s · HEVC）。
// 之所以用「正放+倒放」而不是交叉溶解：这段素材 8 秒内所有区域的位移只有 0.03~0.49px，
// 全是原地闪点、没有方向性运动，倒放不穿帮；而溶解无论多短都会形成「收尾」的 cue。
// 静帧（同一素材里最锐的第 16 帧）负责视频出画前不闪黑，也当真机播不了时兜底。
// 出片与选档参数见 design/README.md。
const BG_IMAGE = '/asserts/images/home/home-bg.jpg';
const BG_MP4_PKG = '/asserts/video/home-bg.mp4';
// 临时目录里带版本戳：换视频必须改这个名字，否则 accessSync 命中旧文件、真机会一直播老素材
const BG_MP4_TMP_NAME = 'home-bg-p32s.mp4';
const BG_LOOP_SEC = 32; // 视频周期，用于随机起点取值范围
const BG_CDN = ''; // 有自家 CDN 就填这里，优先级最高，且能省掉下面那次复制

// <video> 的 src 实测只吃「网络路径 / 本地临时路径 / 云文件ID」：直接填包内路径整块渲染成黑。
// 把包内母本复制进用户目录、拿临时路径喂它可以正常播（开发者工具已验证）。失败返回空串，静帧顶上。
function resolveBgVideo() {
  if (BG_CDN) return BG_CDN;
  try {
    const fs = wx.getFileSystemManager();
    const dest = `${wx.env.USER_DATA_PATH}/${BG_MP4_TMP_NAME}`;
    try {
      fs.accessSync(dest);
    } catch (e) {
      fs.writeFileSync(dest, fs.readFileSync(BG_MP4_PKG), 'binary');
    }
    return dest;
  } catch (err) {
    return '';
  }
}

const BG_VIDEO = resolveBgVideo();

Component({
  /**
   * 组件的属性列表
   */
  properties: {},

  lifetimes: {
    // menu 被 wx:if 反复创建销毁，视频若固定从 0 起播，每切一次 tab 都要重看一遍开头。
    // 每次挂载换一个随机起点，再配合开播前视频不可见那道门，重建过程就看不出来了。
    attached() {
      this.setData({
        bgStart: Math.round(Math.random() * BG_LOOP_SEC),
      });
    },
  },

  /**
   * 组件的初始数据
   */
  data: {
    bgImage: BG_IMAGE,
    bgVideo: BG_VIDEO,
    // <video> 首帧解码出来之前会先画一帧黑，而它盖在静帧上面；从开播事件起才让它可见，
    // 否则从游戏中心切回首页（menu 被 wx:if 重建）就会闪一下黑。
    bgLive: false,
    bgStart: 0,
    list: [
      {
        image: '/asserts/images/caid/steam.png',
        name: '游戏库',
        router: '/gamehall/pages/list/index',
        show: false,
        style: {
          width: '90rpx',
          height: '86rpx',
        },
      },
      {
        image: '/asserts/images/caid/logoko.png',
        name: '头像制作',
        router: '/pages/my_module/flag/index',
        show: false,
      },
      {
        image: '/asserts/images/caid/logoko.png',
        name: '抖音视频解析',
        router: '/packageA/pages/videoDow/video',
        show: false,
        style: {
          width: '70rpx',
          height: '70rpx',
        },
        blockStyle: {
          width: '92%',
        },
      },
      {
        image: '/asserts/images/home/zodiac-hero.png',
        name: '十二星座',
        router: '/xingzuo/pages/xingzuo/index',
        show: true,
        hero: true,
      },
      {
        image: '/asserts/images/home-icons/wallpaper.png',
        name: '壁纸',
        router: '/bz/pages/wallpaper/wallpaper',
        show: true,
        hue: 'blush',
      },
      {
        image: '/asserts/images/home-icons/tarot.png',
        name: '塔罗占卜',
        router: '/tarot/pages/home/index',
        show: true,
        hue: 'lilac',
      },
      {
        image: '/asserts/images/home-icons/relative.png',
        name: '亲戚关系计算器',
        router: '/pages/my_module/calc_relative/index',
        show: false,
        hue: 'sage',
        compact: true,
      },
      {
        image: '/asserts/images/caid/cg.png',
        name: '橙光资源',
        router: '/pages/goods/cgDetails/index',
        show: false,
        style: {
          width: '110rpx',
          height: '76rpx',
        },
      },
      {
        image: '/asserts/images/caid/rj.png',
        name: '软件资源',
        router: '/pages/rj/index',
        show: false,
        style: {
          width: '70rpx',
          height: '70rpx',
        },
      },
      {
        image: '/asserts/images/caid/az.png',
        name: '手机资源',
        router: '/pages/phone/index',
        show: false,
        style: {
          width: '70rpx',
          height: '70rpx',
        },
      },
      {
        image: '/asserts/images/caid/steam.png',
        name: '电脑资源',
        router: '',
        show: false,
        style: {
          width: '90rpx',
          height: '86rpx',
        },
      },

      {
        image: '/asserts/images/home-icons/colorblind.png',
        name: '色盲测试',
        router: '/packageA/pages/bind/bind',
        show: false,
        hue: 'amber',
        compact: true,
      },
      {
        image: '/asserts/images/bz.png',
        name: '手持弹幕',
        router: '/packageA/pages/danmu/danmu',
        show: false,
        style: {
          width: '70rpx',
          height: '70rpx',
        },
      },
      {
        image: '/asserts/images/bcz.png',
        name: '量尺子',
        router: '/packageA/pages/ruler/ruler',
        show: false,
        style: {
          width: '70rpx',
          height: '70rpx',
        },
      },

      {
        image: '/asserts/images/caid/az.png',
        name: '房贷计算器',
        router: '/pages/phone/index',
        show: false,
        style: {
          width: '70rpx',
          height: '70rpx',
        },
      },
      {
        image: '/asserts/images/ewm.png',
        name: '二维码创建',
        router: '/packageA/pages/createQrcode/createQrcode',
        show: false,
        style: {
          width: '70rpx',
          height: '70rpx',
        },
      },

      {
        image: '/asserts/images/zd.png',
        name: '震动',
        router: '/packageA/pages/zhendong/index',
        show: false,
        style: {
          width: '70rpx',
          height: '70rpx',
        },
      },

      {
        image: '/asserts/images/caid/steam.png',
        name: '网站收录',
        router: '',
        show: false,
        style: {
          width: '70rpx',
          height: '70rpx',
        },
      },
    ],
  },

  /**
   * 组件的方法列表
   */
  methods: {
    onBgPlay() {
      if (!this.data.bgLive) {
        this.setData({ bgLive: true });
      }
    },

    handlerPageRouter(_v) {
      const { item } = _v.currentTarget.dataset.params;
      if (item.router) {
        wx.navigateTo({
          url: item.router,
        });
        return;
      }

      this.triggerEvent('change', {
        item,
      });
    },
  },
});
