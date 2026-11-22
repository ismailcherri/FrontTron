# FrontTron implementation plan

The runnable Langtron sources in this checkout are the behavioral baseline. FrontTron is a standalone, single-process game. The server simulates the original square world. Only the browser projects that world into an isometric arena.

| Phase | Work | Acceptance |
| --- | --- | --- |
| 1. Inventory and rules | Port the shared and server rules to explicit JavaScript modules. Keep movement constants, print timing, world collisions, simultaneous deaths, map sizing, scoring, and tie breaks. | A one-player game and a multiplayer game can progress through warmup, play, results, and another match. |
| 2. Multiplayer service | Serve the browser and authoritative game on one origin. Connect room discovery, generated names, passwords, activity, master succession, local players, moderation, chat history, launch countdown, and mid-round spectating. | Independent connections see the same roster, configuration, positions, effects, and scores. Guests can join a running game as spectators. |
| 3. Browser interface | Rebuild discovery, player profiles, instructions, room setup, game HUD, results, audio, and keyboard, touch, and controller mappings. Include the five bonus presets, custom selection, bonus rate, and victory score. | A player can create or join a room, configure and play a match, chat, and return to the same room. |
| 4. Isometric arena | Project trail widths, gaps, heads, directions, pickups, borderless travel, death effects, active bonuses, and Cleanageddon from server data. Use the same camera for the lobby preview and the match. | Resizing preserves geometry. Collision and steering are independent of the camera. |
| 5. Verification and hosting | Exercise the rule engine and network lifecycle, check browser flows and responsive layout, and provide Node and Docker entry points. | The fronttron directory alone contains all runtime code, assets, and installation metadata. One port serves HTTP and WebSockets. |

## Feature checklist for release checks

- **Rooms** — public list and counts, generated or custom names, public/private toggle, four-digit code, invitation links, idle-room cleanup, activity, join and spectate.
- **Players** — saved profile, local multiplayer, rename, color, control remapping, ready/unready, master transfer, immediate host kicks and player majority votes.
- **Social** — room and in-game chat with history, spectator names, local mute, system notices, tips and flood filtering.
- **Rules** — continuous curves, periodic holes, wall/self/opponent collisions, player-scaled field, scores, tie breaks and final rankings.
- **Pickups** — all 18 configured Langtron bonuses, stacking/expiry, map clears, wrapping, spawn bursts, Cleanageddon and the original presets.
- **Presentation** — pre-round direction, warmup and loading, kill feed, spectator count, FPS, latency, sound effects, touch controls, animated isometric field guide and credits.

## Verification record

| Surface | Check performed |
| --- | --- |
| Original rules | The test suite collects each of the 18 pickups through the collision system, checks its targets and behavior, and advances time for temporary effects. Separate cases exercise trail gaps, walls, wraparound, own and opponent trails, and tie breaks. |
| Scoring | The original Langtron engine and FrontTron returned identical round points, totals and winners across 633 elimination sequences with one to five riders. Their default victory targets also matched. The scoring tests cover multi-round totals, same-tick crashes, a tied lead above the target, solo scoring and shared ranks in the standings. |
| Multiplayer | Independent WebSocket clients exercise room discovery, private joins, local players, configuration, moderation, chat limits, ready and launch, steering, spectator state, scores, and rematch. |
| Browser | Played a solo match from room creation to final standings and returned to the same room. Checked the lobby at desktop and phone widths and selected touch bindings in the profile editor. Keyboard, touch, and gamepad events also run through the input adapter in an automated test. |
| Deployment | Built the production Docker image and checked the health endpoint, browser HTML, and WebSocket greeting in a disposable container. |

Physical controller hardware, public reverse-proxy deployment, and external analytics require their respective devices or endpoints for end-to-end verification.

## Computer riders

Five bot difficulties are available in solo and multiplayer rooms. The fifth, Apex, learned from round outcomes against baseline opponents and earlier versions of itself. Its release benchmark covers head-to-head play against Hard and Mimic across all five pickup presets. [AI implementation and evaluation record](docs/ai-players.md)
