// packageA/pages/fundSearch/fundSearch.js
import {
  debounce
} from "../../../../utils/util"

const SEARCH_HISTORY_KEY = "fund_search_history";
const FUND_CODE_URL = "https://fund.eastmoney.com/js/fundcode_search.js";
const MAX_HISTORY_COUNT = 10;
const MAX_RESULT_COUNT = 30;

const FALLBACK_SOURCE = [
  ["000001", "HXCZHH", "华夏成长混合", "混合型-灵活", "HUAXIACHENGZHANGHUNHE"]
];

function normalizeFundItem(row) {
  if (!Array.isArray(row)) {
    return null;
  }
  const [code, abbr, name, type, pinyin] = row;
  if (!code || !name) {
    return null;
  }
  return {
    code: String(code),
    abbr: String(abbr || ""),
    name: String(name),
    type: String(type || ""),
    pinyin: String(pinyin || ""),
  };
}

function parseFundCodeSource(scriptText) {
  if (typeof scriptText !== "string" || !scriptText.trim()) {
    return [];
  }

  const matched = scriptText.match(/var\s+r\s*=\s*(\[[\s\S]*\])\s*;?/);
  if (!matched || !matched[1]) {
    return [];
  }

  let parsed = [];
  try {
    parsed = JSON.parse(matched[1]);
  } catch (error) {
    try {
      parsed = new Function(`return ${matched[1]}`)();
    } catch (evalError) {
      console.error("parse fundcode_search.js failed:", evalError);
    }
  }

  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.map(normalizeFundItem).filter(Boolean);
}

function getMatchScore(item, keyword, keywordLower) {
  let score = 0;
  const code = item.code;
  const name = item.name;
  const abbr = item.abbr.toLowerCase();
  const pinyin = item.pinyin.toLowerCase();
  const type = item.type.toLowerCase();
  const nameLower = name.toLowerCase();

  if (code === keyword) {
    score += 220;
  } else if (code.startsWith(keyword)) {
    score += 120;
  } else if (code.includes(keyword)) {
    score += 80;
  }

  if (name === keyword) {
    score += 220;
  } else if (nameLower.startsWith(keywordLower)) {
    score += 140;
  } else if (nameLower.includes(keywordLower)) {
    score += 90;
  }

  if (abbr.startsWith(keywordLower)) {
    score += 70;
  } else if (abbr.includes(keywordLower)) {
    score += 40;
  }

  if (pinyin.startsWith(keywordLower)) {
    score += 60;
  } else if (pinyin.includes(keywordLower)) {
    score += 35;
  }

  if (type.includes(keywordLower)) {
    score += 20;
  }

  return score;
}

function filterFundList(sourceList, keyword) {
  const safeKeyword = String(keyword || "").trim();
  if (!safeKeyword) {
    return [];
  }

  const keywordLower = safeKeyword.toLowerCase();
  return sourceList
    .map((item) => ({
      ...item,
      score: getMatchScore(item, safeKeyword, keywordLower),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.code.localeCompare(b.code))
    .slice(0, MAX_RESULT_COUNT)
    .map((item) => ({
      code: item.code,
      abbr: item.abbr,
      name: item.name,
      type: item.type,
      pinyin: item.pinyin,
    }));
}

function fetchFundCodeScript() {
  return new Promise((resolve, reject) => {
    wx.request({
      url: FUND_CODE_URL,
      method: "GET",
      dataType: "text",
      responseType: "text",
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(typeof res.data === "string" ? res.data : "");
          return;
        }
        reject(new Error(`request failed with status ${res.statusCode}`));
      },
      fail: reject,
    });
  });
}

Page({
  data: {
    searchValue: "",
    loading: false,
    errorMsg: "",
    sourceList: [],
    renderList: [],
    searchHistory: [],
  },

  onLoad() {
    this.loadSearchHistory();
    this.fetchFundList();
    this.updateRenderList = debounce(this.updateRenderList, 500);
  },

  async fetchFundList() {
    this.setData({
      loading: true,
      errorMsg: "",
    });

    try {
      const rawText = await fetchFundCodeScript();
      const sourceList = parseFundCodeSource(rawText);
      this.setData({
        sourceList: sourceList.length ? sourceList : FALLBACK_SOURCE.map(normalizeFundItem).filter(Boolean),
      });
      this.updateRenderList(this.data.searchValue);
    } catch (error) {
      console.error("fetch fund list failed:", error);
      this.setData({
        sourceList: FALLBACK_SOURCE.map(normalizeFundItem).filter(Boolean),
        errorMsg: "基金列表加载失败，请检查合法域名配置",
      });
      this.updateRenderList(this.data.searchValue);
    } finally {
      this.setData({
        loading: false,
      });
    }
  },

  updateRenderList(keyword = "") {
    console.log(keyword);
    const renderList = filterFundList(this.data.sourceList, keyword);
    this.setData({
      renderList,
    });
  },

  onSearchInput(e) {
    const searchValue = (e.detail.value || "").trim();
    this.setData({
      searchValue
    });

    this.updateRenderList(searchValue);
  },

  /**
 * 当搜索确认时触发的事件处理函数
 * 调用submitSearch方法执行实际的搜索操作
 */
onSearchConfirm() {
    this.submitSearch();
  },

  onSearchSubmit() {
    this.submitSearch();
  },

  submitSearch() {
    const keyword = this.data.searchValue.trim();
    this.updateRenderList(keyword);
    if (keyword) {
      this.pushHistory(keyword);
    }
  },

  onTapResultItem(e) {
    const {
      name = "", code = ""
    } = e.currentTarget.dataset;
    if (!name) {
      return;
    }
    this.setData({
      searchValue: name,
    });
    this.pushHistory(name || code);
    this.updateRenderList(name);
    wx.navigateTo({
      url: `/packageA/pages/fundPage/fundItem/fundItem?code=${code}`
    })
  },

  onTapHistoryWord(e) {
    const word = e.currentTarget.dataset.word || "";
    if (!word) {
      return;
    }
    this.setData({
      searchValue: word,
    });
    this.updateRenderList(word);
  },

  onClearInput() {
    this.setData({
      searchValue: "",
      renderList: [],
    });
  },

  onClearHistory() {
    this.setData({
      searchHistory: [],
    });
    wx.removeStorageSync(SEARCH_HISTORY_KEY);
  },

  loadSearchHistory() {
    const history = wx.getStorageSync(SEARCH_HISTORY_KEY);
    this.setData({
      searchHistory: Array.isArray(history) ? history : [],
    });
  },

  pushHistory(keyword) {
    const safeKeyword = String(keyword || "").trim();
    if (!safeKeyword) {
      return;
    }

    const mergedHistory = [safeKeyword, ...this.data.searchHistory.filter((item) => item !== safeKeyword)].slice(
      0,
      MAX_HISTORY_COUNT
    );
    this.setData({
      searchHistory: mergedHistory,
    });
    wx.setStorageSync(SEARCH_HISTORY_KEY, mergedHistory);
  },
});