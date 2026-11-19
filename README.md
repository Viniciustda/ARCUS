# ARCUS

Interactive companion page of the poster "Resilient Local Consensus in UAV Networks Against
Man-in-the-Middle Attacks with MARL" (Projeto Orientado em Computação I, DCC, UFMG).

ARCUS is a defence learned by every UAV with multi-agent reinforcement learning. It protects the local
clock consensus of a UAV network against a man-in-the-middle insider that forges synchronization
messages (SYNC). The page replays one ns-3 simulation of ARCUS in 3D, shows the steps of the attack
and of the defence, and links to a short anonymous feedback form.

## Structure

| File | What it does |
|---|---|
| `index.html` | The page, in three full screen sections: 3D replay, animated steps and feedback form. |
| `css/style.css` | Layout, section snapping, colours, the light and dark themes and the feedback card. |
| `js/theme.js` | Follows the system theme and lets the visitor switch it. |
| `js/sections.js` | Chooses how firmly the scroll stops on each section and marks the section on screen. |
| `js/replay.js` | Builds the 3D scene, plays the run and handles the camera, the start tap, play, restart, mute and the follow mode. |
| `js/fullscreen.js` | Full screen mode of the replay, with its controls and legend in a bar on top. |
| `js/replay-sound.js` | Sounds of the replay made with Web Audio: rotor hum, honest and forged SYNC, and blocks. |
| `js/speed-slider.js` | Speed slider from 1x to 100x, stopping at 10x, 20x and 60x while dragging. |
| `js/replay-data.js` | Loads the run files and gives the position of a UAV and the messages at a time. |
| `js/drone-model.js` | Builds the 3D quadcopter and the marks that show its height. |
| `js/message-pulses.js` | Draws the SYNC messages near the camera, honest in grey and forged in red. |
| `js/steps.js` | Animates the five steps (consensus, attack, detection, identification, result) on a small swarm. |
| `assets/drones/` | Drone icons of the animated steps and of the page icon. |
| `data/` | The replayed run: `meta.json`, `positions.bin` and `messages.bin`. |
| `tools/build_replay_data.py` | Converts the traces of one ns-3 run into the files in `data/`. |

The 3D scene uses [three.js](https://threejs.org) 0.160.0, loaded from a CDN. The titles use the Space Grotesk font from Google Fonts.

## How to run

The page is served by GitHub Pages at <https://viniciustda.github.io/ARCUS/>.

To open it locally, serve the repository root with any static server and open the address it prints,
for example:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

To replay another run, convert its traces (the folder holds `nodes.csv`, `positions.csv`, `tx.csv`,
`forgeries.csv`, `blocks.csv` and `config.txt`, plain or gzipped):

```bash
./tools/build_replay_data.py <run folder> data
```
