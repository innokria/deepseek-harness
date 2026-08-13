#!/usr/bin/env node
/**
 * Stage the desktop app's self-contained runtime: download per-platform Node
 * binaries and deploy the harness closure. Runs at build/CI time (needs
 * network and a built workspace); the app falls back to a PATH `dsh` when the
 * staged bundle is absent.
 *
 * Prerequisite: build the repo first (`pnpm run build`), so the deployed
 * `@deepseek-ai/dsh` carries its `lib/` artifacts.
 */
import { spawnSync } from 'node:child_process'
import { createWriteStream, mkdirSync, renameSync, rmSync } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')
const VENDOR_DIR = join(APP_DIR, 'vendor')
const NODE_VERSION = process.env.DSH_DESKTOP_NODE_VERSION ?? 'v22.19.0'

/**
 * The runtimes staged for this host. An installer only bundles the runtime its
 * own platform needs: the macOS job stages both architectures (it cross-builds
 * an x64 dmg), the Windows job stages Windows x64. Staging the macOS runtimes
 * on Windows would copy their symlinked `bin/` entries into the NSIS archive,
 * which 7za rejects.
 */
const TARGETS = process.platform === 'win32'
  ? [{ platform: 'win32', arch: 'x64' }]
  : [
      { platform: 'darwin', arch: 'arm64' },
      { platform: 'darwin', arch: 'x64' },
    ]

/** Node's distribution filename names Windows `win`, not `win32`. */
function distPlatform(platform) {
  return platform === 'win32' ? 'win' : platform
}

function distName(target) {
  return `node-${NODE_VERSION}-${distPlatform(target.platform)}-${target.arch}`
}

function run(command, args) {
  // Windows resolves `pnpm` to `pnpm.cmd`, which CreateProcess cannot run
  // without a shell; `tar` and the other commands are unaffected by shell:true.
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} exited ${String(result.status)}`)
}

async function fetchNode(target) {
  const ext = target.platform === 'win32' ? 'zip' : 'tar.gz'
  const url = `https://nodejs.org/dist/${NODE_VERSION}/${distName(target)}.${ext}`
  const archive = join(VENDOR_DIR, `${distName(target)}.${ext}`)
  mkdirSync(VENDOR_DIR, { recursive: true })
  const response = await fetch(url)
  if (!response.ok || response.body === null) {
    throw new Error(`download failed (${response.status}): ${url}`)
  }
  await pipeline(response.body, createWriteStream(archive))
  return archive
}

function extractNode(target, archive) {
  const runtimeDir = join(VENDOR_DIR, 'runtime')
  mkdirSync(runtimeDir, { recursive: true })
  // bsdtar — the `tar` on macOS and Windows — reads both tarballs and zip
  // archives, so one extractor covers every shipped target without the
  // `unzip` binary that Windows runners do not provide.
  run('tar', ['-xf', archive, '-C', runtimeDir])
  const flat = join(runtimeDir, `${target.platform}-${target.arch}`)
  rmSync(flat, { recursive: true, force: true })
  renameSync(join(runtimeDir, distName(target)), flat)
  rmSync(archive, { force: true })
}

function deployHarness() {
  rmSync(join(VENDOR_DIR, 'harness'), { recursive: true, force: true })
  run('pnpm', [
    '--filter', '@deepseek-ai/dsh', 'deploy',
    '--legacy', '--prod',
    '--config.node-linker=hoisted',
    '--config.auto-install-peers=false',
    '--config.link-workspace-packages=true',
    join(VENDOR_DIR, 'harness'),
  ])
}

for (const target of TARGETS) {
  try {
    const archive = await fetchNode(target)
    extractNode(target, archive)
    console.log(`prepare-runtime: staged Node ${NODE_VERSION} for ${target.platform}-${target.arch}`)
  } catch (error) {
    console.error(`prepare-runtime: Node ${target.platform}-${target.arch} failed: ${error.message}`)
  }
}

try {
  deployHarness()
  console.log('prepare-runtime: staged harness closure')
} catch (error) {
  console.error(`prepare-runtime: harness deploy failed: ${error.message}`)
}
