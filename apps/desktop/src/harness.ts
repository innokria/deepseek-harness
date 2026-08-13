import { spawn, type ChildProcess } from 'node:child_process'
import { createWriteStream, mkdirSync, type WriteStream } from 'node:fs'
import { dirname } from 'node:path'
import { EventEmitter } from 'node:events'

/**
 * The web app prints one `dsh web: http://127.0.0.1:<port>` line once its
 * Loader tree has settled; that line is the documented readiness signal
 * (`packages/bundle/web-app`), so the supervisor treats it as the moment the
 * window may load the origin. Matching the line also gives the real port when
 * the invocation used `--port 0`.
 */
const READY_LINE = /^dsh web:\s+(https?:\/\/127\.0\.0\.1:\d+)/

/** A single child exit, as observed by the supervisor. */
export interface HarnessExit {
  code: number | null
  signal: NodeJS.Signals | null
  /** True only during {@link HarnessSupervisor.stop}. */
  expected: boolean
}

/** Events emitted by {@link HarnessSupervisor}. */
export interface HarnessSupervisorEvents {
  /** The harness served a Web GUI; carries the canonical loopback URL. */
  ready: [url: string]
  /** The child process exited. */
  exit: [exit: HarnessExit]
  /** A restart is scheduled after an unexpected exit. */
  restart: [detail: { attempt: number; delayMs: number }]
}

export interface HarnessSupervisorOptions {
  logFile: string
  restartDelayMs: number
  maxRestartDelayMs: number
  killTimeoutMs: number
}

/**
 * Spawn and supervise the harness as a child process: start it, observe its
 * readiness line, restart it on unexpected exit with exponential backoff, and
 * stop it gracefully on request. One supervisor owns one child at a time.
 */
export class HarnessSupervisor extends EventEmitter<HarnessSupervisorEvents> {
  private readonly command: string
  private readonly args: readonly string[]
  private readonly options: HarnessSupervisorOptions
  private readonly logStream: WriteStream
  private child: ChildProcess | null = null
  private stopping = false
  private restartAttempt = 0
  private stdoutTail = ''
  private servedUrl: string | null = null

  constructor(command: string, args: readonly string[], options: HarnessSupervisorOptions) {
    super()
    this.command = command
    this.args = args
    this.options = options
    mkdirSync(dirname(options.logFile), { recursive: true })
    this.logStream = createWriteStream(options.logFile, { flags: 'a' })
  }

  /** The canonical loopback URL once observed; `null` before the first ready. */
  get url(): string | null {
    return this.servedUrl
  }

  /** Begin supervising: spawn the first child. */
  start(): void {
    this.stopping = false
    this.spawn()
  }

  /**
   * Gracefully stop the child (SIGTERM, then SIGKILL after the timeout) and
   * suppress restart. Resolves after the child has exited.
   */
  stop(): Promise<void> {
    this.stopping = true
    const child = this.child
    if (child === null) {
      this.logStream.end()
      return Promise.resolve()
    }
    return new Promise((resolve) => {
      const killTimer = setTimeout(() => child.kill('SIGKILL'), this.options.killTimeoutMs)
      child.once('exit', () => {
        clearTimeout(killTimer)
        this.logStream.end()
        resolve()
      })
      child.kill('SIGTERM')
    })
  }

  private spawn(): void {
    this.child = spawn(this.command, [...this.args], { stdio: ['ignore', 'pipe', 'pipe'] })
    this.child.stdout?.setEncoding('utf8')
    this.child.stderr?.setEncoding('utf8')
    this.child.stdout?.on('data', (chunk: string) => this.onStdout(chunk))
    this.child.stderr?.on('data', (chunk: string) => {
      this.logStream.write(`[stderr] ${chunk}`)
    })
    this.child.on('error', (error: Error) => {
      this.logStream.write(`[spawn error] ${error.message}\n`)
    })
    this.child.on('exit', (code, signal) => this.onExit(code, signal))
  }

  private onStdout(chunk: string): void {
    this.stdoutTail += chunk
    const lines = this.stdoutTail.split('\n')
    this.stdoutTail = lines.pop() ?? ''
    for (const line of lines) {
      this.logStream.write(`${line}\n`)
      const match = READY_LINE.exec(line)
      if (match === null) continue
      this.servedUrl = match[1] ?? null
      this.restartAttempt = 0
      if (this.servedUrl !== null) this.emit('ready', this.servedUrl)
    }
  }

  private onExit(code: number | null, signal: NodeJS.Signals | null): void {
    this.child = null
    this.emit('exit', { code, signal, expected: this.stopping })
    if (!this.stopping) this.scheduleRestart()
  }

  private scheduleRestart(): void {
    this.restartAttempt += 1
    const delayMs = Math.min(
      this.options.restartDelayMs * 2 ** (this.restartAttempt - 1),
      this.options.maxRestartDelayMs,
    )
    this.emit('restart', { attempt: this.restartAttempt, delayMs })
    setTimeout(() => {
      if (!this.stopping) this.spawn()
    }, delayMs)
  }
}
