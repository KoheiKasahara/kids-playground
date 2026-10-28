import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import type { AddressInfo } from 'node:net'
import type { Page } from '@playwright/test'

export async function waitForOfflineReady(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }))
    }
  })
}

/** 他のE2Eのdistを変更せず、実際の生成SWに更新を届ける専用origin。 */
export async function servePwaUpdateFixture() {
  const root = resolve('dist')
  let version = 1
  const mime: Record<string, string> = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
    '.wasm': 'application/wasm', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg', '.mp3': 'audio/mpeg', '.glb': 'model/gltf-binary', '.ico': 'image/x-icon',
  }
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname)
      const file = resolve(root, `.${pathname}`, ...(extname(pathname) ? [] : ['index.html']))
      if (!file.startsWith(root + sep)) { response.writeHead(403).end(); return }
      const bytes = await readFile(file)
      response.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' })
      response.end(pathname === '/sw.js' ? Buffer.concat([bytes, Buffer.from(`\n// update-fixture-${version}\n`)]) : bytes)
    } catch { response.writeHead(404).end() }
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    update: () => { version++ },
    close: () => new Promise<void>((resolve, reject) => {
      server.closeAllConnections()
      server.close(error => error ? reject(error) : resolve())
    }),
  }
}
