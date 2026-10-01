const IDLE_TIMEOUT_MS = 4 * 60 * 60 * 1000;
const REMEMBER_ME_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000;

export function checkIdleTimeout(): boolean {
  const rememberMe = localStorage.getItem("remember_me") === "true";
  const timeout = rememberMe ? REMEMBER_ME_TIMEOUT_MS : IDLE_TIMEOUT_MS;
  const lastActivity = localStorage.getItem("last_activity");
  if (!lastActivity) return false;
  const elapsed = Date.now() - parseInt(lastActivity, 10);
  return elapsed > timeout;
}

export function touchActivity(rememberMe?: boolean) {
  if (rememberMe !== undefined) {
    localStorage.setItem("remember_me", String(rememberMe));
  }
  localStorage.setItem("last_activity", String(Date.now()));
}

export function clearRememberMe() {
  localStorage.removeItem("remember_me");
}
