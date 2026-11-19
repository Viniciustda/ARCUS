/**
 * @file replay-sound.js
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Sounds of the 3D replay, made in the browser with Web Audio: the hum of the rotors, a tick for each
 * honest SYNC, a rough buzz for each forged SYNC and a clear note when a UAV blocks the attacker.
 */

// Loudness of the whole replay and of each sound, from 0 to 1, set by ear
const MASTER_LEVEL = 0.6;
const HUM_FAR_LEVEL = 0.05;
const HUM_NEAR_LEVEL = 0.16;
const TICK_LEVEL = 0.035;
const FORGED_LEVEL = 0.09;
const BLOCK_LEVEL = 0.11;
// Most honest message sounds in one second. Near the attacker the run sends a median of 79 SYNC per second
// and up to 163, so this keeps one tick per message
const MESSAGE_SOUNDS_PER_S = 180;
// Time the levels take to follow a change, in seconds
const GLIDE_S = 0.25;

/**
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief The sounds of the replay, silent until the visitor starts it with a tap.
 */
export class ReplaySound {
  /**
   * @author Vinicius Trindade
   * @date Nov 19, 2026
   *
   * @brief Prepares the sound, still without an audio context, since browsers only allow one after a tap.
   */
  constructor() {
    this.context = null;
    this.muted = false;
    this.active = false;
    this.messageTimes = [];
  }

  /**
   * @author Vinicius Trindade
   * @date Nov 19, 2026
   *
   * @brief Creates the audio context and the hum. Must run inside the tap that starts the replay.
   */
  start() {
    if (this.context) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    this.context = new AudioContextClass();
    this.master = this.context.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.context.destination);
    this.humGain = this.context.createGain();
    this.humGain.gain.value = HUM_FAR_LEVEL;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 260;
    filter.connect(this.humGain);
    this.humGain.connect(this.master);
    // Two close pitches beat against each other like rotors
    for (const frequency of [92, 97.5]) {
      const rotor = this.context.createOscillator();
      rotor.type = 'sawtooth';
      rotor.frequency.value = frequency;
      rotor.connect(filter);
      rotor.start();
    }
    this.active = true;
    this.applyLevel();
  }

  /**
   * @author Vinicius Trindade
   * @date Nov 19, 2026
   *
   * @brief Turns the sound on or off.
   *
   * @param muted - true to silence the replay
   */
  setMuted(muted) {
    this.muted = muted;
    this.applyLevel();
  }

  /**
   * @author Vinicius Trindade
   * @date Nov 19, 2026
   *
   * @brief Lets the sound play only while the replay is on screen and running.
   *
   * @param active - true while the replay is on screen and playing
   */
  setActive(active) {
    if (this.active === active) return;
    this.active = active;
    this.applyLevel();
  }

  /**
   * @author Vinicius Trindade
   * @date Nov 19, 2026
   *
   * @brief Fades the whole sound to its level, and suspends the audio while it is silent.
   */
  applyLevel() {
    if (!this.context) return;
    const audible = this.active && !this.muted;
    if (audible && this.context.state === 'suspended') this.context.resume();
    this.master.gain.setTargetAtTime(audible ? MASTER_LEVEL : 0, this.context.currentTime, 0.08);
  }

  /**
   * @author Vinicius Trindade
   * @date Nov 19, 2026
   *
   * @brief Sets how close the camera is to the UAVs, which makes the hum louder or softer.
   *
   * @param closeness - 0 when far from the UAVs, 1 when close
   */
  setCloseness(closeness) {
    if (!this.context) return;
    const level = HUM_FAR_LEVEL + (HUM_NEAR_LEVEL - HUM_FAR_LEVEL) * closeness;
    this.humGain.gain.setTargetAtTime(level, this.context.currentTime, GLIDE_S);
  }

  /**
   * @author Vinicius Trindade
   * @date Nov 19, 2026
   *
   * @brief Tells whether an honest message sound may play now, keeping at most MESSAGE_SOUNDS_PER_S per second.
   *
   * @return true when the sound may play
   */
  allowMessage() {
    if (!this.context || !this.active || this.muted) return false;
    const now = this.context.currentTime;
    while (this.messageTimes.length && this.messageTimes[0] < now - 1) this.messageTimes.shift();
    if (this.messageTimes.length >= MESSAGE_SOUNDS_PER_S) return false;
    this.messageTimes.push(now);
    return true;
  }

  /**
   * @author Vinicius Trindade
   * @date Nov 19, 2026
   *
   * @brief Plays one short tone that fades out.
   *
   * @param type - oscillator wave
   * @param frequency - pitch in Hz
   * @param level - loudness from 0 to 1
   * @param length - duration in seconds
   * @param cutoff - lowpass frequency in Hz
   */
  tone(type, frequency, level, length, cutoff) {
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(level, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + length);
    oscillator.connect(filter).connect(gain).connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + length + 0.05);
  }

  /**
   * @author Vinicius Trindade
   * @date Nov 19, 2026
   *
   * @brief A very short soft tick for an honest SYNC, its pitch varied a little so many ticks sound natural.
   */
  honestMessage() {
    if (this.allowMessage()) this.tone('sine', 1500 + Math.random() * 400, TICK_LEVEL, 0.025, 4000);
  }

  /**
   * @author Vinicius Trindade
   * @date Nov 19, 2026
   *
   * @brief A low rough buzz for a forged SYNC. It always plays, so no forgery on screen goes unheard.
   */
  forgedMessage() {
    if (this.context && this.active && !this.muted) this.tone('sawtooth', 150, FORGED_LEVEL, 0.12, 900);
  }

  /**
   * @author Vinicius Trindade
   * @date Nov 19, 2026
   *
   * @brief A clear bell like note when a UAV blocks the attacker.
   */
  block() {
    if (!this.context || !this.active || this.muted) return;
    this.tone('sine', 880, BLOCK_LEVEL, 0.9, 6000);
    this.tone('sine', 1320, BLOCK_LEVEL * 0.45, 0.6, 6000);
  }
}
