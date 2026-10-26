import { createHash } from 'node:crypto'
import type { Plugin } from 'vite'

const MAX_WASM_BYTES = 3 * 1024 * 1024

/** Remove base64 transport overhead while keeping Rapier's own async WASM init.
 * Fail closed when its generated wrapper changes or the binary outgrows PWA's limit. */
export function externalizeRapierWasm(code: string, base: string) {
  const pattern = /module_or_path:\s*[\w$]+\.toByteArray\(("AGFzbQE[A-Za-z0-9+/=]+")\)\.buffer/g
  const matches = [...code.matchAll(pattern)]
  if (matches.length !== 1) throw new Error('Expected exactly one Rapier base64 WASM initializer')
  const bytes = Buffer.from(JSON.parse(matches[0]![1]!) as string, 'base64')
  if (bytes.length > MAX_WASM_BYTES) throw new Error('Rapier WASM exceeds the 3 MiB offline asset limit')
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 12)
  const fileName = `assets/rapier3d-${hash}.wasm`
  return {
    bytes, fileName,
    code: code.replace(matches[0]![0], `module_or_path:fetch(${JSON.stringify(`${base}${fileName}`)})`),
  }
}

export function rapierWasmAsset(base: string): Plugin {
  return {
    name: 'rapier-wasm-asset',
    apply: 'build',
    transform(code, id) {
      if (!id.replaceAll('\\', '/').endsWith('/@dimforge/rapier3d-compat/dist/rapier.mjs')) return null
      const result = externalizeRapierWasm(code, base)
      this.emitFile({ type: 'asset', fileName: result.fileName, source: result.bytes })
      return { code: result.code, map: null }
    },
  }
}
