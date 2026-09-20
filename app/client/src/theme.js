const KEY = 'bloom_theme'; // 'light' | 'dark' | 'system'
export const getTheme = () => { try { return localStorage.getItem(KEY) || 'system'; } catch { return 'system'; } };
export function setTheme(t) {
  try { localStorage.setItem(KEY, t); } catch { /* storage blocked: still apply for this session */ }
  applyTheme(t);
}
export function applyTheme(t = getTheme()) {
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}
