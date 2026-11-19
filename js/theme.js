/**
 * @file theme.js
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Light and dark mode: follows the system and lets the visitor switch, remembering the choice.
 */

const root = document.documentElement;
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

/**
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Tells whether the page is showing the dark theme.
 *
 * @return true when the dark theme is on
 */
export function isDark() {
  const chosen = root.dataset.theme;
  return chosen ? chosen === 'dark' : darkQuery.matches;
}

/**
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Switches to the other theme, saves it and tells the page.
 */
function toggle() {
  const next = isDark() ? 'light' : 'dark';
  root.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch (e) { /* storage blocked */ }
  window.dispatchEvent(new Event('themechange'));
}

/**
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Tells the page that the system theme changed.
 */
function systemChanged() {
  window.dispatchEvent(new Event('themechange'));
}

document.getElementById('theme-toggle').addEventListener('click', toggle);
darkQuery.addEventListener('change', systemChanged);
