const FAVORITES_KEY = "festflow_favorites";
const RECENTS_KEY = "festflow_recents";
const MEMOS_KEY = "festflow_memos";

function safeParse(value, fallback) {
  try {
    return JSON.parse(value) ?? fallback;
  } catch {
    return fallback;
  }
}

export function getFavoriteIds() {
  return safeParse(localStorage.getItem(FAVORITES_KEY), []);
}

export function toggleFavorite(id) {
  const favorites = new Set(getFavoriteIds());
  if (favorites.has(id)) {
    favorites.delete(id);
  } else {
    favorites.add(id);
  }
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites]));
  return [...favorites];
}

export function addRecentBooth(id) {
  const recents = safeParse(localStorage.getItem(RECENTS_KEY), []);
  const next = [id, ...recents.filter((item) => item !== id)].slice(0, 5);
  localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  return next;
}

export function getRecentBoothIds() {
  return safeParse(localStorage.getItem(RECENTS_KEY), []);
}

export function getBoothMemo(id) {
  const memos = safeParse(localStorage.getItem(MEMOS_KEY), {});
  return memos[id] ?? "";
}

export function saveBoothMemo(id, memo) {
  const memos = safeParse(localStorage.getItem(MEMOS_KEY), {});
  memos[id] = memo;
  localStorage.setItem(MEMOS_KEY, JSON.stringify(memos));
}
