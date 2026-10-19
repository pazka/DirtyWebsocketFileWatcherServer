# CLAUDE.md — pazka/DirtyWebsocketFileWatcherServer

Small Express 5 + Socket.IO 4 server (`allowEIO3`: its existing Socket.IO v2 clients still connect): broadcasts changes of `./test.txt` and the host's listening ports to
websocket clients (port 43000). Owner: Alexandre (pazka). Read **TESTING.md** first (it holds the
dependency upgrade ranking).

## Maintenance (autonomous agent)
Goal: bring the 2019-era dependencies up to date **without changing behaviour**.
- **Gate = `ci` green**: `server tests (node 20|26)`.
- **Branches**: work on `agent/<topic>`; CI runs without a PR. Never push to `master`. **The owner merges.**
- **Dependabot PRs**: they are stale against master; test them as described in TESTING.md, ask for a rebase.
  Green → summarise risk in a PR comment.
- Socket.IO 4 and Express 5 are protocol/API majors: owner decision, not routine maintenance.
- Never weaken or delete a test.

## Rules
- No new dependency without the owner's yes.
- Run installs and tests in containers (TESTING.md), not on the owner's machine.
