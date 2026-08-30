import { CARDS, getCardById } from '../data/cards';

const HISTORY_KEY = 'tarot_history';
const SAVED_KEY = 'tarot_saved';
const SPREAD_KEY = 'tarot_spreads';
const SALT = 'ydw-tarot';
const POSITIONS = ['过去', '现在', '未来'];

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
  const total = dates.length + getSpreads().length * 3;
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

export function drawThreeSpread(question = '') {
  const pool = [...CARDS];
  const draws = POSITIONS.map((position) => {
    const idx = Math.floor(Math.random() * pool.length);
    const card = pool.splice(idx, 1)[0];
    return { card, isReversed: Math.random() < 0.5, position };
  });
  const now = new Date();
  const hh = `${now.getHours()}`.padStart(2, '0');
  const mm = `${now.getMinutes()}`.padStart(2, '0');
  return { ts: now.getTime(), dateStr: todayStr(), time: `${hh}:${mm}`, question, draws };
}

export function getSpreads() {
  return wx.getStorageSync(SPREAD_KEY) || [];
}

export function recordSpread(spread) {
  const list = getSpreads();
  list.unshift(spread);
  wx.setStorageSync(SPREAD_KEY, list.slice(0, 50));
}

export function getMonthRecords(year, month) {
  const prefix = `${year}-${`${month}`.padStart(2, '0')}`;
  const records = [];
  const history = readHistory();
  Object.keys(history)
    .filter((date) => date.startsWith(prefix))
    .forEach((date) => {
      const rec = history[date];
      records.push({
        type: 'daily',
        date,
        time: '00:00',
        cardId: rec.cardId,
        reversed: !!rec.reversed,
        label: '每日之牌',
      });
    });
  getSpreads().forEach((sp) => {
    if (!sp.dateStr || !sp.dateStr.startsWith(prefix)) return;
    (sp.draws || []).forEach((dr) => {
      records.push({
        type: 'spread',
        date: sp.dateStr,
        time: sp.time || '00:00',
        cardId: dr.card.id,
        reversed: !!dr.isReversed,
        position: dr.position,
        label: `${dr.position} · 问卜`,
      });
    });
  });
  records.sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));
  return records;
}

const REDRAW_KEY = 'tarot_redraw';

export function isRedrawUsed(dateStr) {
  const map = wx.getStorageSync(REDRAW_KEY) || {};
  return !!map[dateStr];
}

export function redrawDaily(dateStr) {
  const map = wx.getStorageSync(REDRAW_KEY) || {};
  map[dateStr] = true;
  wx.setStorageSync(REDRAW_KEY, map);
  const card = CARDS[Math.floor(Math.random() * CARDS.length)];
  const isReversed = Math.random() < 0.5;
  const history = readHistory();
  history[dateStr] = { cardId: card.id, reversed: isReversed };
  writeHistory(history);
  return { ...card, isReversed };
}
