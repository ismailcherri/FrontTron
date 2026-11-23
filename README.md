# FrontTron

FrontTron is a real-time multiplayer curve-survival game for the browser. It runs the Langtron rules on a Node.js server and renders the arena with Canvas 2D. The browser sends steering inputs. The server decides positions, collisions, pickups, scores, round outcomes, and room permissions.

![FrontTron browser lobby](docs/lobby.jpg)

## Run locally

Use Node.js 22 or newer. From the repository root, run

```sh
cd fronttron
npm ci
npm start
```

Open **http://localhost:8080**. The server listens on all interfaces by default. Other players on the same network can open the server's LAN address on port 8080. All browser assets, including fonts, are bundled here.

Select **Create room**. An empty room name generates one automatically. Edit the callsign, trail color, and steering from **Your pilot** or by selecting a rider's keys in the room. Add another local rider to share a keyboard, or use **Invite** to copy the room link. **Ready** starts the match as soon as everyone is ready, including in solo play. The host's **Start now** begins a cancellable five-second countdown.

New rooms start in **Isometric** view, which always uses a square arena. In **Room settings → Arena view**, choose **Classic top-down** to play on a **Widescreen (16:9)** track. The host can also select **Square** under **Arena shape**. The room remembers its top-down shape when switching views, and riders and spectators share the settings through rematches.

Choose **First person** to ride from the cockpit on a square track. The upper-right minimap shows the entire track, with an outlined arrow for your cycle, dots for other riders, and diamonds for pickups. Riders sharing a keyboard each get a cockpit while they’re racing. Spectators and eliminated riders follow a surviving cycle.

In an isometric room, the host can choose **1, 2, or 3** under **Room settings → Platform levels**. The platforms stack vertically. Your current floor is solid, floors above appear as translucent outlines, and floors below are hidden. Riders sharing a keyboard share the view until they move to different floors, then each occupied floor gets its own view. Spectators follow a surviving rider.

Everyone starts on level 1. Ride onto a numbered lift to travel to the indicated level, keeping your speed and heading. Lifts link neighboring levels and move to random locations during the round. Each level has its own trails and pickups.

Hold Left or Right to steer and release to travel straight. Turn through gaps in the trails and collect pickups. The field guide explains the rules. Select **Use touch controls** for touch steering. For a gamepad, activate the controller, select a steering binding, then press a button or move an axis.

## Computer riders

The host can select **Add bot** in a ready room and choose **Easy** (reactive), **Normal** (predictive steering), **Hard** (territory and opponent search), **Mimic** (imitation learning), or **Apex** (reinforcement learning). Add up to three bots, then press **Ready** to race. **Edit bot** changes or removes a computer rider before the next match. All five run on the game server. The Node and Docker distributions include both learned policies. [Training and head-to-head results](docs/ai-players.md#apex-head-to-head-results)

## Host with Docker

Build from this directory, with the Dockerfile and package-lock.json alongside it.

```sh
docker build -t fronttron .
docker run -d --name fronttron --restart unless-stopped -p 8080:8080 fronttron
```

A single container serves both the web page and the WebSocket at `/ws`. Use a single game-server process per public lobby. Rooms and active matches live in that process's memory and end when it restarts. Players' profiles persist in their browsers.

For a public domain, point DNS at the server, enable HTTPS on your reverse proxy, and proxy the whole origin including WebSocket upgrades. With Caddy running on the host, a site block for a container published to host port 8080 can be as small as

```caddyfile
game.example.com {
    reverse_proxy 127.0.0.1:8080
}
```

Use your domain in place of the example. In a container platform, set the build context to `fronttron`, the internal port to `8080`, and the HTTP health probe to `/healthz`.

## Configuration

| Environment variable | Purpose |
| --- | --- |
| PORT | HTTP and WebSocket port. Default 8080. |
| HOST | Bind address. Default 0.0.0.0. |
| ANALYTICS_ID | Defaults to the Google Tag Manager container `GTM-W8X5XVH5`. Set a different GTM container ID or a GA4 measurement ID (`G-…`) to override it. Set an empty value to disable tracking. |

## Google Analytics

Use **Event count** for `game_started` in GA4 to see how many matches were played. The server selects one connected rider to report each shared match event. As with other browser analytics, blocked tags can reduce reported counts.

| Event | When FrontTron sends it |
| --- | --- |
| `room_created` | The server accepts a new room. |
| `room_joined` | A browser successfully enters a room, including the creator or a spectator. |
| `invite_copied` | The room invite is copied to the clipboard. |
| `game_started` | The first round begins racing. Each rematch counts as a new game. |
| `round_started` | A round begins racing, including the first round. |
| `game_completed` | A match ends with a winner at the target score. |
| `page_view` | The browser shows the lobby, room, or match screen. |

To route these events from the default GTM container to your GA4 web stream:

1. Configure a **Google tag** with your stream’s measurement ID on **Initialization – All Pages**. Set `send_page_view` to `false` and turn off automatic history-based page views in the web stream’s enhanced measurement settings. FrontTron supplies its own screen views.
2. Create a **Custom Event** trigger. Enable regex matching and use `^(room_created|room_joined|invite_copied|game_started|round_started|game_completed|page_view)$`.
3. Create a **Google Analytics: GA4 Event** tag with the same measurement ID, set **Event Name** to the built-in `{{Event}}` variable, and attach that trigger. Add `page_title` and `page_location` as event parameters, each mapped to a Data Layer Variable of the same name. FrontTron supplies a screen title and a generic URL such as `/room` so these events omit private invite codes and room names.
4. In **Preview**, create a room and play a match. Check the events in GA4 **DebugView**, then publish the container. [Google’s event setup guide](https://support.google.com/tagmanager/answer/13034206)

## Verification and source

```sh
npm test
```

Tests start ephemeral local servers and exercise independent WebSocket clients. The rules suite also uses controlled game time to collect and expire each selectable pickup.

- `server/start.js`, `server/server.js`, `server/session.js` — startup, HTTP hosting, and WebSocket transport.
- `server/engine/` — modular port of the original shared and server game rules, room controllers, and bonus implementations.
- `public/app.js`, `views.js`, `controls.js` — browser navigation, lobby, profile, room controls, chat, and input handling.
- `public/match.js` — render state shared by live clients and the server's mid-game spectator snapshot.
- `public/arena.js` — world-to-screen projection, arena, bikes, trails, pickups and effects.
- [Phased implementation plan](IMPLEMENTATION_PLAN.md)
- [Original project license](LICENSE) and [audio credits](public/sounds/CREDITS.txt). Typefaces include their licenses in `public/fonts/`.
