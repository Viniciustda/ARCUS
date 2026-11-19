/**
 * @file steps.js
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Animated story of the attack and of ARCUS on a small swarm, in five steps: consensus, attack,
 * detection, identification with the verdict, and the result.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const ICONS = ['assets/drones/honest_1.svg', 'assets/drones/honest_2.svg'];
const ATTACKER_ICON = 'assets/drones/attacker.svg';
const ICON_SIZE = 70;
// Places of the honest UAVs and of the attacker, in viewBox units (800 x 500)
const PLACES = { A: [130, 160], B: [330, 90], C: [560, 120], D: [700, 260], E: [575, 395], F: [345, 410], G: [140, 340] };
const ATTACKER_PLACE = [380, 255];
const HONEST = Object.keys(PLACES);
const LINKS = [['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'E'], ['E', 'F'], ['F', 'G'], ['G', 'A'], ['C', 'E'], ['B', 'G']];
// Neighbours of the attacker, the ones that receive forged messages
const EXPOSED = ['B', 'C', 'F', 'G'];
// UAVs whose clock label sits under them
const LABEL_BELOW = { E: true, F: true };
// Story timing in seconds and gain of the clock update, chosen to read well on screen
const ROUND_S = 1.0;
const TRAVEL_S = 0.6;
const GAIN = 0.3;
const EFFECT_S = 0.8;
// Clock shift of the forged messages, the 2 ms offset attack the policies were trained on
const FORGED_SHIFT_MS = 2.0;
// Forged SYNC that M sends to each neighbour per round, as it resends what it captures
const FORGERIES_PER_ROUND = 2;
// The group is in sync when its largest and smallest clocks are closer than this (consensus_agreement_threshold
// of the runs, the rule behind "group in sync" on the poster)
const AGREEMENT_MS = 1.0;
// Suspicions of the same neighbour needed before a UAV blocks it (VerdictAccusations of the ARCUS filter)
const VERDICT = 5;

const SCENES = [
  {
    name: 'Consensus', title: 'Local clock consensus', duration: 9,
    text: 'There is no leader and no ground station. Each UAV sends its clock (SYNC) to its neighbours and moves its own clock towards the readings it receives. The swarm converges to one common time.',
    start: { A: 1.4, B: -0.8, C: 0.6, D: -1.2, E: 0.9, F: -0.4, G: 1.1 },
  },
  {
    name: 'Attack', title: 'A man in the middle', duration: 9,
    text: 'M captures SYNC messages and resends them shifted by 2 ms, under the identity of the real sender. Messages carry no authentication, so the neighbours accept them and the consensus itself spreads the error.',
    start: { A: 0, B: 0.05, C: -0.05, D: 0, E: 0.05, F: -0.05, G: 0 },
  },
  {
    name: 'Detection', title: 'ARCUS, step 1: detection', duration: 8,
    text: 'On every UAV a small neural network judges each SYNC that arrives. A forged one is dropped before it touches the clock, and the group starts to recover.',
    start: { A: 0.5, B: 1.6, C: 1.3, D: 0.2, E: 0.4, F: 1.5, G: 1.2 },
  },
  {
    name: 'Identification', title: 'ARCUS, step 2: identification and verdict', duration: 10,
    text: 'Each drop asks a second network who forged the message. It scores every neighbour and suspects the most likely one. A UAV blocks a neighbour once it holds at least 5 suspicions of it, the first and the last at least 30 s apart, and at least 90% of all its suspicions.',
    start: { A: 0.2, B: 0.5, C: 0.4, D: 0.1, E: 0.2, F: 0.5, G: 0.4 },
  },
  {
    name: 'Result', title: 'Result', duration: 9,
    text: 'Every exposed UAV blocked M on its own, with no central node, and ignores its messages. The clocks of the group stay in sync.',
    start: { A: 0, B: 0.05, C: -0.05, D: 0, E: 0.05, F: -0.05, G: 0 },
  },
];

/**
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Creates an SVG element with its attributes and adds it to a parent.
 *
 * @param tag - element name
 * @param attributes - attribute names and values
 * @param parent - element that receives it, or null
 * @return the element
 */
function element(tag, attributes, parent) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const name in attributes) node.setAttribute(name, attributes[name]);
  if (parent) parent.appendChild(node);
  return node;
}

/**
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Mean clock of the honest UAVs.
 *
 * @param values - clock of each honest UAV in ms
 * @return the mean in ms
 */
function groupMean(values) {
  return HONEST.reduce((sum, id) => sum + values[id], 0) / HONEST.length;
}

const svg = document.getElementById('story');
const layers = {};
for (const name of ['links', 'attackerLinks', 'effects', 'messages', 'nodes']) layers[name] = element('g', {}, svg);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

for (const [a, b] of LINKS) {
  element('line', { class: 'story-link', x1: PLACES[a][0], y1: PLACES[a][1], x2: PLACES[b][0], y2: PLACES[b][1] }, layers.links);
}

const attackerLinks = {};
const blockMarks = {};
for (const id of EXPOSED) {
  const [x, y] = PLACES[id];
  attackerLinks[id] = element('line', { class: 'story-attacker-link', x1: x, y1: y, x2: ATTACKER_PLACE[0], y2: ATTACKER_PLACE[1] }, layers.attackerLinks);
  const mark = element('g', { transform: `translate(${(x + ATTACKER_PLACE[0]) / 2} ${(y + ATTACKER_PLACE[1]) / 2})`, opacity: 0 }, layers.attackerLinks);
  element('circle', { class: 'story-block-mark', r: 13 }, mark);
  element('line', { class: 'story-block-slash', x1: -9, y1: 9, x2: 9, y2: -9 }, mark);
  blockMarks[id] = mark;
}

const views = {};
HONEST.forEach((id, index) => {
  const [x, y] = PLACES[id];
  const group = element('g', { transform: `translate(${x} ${y})` }, layers.nodes);
  element('image', { href: ICONS[index % 2], x: -ICON_SIZE / 2, y: -ICON_SIZE / 2, width: ICON_SIZE, height: ICON_SIZE }, group);
  element('text', { class: 'story-name', x: ICON_SIZE / 2 + 4, y: ICON_SIZE / 2 - 4 }, group).textContent = id;
  const badge = element('g', { class: 'story-badge', transform: `translate(0 ${LABEL_BELOW[id] ? 64 : -62})` }, group);
  const rect = element('rect', { x: -60, y: -19, width: 120, height: 38, rx: 19 }, badge);
  const text = element('text', { x: 0, y: 8 }, badge);
  const count = element('text', { class: 'story-count', x: 0, y: LABEL_BELOW[id] ? -46 : 58, opacity: 0 }, group);
  const shield = element('g', { transform: 'translate(-48 0)', opacity: 0 }, group);
  element('path', { class: 'story-shield', d: 'M0 -13 L11 -9 L11 0 Q11 9 0 14 Q-11 9 -11 0 L-11 -9 Z' }, shield);
  element('path', { class: 'story-shield-check', d: 'M-5 0 L-1 4 L6 -4' }, shield);
  views[id] = { rect, text, count, shield };
});

const groupLabel = element('g', { class: 'story-group', transform: 'translate(6 474)' }, layers.nodes);
const groupRect = element('rect', { x: 0, y: -20, width: 214, height: 36, rx: 18 }, groupLabel);
const groupText = element('text', { x: 107, y: 5 }, groupLabel);

const attackerGroup = element('g', { transform: `translate(${ATTACKER_PLACE[0]} ${ATTACKER_PLACE[1]})` }, layers.nodes);
element('image', { href: ATTACKER_ICON, x: -ICON_SIZE / 2, y: -ICON_SIZE / 2, width: ICON_SIZE, height: ICON_SIZE }, attackerGroup);
element('text', { class: 'story-attacker-name', x: ICON_SIZE / 2 + 2, y: 8 }, attackerGroup).textContent = 'M';

const ui = {
  steps: document.getElementById('story-steps'),
  title: document.getElementById('story-title'),
  text: document.getElementById('story-text'),
  caption: document.getElementById('story-caption'),
  play: document.getElementById('story-play'),
};

const story = {
  scene: 0, time: 0, playing: !reduceMotion, visible: true, last: null,
  clock: {}, shown: {}, counts: {}, blocked: {}, messages: [], effects: [], nextRound: 0,
};

/**
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Moves the story to the start of a step.
 *
 * @param index - step to show
 * @param manual - true when the visitor chose the step, so screen readers announce it
 */
function enter(index, manual = false) {
  Object.assign(story, { scene: index, time: 0, nextRound: 0.2, messages: [], effects: [] });
  story.clock = { ...SCENES[index].start };
  story.shown = { ...story.clock };
  story.counts = Object.fromEntries(EXPOSED.map((id) => [id, index === 4 ? VERDICT : 0]));
  story.blocked = Object.fromEntries(EXPOSED.map((id) => [id, index === 4]));
  layers.messages.replaceChildren();
  layers.effects.replaceChildren();
  ui.title.textContent = SCENES[index].title;
  ui.text.textContent = SCENES[index].text;
  ui.caption.setAttribute('aria-live', manual ? 'polite' : 'off');
  stepButtons.forEach((button, i) => {
    if (i === index) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
    button.querySelector('i').style.width = i < index ? '100%' : '0';
  });
  drawStatic();
  if (reduceMotion) settle();
  draw();
}

/**
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Runs the step silently until it settles and clears the messages in flight, for visitors who
 * asked for reduced motion.
 */
function settle() {
  const end = SCENES[story.scene].duration - 0.5;
  while (story.time < end) stepStory(0.05);
  for (const message of story.messages) if (message.node) message.node.remove();
  story.messages = [];
}

/**
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Sends one round of honest SYNC on every link and, during the attack steps, the forged ones.
 */
function sendRound() {
  for (const [a, b] of LINKS) {
    for (const [from, to] of [[a, b], [b, a]]) {
      story.messages.push({ from: PLACES[from], to, value: story.clock[from], forged: false, start: story.time + Math.random() * 0.3, node: null });
    }
  }
  if (story.scene < 1 || story.scene > 3) return;
  for (const to of EXPOSED) {
    if (story.blocked[to]) continue;
    for (let k = 0; k < FORGERIES_PER_ROUND; k++) {
      // A captured SYNC of a random honest UAV, resent with its clock shifted
      const victim = HONEST[Math.floor(Math.random() * HONEST.length)];
      story.messages.push({ from: ATTACKER_PLACE, to, value: story.clock[victim] + FORGED_SHIFT_MS, forged: true,
        start: story.time + 0.15 + Math.random() * 0.6, node: null });
    }
  }
}

/**
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Applies a message that reached its UAV: it moves the clock, or ARCUS drops it and may suspect M.
 *
 * @param message - the message that arrived
 */
function arrive(message) {
  const to = message.to;
  if (!message.forged || story.scene === 1) {
    story.clock[to] += GAIN * (message.value - story.clock[to]);
    return;
  }
  story.effects.push({ kind: 'drop', at: to, start: story.time, node: null });
  if (story.scene === 3) {
    story.counts[to] += 1;
    story.effects.push({ kind: 'suspect', at: to, start: story.time, node: null });
    if (story.counts[to] >= VERDICT) story.blocked[to] = true;
  }
}

/**
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Draws what changes only with the step: M, its links, the counts and the blocks.
 */
function drawStatic() {
  const scene = story.scene;
  attackerGroup.style.opacity = scene === 0 ? 0 : (EXPOSED.every((id) => story.blocked[id]) ? 0.35 : 1);
  for (const id of EXPOSED) {
    attackerLinks[id].style.opacity = scene === 0 ? 0 : (story.blocked[id] ? 0.15 : 0.55);
    blockMarks[id].setAttribute('opacity', story.blocked[id] ? 1 : 0);
    views[id].shield.setAttribute('opacity', story.blocked[id] ? 1 : 0);
    views[id].count.setAttribute('opacity', scene >= 3 ? 1 : 0);
    views[id].count.textContent = `${Math.min(story.counts[id], VERDICT)}/${VERDICT}`;
  }
}

/**
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Draws one frame: the clock labels, the spread of the group, the messages in flight and the drop and
 * suspicion marks.
 *
 * @note Each label shows how far the clock of a UAV is from the mean of the group. Every label turns red when
 * the largest and the smallest clocks of the group are 1 ms or more apart.
 */
function draw() {
  for (const id of HONEST) story.shown[id] += (story.clock[id] - story.shown[id]) * 0.15;
  const mean = groupMean(story.shown);
  const values = HONEST.map((id) => story.shown[id]);
  const spread = Math.max(...values) - Math.min(...values);
  const inSync = spread < AGREEMENT_MS;
  groupRect.classList.toggle('off', !inSync);
  groupText.classList.toggle('off', !inSync);
  groupText.textContent = `group spread ${spread.toFixed(1)} ms`;
  for (const id of HONEST) {
    const error = story.shown[id] - mean;
    views[id].rect.classList.toggle('off', !inSync);
    views[id].text.classList.toggle('off', !inSync);
    const size = Math.abs(error).toFixed(1);
    views[id].text.textContent = size === '0.0' ? '0.0 ms' : `${error > 0 ? '+' : '−'}${size} ms`;
  }
  for (const message of story.messages) {
    const progress = (story.time - message.start) / TRAVEL_S;
    if (progress < 0) continue;
    if (!message.node) {
      message.node = element('circle', { class: message.forged ? 'story-forged' : 'story-sync', r: message.forged ? 8 : 5 }, layers.messages);
    }
    const share = Math.min(progress, 1);
    const [x0, y0] = message.from;
    const [x1, y1] = PLACES[message.to];
    message.node.setAttribute('cx', x0 + (x1 - x0) * share);
    message.node.setAttribute('cy', y0 + (y1 - y0) * share);
  }
  for (const effect of story.effects) {
    const age = story.time - effect.start;
    if (!effect.node) drawEffect(effect);
    if (effect.ring) effect.ring.setAttribute('r', 34 + age * 30);
    effect.node.setAttribute('opacity', Math.max(0, 1 - age / EFFECT_S));
  }
}

/**
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Creates the mark of a drop (a ring and a cross) or of a suspicion (a dashed line to M).
 *
 * @param effect - the drop or suspicion to draw
 */
function drawEffect(effect) {
  const [x, y] = PLACES[effect.at];
  effect.node = element('g', {}, layers.effects);
  if (effect.kind === 'drop') {
    effect.ring = element('circle', { class: 'story-ring', cx: x, cy: y, r: 34 }, effect.node);
    element('line', { class: 'story-cross', x1: x - 9, y1: y - 48, x2: x + 9, y2: y - 30 }, effect.node);
    element('line', { class: 'story-cross', x1: x + 9, y1: y - 48, x2: x - 9, y2: y - 30 }, effect.node);
  } else {
    element('path', { class: 'story-suspect', d: `M${x} ${y} L${ATTACKER_PLACE[0]} ${ATTACKER_PLACE[1]}` }, effect.node);
  }
}

/**
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Advances the story by a time step and moves to the next step at the end of the current one.
 *
 * @param step - time step in seconds
 */
function advance(step) {
  stepStory(step);
  draw();
  const scene = SCENES[story.scene];
  stepButtons[story.scene].querySelector('i').style.width = `${Math.min(100, (story.time / scene.duration) * 100)}%`;
  if (story.time >= scene.duration) enter((story.scene + 1) % SCENES.length);
}

/**
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Moves the messages, applies the ones that arrived and removes the old marks, without drawing.
 *
 * @param step - time step in seconds
 */
function stepStory(step) {
  story.time += step;
  while (story.time >= story.nextRound) {
    sendRound();
    story.nextRound += ROUND_S;
  }
  let changed = false;
  story.messages = story.messages.filter((message) => {
    if (story.time - message.start < TRAVEL_S) return true;
    if (message.node) message.node.remove();
    const wasBlocked = story.blocked[message.to];
    arrive(message);
    if (story.blocked[message.to] !== wasBlocked || message.forged) changed = true;
    return false;
  });
  story.effects = story.effects.filter((effect) => {
    if (story.time - effect.start < EFFECT_S) return true;
    if (effect.node) effect.node.remove();
    return false;
  });
  if (changed) drawStatic();
}

/**
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Animation loop, paused while the story is out of the screen.
 *
 * @param now - time of the frame in ms
 */
function frame(now) {
  requestAnimationFrame(frame);
  const step = story.last === null ? 0 : Math.min(0.25, (now - story.last) / 1000);
  story.last = now;
  if (story.playing && story.visible) advance(step);
}

/**
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Shows Pause or Play on the button.
 */
function showPlayState() {
  ui.play.textContent = story.playing ? 'Pause' : 'Play';
}

/**
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Pauses or resumes the story and updates the button.
 */
function togglePlay() {
  story.playing = !story.playing;
  showPlayState();
}

/**
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Goes to the previous step.
 */
function previousStep() {
  enter((story.scene + SCENES.length - 1) % SCENES.length, true);
}

/**
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Goes to the next step.
 */
function nextStep() {
  enter((story.scene + 1) % SCENES.length, true);
}

/**
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Builds the button of one step, with its progress bar.
 *
 * @param scene - the step
 * @param index - its position
 * @return the button
 */
function stepButton(scene, index) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'story-step';
  button.innerHTML = `<span class="bar"><i></i></span><span>${index + 1}. ${scene.name}</span>`;
  button.addEventListener('click', () => enter(index, true));
  ui.steps.appendChild(button);
  return button;
}

/**
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Keeps the story running only while it is on the screen.
 *
 * @param entries - visibility change of the story
 */
function watchVisibility(entries) {
  story.visible = entries[0].isIntersecting;
}

const stepButtons = SCENES.map(stepButton);
ui.play.addEventListener('click', togglePlay);
document.getElementById('story-prev').addEventListener('click', previousStep);
document.getElementById('story-next').addEventListener('click', nextStep);
new IntersectionObserver(watchVisibility).observe(svg);

enter(0);
showPlayState();
requestAnimationFrame(frame);
