/* ============================================================
   Opera Sidebar Translator — Theme bootstrap
   Loaded synchronously in <head> so the theme is set before
   the first paint. Preferences are mirrored in localStorage.
   ============================================================ */
(() => {
  const dark = matchMedia('(prefers-color-scheme: dark)');

  const read = (key, fallback) => {
    try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
  };

  window.applyTheme = () => {
    const theme = read('appTheme', 'claude');
    document.documentElement.dataset.theme = theme === 'auto'
      ? (dark.matches ? 'night' : read('lightTheme', 'claude'))
      : theme;
  };

  dark.addEventListener('change', window.applyTheme);
  window.applyTheme();
})();
