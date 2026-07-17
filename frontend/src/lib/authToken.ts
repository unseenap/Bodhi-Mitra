const TOKEN_KEY = "bodhi_token";

export function getAuthToken() {
  const current = sessionStorage.getItem(TOKEN_KEY);
  if (current) return current;
  const legacy = localStorage.getItem(TOKEN_KEY);
  if (legacy) {
    sessionStorage.setItem(TOKEN_KEY, legacy);
    localStorage.removeItem(TOKEN_KEY);
  }
  return legacy;
}

export function setAuthToken(token: string) {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}
