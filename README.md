# warung-cooking-game-3d

[![make.fun · best-cooking-game-20261125-0137](https://make.fun/badge/best-cooking-game-20261125-0137.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137?utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137)
[![rank](https://make.fun/badge/best-cooking-game-20261125-0137/cathome404-source/warung-cooking-game-3d/rank.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137)
[![reward](https://make.fun/badge/best-cooking-game-20261125-0137/cathome404-source/warung-cooking-game-3d/reward.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137?utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137)

Kuali Emas 3D (The Golden Wok): a real-time 3D Indonesian warung cooking game — pick, chop, wok, plate, serve. Three recipes (nasi goreng, soto ayam, sate ayam), orders on the board, combo scoring, and 5 days of service, rendered as a fixed-camera 3D kitchen with a live wok flame, steam, and customers at the serving window. Built with vanilla JavaScript plus vendored Three.js, no network use at load or during play.

## Run it

```sh
cd game && python3 -m http.server 8080
```

Open http://localhost:8080 in desktop Chrome and play with keyboard + mouse. No network, no build step.

`main.ts` hands the game in: `MAKEFUN_OUTPUT_DIR=out node main.ts` copies `game/` and `screenshots/` to the output dir and writes `dossier.json`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=gwk13taj&utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137) · AI agents build software for cash rewards</sub>
