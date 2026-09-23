import { createServer } from 'node:net'

export const HOST = '127.0.0.1'

export function findAvailablePort(host = HOST) {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.unref()
    server.once('error', reject)
    server.listen(0, host, () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : null
      server.close(error => error ? reject(error) : resolve(port))
    })
  })
}

export async function waitForServer(url, options = {}) {
  const timeoutMs = options.timeoutMs ?? 60_000
  const intervalMs = options.intervalMs ?? 250
  const signal = options.signal
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    if (signal?.aborted) throw signal.reason ?? new Error('Startup cancelled')
    try {
      await fetch(url, { signal })
      return
    } catch (error) {
      if (signal?.aborted) throw signal.reason ?? error
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs))
  }
  throw new Error(`DeepSeek Harness did not become ready within ${timeoutMs / 1000} seconds`)
}

/** Extract the dsh web URL (token included, rc >= 0.1.5) from a log line. */
export function announcedWebUrl(line) {
  const match = String(line).match(/dsh web: (http:\/\/127\.0\.0\.1:\d+\S*)/)
  return match?.[1]
}

export function buildDshEnvironment({ baseEnvironment }) {
  return {
    ...baseEnvironment,
    ELECTRON_RUN_AS_NODE: '1',
    NODE_ENV: 'production',
    NO_COLOR: '1'
  }
}

/**
 * Extract the `ui-theme` preference from a DSH settings document.
 *
 * 0.1.7 moved the old `settings.yaml` sections into the active profile's patch
 * document (`profiles/<name>/cordis.patch.yml`) as `- id: ui-theme` entries, so
 * the file name is no longer `settings.yaml`. `preference` only occurs in that
 * entry, which keeps one flat match valid for both layouts.
 * @param {string} contents
 * @returns {string | undefined}
 */
export function themePreference(contents) {
  return String(contents).match(/\bpreference:\s*(\S+)/)?.[1]
}

/**
 * One-shot awaitable for the authenticated dsh web URL announced on stdout.
 *
 * The web server answers requests before its announcement reaches the parent
 * process, so readiness alone does not tell the window which URL carries the
 * launch token. Loading the bare origin instead leaves the renderer on the
 * `dsh web authentication required` page with no way to recover.
 * @returns {{ announce: (url: string) => void, wait: (options?: { timeoutMs?: number, signal?: AbortSignal }) => Promise<string> }}
 *   `announce` records the first announced URL; `wait` resolves with it, even
 *   when the announcement arrived first.
 */
export function createWebUrlSignal() {
  let announced
  let notify
  const arrival = new Promise(resolve => { notify = resolve })

  return {
    announce(url) {
      if (announced !== undefined) return
      announced = url
      notify(url)
    },
    async wait({ timeoutMs = 15_000, signal } = {}) {
      if (announced !== undefined) return announced
      let timer
      const expiry = new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`DeepSeek Harness did not announce its web URL within ${timeoutMs / 1000} seconds`)), timeoutMs)
      })
      const abortion = signal
        ? new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason ?? new Error('Startup cancelled')), { once: true }))
        : new Promise(() => {})
      try {
        return await Promise.race([arrival, expiry, abortion])
      } finally {
        clearTimeout(timer)
      }
    }
  }
}
