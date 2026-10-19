# Testing

Safety net for the 2019-era dependencies (Express 4.17, Socket.IO 2.3): it pins what the server does today
so dependency upgrades can be merged on a green CI run.

## What it is

`index.js`: Express 5 + Socket.IO 4 (`allowEIO3`, so Socket.IO v2 clients still connect) on port 43000 (hard-coded). Watches `./test.txt` (relative to the working
directory) and broadcasts its content as `list-updated`; `POST /ports` runs `sudo netstat -tulpn` and
broadcasts the output as `ports-updated` (also once, 5 s after start). No Dockerfile, no deployment workflow;
no `engines` field — CI uses Node 20 and 26.

## Run it

```bash
docker run --rm -v "$PWD":/src:ro node:20-alpine sh -c \
  'mkdir /a && cd /src && tar --exclude=./node_modules -cf - . | tar -xf - -C /a && cd /a \
   && npm ci && node --test --test-reporter=spec test/server.test.js'
```

(Windows Git Bash: prefix with `MSYS_NO_PATHCONV=1`, mount `"$(cygpath -w "$PWD")"`.)
The server runs in a temp working directory, so the repo's `test.txt` is never modified.

## What is covered (`test/server.test.js`, 9 tests)

Uses the real `socket.io-client` 2.5.0 — the client of the existing users — as an explicit devDependency
(it used to come with socket.io 2): file change → `list-updated` to every client; `POST /ports` → 200 empty +
`ports-updated` broadcast (netstat output, or the exec error string where sudo/netstat are missing); CORS `*`
preflight; 404s; the watched path cannot be chosen (the CLI argument is logged and ignored — the only "path
traversal" surface there is); the 5 s startup poll. Client compatibility: a v2 client on polling then
websocket (Engine.IO 3) and a minimal fetch-based Engine.IO 4 client (the protocol of socket.io-client 3/4,
no extra dependency) both receive `list-updated` and `ports-updated`; a cross-origin EIO3 polling handshake
is allowed (origin echoed, with credentials), as Socket.IO 2 did.

## Upgrade ranking (2026-10-19)

`npm audit` on master: **19 advisories (6 critical, 7 high, 2 moderate, 4 low)**. `npm outdated`: express
4.17.1 (wanted 4.22.3, latest 5.x), socket.io 2.3.0 (wanted 2.5.1, latest 4.x), node-persist 3.0.5 (unused
by the code), cors 2.8.5.

Each open Dependabot PR was tested as *master code + that PR's package.json/lockfile*, Node 20 and 26:

| PR | change | tests | verdict |
|---|---|---|---|
| #7 | minimist 0.0.8 → removed, mkdirp 0.5.1 → 0.5.6 | 6/6, 6/6 | safe |
| #6 | express 4.17.1 → 4.17.3 (qs 6.9.7) | 6/6, 6/6 | safe |
| #5 | express → 4.18.2, qs → 6.11.0 | 6/6, 6/6 | safe (supersedes #6) |
| #3 | socket.io-parser 3.4.1 → 3.4.2 | 6/6, 6/6 | safe |
| #4 | socket.io 2.3.0 → 2.5.0, engine.io → 3.6.1 | 6/6, 6/6 | safe |

The PR branches themselves predate master's commit 15a40db (port poll 60 s → 5 s), so run as-is they fail
the "5 s poll" test; ask Dependabot to rebase (`@dependabot rebase`) before merging. They also conflict with
each other on `package-lock.json`: merge one, let the others rebase.

**Applied 2026-10-19** (supersedes #3–#7): **`npm audit fix`** (no `--force`) → express 4.22.3, socket.io 2.5.1,
engine.io 3.6.2, ws 7.5.13, qs 6.16.1; 6/6 on Node 20 and 26; advisories 19 → **8 (1 critical)**.

**Branch `agent/deps-socketio4`** (owner decision, supersedes #8–#11): socket.io 2.5.1 → **4.8.4** with
`allowEIO3: true` (existing v2 clients keep working, no client upgrade needed) and
`cors: {origin: true, credentials: true}` (Socket.IO 2's default for cross-origin polling); express 4.22.3 →
**5.3.0** (`app.options('*')` → `'/{*splat}'`, which Express 5 requires to start). 9/9 on Node 20 and 26.
`npm audit`: 8 (1 critical) → **3 moderate, all in the devDependency `socket.io-client` 2.5.0**
(parseuri ReDoS, test-only); `npm audit --omit=dev`: **0**. Remaining Socket.IO 4 differences (not covered):
`/socket.io/socket.io.js` now serves the v4 client bundle; defaults `pingTimeout` 5 s → 20 s and
`maxHttpBufferSize` 100 MB → 1 MB.

## Known gaps (pinned, not changed)

- `POST /ports` is unauthenticated, CORS `*`, and broadcasts the host's listening ports and processes (and
  needs passwordless sudo) to every websocket client.
- The watched-file CLI argument is ignored; port 43000 is hard-coded.
- `node-persist` and `http` (a placeholder package) are dependencies but unused.
