// game/pages/sudoku/core.js
// 数独核心逻辑：确定性关卡生成（种子随机，同一关全世界玩家盘面一致）+ 位运算 MRV 求解器。
// 纯函数模块，不依赖 wx，可在 Node 中直接单测（唯一解 / 线索数 / 耗时）。

// ---------- 随机数（可复现） ----------
// 字符串哈希（xmur3），把关卡号 / 日期映射为 32 位种子
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

// mulberry32：轻量 PRNG，返回 () => [0,1)
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rngFor(key) {
  return mulberry32(xmur3(key)());
}

function shuffled(n, rng) {
  const arr = new Array(n);
  for (let i = 0; i < n; i++) arr[i] = i;
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

// ---------- 位运算表 ----------
export const ROW_OF = new Uint8Array(81);
export const COL_OF = new Uint8Array(81);
export const BOX_OF = new Uint8Array(81);
for (let i = 0; i < 81; i++) {
  const r = Math.floor(i / 9);
  const c = i % 9;
  ROW_OF[i] = r;
  COL_OF[i] = c;
  BOX_OF[i] = Math.floor(r / 3) * 3 + Math.floor(c / 3);
}

const ALL_MASK = 0x3fe; // 数字 1~9 占 bit1~bit9
const POPCNT = new Uint8Array(1024);
const BIT_DIGIT = new Uint8Array(1024);
for (let m = 1; m < 1024; m++) {
  POPCNT[m] = POPCNT[m >> 1] + (m & 1);
}
for (let d = 1; d <= 9; d++) {
  BIT_DIGIT[1 << d] = d;
}

// 某格在当前行/列/宫占用下的候选位掩码
export function candidatesOf(rows, cols, boxes, i) {
  return ALL_MASK & ~(rows[ROW_OF[i]] | cols[COL_OF[i]] | boxes[BOX_OF[i]]);
}

// 从位掩码取候选数字数组（升序）
export function maskToDigits(mask) {
  const out = [];
  while (mask) {
    const bit = mask & -mask;
    out.push(BIT_DIGIT[bit]);
    mask ^= bit;
  }
  return out;
}

// 行/列/宫占用位掩码
export function unitMasks(grid) {
  const rows = new Uint16Array(9);
  const cols = new Uint16Array(9);
  const boxes = new Uint16Array(9);
  for (let i = 0; i < 81; i++) {
    const v = grid[i];
    if (!v) continue;
    const bit = 1 << v;
    rows[ROW_OF[i]] |= bit;
    cols[COL_OF[i]] |= bit;
    boxes[BOX_OF[i]] |= bit;
  }
  return { rows, cols, boxes };
}

// ---------- 求解器 ----------
// 统计解个数（上限 limit，达到即提前返回），带 MRV 剪枝；盘面非法返回 0。
export function countSolutions(grid, limit = 2) {
  const g = grid.slice();
  const rows = new Uint16Array(9);
  const cols = new Uint16Array(9);
  const boxes = new Uint16Array(9);
  // 建占用掩码，顺带查重：任一行/列/宫内同数字出现两次即非法
  for (let i = 0; i < 81; i++) {
    const v = g[i];
    if (!v) continue;
    const bit = 1 << v;
    const r = ROW_OF[i];
    const c = COL_OF[i];
    const b = BOX_OF[i];
    if ((rows[r] | cols[c] | boxes[b]) & bit) return 0;
    rows[r] |= bit;
    cols[c] |= bit;
    boxes[b] |= bit;
  }
  let count = 0;
  function dfs() {
    if (count >= limit) return;
    let best = -1;
    let bestMask = 0;
    let bestN = 10;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const mask = candidatesOf(rows, cols, boxes, i);
      const n = POPCNT[mask];
      if (n === 0) return;
      if (n < bestN) {
        bestN = n;
        best = i;
        bestMask = mask;
        if (n === 1) break;
      }
    }
    if (best === -1) {
      count++;
      return;
    }
    const r = ROW_OF[best];
    const c = COL_OF[best];
    const b = BOX_OF[best];
    let mask = bestMask;
    while (mask) {
      const bit = mask & -mask;
      mask ^= bit;
      g[best] = BIT_DIGIT[bit];
      rows[r] |= bit;
      cols[c] |= bit;
      boxes[b] |= bit;
      dfs();
      rows[r] ^= bit;
      cols[c] ^= bit;
      boxes[b] ^= bit;
      g[best] = 0;
      if (count >= limit) return;
    }
  }
  dfs();
  return count;
}

// 求一个完整解（无解返回 null）。rng 可选：随机化数字尝试顺序，用于生成终盘。
export function solveOne(grid, rng) {
  const g = grid.slice();
  const { rows, cols, boxes } = unitMasks(g);
  function dfs() {
    let best = -1;
    let bestMask = 0;
    let bestN = 10;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const mask = candidatesOf(rows, cols, boxes, i);
      const n = POPCNT[mask];
      if (n === 0) return false;
      if (n < bestN) {
        bestN = n;
        best = i;
        bestMask = mask;
        if (n === 1) break;
      }
    }
    if (best === -1) return true;
    const order = maskToDigits(bestMask);
    if (rng) {
      for (let k = order.length - 1; k > 0; k--) {
        const j = Math.floor(rng() * (k + 1));
        const t = order[k];
        order[k] = order[j];
        order[j] = t;
      }
    }
    const r = ROW_OF[best];
    const c = COL_OF[best];
    const b = BOX_OF[best];
    for (const d of order) {
      const bit = 1 << d;
      g[best] = d;
      rows[r] |= bit;
      cols[c] |= bit;
      boxes[b] |= bit;
      if (dfs()) return true;
      rows[r] ^= bit;
      cols[c] ^= bit;
      boxes[b] ^= bit;
      g[best] = 0;
    }
    return false;
  }
  return dfs() ? g : null;
}

// ---------- 生成 ----------
// 生成随机终盘：先随机填三条对角宫，再随机化求解补满
function generateFull(rng) {
  const g = new Array(81).fill(0);
  for (const b of [0, 4, 8]) {
    const digits = shuffled(9, rng).map((d) => d + 1);
    let k = 0;
    for (let r = Math.floor(b / 3) * 3; r < Math.floor(b / 3) * 3 + 3; r++) {
      for (let c = (b % 3) * 3; c < (b % 3) * 3 + 3; c++) {
        g[r * 9 + c] = digits[k++];
      }
    }
  }
  const solved = solveOne(g, rng);
  return solved || generateFull(rng);
}

// 由终盘按唯一解约束随机去格，逼近目标线索数。
// 去格失败具备单调性（线索越少越难保持唯一解），单轮乱序遍历即为最优。
function carvePuzzle(solution, targetClues, rng) {
  const puzzle = solution.slice();
  let clues = 81;
  for (const i of shuffled(81, rng)) {
    if (clues <= targetClues) break;
    const backup = puzzle[i];
    puzzle[i] = 0;
    if (countSolutions(puzzle, 2) !== 1) {
      puzzle[i] = backup;
    } else {
      clues--;
    }
  }
  return puzzle;
}

// ---------- 难度与关卡 ----------
// 线索数越少越难；目标值留少量余量，保证生成耗时稳定
export const DIFFICULTIES = [
  { key: 'easy', name: '入门', clues: 42 },
  { key: 'basic', name: '简单', clues: 38 },
  { key: 'medium', name: '中等', clues: 33 },
  { key: 'hard', name: '困难', clues: 29 },
  { key: 'expert', name: '专家', clues: 26 },
  { key: 'master', name: '大师', clues: 24 },
];

// 关卡 → 难度档位（关卡 374 落在「困难」，与主流数独难度曲线一致）
export function difficultyIndexOfLevel(level) {
  if (level <= 40) return 0;
  if (level <= 120) return 1;
  if (level <= 260) return 2;
  if (level <= 480) return 3;
  if (level <= 800) return 4;
  return 5;
}

export function difficultyOfLevel(level) {
  return DIFFICULTIES[difficultyIndexOfLevel(level)];
}

// 生成指定关卡（确定性：同一关卡号任何时刻生成结果一致）
export function generateLevel(level) {
  const diff = difficultyOfLevel(level);
  const rng = rngFor(`sudoku-L${level}`);
  const solution = generateFull(rng);
  const puzzle = carvePuzzle(solution, diff.clues, rng);
  return { puzzle, solution, difficulty: diff };
}

// 每日挑战：按本地日期（YYYY-MM-DD）确定性生成，固定困难
export function generateDaily(dateKey) {
  const rng = rngFor(`sudoku-D${dateKey}`);
  const solution = generateFull(rng);
  const puzzle = carvePuzzle(solution, 29, rng);
  return { puzzle, solution, difficulty: DIFFICULTIES[3] };
}

// ---------- 运行时辅助 ----------
// 计算某空格的候选数字（基于当前作答盘面）
export function candidatesForGrid(grid, i) {
  const { rows, cols, boxes } = unitMasks(grid);
  return maskToDigits(candidatesOf(rows, cols, boxes, i));
}

// 全盘空格候选（用于「一键笔记」）：返回 81 项位掩码
export function allCandidateMasks(grid) {
  const { rows, cols, boxes } = unitMasks(grid);
  const masks = new Array(81).fill(0);
  for (let i = 0; i < 81; i++) {
    if (!grid[i]) masks[i] = candidatesOf(rows, cols, boxes, i);
  }
  return masks;
}

// 数组 <-> 紧凑字符串（存档用）
export function gridToString(grid) {
  let s = '';
  for (let i = 0; i < 81; i++) s += grid[i] ? String.fromCharCode(48 + grid[i]) : '.';
  return s;
}

export function stringToGrid(str) {
  const g = new Array(81).fill(0);
  for (let i = 0; i < 81 && i < str.length; i++) {
    const ch = str[i];
    g[i] = ch >= '1' && ch <= '9' ? ch.charCodeAt(0) - 48 : 0;
  }
  return g;
}

// 校验完整解是否合法（单测用）
export function isValidSolution(grid) {
  for (let u = 0; u < 9; u++) {
    let rMask = 0;
    let cMask = 0;
    let bMask = 0;
    for (let k = 0; k < 9; k++) {
      rMask |= 1 << grid[u * 9 + k];
      cMask |= 1 << grid[k * 9 + u];
      const br = Math.floor(u / 3) * 3 + Math.floor(k / 3);
      const bc = (u % 3) * 3 + (k % 3);
      bMask |= 1 << grid[br * 9 + bc];
    }
    if (rMask !== ALL_MASK || cMask !== ALL_MASK || bMask !== ALL_MASK) return false;
  }
  return true;
}
