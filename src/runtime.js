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
