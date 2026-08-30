// game/pages/sudoku/index.js 数独 · 雅集
// 关卡无限（种子化确定性生成）、每日挑战、笔记/提示/撤销、进度与战绩本地缓存。
import { generateLevel, generateDaily, difficultyOfLevel, allCandidateMasks, gridToString, stringToGrid } from './core';
import audio from './audio';

const MAX_MISTAKES = 3;
const MAX_HINTS = 3;
const UNDO_LIMIT = 40;
const PER_PAGE = 60;
const MAX_RECORDS = 20;

const KEY_SAVE = 'sudokuSave';
const KEY_PROGRESS = 'sudokuProgress';
const KEY_SETTINGS = 'sudokuSettings';
const KEY_RECORDS = 'sudokuRecords';

function pad2(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  return `${pad2(Math.floor(sec / 60))}:${pad2(sec % 60)}`;
}

function dateKeyOf(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function shiftDateKey(key, days) {
  const p = key.split('-');
  const d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  d.setDate(d.getDate() + days);
  return dateKeyOf(d);
}

function dateTextOf(key) {
  const p = key.split('-');
  return `${Number(p[1])}月${Number(p[2])}日`;
}

function defaultProgress() {
  return {
    v: 1,
    unlocked: 1,
    stars: {},
    times: {},
    daily: {},
    streak: 0,
    lastDaily: '',
    played: 0,
    won: 0,
  };
}

function loadStore(key, fallback) {
  try {
    const v = wx.getStorageSync(key);
    return v || fallback;
  } catch (e) {
    return fallback;
  }
}

function saveStore(key, val) {
  try {
    wx.setStorageSync(key, val);
  } catch (e) {}
}

Page({
  data: {
    mode: 'level', // level | daily
    level: 1,
    diffName: '入门',
    dateText: '',
    theme: 'light',
    hearts: [1, 1, 1],
    timeText: '00:00',
    bestText: '',
    cells: [],
    padCounts: [9, 9, 9, 9, 9, 9, 9, 9, 9],
    padActive: 0,
    noteMode: false,
    hintsLeft: MAX_HINTS,
    canUndo: false,
    status: 'playing', // playing | win | lose
    paused: false,
    winClosed: false,
    // 弹层
    showLevels: false,
    showSettings: false,
    showStats: false,
    levelItems: [],
    levelPage: 0,
    levelPageCount: 1,
    dailyDone: false,
    dailyStreak: 0,
    // 结算
    winStars: [false, false, false],
    winTimeText: '',
    winBestText: '',
    isNewBest: false,
    winCheat: false,
    // 修改器（雅集模式，隐藏入口：设置页连点版本号 5 次）
    mod: { god: false, hints: false, ghost: false, timeStop: false },
    // 战绩
    stats: { stars: 0, won: 0, winRate: '--', streak: 0 },
    records: [],
    // 设置
    settings: { muted: false, vibrate: true, highlight: true, theme: 'light', modOn: false },
    // 反馈
    flashI: -1,
    confetti: [],
  },

  onLoad(options) {
    this.puzzle = null;
    this.solution = null;
    this.values = null;
    this.notes = null;
    this.mistakes = 0;
    this.hintsUsed = 0;
    this.elapsed = 0;
    this.noteMode = false;
    this.selected = -1;
    this.undoStack = [];
    this.status = 'playing';
    this.paused = false;
    this.flashI = -1;
    this._genCache = {};
    this._flashTimer = null;
    // 修改器状态（具体开关会话级不持久化；modOn 主开关存 settings）
    this.mod = { god: false, hints: false, ghost: false, timeStop: false };
    this._cheatUsed = false;

    this.settings = this.loadSettings();
    audio.init();
    this.progress = Object.assign(defaultProgress(), loadStore(KEY_PROGRESS, {}));
    this.records = loadStore(KEY_RECORDS, []);

    this.applyTheme(this.settings.theme, true);

    // 入口：?daily=1 每日挑战；?level=N 指定关卡；默认续玩存档或当前进度关
    if (options && options.daily === '1') {
      this.startDaily();
    } else if (options && options.level) {
      const lv = Math.max(1, parseInt(options.level, 10) || 1);
      this.startLevel(Math.min(lv, this.progress.unlocked));
    } else if (!this.resumeSave()) {
      this.startLevel(this.progress.unlocked);
    }

    if (!this.settings.seenHint) {
      this.settings.seenHint = true;
      this.saveSettings();
      wx.showToast({
        title: '点格子，再点下方数字填入',
        icon: 'none',
        duration: 2600,
      });
    }
  },

  onShow() {
    // 首次 onShow 紧随 onLoad，此时刚开局不应弹暂停；仅从后台/其他页返回时暂停
    if (!this._everShown) {
      this._everShown = true;
      return;
    }
    if (this.status === 'playing' && !this.anyOverlay()) {
      // 从后台切回需手动恢复，避免计时偷跑
      this.paused = true;
      this.setData({ paused: true });
    }
  },

  onHide() {
    this.save();
  },

  onUnload() {
    this.save();
    this.stopTimer();
    if (this._flashTimer) clearTimeout(this._flashTimer);
    audio.destroy();
  },

  onShareAppMessage() {
    const t =
      this.data.mode === 'daily'
        ? '来挑战今天的数独「雅集」每日一题！'
        : `我在数独·雅集闯到第${this.data.level}关，来比比？`;
    return { title: t, path: '/game/pages/sudoku/index' };
  },

  // ---------- 设置 ----------
  loadSettings() {
    const s = Object.assign(
      { muted: false, vibrate: true, highlight: true, theme: 'light', seenHint: false, modOn: false },
      loadStore(KEY_SETTINGS, {}),
    );
    if (audio.isMuted()) s.muted = true;
    return s;
  },

  saveSettings() {
    saveStore(KEY_SETTINGS, this.settings);
  },

  applyTheme(theme, silent) {
    this.setData({ theme });
    if (silent && theme !== 'dark') return;
    try {
      wx.setNavigationBarColor({
        frontColor: theme === 'dark' ? '#ffffff' : '#000000',
        backgroundColor: theme === 'dark' ? '#211D18' : '#F7F3EA',
      });
    } catch (e) {}
  },

  // ---------- 开局 ----------
  genLevel(level) {
    if (!this._genCache[level]) this._genCache[level] = generateLevel(level);
    return this._genCache[level];
  },

  resetBoardState() {
    this.values = this.puzzle.slice();
    this.notes = new Array(81).fill(0);
    this.mistakes = 0;
    this.hintsUsed = 0;
    this.elapsed = 0;
    this.noteMode = false;
    this.selected = -1;
    this.undoStack = [];
    this.status = 'playing';
    this.paused = false;
    this.flashI = -1;
    this._cheatUsed = false;
  },

  startLevel(level) {
    const gen = this.genLevel(level);
    this.mode = 'level';
    this.level = level;
    this.puzzle = gen.puzzle;
    this.solution = gen.solution;
    this.resetBoardState();
    const best = this.progress.times[level];
    this.setData({
      mode: 'level',
      level,
      diffName: gen.difficulty.name,
      dateText: '',
      status: 'playing',
      paused: false,
      winClosed: false,
      noteMode: false,
      hintsLeft: MAX_HINTS,
      bestText: best ? `最佳 ${fmtTime(best)}` : '',
      winStars: [false, false, false],
    });
    this.refreshView();
    this.startTimer();
  },

  startDaily() {
    const key = dateKeyOf(new Date());
    const gen = generateDaily(key);
    this.mode = 'daily';
    this.level = 0;
    this.dateKey = key;
    this.puzzle = gen.puzzle;
    this.solution = gen.solution;
    this.resetBoardState();
    this.setData({
      mode: 'daily',
      level: 0,
      diffName: gen.difficulty.name,
      dateText: dateTextOf(key),
      status: 'playing',
      paused: false,
      winClosed: false,
      noteMode: false,
      hintsLeft: MAX_HINTS,
      bestText: this.progress.daily[key] ? `今日最佳 ${fmtTime(this.progress.daily[key].t)}` : '',
      winStars: [false, false, false],
    });
    this.refreshView();
    this.startTimer();
  },

  resumeSave() {
    const s = loadStore(KEY_SAVE, null);
    if (!s || !s.puzzle || s.status !== 'playing') return false;
    this.mode = s.mode || 'level';
    this.level = s.level || 1;
    this.dateKey = s.dateKey || dateKeyOf(new Date());
    this.puzzle = stringToGrid(s.puzzle);
    this.solution = stringToGrid(s.solution);
    this.values = stringToGrid(s.values);
    this.notes = (s.notes || []).slice();
    while (this.notes.length < 81) this.notes.push(0);
    this.mistakes = s.mistakes || 0;
    this.hintsUsed = s.hintsUsed || 0;
    this.elapsed = s.elapsed || 0;
    this.noteMode = !!s.noteMode;
    this.selected = -1;
    this.undoStack = [];
    this.status = 'playing';
    this.paused = false;
    this.flashI = -1;
    const diff = this.mode === 'daily' ? difficultyOfLevel(300).name : difficultyOfLevel(this.level).name;
    let bestText = '';
    if (this.mode === 'daily') {
      const rec = this.progress.daily[this.dateKey];
      if (rec) bestText = `今日最佳 ${fmtTime(rec.t)}`;
    } else if (this.progress.times[this.level]) {
      bestText = `最佳 ${fmtTime(this.progress.times[this.level])}`;
    }
    this.setData({
      mode: this.mode,
      level: this.level,
      diffName: diff,
      dateText: this.mode === 'daily' ? dateTextOf(this.dateKey) : '',
      status: 'playing',
      paused: false,
      winClosed: false,
      noteMode: this.noteMode,
      hintsLeft: MAX_HINTS - this.hintsUsed,
      bestText,
    });
    this.refreshView();
    this.startTimer();
    return true;
  },

  save() {
    if (this.status !== 'playing' || !this.puzzle) return;
    saveStore(KEY_SAVE, {
      v: 1,
      mode: this.mode,
      level: this.level,
      dateKey: this.dateKey || '',
      puzzle: gridToString(this.puzzle),
      solution: gridToString(this.solution),
      values: gridToString(this.values),
      notes: this.notes.slice(),
      mistakes: this.mistakes,
      hintsUsed: this.hintsUsed,
      elapsed: this.elapsed,
      noteMode: this.noteMode ? 1 : 0,
      status: 'playing',
    });
  },

  clearSave() {
    try {
      wx.removeStorageSync(KEY_SAVE);
    } catch (e) {}
  },

  // ---------- 计时 ----------
  startTimer() {
    this.stopTimer();
    this._timer = setInterval(() => {
      if (this.status !== 'playing' || this.paused || this.anyOverlay()) return;
      if (this.mod.timeStop) {
        this._cheatUsed = true;
        return;
      }
      this.elapsed++;
      this.setData({ timeText: fmtTime(this.elapsed) });
    }, 1000);
    this.setData({ timeText: fmtTime(this.elapsed) });
  },

  stopTimer() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  },

  anyOverlay() {
    return !!(
      this.data.showLevels ||
      this.data.showSettings ||
      this.data.showStats ||
      this.data.paused ||
      this.data.status !== 'playing'
    );
  },

  // ---------- 渲染 ----------
  refreshView(extra) {
    const built = this.buildCells();
    this.setData(
      Object.assign(
        {
          cells: built.cells,
          padCounts: built.padCounts,
          padActive: this.selected >= 0 ? this.values[this.selected] : 0,
          hearts: [
            this.mistakes < MAX_MISTAKES ? 1 : 0,
            this.mistakes < MAX_MISTAKES - 1 ? 1 : 0,
            this.mistakes < MAX_MISTAKES - 2 ? 1 : 0,
          ],
          hintsLeft: this.mod.hints ? '∞' : MAX_HINTS - this.hintsUsed,
          canUndo: this.undoStack.length > 0,
          noteMode: this.noteMode,
        },
        extra || {},
      ),
    );
  },

  buildCells() {
    const vals = this.values;
    const sel = this.selected;
    const selR = sel >= 0 ? Math.floor(sel / 9) : -1;
    const selC = sel >= 0 ? sel % 9 : -1;
    const selBox = sel >= 0 ? Math.floor(selR / 3) * 3 + Math.floor(selC / 3) : -1;
    const selVal = sel >= 0 ? vals[sel] : 0;
    const highlight = this.settings.highlight !== false;

    // 冲突检测：同一行/列/宫内重复数字
    const conflict = new Uint8Array(81);
    const units = [];
    for (let r = 0; r < 9; r++) {
      const a = [];
      for (let c = 0; c < 9; c++) a.push(r * 9 + c);
      units.push(a);
    }
    for (let c = 0; c < 9; c++) {
      const a = [];
      for (let r = 0; r < 9; r++) a.push(r * 9 + c);
      units.push(a);
    }
    for (let b = 0; b < 9; b++) {
      const br = Math.floor(b / 3) * 3;
      const bc = (b % 3) * 3;
      const a = [];
      for (let k = 0; k < 9; k++) a.push((br + Math.floor(k / 3)) * 9 + bc + (k % 3));
      units.push(a);
    }
    for (let u = 0; u < units.length; u++) {
      const seen = {};
      for (const i of units[u]) {
        const v = vals[i];
        if (!v) continue;
        if (seen[v]) {
          conflict[i] = 1;
          conflict[seen[v]] = 1;
        } else {
          seen[v] = i;
        }
      }
    }

    const cells = [];
    for (let i = 0; i < 81; i++) {
      const r = Math.floor(i / 9);
      const c = i % 9;
      let cls = 'cell';
      if (c === 2 || c === 5) cls += ' br';
      if (r === 2 || r === 5) cls += ' bb';
      if (c === 8) cls += ' er';
      if (r === 8) cls += ' eb';
      const v = vals[i];
      if (v) {
        cls += this.puzzle[i] ? ' given' : ' user';
        if (v !== this.solution[i]) cls += ' err';
        else if (conflict[i]) cls += ' conf';
      }
      if (i === sel) cls += ' sel';
      else if (
        highlight &&
        sel >= 0 &&
        (r === selR || c === selC || Math.floor(r / 3) * 3 + Math.floor(c / 3) === selBox)
      ) {
        cls += ' peer';
      }
      if (selVal && v === selVal && i !== sel) cls += ' same';
      if (i === this.flashI) cls += ' flash';

      const cell = { cls, txt: v ? String(v) : '', nc: null };
      if (!v && this.mod.ghost) {
        // 透视答案：空格淡显正解
        cell.txt = String(this.solution[i]);
        cls += ' ghost';
        cell.cls = cls;
      } else if (!v && this.notes[i]) {
        const arr = [];
        for (let k = 1; k <= 9; k++) {
          arr.push({ i: k, t: this.notes[i] & (1 << k) ? String(k) : '' });
        }
        cell.nc = arr;
      }
      cells.push(cell);
    }

    const counts = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 81; i++) {
      if (vals[i]) counts[vals[i] - 1]++;
    }
    const padCounts = counts.map((n) => 9 - n);
    return { cells, padCounts };
  },

  // ---------- 交互 ----------
  onCellTap(e) {
    if (this.status !== 'playing' || this.paused) return;
    const { i } = e.currentTarget.dataset;
    if (this.selected === i) return;
    this.selected = i;
    this.refreshView();
  },

  onPadTap(e) {
    if (this.status !== 'playing' || this.paused) return;
    const v = Number(e.currentTarget.dataset.v);
    // 未选格时自动定位到第一个空格
    if (this.selected < 0 || this.puzzle[this.selected]) {
      const first = this.values.indexOf(0);
      if (first < 0) return;
      this.selected = first;
    }
    this.placeDigit(this.selected, v);
  },

  placeDigit(i, v) {
    if (this.puzzle[i]) return;
    if (this.noteMode) {
      if (this.values[i]) return;
      this.pushUndo();
      this.notes[i] ^= 1 << v;
      audio.play('note');
      this.vibrate('light');
      this.save();
      this.refreshView();
      return;
    }
    const redo = this.values[i] === v; // 再点同数字 = 清除
    this.pushUndo();
    this.values[i] = redo ? 0 : v;
    this.notes[i] = 0;
    if (redo) {
      audio.play('erase');
      this.save();
      this.refreshView();
      return;
    }
    if (v === this.solution[i]) {
      audio.play('place');
      this.vibrate('light');
      this.cleanPeerNotes(i, v);
      this.save();
      this.refreshView();
      this.checkWin();
    } else if (this.mod.god) {
      // 不判错：数字照常填入、标红提示，但不扣心
      this._cheatUsed = true;
      audio.play('place');
      this.save();
      this.refreshView();
    } else {
      this.mistakes++;
      audio.play('error');
      this.vibrate('heavy');
      this.flashCell(i);
      this.save();
      this.refreshView();
      if (this.mistakes >= MAX_MISTAKES) this.onLose();
    }
  },

  cleanPeerNotes(i, v) {
    const r = Math.floor(i / 9);
    const c = i % 9;
    const br = Math.floor(r / 3) * 3;
    const bc = Math.floor(c / 3) * 3;
    const bit = ~(1 << v);
    for (let k = 0; k < 9; k++) {
      this.notes[r * 9 + k] &= bit;
      this.notes[k * 9 + c] &= bit;
      this.notes[(br + Math.floor(k / 3)) * 9 + bc + (k % 3)] &= bit;
    }
  },

  flashCell(i) {
    this.flashI = i;
    if (this._flashTimer) clearTimeout(this._flashTimer);
    this._flashTimer = setTimeout(() => {
      this.flashI = -1;
      this._flashTimer = null;
      if (this.status === 'playing') this.refreshView();
    }, 550);
  },

  pushUndo() {
    this.undoStack.push({ v: this.values.slice(), n: this.notes.slice() });
    if (this.undoStack.length > UNDO_LIMIT) this.undoStack.shift();
  },

  onErase() {
    if (this.status !== 'playing' || this.paused) return;
    const i = this.selected;
    if (i < 0) return;
    if (this.puzzle[i]) return;
    if (!this.values[i] && !this.notes[i]) return;
    this.pushUndo();
    this.values[i] = 0;
    this.notes[i] = 0;
    audio.play('erase');
    this.save();
    this.refreshView();
  },

  onUndo() {
    if (this.status !== 'playing' || this.paused) return;
    const snap = this.undoStack.pop();
    if (!snap) return;
    this.values = snap.v;
    this.notes = snap.n;
    audio.play('undo');
    this.save();
    this.refreshView();
  },

  onToggleNotes() {
    if (this.status !== 'playing' || this.paused) return;
    this.noteMode = !this.noteMode;
    audio.play('button');
    this.refreshView();
  },

  onAutoNotes() {
    if (this.status !== 'playing' || this.paused) return;
    this.pushUndo();
    const masks = allCandidateMasks(this.values);
    for (let i = 0; i < 81; i++) {
      if (!this.values[i]) this.notes[i] = masks[i];
    }
    audio.play('note');
    this.refreshView();
    this.save();
    wx.showToast({ title: '已填入全部候选数', icon: 'none', duration: 1200 });
  },

  onHint() {
    if (this.status !== 'playing' || this.paused) return;
    if (this.hintsUsed >= MAX_HINTS && !this.mod.hints) {
      wx.showToast({ title: '提示已用完', icon: 'none' });
      return;
    }
    let target = -1;
    const sel = this.selected;
    if (sel >= 0 && !this.puzzle[sel] && this.values[sel] !== this.solution[sel]) {
      target = sel;
    } else {
      const empties = [];
      for (let i = 0; i < 81; i++) {
        if (!this.values[i]) empties.push(i);
      }
      if (!empties.length) return;
      target = empties[Math.floor(Math.random() * empties.length)];
    }
    this.pushUndo();
    this.values[target] = this.solution[target];
    this.notes[target] = 0;
    this.cleanPeerNotes(target, this.solution[target]);
    this.selected = target;
    if (!this.mod.hints) this.hintsUsed++;
    else this._cheatUsed = true;
    this.flashI = -1;
    audio.play('hint');
    this.vibrate('light');
    this.save();
    this.refreshView();
    this.checkWin();
  },

  vibrate(type) {
    if (!this.settings.vibrate) return;
    try {
      wx.vibrateShort({ type });
    } catch (e) {}
  },

  // ---------- 胜负 ----------
  checkWin() {
    if (this.status !== 'playing') return;
    for (let i = 0; i < 81; i++) {
      if (this.values[i] !== this.solution[i]) return;
    }
    this.onWin();
  },

  computeStars() {
    if (this.mistakes === 0 && this.hintsUsed === 0) return 3;
    if (this.mistakes <= 2 && this.hintsUsed <= 1) return 2;
    return 1;
  },

  onWin() {
    this.status = 'win';
    this.stopTimer();
    const stars = this.computeStars();
    const cheat = !!this._cheatUsed;
    const winStars = [stars >= 1, stars >= 2, stars >= 3];

    this.clearSave();
    audio.play('win');
    this.vibrate('medium');
    this.setData({
      status: 'win',
      winClosed: false,
      winStars,
      winTimeText: fmtTime(this.elapsed),
      winBestText: '',
      isNewBest: false,
      winCheat: cheat,
      confetti: this.buildConfetti(),
    });
    for (let k = 0; k < 3; k++) {
      if (winStars[k]) {
        setTimeout(() => audio.play('star'), 350 + k * 280);
      }
    }
    // 修改器对局：只演不算，进度与战绩一律不入库
    if (cheat) return;

    const p = this.progress;
    let isNewBest = false;
    let bestText = '';

    if (this.mode === 'level') {
      const key = String(this.level);
      const oldStars = p.stars[key] || 0;
      const oldTime = p.times[key];
      if (stars > oldStars) p.stars[key] = stars;
      if (!oldTime || this.elapsed < oldTime) {
        p.times[key] = this.elapsed;
        isNewBest = !!oldTime;
      }
      if (this.level >= p.unlocked) p.unlocked = this.level + 1;
      bestText = `最佳 ${fmtTime(p.times[key])}`;
    } else {
      const rec = p.daily[this.dateKey];
      if (!rec) {
        p.daily[this.dateKey] = { s: stars, t: this.elapsed };
        isNewBest = true;
      } else {
        if (stars > rec.s) rec.s = stars;
        if (this.elapsed < rec.t) {
          rec.t = this.elapsed;
          isNewBest = true;
        }
      }
      if (p.lastDaily !== this.dateKey) {
        p.streak = p.lastDaily === shiftDateKey(this.dateKey, -1) ? p.streak + 1 : 1;
        p.lastDaily = this.dateKey;
      }
    }
    p.played++;
    p.won++;
    saveStore(KEY_PROGRESS, p);

    this.records.unshift({
      time: Date.now(),
      mode: this.mode,
      level: this.mode === 'daily' ? 0 : this.level,
      result: 'win',
      t: this.elapsed,
      mistakes: this.mistakes,
    });
    if (this.records.length > MAX_RECORDS) this.records.length = MAX_RECORDS;
    saveStore(KEY_RECORDS, this.records);

    this.setData({
      winBestText: bestText,
      isNewBest,
    });
  },

  onLose() {
    this.status = 'lose';
    this.stopTimer();
    const p = this.progress;
    p.played++;
    saveStore(KEY_PROGRESS, p);
    this.records.unshift({
      time: Date.now(),
      mode: this.mode,
      level: this.mode === 'daily' ? 0 : this.level,
      result: 'lose',
      t: this.elapsed,
      mistakes: this.mistakes,
    });
    if (this.records.length > MAX_RECORDS) this.records.length = MAX_RECORDS;
    saveStore(KEY_RECORDS, this.records);
    this.clearSave();
    audio.play('lose');
    this.vibrate('heavy');
    this.setData({ status: 'lose' });
  },

  buildConfetti() {
    const colors = ['#C9A063', '#3E7C6F', '#C3392B', '#8A9A5B'];
    const arr = [];
    for (let k = 0; k < 14; k++) {
      arr.push({
        left: 4 + Math.random() * 92,
        delay: (Math.random() * 0.9).toFixed(2),
        dur: (2.1 + Math.random() * 1.3).toFixed(2),
        color: colors[k % colors.length],
      });
    }
    return arr;
  },

  // ---------- 弹层与按钮 ----------
  onPause() {
    if (this.status !== 'playing') return;
    audio.play('button');
    this.paused = true;
    this.setData({ paused: true });
    this.save();
  },

  onResume() {
    audio.play('button');
    this.paused = false;
    this.setData({ paused: false });
  },

  onRestart() {
    audio.play('button');
    this.winClosed = false;
    if (this.mode === 'daily') {
      this.startDaily();
    } else {
      this.startLevel(this.level);
    }
  },

  onNextLevel() {
    audio.play('button');
    this.winClosed = false;
    this.startLevel(this.level + 1);
  },

  onCloseWin() {
    audio.play('button');
    this.winClosed = true;
    this.setData({ winClosed: true });
  },

  // 从暂停/结算弹层进入选关、战绩（保持原弹层在下方，关闭后回到原状态）
  onOpenLevelsFromPause() {
    audio.play('button');
    const cur = this.data.mode === 'level' ? this.level : this.progress.unlocked;
    const page = Math.floor((cur - 1) / PER_PAGE);
    this.setData({ showLevels: true });
    this.buildLevelPage(Math.max(0, page));
  },

  onOpenStatsFromPause() {
    audio.play('button');
    this.setData({ showStats: true });
    this.refreshStats();
  },

  onBack() {
    wx.navigateBack({
      fail() {
        wx.switchTab({
          url: '/pages/home/home',
          fail() {},
        });
      },
    });
  },

  noop() {},

  // 选关弹层
  onOpenLevels() {
    audio.play('button');
    const cur = this.data.mode === 'level' ? this.level : this.progress.unlocked;
    const page = Math.floor((cur - 1) / PER_PAGE);
    this.setData({ showLevels: true });
    this.buildLevelPage(Math.max(0, page));
  },

  onCloseLevels() {
    audio.play('button');
    this.setData({ showLevels: false });
  },

  buildLevelPage(page) {
    const p = this.progress;
    const totalPages = Math.floor((p.unlocked - 1) / PER_PAGE) + 1;
    const start = page * PER_PAGE + 1;
    const items = [];
    for (let n = start; n < start + PER_PAGE; n++) {
      items.push({
        n,
        stars: p.stars[String(n)] || 0,
        locked: n > p.unlocked,
        cur: this.data.mode === 'level' && n === this.data.level && this.status === 'playing',
      });
    }
    this.setData({
      levelItems: items,
      levelPage: page,
      levelPageCount: totalPages,
      dailyStreak: p.streak,
      dailyDone: !!p.daily[dateKeyOf(new Date())],
    });
  },

  onLevelPagePrev() {
    if (this.data.levelPage <= 0) return;
    audio.play('button');
    this.buildLevelPage(this.data.levelPage - 1);
  },

  onLevelPageNext() {
    if (this.data.levelPage >= this.data.levelPageCount - 1) return;
    audio.play('button');
    this.buildLevelPage(this.data.levelPage + 1);
  },

  onSelectLevel(e) {
    const n = Number(e.currentTarget.dataset.n);
    if (n > this.progress.unlocked) {
      wx.showToast({ title: '先通关前面的关卡', icon: 'none' });
      return;
    }
    audio.play('button');
    this.setData({ showLevels: false });
    this.startLevel(n);
  },

  onPlayDaily() {
    audio.play('button');
    this.setData({ showLevels: false });
    this.startDaily();
  },

  // 设置弹层
  onOpenSettings() {
    audio.play('button');
    this.setData({ showSettings: true, settings: Object.assign({}, this.settings) });
  },

  onCloseSettings() {
    audio.play('button');
    this.setData({ showSettings: false });
  },

  onToggleMute() {
    this.settings.muted = audio.toggle();
    this.saveSettings();
    this.setData({ settings: Object.assign({}, this.settings) });
    if (!this.settings.muted) audio.play('button');
  },

  onToggleVibrate() {
    this.settings.vibrate = !this.settings.vibrate;
    this.saveSettings();
    this.setData({ settings: Object.assign({}, this.settings) });
    this.vibrate('light');
  },

  onToggleHighlight() {
    this.settings.highlight = !this.settings.highlight;
    this.saveSettings();
    this.setData({ settings: Object.assign({}, this.settings) });
    this.refreshView();
  },

  onToggleTheme() {
    const next = this.settings.theme === 'dark' ? 'light' : 'dark';
    this.settings.theme = next;
    this.saveSettings();
    this.applyTheme(next);
    this.setData({ settings: Object.assign({}, this.settings) });
  },

  onResetProgress() {
    wx.showModal({
      title: '重置进度',
      content: '将清空全部关卡进度、星标与战绩，确定吗？',
      confirmColor: '#C3392B',
      success: (res) => {
        if (!res.confirm) return;
        this.progress = defaultProgress();
        this.records = [];
        saveStore(KEY_PROGRESS, this.progress);
        saveStore(KEY_RECORDS, this.records);
        this.clearSave();
        this.setData({ showSettings: false });
        this.startLevel(1);
        wx.showToast({ title: '已重置', icon: 'none' });
      },
    });
  },

  // ---------- 修改器（雅集模式，设置内开关直开） ----------
  onToggleMod() {
    this.settings.modOn = !this.settings.modOn;
    this.saveSettings();
    audio.play('button');
    if (!this.settings.modOn) {
      // 关闭修改器时复位全部作弊开关，避免透视/时间静止等状态残留
      this.mod = { god: false, hints: false, ghost: false, timeStop: false };
      this.syncMod();
      this.refreshView();
    }
    this.setData({ settings: Object.assign({}, this.settings) });
  },

  syncMod(extra) {
    this.setData(Object.assign({ mod: Object.assign({}, this.mod) }, extra || {}));
  },

  onModGod() {
    this.mod.god = !this.mod.god;
    if (this.mod.god) this._cheatUsed = true;
    audio.play('button');
    this.syncMod();
  },

  onModHints() {
    this.mod.hints = !this.mod.hints;
    if (this.mod.hints) this._cheatUsed = true;
    audio.play('button');
    this.syncMod();
    this.refreshView();
  },

  onModGhost() {
    this.mod.ghost = !this.mod.ghost;
    if (this.mod.ghost) this._cheatUsed = true;
    audio.play('button');
    this.syncMod();
    this.refreshView();
  },

  onModTime() {
    this.mod.timeStop = !this.mod.timeStop;
    if (this.mod.timeStop) this._cheatUsed = true;
    audio.play('button');
    this.syncMod();
  },

  // 一键完成：摆出正解但不结算（不入战绩、不解锁）
  onModFill() {
    if (!this.puzzle || this.status !== 'playing') return;
    this.pushUndo();
    this.values = this.solution.slice();
    this.notes = new Array(81).fill(0);
    this._cheatUsed = true;
    this.stopTimer();
    this.clearSave();
    this.status = 'win';
    this.winClosed = true;
    audio.play('win');
    this.setData({ status: 'win', winClosed: true, winCheat: true });
    this.refreshView();
    wx.showToast({ title: '已自动完成，本局不计战绩', icon: 'none' });
  },

  onModHeal() {
    if (this.status !== 'playing') return;
    this.mistakes = 0;
    audio.play('hint');
    this.refreshView();
    wx.showToast({ title: '爱心已回满', icon: 'none', duration: 800 });
  },

  onModTimeReset() {
    this.elapsed = 0;
    audio.play('button');
    this.setData({ timeText: fmtTime(0) });
  },

  onModJump() {
    wx.showModal({
      title: '跳转关卡',
      content: '',
      editable: true,
      placeholderText: '输入关卡号（1~9999）',
      success: (res) => {
        if (!res.confirm) return;
        const n = parseInt(res.content, 10);
        if (!n || n < 1 || n > 9999) {
          wx.showToast({ title: '关卡号无效', icon: 'none' });
          return;
        }
        if (n > this.progress.unlocked) this.progress.unlocked = n;
        saveStore(KEY_PROGRESS, this.progress);
        this.setData({ showSettings: false });
        this.winClosed = false;
        this.startLevel(n);
        wx.showToast({ title: `已跳转至第 ${n} 关`, icon: 'none' });
      },
    });
  },

  // 战绩弹层
  onOpenStats() {
    audio.play('button');
    this.setData({ showStats: true });
    this.refreshStats();
  },

  onCloseStats() {
    audio.play('button');
    this.setData({ showStats: false });
  },

  refreshStats() {
    const p = this.progress;
    let stars = 0;
    Object.keys(p.stars).forEach((k) => {
      stars += p.stars[k];
    });
    Object.keys(p.daily).forEach((k) => {
      stars += p.daily[k].s;
    });
    const winRate = p.played ? `${Math.round((p.won / p.played) * 100)}%` : '--';
    const records = (this.records || []).map((r) => ({
      timeText: fmtTime(r.t),
      dateText: (() => {
        const d = new Date(r.time);
        return `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
      })(),
      label: r.mode === 'daily' ? '每日挑战' : `第${r.level}关`,
      result: r.result,
      mistakes: r.mistakes,
    }));
    this.setData({
      stats: { stars, won: p.won, winRate, streak: p.streak },
      records,
    });
  },
});
