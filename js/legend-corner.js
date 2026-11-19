/**
 * @file legend-corner.js
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief In full screen, the visitor holds the legend and drags it. When released it settles in the nearest of
 * the four corners. In a top corner it sits under the controls bar while the bar is open.
 */

const box = document.getElementById('replay-box');
const legend = box.querySelector('.legend');
// Time the legend takes to glide into its corner, in ms, matched to the css transition
const GLIDE_MS = 250;

const drag = { active: false, startX: 0, startY: 0 };

/**
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Picks up the legend, only in full screen.
 *
 * @param event - pointer pressed on the legend
 */
function pickUp(event) {
  if (!box.classList.contains('full')) return;
  Object.assign(drag, { active: true, startX: event.clientX, startY: event.clientY });
  legend.setPointerCapture(event.pointerId);
  legend.classList.add('dragging');
}

/**
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Moves the legend with the finger or the mouse.
 *
 * @param event - pointer moved
 */
function move(event) {
  if (!drag.active) return;
  legend.style.transform = `translate(${event.clientX - drag.startX}px, ${event.clientY - drag.startY}px)`;
}

/**
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Drops the legend in the corner nearest to where it was released, gliding from there.
 *
 * @param event - pointer released
 */
function drop(event) {
  if (!drag.active) return;
  drag.active = false;
  legend.classList.remove('dragging');
  const before = legend.getBoundingClientRect();
  const frame = box.getBoundingClientRect();
  const top = before.top + before.height / 2 < frame.top + frame.height / 2;
  const left = before.left + before.width / 2 < frame.left + frame.width / 2;
  box.dataset.legendCorner = `${top ? 't' : 'b'}${left ? 'l' : 'r'}`;
  legend.style.transform = '';
  // Starts the glide from the place where it was released
  const after = legend.getBoundingClientRect();
  legend.style.transition = 'none';
  legend.style.transform = `translate(${before.left - after.left}px, ${before.top - after.top}px)`;
  void legend.offsetWidth;
  legend.style.transition = `transform ${GLIDE_MS}ms ease`;
  legend.style.transform = '';
  setTimeout(() => { legend.style.transition = ''; }, GLIDE_MS);
}

box.dataset.legendCorner = 'bl';
legend.addEventListener('pointerdown', pickUp);
legend.addEventListener('pointermove', move);
legend.addEventListener('pointerup', drop);
legend.addEventListener('pointercancel', drop);
