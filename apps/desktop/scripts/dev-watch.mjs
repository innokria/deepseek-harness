#!/usr/bin/env node
/**
 * Watch-driven development loop for the desktop shell: keep the TypeScript
 * project in watch mode and restart Electron whenever the emitted `lib/`
 * settles. This is the "hot" counterpart of `dev` (which builds once and
 * launches) — edit `src/*.ts` and the running app reloads without a manual
 * re-run.
 *
 * The renderer it hosts is `dsh web` serving built `dist/` (not a Vite dev
 * server), so shell edits reload here; Web GUI edits still follow the
 * rebuild-and-refresh path documented in the README.
 */
import { spawn } from 'node:child_process'
import { watch } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')
const LIB_DIR = join(APP_DIR, 'lib')
const TSC = process.platform === 'win32' ? 'tsc.cmd' : 'tsc'
const ELECTRON = process.platform === 'win32' ? 'electron.cmd' : 'electron'

let electron = null
let pendingRestart = false
let debounce = null
let closing = false

function startElectron() {
  electron = spawn(ELECTRON, ['.'], { cwd: APP_DIR, stdio: 'inherit', env: process.env })
  electron.on('exit', () => {
    electron = null
    if (pendingRestart) {
      pendingRestart = false
      startElectron()
    } else if (!closing) {
      shutdown(0)
    }
  })
}

function shutdown(code) {
  if (closing) return
  closing = true
  if (debounce !== null) clearTimeout(debounce)
  tscWatcher.kill()
  electron?.kill()
  process.exit(code)
}

function startLibWatcher() {
  // tsc --watch rewrites several lib/*.js per compile; debounce so one source
  // edit produces a single Electron restart, not one per emitted file.
  watch(LIB_DIR, { recursive: true }, (_event, filename) => {
    if (filename !== undefined && !filename.endsWith('.js')) return
    if (debounce !== null) return
    debounce = setTimeout(() => {
      debounce = null
      pendingRestart = true
      electron?.kill()
    }, 250)
  })
}

const tscWatcher = spawn(TSC, ['-p', 'tsconfig.json', '--watch', '--preserveWatchOutput'], {
  cwd: APP_DIR,
  stdio: ['ignore', 'pipe', 'inherit'],
})
tscWatcher.on('exit', (code) => {
  if (!closing) shutdown(code ?? 1)
})

let booted = false
tscWatcher.stdout.setEncoding('utf8')
tscWatcher.stdout.on('data', (chunk) => {
  process.stdout.write(chunk)
  // Launch only after the first watch build completes, so the app never
  // starts against a half-written lib/ and the initial emit is not mistaken
  // for a source edit.
  if (!booted && chunk.includes('Watching for file changes')) {
    booted = true
    startElectron()
    startLibWatcher()
  }
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => shutdown(0))
}
