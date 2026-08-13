import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** The resolved child invocation: argv[0] plus argv[1..]. */
export interface HarnessLaunch {
  command: string
  args: string[]
}

/**
 * Deployment-varying values for the desktop shell, each overridable by an
 * environment variable so a user can redirect logs or pin a port without
 * rebuilding.
 */
export interface DesktopEnv {
  launch: HarnessLaunch
  /** Absolute path of the combined child stdout/stderr log file. */
  logFile: string
  /** Base of the restart backoff, in milliseconds. */
  restartDelayMs: number
  /** Ceiling of the restart backoff, in milliseconds. */
  maxRestartDelayMs: number
  /** Graceful-shutdown window before the supervisor escalates to SIGKILL. */
  killTimeoutMs: number
}

const DSH_BIN_ENV = 'DSH_DESKTOP_DSH_BIN'
const PORT_ENV = 'DSH_DESKTOP_PORT'
const LOG_DIR_ENV = 'DSH_DESKTOP_LOG_DIR'

function port(): string {
  return process.env[PORT_ENV] ?? '0'
}

/** Platform log directory; only macOS and Windows are shipped. */
function defaultLogDir(): string {
  if (process.platform === 'win32') {
    const roaming = process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming')
    return join(roaming, 'dsh-desktop', 'logs')
  }
  return join(homedir(), 'Library', 'Logs', 'dsh-desktop')
}

/**
 * The bundled Node binary for this host, or `null` when the runtime bundle is
 * absent (development). The prepare-runtime script stages each target at
 * `runtime/<platform>-<arch>/`; macOS keeps `node` under `bin/`, Windows keeps
 * `node.exe` at the root.
 */
function bundledNode(resourceRoot: string): string | null {
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
  const platform = process.platform === 'darwin' ? 'darwin' : 'win32'
  const dir = join(resourceRoot, 'runtime', `${platform}-${arch}`)
  const bin = process.platform === 'win32' ? join(dir, 'node.exe') : join(dir, 'bin', 'node')
  return existsSync(bin) ? bin : null
}

/** The deployed `dsh` bin, or `null` when the harness bundle is absent. */
function bundledDshBin(resourceRoot: string): string | null {
  const bin = join(resourceRoot, 'harness', 'lib', 'bin.js')
  return existsSync(bin) ? bin : null
}

/**
 * Resolve the harness child invocation. A packaged app spawns the bundled Node
 * runtime running the deployed `dsh` bin. Development prefers an explicit
 * `DSH_DESKTOP_DSH_BIN`, else runs the repository's built CLI with the ambient
 * `node` — no `dsh` on `PATH` is required.
 */
function resolveLaunch(resourceRoot: string): HarnessLaunch {
  const node = bundledNode(resourceRoot)
  const dshBin = bundledDshBin(resourceRoot)
  if (node !== null && dshBin !== null) {
    return { command: node, args: [dshBin, 'web', '--port', port()] }
  }
  const explicit = process.env[DSH_BIN_ENV]
  if (explicit !== undefined && explicit !== '') {
    return { command: explicit, args: ['web', '--port', port()] }
  }
  const repoRoot = join(resourceRoot, '..', '..')
  return { command: 'node', args: [join(repoRoot, 'apps', 'cli', 'lib', 'bin.js'), 'web', '--port', port()] }
}

/**
 * Resolve the shell's environment.
 * @param resourceRoot - `process.resourcesPath` when packaged, else the app dir.
 * @returns the resolved {@link DesktopEnv}.
 */
export function resolveDesktopEnv(resourceRoot: string): DesktopEnv {
  return {
    launch: resolveLaunch(resourceRoot),
    logFile: join(process.env[LOG_DIR_ENV] ?? defaultLogDir(), 'harness.log'),
    restartDelayMs: 500,
    maxRestartDelayMs: 10000,
    killTimeoutMs: 5000,
  }
}
