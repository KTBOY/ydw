// game/pages/sudoku/audio.js
// 轻量音效管理：音频池（支持重叠播放）+ 预加载 + 静音开关（持久化）。
// 音效为本地合成的原创 WAV（五声音阶国风胜利音），无版权问题。
const BASE = '/game/audio/sudoku/';
const SOUNDS = {
  place: 'place.wav',
  note: 'note.wav',
  erase: 'erase.wav',
  undo: 'undo.wav',
  error: 'error.wav',
  hint: 'hint.wav',
  button: 'button.wav',
  star: 'star.wav',
  win: 'win.wav',
  lose: 'lose.wav',
};
const POOL_SIZE = {
  place: 4,
  note: 3,
  erase: 2,
  undo: 2,
  error: 3,
  hint: 2,
  button: 3,
  star: 3,
  win: 1,
  lose: 1,
};
const MUTE_KEY = 'sudokuMuted';

let pools = null;
let muted = false;
let inited = false;

function createCtx(src) {
  const ctx = wx.createInnerAudioContext();
  ctx.src = src;
  // 解谜音效不跟随系统静音键，由应用内静音开关控制
  try {
    ctx.obeyMuteSwitch = false;
  } catch (e) {}
  ctx.volume = 1;
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
  },

  play(name) {
    if (muted || !pools || !pools[name]) return;
    const p = pools[name];
    const ctx = p.list[p.idx];
    p.idx = (p.idx + 1) % p.list.length;
    try {
      ctx.stop();
    } catch (e) {}
    try {
      ctx.play();
    } catch (e) {}
  },

  isMuted() {
    return muted;
  },

  setMuted(v) {
    muted = !!v;
    try {
      wx.setStorageSync(MUTE_KEY, muted);
    } catch (e) {}
    return muted;
  },

  toggle() {
    return this.setMuted(!muted);
  },

  destroy() {
    if (!pools) return;
    Object.keys(pools).forEach((name) => {
      pools[name].list.forEach((ctx) => {
        try {
          ctx.destroy();
        } catch (e) {}
      });
    });
    pools = null;
    inited = false;
  },
};

export default audio;
