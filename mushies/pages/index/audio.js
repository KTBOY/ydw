// mushies/pages/index/audio.js
// 音效管理：音频池（支持重叠）+ 循环声道 + 应用内静音开关（持久化）。
// 写法沿用 game/pages/arrowEscape/audio.js 的约定，素材为原工程 audio_v2 的 mp3 源。
const BASE = '/mushies/audio/';
const SOUNDS = {
  mergeSmall: 'merge_small.mp3',
  mergeLarge: 'merge_large.mp3',
  chain: 'chain_bonus.mp3',
  clawOpen: 'claw_open.mp3',
  clawClose: 'claw_close.mp3',
  release: 'release_whoosh.mp3',
  impactA: 'impact_soft_a.mp3',
  impactB: 'impact_soft_b.mp3',
  impactHeavy: 'impact_heavy.mp3',
  wall: 'wall_tap.mp3',
  bomb: 'bomb_pop.mp3',
  danger: 'danger.mp3',
  discovery: 'discovery.mp3',
  gameOver: 'game_over.mp3',
  restart: 'restart.mp3',
  click: 'ui_click.mp3',
  open: 'ui_open.mp3',
};
const LOOP_SOUNDS = { carriage: 'carriage_loop.mp3' };
const POOL_SIZE = { mergeSmall: 3, impactA: 2, impactB: 2, wall: 2, click: 2, chain: 2 };
const MUTE_KEY = 'mushiesMuted';

let pools = null;
let loops = null;
let muted = false;
let inited = false;

function createCtx(src, volume) {
  const ctx = wx.createInnerAudioContext();
  ctx.src = src;
  // 游戏音效不跟随系统静音键，由应用内静音开关控制
  try {
    ctx.obeyMuteSwitch = false;
  } catch (e) {
    /* 老基础库忽略 */
  }
  ctx.volume = volume === undefined ? 1 : volume;
  return ctx;
}

const audio = {
  init() {
    if (inited) return;
    inited = true;
    try {
      muted = !!wx.getStorageSync(MUTE_KEY);
    } catch (e) {
      muted = false;
    }
    pools = {};
    Object.keys(SOUNDS).forEach((name) => {
      const src = BASE + SOUNDS[name];
      const n = POOL_SIZE[name] || 1;
      const list = [];
      for (let i = 0; i < n; i++) list.push(createCtx(src));
      pools[name] = { list, idx: 0 };
    });
    loops = {};
    Object.keys(LOOP_SOUNDS).forEach((name) => {
      const ctx = createCtx(BASE + LOOP_SOUNDS[name], 0.45);
      ctx.loop = true;
      loops[name] = ctx;
    });
  },

  play(name) {
    if (muted || !pools || !pools[name]) return;
    const p = pools[name];
    const ctx = p.list[p.idx % p.list.length];
    p.idx += 1;
    try {
      ctx.stop();
    } catch (e) {
      /* 未播放时 stop 会报错，忽略 */
    }
    ctx.play();
  },

  loopPlay(name) {
    if (muted || !loops || !loops[name]) return;
    if (!loops[name]._playing) {
      loops[name]._playing = true;
      loops[name].play();
    }
  },

  loopStop(name) {
    if (!loops || !loops[name] || !loops[name]._playing) return;
    loops[name]._playing = false;
    try {
      loops[name].stop();
    } catch (e) {
      /* ignore */
    }
  },

  setMuted(value) {
    muted = !!value;
    try {
      wx.setStorageSync(MUTE_KEY, muted ? 1 : 0);
    } catch (e) {
      /* 存储失败不影响本局 */
    }
    if (muted) audio.loopStop('carriage');
  },

  isMuted() {
    return muted;
  },

  destroy() {
    if (pools) {
      Object.keys(pools).forEach((name) => {
        pools[name].list.forEach((ctx) => {
          try {
            ctx.destroy();
          } catch (e) {
            /* ignore */
          }
        });
      });
    }
    if (loops) {
      Object.keys(loops).forEach((name) => {
        try {
          loops[name].destroy();
        } catch (e) {
          /* ignore */
        }
      });
    }
    pools = null;
    loops = null;
    inited = false;
  },
};

export default audio;
