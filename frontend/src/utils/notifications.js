export const NOTIFICATION_STORAGE_KEY = "festflow_notifications";

export function areNotificationsEnabled() {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(NOTIFICATION_STORAGE_KEY) !== "false";
}

export function setNotificationsEnabled(enabled) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(NOTIFICATION_STORAGE_KEY, String(Boolean(enabled)));
}

export async function ensureNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return false;
  }
  if (window.Notification.permission === "granted") {
    return true;
  }
  if (window.Notification.permission === "denied") {
    return false;
  }
  const permission = await window.Notification.requestPermission();
  return permission === "granted";
}

export function showBrowserNotification(title, options = {}) {
  if (
    typeof window === "undefined" ||
    !areNotificationsEnabled() ||
    !("Notification" in window) ||
    window.Notification.permission !== "granted"
  ) {
    return false;
  }

  try {
    new window.Notification(title, options);
    return true;
  } catch {
    return false;
  }
}
