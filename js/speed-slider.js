/**
 * @file speed-slider.js
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Speed slider from 1x to 100x on a linear scale, with a value that follows the thumb and stops at the
 * preset speeds while dragging.
 */

const MIN_SPEED = 1;
const MAX_SPEED = 100;
// Preset speeds. Dragging the slider stops on one when it gets this close to it
const PRESET_SPEEDS = [10, 20, 60];
const SNAP_SPEED = 2;

/**
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Share of the track where a speed sits.
 *
 * @param speed - speed from 1x to 100x
 * @return share from 0 to 1
 */
function shareOf(speed) {
  return (speed - MIN_SPEED) / (MAX_SPEED - MIN_SPEED);
}

/**
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Connects the slider, its value bubble and its tick labels.
 *
 * @param initial - speed shown at start
 * @param onChange - called with the new speed whenever the visitor moves the slider
 * @return the track element, to mark it when the replay is slowed down
 */
export function createSpeedSlider(initial, onChange) {
  const range = document.getElementById('speed-range');
  const bubble = document.getElementById('speed-value');
  const track = document.getElementById('speed-track');
  const ticks = document.getElementById('speed-ticks');
  ticks.innerHTML = PRESET_SPEEDS.map((speed) => `<span style="left: ${100 * shareOf(speed)}%">${speed}</span>`).join('');
  let dragging = false;

  /**
   * @author Vinicius Trindade
   * @date Nov 19, 2026
   *
   * @brief Places the thumb and the bubble on a speed and tells the replay.
   *
   * @param speed - speed from 1x to 100x
   */
  function choose(speed) {
    range.value = String(speed);
    range.setAttribute('aria-valuetext', `${speed} times`);
    bubble.textContent = `${speed}×`;
    track.style.setProperty('--position', String(shareOf(speed)));
    onChange(speed);
  }

  /**
   * @author Vinicius Trindade
   * @date Nov 19, 2026
   *
   * @brief Reads the slider. While a finger or the mouse drags it, it stops on a preset speed nearby.
   */
  function slide() {
    const value = Number(range.value);
    const preset = dragging ? PRESET_SPEEDS.find((speed) => Math.abs(value - speed) <= SNAP_SPEED) : undefined;
    choose(preset ?? value);
  }

  /**
   * @author Vinicius Trindade
   * @date Nov 19, 2026
   *
   * @brief Marks whether a finger or the mouse is dragging the slider.
   *
   * @param event - pointer pressed or released
   */
  function trackPointer(event) {
    dragging = event.type === 'pointerdown';
  }

  range.min = String(MIN_SPEED);
  range.max = String(MAX_SPEED);
  range.addEventListener('input', slide);
  range.addEventListener('pointerdown', trackPointer);
  window.addEventListener('pointerup', trackPointer);
  window.addEventListener('pointercancel', trackPointer);
  choose(initial);
  return track;
}
