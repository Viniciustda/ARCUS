/**
 * @file message-pulses.js
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Draws the SYNC messages near the camera as dots that travel from the sender to each receiver.
 */

import * as THREE from 'three';
import { BROADCAST, firstMessageFrom } from './replay-data.js';

// Simulation time a message takes to cross from sender to receiver on screen
const PULSE_MS = 400;
// Upper bound on the dots drawn in one frame
const MAX_PULSES = 3000;

/**
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief A white disc texture, so every message dot is drawn round.
 *
 * @return the texture
 */
function discTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.beginPath();
  context.arc(size / 2, size / 2, size / 2 - 2, 0, 2 * Math.PI);
  context.fill();
  return new THREE.CanvasTexture(canvas);
}

/**
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief The dots and faint lines of the messages in flight, rebuilt every frame.
 */
export class MessagePulses {
  /**
   * @author Vinicius Trindade
   * @date Nov 19, 2026
   *
   * @brief Creates the buffers and adds the dots and lines to the scene.
   *
   * @param scene - scene that shows the replay
   * @param colours - colours of honest and forged messages, as THREE.Color
   */
  constructor(scene, colours) {
    this.colours = colours;
    this.dotPositions = new Float32Array(MAX_PULSES * 3);
    this.dotColours = new Float32Array(MAX_PULSES * 3);
    this.linePositions = new Float32Array(MAX_PULSES * 6);
    this.lineColours = new Float32Array(MAX_PULSES * 6);
    const dotGeometry = new THREE.BufferGeometry();
    dotGeometry.setAttribute('position', new THREE.BufferAttribute(this.dotPositions, 3).setUsage(THREE.DynamicDrawUsage));
    dotGeometry.setAttribute('color', new THREE.BufferAttribute(this.dotColours, 3).setUsage(THREE.DynamicDrawUsage));
    this.dots = new THREE.Points(dotGeometry, new THREE.PointsMaterial({ size: 8, sizeAttenuation: false, vertexColors: true, map: discTexture(), alphaTest: 0.5 }));
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(this.linePositions, 3).setUsage(THREE.DynamicDrawUsage));
    lineGeometry.setAttribute('color', new THREE.BufferAttribute(this.lineColours, 3).setUsage(THREE.DynamicDrawUsage));
    this.lines = new THREE.LineSegments(lineGeometry, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.35 }));
    this.dots.frustumCulled = false;
    this.lines.frustumCulled = false;
    this.attributes = [dotGeometry.attributes.position, dotGeometry.attributes.color,
      lineGeometry.attributes.position, lineGeometry.attributes.color];
    scene.add(this.lines, this.dots);
    this.clear();
  }

  /**
   * @author Vinicius Trindade
   * @date Nov 19, 2026
   *
   * @brief Hides every dot and line.
   */
  clear() {
    this.dots.geometry.setDrawRange(0, 0);
    this.lines.geometry.setDrawRange(0, 0);
  }

  /**
   * @author Vinicius Trindade
   * @date Nov 19, 2026
   *
   * @brief Draws the messages in flight at a time whose sender is close to a point.
   *
   * @param run - the loaded run
   * @param timeMs - simulation time in milliseconds
   * @param nodeScene - scene position of every node at that time, as THREE.Vector3
   * @param focus - scene point the camera looks at
   * @param focusRadius - only senders closer than this to the focus are drawn, in metres
   */
  update(run, timeMs, nodeScene, focus, focusRadius) {
    const rangeSquared = run.meta.range_m * run.meta.range_m;
    const focusSquared = focusRadius * focusRadius;
    const end = firstMessageFrom(run, timeMs + 1);
    let count = 0;
    for (let i = firstMessageFrom(run, timeMs - PULSE_MS); i < end && count < MAX_PULSES; i++) {
      const sender = nodeScene[run.senders[i]];
      if (sender.distanceToSquared(focus) > focusSquared) continue;
      const progress = (timeMs - run.times[i]) / PULSE_MS;
      const colour = run.forged[i] ? this.colours.forged : this.colours.honest;
      const receiver = run.receivers[i];
      if (receiver !== BROADCAST) {
        count = this.add(count, sender, nodeScene[receiver], progress, colour);
        continue;
      }
      for (let node = 0; node < nodeScene.length && count < MAX_PULSES; node++) {
        const target = nodeScene[node];
        if (target !== sender && target.distanceToSquared(sender) <= rangeSquared) {
          count = this.add(count, sender, target, progress, colour);
        }
      }
    }
    this.dots.geometry.setDrawRange(0, count);
    this.lines.geometry.setDrawRange(0, count * 2);
    for (const attribute of this.attributes) attribute.needsUpdate = true;
  }

  /**
   * @author Vinicius Trindade
   * @date Nov 19, 2026
   *
   * @brief Writes one dot and its line into the buffers.
   *
   * @param index - slot to write
   * @param from - sender position
   * @param to - receiver position
   * @param progress - share of the way travelled, from 0 to 1
   * @param colour - colour of the message
   * @return the next free slot
   */
  add(index, from, to, progress, colour) {
    const dot = index * 3;
    const line = index * 6;
    this.dotPositions[dot] = from.x + (to.x - from.x) * progress;
    this.dotPositions[dot + 1] = from.y + (to.y - from.y) * progress;
    this.dotPositions[dot + 2] = from.z + (to.z - from.z) * progress;
    const lines = this.linePositions;
    lines[line] = from.x;
    lines[line + 1] = from.y;
    lines[line + 2] = from.z;
    lines[line + 3] = to.x;
    lines[line + 4] = to.y;
    lines[line + 5] = to.z;
    const dots = this.dotColours;
    const lineColours = this.lineColours;
    dots[dot] = lineColours[line] = lineColours[line + 3] = colour.r;
    dots[dot + 1] = lineColours[line + 1] = lineColours[line + 4] = colour.g;
    dots[dot + 2] = lineColours[line + 2] = lineColours[line + 5] = colour.b;
    return index + 1;
  }
}
