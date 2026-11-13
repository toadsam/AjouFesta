const RESERVATION_USER_KEY = "festflow_reservation_user_key";

export function getReservationUserKey() {
  const existing = localStorage.getItem(RESERVATION_USER_KEY);
  if (existing) {
    return existing;
  }

  const created = `user-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(RESERVATION_USER_KEY, created);
  return created;
}
