/**
 * @file replay.js
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief 3D replay of one ns-3 run: the UAVs fly, change colour when they block the attacker, and show their
 * messages when the camera is close. The visitor orbits, zooms, changes the speed and follows the attacker.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadRun, positionAt, blockedCount, firstMessageFrom } from './replay-data.js';
import { buildDrone, buildHeightMarks } from './drone-model.js';
import { MessagePulses } from './message-pulses.js';
import { isDark } from './theme.js';
import { createSpeedSlider } from './speed-slider.js';
import { ReplaySound } from './replay-sound.js';

const DATA_FOLDER = 'data';
// Camera distance under which the messages appear and the replay drops to 1x, in metres
const NEAR_DISTANCE_M = 650;
// Senders farther than this from the point the camera looks at are not drawn, in metres
const FOCUS_RADIUS_M = 450;
// Camera distance when the visitor starts following the attacker, in metres
const FOLLOW_DISTANCE_M = 320;
// Initial view: seen from the corner of the area, 35 degrees above the ground
const VIEW_ELEVATION = THREE.MathUtils.degToRad(35);
const VIEW_DISTANCE_M = 2100;
// Speed when the page opens
const START_SPEED = 20;
// Distance the visitor must drag the view away from the attacker to stop following it, in metres
const FOLLOW_BREAK_M = 40;
// Camera distances between which the rotor hum goes from loud to soft, in metres
const HUM_NEAR_M = 150;
const HUM_FAR_M = 1600;
// A press on the replay counts as a tap, not a drag, when it moves less than this and ends sooner, in px and ms
const TAP_MOVE_PX = 8;
const TAP_TIME_MS = 350;
// Share of the stage that must be on screen for the replay to draw and sound
const VISIBLE_SHARE = 0.2;
// Frame step cap, so a hidden tab does not jump the replay forward
const MAX_FRAME_S = 0.1;

const canvas = document.getElementById('replay');
const stage = document.getElementById('stage');
const ui = {
  loading: document.getElementById('stage-loading'),
  clock: document.getElementById('clock'),
  blocked: document.getElementById('blocked'),
  play: document.getElementById('play'),
  start: document.getElementById('start'),
  sound: document.getElementById('sound'),
  restart: document.getElementById('restart'),
  follow: document.getElementById('follow'),
  reset: document.getElementById('reset'),
  note: document.getElementById('speed-note'),
};

/**
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Reads a colour of the current theme from the CSS variables.
 *
 * @param name - CSS variable name, without the leading dashes
 * @return the colour
 */
function themeColour(name) {
  return new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim());
}

/**
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Converts an ns-3 position (x east, y north, z up) to the scene, centred on the area.
 *
 * @param p - ns-3 position in metres
 * @param centre - centre of the area in ns-3 coordinates
 * @param out - vector that receives the scene position
 * @return out
 */
function toScene(p, centre, out) {
  return out.set(p[0] - centre[0], p[2], -(p[1] - centre[1]));
}

/**
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Builds the ground of the area with a grid every 100 m.
 *
 * @param side - side of the area in metres
 * @return the ground group and its two materials, recoloured with the theme
 */
function buildGround(side) {
  const group = new THREE.Group();
  const planeMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.5 });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(side, side), planeMaterial);
  plane.rotation.x = -Math.PI / 2;
  const grid = new THREE.GridHelper(side, side / 100);
  grid.material.transparent = true;
  grid.material.opacity = 0.6;
  group.add(plane, grid);
  return { group, planeMaterial, gridMaterial: grid.material };
}

/**
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Loads the run, builds the scene and starts the replay loop.
 */
async function start() {
  const run = await loadRun(DATA_FOLDER);
  const { nodes, attacker, duration_s: duration, bounds_m: bounds } = run.meta;
  const centre = [(bounds[0] + bounds[1]) / 2, (bounds[2] + bounds[3]) / 2];
  const side = bounds[1] - bounds[0];

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 5, 20000);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(-600, 1500, 900);
  scene.add(sun);

  const ground = buildGround(side);
  scene.add(ground.group);

  const materials = {
    honest: new THREE.MeshStandardMaterial({ roughness: 0.6 }),
    attacker: new THREE.MeshStandardMaterial({ roughness: 0.6 }),
    blocked: new THREE.MeshStandardMaterial({ roughness: 0.6 }),
    height: new THREE.LineBasicMaterial({ transparent: true, opacity: 0.25 }),
    shadow: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.12 }),
  };
  const messageColours = { honest: new THREE.Color(), forged: new THREE.Color() };

  const drones = [];
  const nodeScene = [];
  const raw = [0, 0, 0];
  for (let node = 0; node < nodes; node++) {
    const { drone, coloured } = buildDrone(node === attacker ? materials.attacker : materials.honest);
    const marks = buildHeightMarks(materials.height, materials.shadow);
    scene.add(drone, marks.line, marks.shadow);
    drones.push({ drone, coloured, blocked: false, ...marks });
    nodeScene.push(new THREE.Vector3());
  }
  const blockTime = new Map(run.meta.blocks.map(([time, node]) => [node, time]));
  const pulses = new MessagePulses(scene, messageColours);

  /**
   * @author Vinicius Trindade
   * @date Nov 19, 2026
   *
   * @brief Recolours the scene with the current theme.
   */
  function applyTheme() {
    scene.background = themeColour('stage');
    ground.planeMaterial.color = themeColour('surface');
    ground.gridMaterial.color = themeColour('line');
    materials.honest.color = new THREE.Color(isDark() ? 0xd8dde6 : 0x1b1b1b);
    materials.attacker.color = themeColour('red');
    materials.blocked.color = themeColour('blue');
    materials.height.color = themeColour('muted');
    materials.shadow.color = themeColour('muted');
    messageColours.honest.copy(themeColour('muted'));
    messageColours.forged.copy(themeColour('red'));
  }
  applyTheme();
  window.addEventListener('themechange', applyTheme);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.maxPolarAngle = THREE.MathUtils.degToRad(88);
  controls.minDistance = 40;
  controls.maxDistance = 4500;

  /**
   * @author Vinicius Trindade
   * @date Nov 19, 2026
   *
   * @brief Puts the camera back on the initial view, seen from the corner of the area.
   */
  function resetView() {
    const horizontal = VIEW_DISTANCE_M * Math.cos(VIEW_ELEVATION);
    camera.position.set(-horizontal / Math.SQRT2, VIEW_DISTANCE_M * Math.sin(VIEW_ELEVATION), horizontal / Math.SQRT2);
    controls.target.set(0, 0, 0);
    controls.update();
  }
  resetView();

  /**
   * @author Vinicius Trindade
   * @date Nov 19, 2026
   *
   * @brief Fits the renderer and the camera to the size of the stage and to the pixel density of the screen.
   */
  function resize() {
    const { clientWidth: width, clientHeight: height } = stage;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage);
  window.addEventListener('resize', resize);
  resize();

  const state = { timeS: 0, speed: START_SPEED, playing: false, started: false, following: false, visible: true };
  const sound = new ReplaySound();

  /**
   * @author Vinicius Trindade
   * @date Nov 19, 2026
   *
   * @brief Sets the speed chosen on the slider.
   *
   * @param speed - speed from 1x to 100x
   */
  function setSpeed(speed) {
    state.speed = speed;
  }

  /**
   * @author Vinicius Trindade
   * @date Nov 19, 2026
   *
   * @brief Pauses or resumes the replay.
   */
  function togglePlay() {
    if (!state.started) {
      startReplay();
      return;
    }
    state.playing = !state.playing;
    showPlayState();
  }

  /**
   * @author Vinicius Trindade
   * @date Nov 19, 2026
   *
   * @brief Shows Play or Pause on the button.
   */
  function showPlayState() {
    ui.play.classList.toggle('paused', !state.playing);
    ui.play.setAttribute('aria-label', state.playing ? 'Pause' : 'Play');
  }

  /**
   * @author Vinicius Trindade
   * @date Nov 19, 2026
   *
   * @brief Starts the replay and its sound with the first tap, as browsers only allow sound after one.
   */
  function startReplay() {
    sound.start();
    state.started = true;
    state.playing = true;
    ui.start.hidden = true;
    showPlayState();
  }

  /**
   * @author Vinicius Trindade
   * @date Nov 19, 2026
   *
   * @brief Turns the sound of the replay on or off.
   */
  function toggleSound() {
    const muted = ui.sound.getAttribute('aria-pressed') !== 'true';
    ui.sound.setAttribute('aria-pressed', String(muted));
    ui.sound.setAttribute('aria-label', muted ? 'Turn the sound on' : 'Mute');
    sound.setMuted(muted);
  }

  /**
   * @author Vinicius Trindade
   * @date Nov 19, 2026
   *
   * @brief Starts the simulation again from 0 s.
   */
  function restart() {
    state.timeS = 0;
    lastSoundMs = 0;
    pulses.clear();
  }

  /**
   * @author Vinicius Trindade
   * @date Nov 19, 2026
   *
   * @brief Plays the sound of the messages sent since the last frame by UAVs close to the camera.
   *
   * @param fromMs - simulation time of the last frame in milliseconds
   * @param toMs - simulation time of this frame in milliseconds
   */
  function soundMessages(fromMs, toMs) {
    const radiusSquared = FOCUS_RADIUS_M * FOCUS_RADIUS_M;
    const end = firstMessageFrom(run, toMs);
    for (let i = firstMessageFrom(run, fromMs); i < end; i++) {
      if (nodeScene[run.senders[i]].distanceToSquared(controls.target) > radiusSquared) continue;
      if (run.forged[i]) sound.forgedMessage();
      else sound.honestMessage();
    }
  }

  /**
   * @author Vinicius Trindade
   * @date Nov 19, 2026
   *
   * @brief Stops following the attacker and releases the button.
   */
  function stopFollowing() {
    state.following = false;
    ui.follow.setAttribute('aria-pressed', 'false');
  }

  /**
   * @author Vinicius Trindade
   * @date Nov 19, 2026
   *
   * @brief Starts or stops following the attacker, bringing the camera close to it when starting.
   */
  function toggleFollow() {
    state.following = !state.following;
    ui.follow.setAttribute('aria-pressed', String(state.following));
    if (state.following) {
      const offset = camera.position.clone().sub(controls.target).setLength(FOLLOW_DISTANCE_M);
      controls.target.copy(nodeScene[attacker]);
      camera.position.copy(nodeScene[attacker]).add(offset);
    }
  }

  /**
   * @author Vinicius Trindade
   * @date Nov 19, 2026
   *
   * @brief Stops following and goes back to the initial view.
   */
  function resetAll() {
    stopFollowing();
    resetView();
  }

  /**
   * @author Vinicius Trindade
   * @date Nov 19, 2026
   *
   * @brief Pauses the drawing and the sound when most of the stage leaves the screen, as when the visitor
   * moves to another section.
   *
   * @param entries - visibility change of the stage
   */
  function watchVisibility(entries) {
    state.visible = entries[0].intersectionRatio >= VISIBLE_SHARE;
  }

  const speedTrack = createSpeedSlider(START_SPEED, setSpeed);
  const press = { x: 0, y: 0, time: 0, pointers: 0 };

  /**
   * @author Vinicius Trindade
   * @date Nov 19, 2026
   *
   * @brief Notes where and when a press on the replay began.
   *
   * @param event - pointer pressed on the canvas
   */
  function pressStart(event) {
    press.pointers += 1;
    Object.assign(press, { x: event.clientX, y: event.clientY, time: event.timeStamp });
  }

  /**
   * @author Vinicius Trindade
   * @date Nov 19, 2026
   *
   * @brief Pauses or resumes the replay when a press was a short tap with one finger, and not a drag or a pinch.
   *
   * @param event - pointer released on the canvas
   */
  function pressEnd(event) {
    const single = press.pointers === 1;
    press.pointers = Math.max(0, press.pointers - 1);
    const moved = Math.hypot(event.clientX - press.x, event.clientY - press.y);
    if (single && moved < TAP_MOVE_PX && event.timeStamp - press.time < TAP_TIME_MS) togglePlay();
  }

  /**
   * @author Vinicius Trindade
   * @date Nov 19, 2026
   *
   * @brief Forgets the presses when the browser takes over the gesture.
   */
  function pressCancel() {
    press.pointers = 0;
  }

  canvas.addEventListener('pointerdown', pressStart);
  canvas.addEventListener('pointerup', pressEnd);
  canvas.addEventListener('pointercancel', pressCancel);
  ui.play.addEventListener('click', togglePlay);
  ui.start.addEventListener('click', startReplay);
  ui.sound.addEventListener('click', toggleSound);
  ui.restart.addEventListener('click', restart);
  ui.follow.addEventListener('click', toggleFollow);
  ui.reset.addEventListener('click', resetAll);
  new IntersectionObserver(watchVisibility, { threshold: [0, VISIBLE_SHARE, 1] }).observe(stage);

  const clock = new THREE.Clock();
  const previousAttacker = new THREE.Vector3();
  const shift = new THREE.Vector3();
  const shown = { second: -1, speed: -1, blocked: -1, note: '' };
  let lastSoundMs = 0;
  ui.loading.hidden = true;
  ui.start.hidden = false;

  /**
   * @author Vinicius Trindade
   * @date Nov 19, 2026
   *
   * @brief Writes the time, the speed, the blocked count and the note, only when they change.
   *
   * @param speed - speed in use
   * @param slowed - whether the replay was slowed down to show the messages
   * @param timeMs - simulation time in milliseconds
   */
  function updateText(speed, slowed, timeMs) {
    const second = Math.floor(state.timeS);
    if (second !== shown.second || speed !== shown.speed) {
      ui.clock.textContent = `t = ${second} s of ${duration} s · ${speed}×`;
      shown.second = second;
      shown.speed = speed;
    }
    const blocked = blockedCount(run, timeMs);
    if (blocked !== shown.blocked) {
      ui.blocked.textContent = `${blocked} of ${nodes - 1} UAVs blocked the attacker`;
      shown.blocked = blocked;
    }
    let note = 'Zoom in on a UAV to see the messages. The replay slows down near the UAVs.';
    if (slowed) {
      note = state.following ? 'Slowed down to 1× to show the messages. Stop following to speed up again.'
        : 'Slowed down to 1× to show the messages. Zoom out to speed up again.';
    }
    if (note !== shown.note) {
      ui.note.textContent = note;
      speedTrack.classList.toggle('slowed', slowed);
      shown.note = note;
    }
  }

  /**
   * @author Vinicius Trindade
   * @date Nov 19, 2026
   *
   * @brief Advances the replay, places every UAV and draws one frame.
   */
  function frame() {
    requestAnimationFrame(frame);
    const step = Math.min(clock.getDelta(), MAX_FRAME_S);
    sound.setActive(state.visible && state.playing && !document.hidden);
    if (!state.visible) return;
    const near = camera.position.distanceTo(controls.target) < NEAR_DISTANCE_M;
    const slowed = (near || state.following) && state.speed > 1;
    const speed = slowed ? 1 : state.speed;
    if (state.playing) state.timeS = (state.timeS + step * speed) % duration;
    const timeMs = state.timeS * 1000;

    for (let node = 0; node < nodes; node++) {
      const p = toScene(positionAt(run, node, state.timeS, raw), centre, nodeScene[node]);
      const uav = drones[node];
      uav.drone.position.copy(p);
      uav.line.position.set(p.x, 0, p.z);
      uav.line.scale.y = p.y;
      uav.shadow.position.set(p.x, 0.5, p.z);
      const blocked = node !== attacker && blockTime.has(node) && blockTime.get(node) <= timeMs;
      if (blocked !== uav.blocked) {
        for (const mesh of uav.coloured) mesh.material = blocked ? materials.blocked : materials.honest;
        if (blocked && state.playing) sound.block();
        uav.blocked = blocked;
      }
    }

    if (state.following) {
      shift.subVectors(nodeScene[attacker], previousAttacker);
      controls.target.add(shift);
      camera.position.add(shift);
      // Dragging the view to another place ends the follow mode
      if (controls.target.distanceTo(nodeScene[attacker]) > FOLLOW_BREAK_M) stopFollowing();
    }
    previousAttacker.copy(nodeScene[attacker]);

    if (near || state.following) pulses.update(run, timeMs, nodeScene, controls.target, FOCUS_RADIUS_M);
    else pulses.clear();
    const distance = camera.position.distanceTo(controls.target);
    sound.setCloseness(THREE.MathUtils.clamp((HUM_FAR_M - distance) / (HUM_FAR_M - HUM_NEAR_M), 0, 1));
    if ((near || state.following) && state.playing && timeMs > lastSoundMs) soundMessages(lastSoundMs, timeMs);
    lastSoundMs = timeMs;
    updateText(speed, slowed, timeMs);

    controls.update();
    renderer.render(scene, camera);
  }
  frame();
}

start().catch(() => {
  ui.loading.textContent = 'The simulation could not be loaded.';
});
