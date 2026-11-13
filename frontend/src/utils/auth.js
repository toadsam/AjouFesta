const ACCESS_TOKEN_KEY = "festflow_access_token";
const ADMIN_NAME_KEY = "festflow_admin_name";

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY) || "";
}

export function getAdminName() {
  return localStorage.getItem(ADMIN_NAME_KEY) || "";
}

export function isLoggedIn() {
  return Boolean(getAccessToken());
}

export function saveLogin(token, username) {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
  localStorage.setItem(ADMIN_NAME_KEY, username);
}

export function clearLogin() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(ADMIN_NAME_KEY);
}
