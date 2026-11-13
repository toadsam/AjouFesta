const RESERVATION_TOKEN_KEY = "festflow_reservation_auth_token";
const RESERVATION_PHONE_KEY = "festflow_reservation_phone";

export function getReservationToken() {
  return localStorage.getItem(RESERVATION_TOKEN_KEY) || "";
}

export function getReservationPhone() {
  return localStorage.getItem(RESERVATION_PHONE_KEY) || "";
}

export function saveReservationAuth(token, phoneNumber) {
  localStorage.setItem(RESERVATION_TOKEN_KEY, token);
  localStorage.setItem(RESERVATION_PHONE_KEY, phoneNumber);
}

export function clearReservationAuth() {
  localStorage.removeItem(RESERVATION_TOKEN_KEY);
  localStorage.removeItem(RESERVATION_PHONE_KEY);
}
