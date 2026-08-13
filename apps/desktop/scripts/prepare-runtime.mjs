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

/** The shipped target matrix: macOS arm64/x64 and Windows x64. */
const TARGETS = [
  { platform: 'darwin', arch: 'arm64' },
  { platform: 'darwin', arch: 'x64' },
  { platform: 'win32', arch: 'x64' },
]

function distName(target) {
  return `node-${NODE_VERSION}-${target.platform}-${target.arch}`
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' })
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
  run(target.platform === 'win32' ? 'unzip' : 'tar', target.platform === 'win32'
    ? ['-q', archive, '-d', runtimeDir]
    : ['-xzf', archive, '-C', runtimeDir])
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
