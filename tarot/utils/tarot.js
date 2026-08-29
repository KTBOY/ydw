import { CARDS, getCardById } from '../data/cards';

const HISTORY_KEY = 'tarot_history';
const SAVED_KEY = 'tarot_saved';
const SALT = 'ydw-tarot';

function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i += 1) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function todayStr() {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function getDailyCard(dateStr = todayStr()) {
  const seed = hash(`${dateStr}${SALT}`);
  const card = CARDS[seed % CARDS.length];
  const isReversed = Math.floor(seed / 32) % 2 === 1;
  return { ...card, isReversed };
}

function readHistory() {
  return wx.getStorageSync(HISTORY_KEY) || {};
}

function writeHistory(history) {
  wx.setStorageSync(HISTORY_KEY, history);
}

export function getDraw(dateStr) {
  const rec = readHistory()[dateStr];
  if (!rec) return null;
  const card = getCardById(rec.cardId);
  return card ? { ...rec, card } : null;
}

export function recordDraw(dateStr, record) {
  const history = readHistory();
  if (history[dateStr]) return;
  history[dateStr] = record;
  writeHistory(history);
}

export function getHistoryByMonth(year, month) {
  const prefix = `${year}-${`${month}`.padStart(2, '0')}`;
  const history = readHistory();
  return Object.keys(history)
    .filter((date) => date.startsWith(prefix))
    .map((date) => ({
      date,
      day: Number(date.slice(8, 10)),
      cardId: history[date].cardId,
      reversed: !!history[date].reversed,
    }))
    .sort((a, b) => a.day - b.day);
}

export function buildMonthGrid(year, month, records) {
  const map = {};
  (records || []).forEach((r) => {
    map[r.day] = r;
  });
  const offset = new Date(year, month - 1, 1).getDay();
  const days = new Date(year, month, 0).getDate();
  const grid = [];
  for (let i = 0; i < offset; i += 1) grid.push({ empty: true, key: `e${i}` });
  for (let d = 1; d <= days; d += 1) {
    const rec = map[d];
    grid.push(
      rec
        ? { day: d, hasRecord: true, cardId: rec.cardId, reversed: rec.reversed, key: `d${d}` }
        : { day: d, hasRecord: false, key: `d${d}` },
    );
  }
  while (grid.length % 7 !== 0) grid.push({ empty: true, key: `t${grid.length}` });
  return grid;
}

export function getSavedIds() {
  return wx.getStorageSync(SAVED_KEY) || [];
}

export function isSaved(cardId) {
  return getSavedIds().indexOf(cardId) !== -1;
}

export function toggleSave(cardId) {
  const saved = getSavedIds();
  const idx = saved.indexOf(cardId);
  if (idx === -1) {
    saved.push(cardId);
  } else {
    saved.splice(idx, 1);
  }
  wx.setStorageSync(SAVED_KEY, saved);
  return idx === -1;
}

export function getStats() {
  const history = readHistory();
  const dates = Object.keys(history).sort();
  const total = dates.length;
  const savedCount = getSavedIds().length;

  let streak = 0;
  const cursor = new Date();
  if (!history[todayStr()]) cursor.setDate(cursor.getDate() - 1);
  for (;;) {
    const m = `${cursor.getMonth() + 1}`.padStart(2, '0');
    const d = `${cursor.getDate()}`.padStart(2, '0');
    const key = `${cursor.getFullYear()}-${m}-${d}`;
    if (!history[key]) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { total, savedCount, streak };
}
