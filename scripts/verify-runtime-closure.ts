/**
 * Verify that a runtime deploy manifest supplies every required workspace peer
 * in its dependency graph. With auto peer installation disabled, a missing root
 * peer can otherwise fail only when Cordis loads the packaged plugin. The
 * single-exe Python SDK and the desktop shell each have a deploy root; both
 * closures are checked so neither can regress its peer list silently.
 */
import { globSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'

interface PackageManifest {
  name?: string
  dependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  peerDependenciesMeta?: Record<string, { optional?: boolean }>
}

interface WorkspacePackage {
  path: string
  manifest: PackageManifest
}

/** Deploy roots whose closure completeness the gate owns. */
const DEFAULT_MANIFESTS = [
  'python/sdk-runtime/package.json',
  'apps/cli/package.json',
] as const

const root = resolve(import.meta.dirname, '..')
const { values } = parseArgs({
  args: process.argv.slice(2),
  options: { manifest: { type: 'string' } },
})
const manifestPaths = values.manifest === undefined
  ? [...DEFAULT_MANIFESTS]
  : [values.manifest]

let failed = false
for (const manifestPath of manifestPaths) {
  const result = await verifyManifest(resolve(root, manifestPath))
  if (result.failures.length > 0) {
    failed = true
    console.error(`verify-runtime-closure: required workspace peers are missing from ${manifestPath} dependencies:`)
    for (const failure of result.failures) console.error(`  ${failure}`)
  } else {
    console.log(`verify-runtime-closure: ${result.packageCount} workspace packages form a closed runtime dependency graph (${manifestPath}).`)
  }
}
if (failed) process.exit(1)

async function verifyManifest(runtimeManifestPath: string): Promise<{ failures: string[]; packageCount: number }> {
  const runtimeManifest = await loadManifest(runtimeManifestPath)
  const runtimeName = runtimeManifest.name ?? runtimeManifestPath
  const workspace = await loadWorkspacePackages()
  const runtimeDependencies = runtimeManifest.dependencies ?? {}
  const parents = new Map<string, string | undefined>()
  const queue: string[] = []

  for (const dependency of Object.keys(runtimeDependencies).sort()) {
    if (!workspace.has(dependency)) continue
    parents.set(dependency, undefined)
    queue.push(dependency)
  }

  const failures: string[] = []
  for (let index = 0; index < queue.length; index += 1) {
    const packageName = queue[index]
    if (packageName === undefined) continue
    const current = workspace.get(packageName)
    if (current === undefined) continue
    const peers = current.manifest.peerDependencies ?? {}
    const peerMeta = current.manifest.peerDependenciesMeta ?? {}
    for (const peer of Object.keys(peers).sort()) {
      if (!workspace.has(peer) || peerMeta[peer]?.optional === true) continue
      if (runtimeDependencies[peer]?.startsWith('workspace:') === true) continue
      failures.push(`${formatChain(runtimeName, packageName, parents)} -> ${peer}`)
    }
    const dependencies = {
      ...current.manifest.dependencies,
      ...current.manifest.optionalDependencies,
    }
    for (const dependency of Object.keys(dependencies).sort()) {
      if (!workspace.has(dependency) || parents.has(dependency)) continue
      parents.set(dependency, packageName)
      queue.push(dependency)
    }
  }

  return { failures, packageCount: queue.length }
}

async function loadWorkspacePackages(): Promise<Map<string, WorkspacePackage>> {
  const paths = globSync(['packages/*/*/package.json', 'vendor/*/package.json'], { cwd: root })
    .sort()
    .map(relative => resolve(root, relative))
  const result = new Map<string, WorkspacePackage>()
  for (const path of paths) {
    const manifest = await loadManifest(path)
    if (manifest.name !== undefined) result.set(manifest.name, { path, manifest })
  }
  return result
}

async function loadManifest(path: string): Promise<PackageManifest> {
  return JSON.parse(await readFile(path, 'utf8')) as PackageManifest
}

function formatChain(
  runtimeName: string,
  packageName: string,
  parents: ReadonlyMap<string, string | undefined>,
): string {
  const chain = [packageName]
  let parent = parents.get(packageName)
  while (parent !== undefined) {
    chain.unshift(parent)
    parent = parents.get(parent)
  }
  return [runtimeName, ...chain].join(' -> ')
}
