/**
 * @file fullscreen.js
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Full screen mode of the replay, with its controls in a bar on top that folds away and the legend in a
 * small box on the left. Uses the browser full screen where it exists and fills the window where it does not,
 * as on the iPhone.
 */

const box = document.getElementById('replay-box');
const button = document.getElementById('fullscreen');
const root = document.documentElement;
const barToggle = document.getElementById('bar-toggle');
const controls = box.querySelector('.controls');

/**
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Shows the replay in full screen or back in the page, and updates the button.
 *
 * @param full - true for full screen
 */
function show(full) {
  box.classList.toggle('full', full);
  root.classList.toggle('replay-full', full);
  setBar(true);
  button.setAttribute('aria-pressed', String(full));
  button.setAttribute('aria-label', full ? 'Leave full screen' : 'Full screen');
}

/**
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Enters or leaves full screen.
 */
function toggle() {
  const full = !box.classList.contains('full');
  if (full && box.requestFullscreen) {
    box.requestFullscreen().catch(() => show(true));
  } else if (!full && document.fullscreenElement) {
    document.exitFullscreen();
  }
  show(full);
}

/**
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Follows the browser when it leaves full screen by itself, as with the Esc key or the back gesture.
 */
function followBrowser() {
  if (!document.fullscreenElement && box.classList.contains('full')) show(false);
}

/**
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Leaves the window filling mode with the Esc key, where the browser full screen does not exist.
 *
 * @param event - key pressed
 */
function leaveWithEscape(event) {
  if (event.key === 'Escape' && box.classList.contains('full') && !document.fullscreenElement) show(false);
}

/**
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Shows or folds away the controls bar of the full screen mode.
 *
 * @param open - true to show the controls
 */
function setBar(open) {
  box.classList.toggle('bar-closed', !open);
  barToggle.setAttribute('aria-expanded', String(open));
  barToggle.setAttribute('aria-label', open ? 'Hide the controls' : 'Show the controls');
}

/**
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Folds the controls away when they are shown, and shows them when they are folded.
 */
function toggleBar() {
  setBar(box.classList.contains('bar-closed'));
}

/**
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Keeps the fold button on the lower edge of the controls bar, whatever its height.
 */
function placeToggle() {
  box.style.setProperty('--bar-height', `${controls.offsetHeight}px`);
}

button.addEventListener('click', toggle);
barToggle.addEventListener('click', toggleBar);
new ResizeObserver(placeToggle).observe(controls);
document.addEventListener('fullscreenchange', followBrowser);
document.addEventListener('keydown', leaveWithEscape);
