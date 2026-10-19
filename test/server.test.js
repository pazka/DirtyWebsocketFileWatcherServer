// Upgrade safety net (see TESTING.md): black-box characterization tests of index.js, started like
// `npm start`, in a temp working dir (it watches ./test.txt there, so the repo's test.txt is never touched).
// They pin what the server does TODAY so a Node, Express or Socket.IO bump that changes behaviour fails.
// Node built-ins + socket.io-client 2.3.0, already in the lockfile (dependency of socket.io 2):
//   node --test --test-reporter=spec test/server.test.js
'use strict'

const {test, before, after} = require('node:test')
const assert = require('node:assert/strict')
const {spawn} = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const ioClient = require('socket.io-client')

const ROOT = path.join(__dirname, '..')
const BASE = 'http://127.0.0.1:43000' // hard-coded in index.js
let work, server, log = ''

async function startServer(args = []) {
    log = ''
    const p = spawn(process.execPath, [path.join(ROOT, 'index.js'), ...args], {cwd: work})
    p.stdout.on('data', d => { log += d })
    p.stderr.on('data', d => { log += d })
    const until = Date.now() + 15000
    while (!log.includes('listening on 43000')) {
        if (Date.now() > until || p.exitCode !== null) throw new Error('server did not start:\n' + log)
        await new Promise(r => setTimeout(r, 50))
    }
    return p
}

async function stopServer(p) {
    p.kill()
    await new Promise(r => p.once('exit', r))
}

function connect() {
    return new Promise((resolve, reject) => {
        const c = ioClient(BASE, {transports: ['websocket'], reconnection: false, forceNew: true})
        c.on('connect', () => resolve(c))
        c.on('connect_error', reject)
    })
}

const next = (client, event, ms = 8000) => new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), ms)
    client.once(event, data => { clearTimeout(t); resolve(data) })
})

before(async () => {
    work = fs.mkdtempSync(path.join(os.tmpdir(), 'dwfws-'))
    fs.writeFileSync(path.join(work, 'test.txt'), 'initial\n')
    server = await startServer()
})

after(async () => {
    await stopServer(server)
    fs.rmSync(work, {recursive: true, force: true})
})

test('a change to ./test.txt is broadcast to every client as "list-updated"', async () => {
    const a = await connect()
    const b = await connect()
    try {
        const got = Promise.all([next(a, 'list-updated'), next(b, 'list-updated')])
        fs.writeFileSync(path.join(work, 'test.txt'), 'room-1\nroom-2\n')
        assert.deepEqual(await got, ['room-1\nroom-2\n', 'room-1\nroom-2\n'])
    } finally {
        a.close()
        b.close()
    }
})

test('POST /ports answers 200 empty and broadcasts the result of `sudo netstat` as "ports-updated"', async () => {
    const c = await connect()
    try {
        const got = next(c, 'ports-updated')
        const r = await fetch(BASE + '/ports', {method: 'POST'})
        assert.equal(r.status, 200)
        assert.equal(await r.text(), '')
        assert.equal(r.headers.get('access-control-allow-origin'), '*')
        const ports = await got
        assert.equal(typeof ports, 'string')
        // With sudo/netstat available: their output. Without (CI, slim images): the exec error, as a string.
        assert.ok(ports.includes('####') || ports.includes('sudo netstat -tulpn'), ports.slice(0, 200))
    } finally {
        c.close()
    }
})

test('CORS: preflight allowed from anywhere', async () => {
    const r = await fetch(BASE + '/ports', {method: 'OPTIONS', headers: {origin: 'https://anywhere.example', 'access-control-request-method': 'POST'}})
    assert.equal(r.status, 204)
    assert.equal(r.headers.get('access-control-allow-origin'), '*')
})

test('unknown routes are 404', async () => {
    assert.equal((await fetch(BASE + '/nope')).status, 404)
    assert.equal((await fetch(BASE + '/ports')).status, 404) // GET is not routed
})

test('the watched path cannot be chosen: the CLI argument is ignored, only ./test.txt is watched', async () => {
    await stopServer(server)
    fs.writeFileSync(path.join(work, 'other.txt'), 'x')
    server = await startServer(['../../etc/passwd'])
    assert.match(log, /'\.\.\/\.\.\/etc\/passwd'/) // logged, then unused
    const c = await connect()
    try {
        let received = null
        c.on('list-updated', d => { received = received ?? d })
        fs.writeFileSync(path.join(work, 'other.txt'), 'not watched')
        await new Promise(r => setTimeout(r, 500))
        assert.equal(received, null)
        fs.writeFileSync(path.join(work, 'test.txt'), 'watched')
        const until = Date.now() + 5000
        while (received === null && Date.now() < until) await new Promise(r => setTimeout(r, 20))
        assert.equal(received, 'watched')
    } finally {
        c.close()
    }
})

test('the server polls the ports once, 5 s after start', async () => {
    const c = await connect()
    try {
        const ports = await next(c, 'ports-updated', 9000)
        assert.equal(typeof ports, 'string')
    } finally {
        c.close()
    }
})
