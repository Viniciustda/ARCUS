/**
 * @file sections.js
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Chooses how firmly the scroll stops on each full screen section and marks the section on screen.
 */

const panels = [...document.querySelectorAll('.panel')];
// Share of a section that must be on screen for it to count as the current one
const CURRENT_SHARE = 0.55;

let current = 0;

/**
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Marks the section that took over the screen, so the animations of the others can rest.
 *
 * @param entries - visibility changes of the sections
 */
function watchSections(entries) {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const index = panels.indexOf(entry.target);
    if (index === current) continue;
    panels[current].classList.remove('is-current');
    entry.target.classList.add('is-current');
    current = index;
  }
}

/**
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Makes the scroll always stop on a section when every section fits the screen.
 */
function chooseSnap() {
  const fits = panels.every((panel) => panel.offsetHeight <= window.innerHeight + 2);
  document.documentElement.classList.toggle('snap-strict', fits);
}

chooseSnap();
window.addEventListener('resize', chooseSnap);
new ResizeObserver(chooseSnap).observe(document.body);

panels[0].classList.add('is-current');
const observer = new IntersectionObserver(watchSections, { threshold: CURRENT_SHARE });
panels.forEach((panel) => observer.observe(panel));
