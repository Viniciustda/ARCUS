/**
 * @file replay-data.js
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Loads the files written by tools/build_replay_data.py and answers questions about the run at a time.
 */

// Receiver code of a message sent to every neighbour
export const BROADCAST = 255;
const DECIMETRES_PER_METRE = 10;

/**
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Downloads meta.json, positions.bin and messages.bin.
 *
 * @param folder - folder that holds the three files
 * @return the run, with its meta data, positions and message arrays
 */
export async function loadRun(folder) {
  const [meta, positionsBuffer, messagesBuffer] = await Promise.all([
    fetch(`${folder}/meta.json`).then((r) => r.json()),
    fetch(`${folder}/positions.bin`).then((r) => r.arrayBuffer()),
    fetch(`${folder}/messages.bin`).then((r) => r.arrayBuffer()),
  ]);
  const count = meta.message_count;
  return {
    meta,
    positions: new Int16Array(positionsBuffer),
    times: new Uint32Array(messagesBuffer, 0, count),
    senders: new Uint8Array(messagesBuffer, 4 * count, count),
    receivers: new Uint8Array(messagesBuffer, 5 * count, count),
    forged: new Uint8Array(messagesBuffer, 6 * count, count),
  };
}

/**
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Position of a node at a time, interpolated between the samples taken every second.
 *
 * @param run - the loaded run
 * @param node - node id
 * @param timeS - simulation time in seconds
 * @param out - array that receives x, y, z in metres
 * @return out
 */
export function positionAt(run, node, timeS, out) {
  const { nodes, duration_s: duration } = run.meta;
  const clamped = Math.min(Math.max(timeS, 0), duration);
  const second = Math.min(Math.floor(clamped), duration - 1);
  const weight = clamped - second;
  const a = (second * nodes + node) * 3;
  const b = a + nodes * 3;
  for (let axis = 0; axis < 3; axis++) {
    const p = run.positions;
    out[axis] = (p[a + axis] + (p[b + axis] - p[a + axis]) * weight) / DECIMETRES_PER_METRE;
  }
  return out;
}

/**
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Index of the first message sent at or after a time, by binary search.
 *
 * @param run - the loaded run
 * @param timeMs - simulation time in milliseconds
 * @return the index, or the message count when every message is earlier
 */
export function firstMessageFrom(run, timeMs) {
  let low = 0;
  let high = run.times.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (run.times[middle] < timeMs) low = middle + 1;
    else high = middle;
  }
  return low;
}

/**
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Number of nodes that blocked the attacker by a time.
 *
 * @param run - the loaded run
 * @param timeMs - simulation time in milliseconds
 * @return the count
 */
export function blockedCount(run, timeMs) {
  let count = 0;
  for (const [time] of run.meta.blocks) if (time <= timeMs) count++;
  return count;
}
