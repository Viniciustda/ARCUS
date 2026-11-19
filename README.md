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
| `README.md` | This file. |

## How to run

The page is served by GitHub Pages at <https://viniciustda.github.io/ARCUS/>.

To open it locally, serve the repository root with any static server and open the address it prints,
for example:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.
