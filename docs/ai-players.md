# FrontTron computer riders

## Playing

In the ready room the host can choose **Add bot**, select a difficulty and confirm. Each room supports up to three computer riders alongside local or network players. **Edit bot** changes the difficulty or removes the rider before a match. Bots are ready immediately. Their names, colors and difficulty selections carry into rematches and follow the room when the host leaves.

| Difficulty | Driving method | What to expect |
| --- | --- | --- |
| Easy | Reactive rules | Checks ahead and to either side, turning away from the nearest obstruction. Short reaction range makes it vulnerable to pockets. |
| Normal | Short-horizon simulation | Compares nine sequences of left, straight and right steering over roughly a second. It chooses the longest safe path and uses clearance and pickups to break ties. It can steer toward a gap and straighten through it. |
| Hard | Territory and opponent search | Extends the steering horizon to 1.5 seconds. A flood fill estimates which open cells it can reach before rivals, using their observed headings. It prefers room to maneuver and can contest an opponent’s exit. |
| Mimic | Imitation learning | A local decision forest votes on the next steering input from clearance, candidate paths, visible pickups and rivals. It learned from the tactical driver. A short emergency check can override a prediction that would immediately hit a trail or wall. |
| Apex | Reinforcement learning | Looks 1.75 seconds ahead and compares the escape routes each steering input leaves open. A policy trained on round outcomes weighs clearance, pickups, and rival positions when several routes look safe. |

Mimic offers a different driving style at roughly Hard strength in the paired evaluation below. Every difficulty uses the same steering API, speed, hitbox, bonuses, collision rules and scoring as a human. The five drivers run in the game server process. The normal Node and Docker commands include the two trained models.

## Implementation phases

1. **Room integration.** The server owns bot players directly and registers their avatars for the same match broadcasts as human riders. Hosts manage bots in the ready room. Human connections retain control of hosting, votes and spectator counts. The match stops when the last human rider departs. Room discovery reports human riders and bots separately.
2. **Reactive and predictive drivers.** The drivers read the arena’s width, height and rider positions before the physics step. Both square views present the same world to the bots. On widescreen, drivers use the longer horizontal axis for wall clearance and wraparound. A spatial index contains the real trail discs and clears with the arena. Prediction uses a separate candidate trail and accounts for self-trail grace, wraparound, steering inversion, right-angle turns, speed, radius and observed shield expiry.
3. **Tactics and imitation.** Hard ranks safe routes by reachable territory. Mimic ships with a versioned model, an offline trainer and optional demonstration export. Its reaction interval, input choices and model weights remain fixed throughout a match.
4. **Evaluation and hosting.** Seeded headless rounds, collision scenarios and a multi-room WebSocket benchmark exercise the same engine as the browser. Decisions are staggered. Each room evaluates at most one driver per physics step. Live rooms share a four-millisecond decision budget per 16 ms window. A decision already in progress finishes, then other riders keep their last input until the next opportunity.
5. **Reinforcement learning.** Apex trains offline against baseline opponents and frozen versions of itself. We select its weights on validation rounds and evaluate the bundled policy against Hard and Mimic on fresh seeds.

## Imitation training

The bundled model learned from 8,521 labeled decisions by the tactical policy. The trainer generates seeded practice situations with trails, gaps, rivals and pickups. It first fits a pilot model, visits additional positions driven by that model, and asks the tactical policy to label those positions. The final seven-tree model agreed with its teacher on 72.7% of 1,478 held-out decisions. Always choosing the most frequent input scored 59.1%. These figures measure steering agreement. Paired matches measure playing strength separately.

To contribute examples of your own style, expand **Driving examples** in the ready room and enable **Record my steering** before the match. Only the primary rider on that connection is sampled. After the match, return to the room and select **Export examples**. The file contains numeric observations and steering choices. Examples are held in the browser tab, up to 10,000 per session. Saving a file and supplying it to the trainer are manual steps.

Run these commands from the FrontTron directory. The second training command mixes exported examples into the demonstration set. Each training run replaces the bundled model in the local checkout. Restart the Node server or rebuild the container to use it.

```sh
npm run bots:train
npm run bots:train -- /path/to/fronttron-driving.json
npm test
npm run bots:evaluate -- 80
npm run bots:network
```

## Reinforcement training

Apex learns ten steering weights with episodic REINFORCE. Every 140 ms it considers left, straight and right. For each input, three simulated continuations estimate how long the rider can survive over the next 1.75 seconds. The longest predicted survival time determines which inputs are eligible. The weights rank those inputs by features including open space beyond the turn, the rider’s ability to straighten, nearby pickups, and rivals’ current and projected positions. The live server takes the highest-scoring input.

Training starts with zero weights. The learner samples from its policy while driving in the real game engine. A round gives +1 for winning, −1 for losing and zero for a simultaneous elimination or a 60-second timeout. Decisions closer to the outcome get more credit. Training uses a 0.985 discount and Adam updates in batches of 64. Across 4,096 two-rider rounds, the opponents were frozen Apex policies (37.5%), Hard (25%), Mimic (25%), and Normal (12.5%). All pickups were enabled. Each starting setup was played in both seat orders.

Every 512 rounds the trainer evaluated a checkpoint on the same 64 separate validation seeds, in both seats against each opponent. It selected the checkpoint with the best win-minus-loss margin against its weaker matchup, using the combined margin to break ties. Batch 64 won selection. Against Hard, the zero-weight policy recorded 63 wins and 61 losses on validation, and the selected policy recorded 64 and 56. Against Mimic those records were 63–53 and 73–47. The artifact includes the weights and complete validation tallies. Repeating the full training run on Node 24.22.1 produced a byte-identical model.

From the FrontTron directory, the first command regenerates the bundled Apex model. The second runs the holdout with the installed model. The optional argument is the number of seed pairs per pickup preset.

```sh
npm run bots:train:rl
npm run bots:evaluate:rl -- 40
```

## Apex head-to-head results

Each matchup used 200 held-out starting setups, with 40 per pickup preset and both seat orders. The simulator used the production drivers, physics and scoring. A draw means both riders were eliminated on the same simulation step. A timeout means both were still riding after 60 simulated seconds. Training used seed IDs 10,000–12,047, validation used 1,000,000–1,000,063, and the final test used five separate ranges starting at 7,000,000. The runner mixes each ID into a 32-bit environment seed.

| Opponent | Apex wins | Opponent wins | Draws | Timeouts | Apex share of decided rounds |
| --- | ---: | ---: | ---: | ---: | ---: |
| Hard | 182 | 189 | 14 | 15 | 49.1% |
| Mimic | 206 | 142 | 34 | 18 | 59.2% |

| Pickup preset | Apex vs Hard (W–L–D–timeout) | Apex vs Mimic (W–L–D–timeout) |
| --- | ---: | ---: |
| All (room default) | 37–38–4–1 | 40–33–7–0 |
| Solo | 27–38–1–14 | 37–21–4–18 |
| Speed of light | 40–38–2–0 | 40–37–3–0 |
| Super size me | 40–37–3–0 | 44–23–13–0 |
| No bonuses | 38–38–4–0 | 45–28–7–0 |

Apex won more rounds than Mimic under every tested preset. It split the no-bonus rounds evenly with Hard and fell furthest behind Hard on Solo. These figures describe two-rider play.

## Playing strength across arena views

`npm run bots:evaluate -- 256` plays each matchup in isometric square, top-down square and top-down widescreen. Each setting uses the same 256 seeds, plays both seat orders and enables the default pickups. Each table entry gives the first rider’s share of decided rounds, with wins and losses in parentheses. Simultaneous eliminations and 60-second timeouts are excluded from the percentages.

| Matchup | Isometric square | Top-down square | Top-down widescreen |
| --- | ---: | ---: | ---: |
| Normal vs Easy | 73.9% (366–129) | 73.9% (366–129) | 73.2% (369–135) |
| Hard vs Normal | 59.6% (289–196) | 59.6% (289–196) | 60.2% (284–188) |
| Mimic vs Hard | 52.7% (254–228) | 52.7% (254–228) | 51.7% (246–230) |
| Apex vs Hard | 55.1% (272–222) | 55.1% (272–222) | 54.1% (259–220) |
| Apex vs Mimic | 62.1% (292–178) | 62.1% (292–178) | 59.2% (283–195) |

The regression suite also replays seeded rounds in both square views and compares every bot’s steering and position at each decision. On widescreen it places each difficulty in the extra track space to test trail avoidance, right and bottom walls, and collecting a pickup across each wraparound seam.

## Verification

The suite covers an offset trail gap, an opening too narrow for the rider, recent and old self-trails, wraparound, expiring shields, legal inputs under all 18 pickup types and stacked effects. Multiplayer tests cover the three-bot limit, host permissions and transfer, voting, recording isolation, a bot winner, spectator reconstruction, rematches and cleanup. The room controls and the entries for Mimic and Apex in live match standings were also checked in the browser.

With external networking disabled, the production Docker image passed its health check, accepted all five bot types over WebSockets and ran a steering decision using the bundled Apex weights.

For each matchup, 80 seeds were played twice with seat order reversed, using the ordinary game engine. Rounds were capped at 60 simulated seconds.

| Matchup | First rider wins | Second rider wins | Draws | Time limit |
| --- | ---: | ---: | ---: | ---: |
| Easy vs Normal | 39 | 113 | 8 | 0 |
| Normal vs Hard | 61 | 91 | 8 | 0 |
| Hard vs Mimic | 73 | 78 | 8 | 1 |

On the development machine (arm64, Node 24), four concurrent headless rooms with 1,500 trail discs per room took 0.14 ms at p99 per batch of four updates with human slots, 0.21 ms with one human, Normal, Hard and Mimic per room, and 0.24 ms with one human and three Hard bots per room. The headless benchmark revives eliminated riders to keep the load steady. Use the network benchmark on the deployment host to measure actual scheduling and WebSocket input-to-angle latency.

In a separate loopback run, 240 steering presses across four rooms produced p95/p99 input-to-angle times of 11.30/12.21 ms with human-controlled slots and 11.36/12.16 ms with 12 Hard bots. Event-loop delay at p99 was 2.17 ms and 1.92 ms respectively. Pickups were disabled for this comparison. These are local measurements on this machine. Public network latency, other workloads and hosting capacity will affect results.
