import { expect, it } from 'vitest'
import { externalizeRapierWasm } from './rapierWasmAsset'

const binary = Buffer.from([0, 97, 115, 109, 1, 0, 0, 0])
const initializer = (bytes: Buffer) => `async function init(){await wasmInit({module_or_path:base64.toByteArray(${JSON.stringify(bytes.toString('base64'))}).buffer})}`

it('emits the identical WASM bytes and supplies a fetch promise to the original initializer', async () => {
  const result = externalizeRapierWasm(initializer(binary), '/play/')
  expect(result.bytes).toEqual(binary)
  expect(result.fileName).toMatch(/^assets\/rapier3d-[a-f0-9]{12}\.wasm$/)
  let received: Uint8Array | undefined
  let requested: string | undefined
  const init = new Function('wasmInit', 'fetch', `${result.code}; return init()`)
  await init(async ({ module_or_path }: { module_or_path: Promise<Response> }) => {
    received = new Uint8Array(await (await module_or_path).arrayBuffer())
  }, (url: string) => {
    requested = url
    return Promise.resolve(new Response(binary))
  })
  expect(requested).toBe(`/play/${result.fileName}`)
  expect(received).toEqual(new Uint8Array(binary))
})

it('rejects missing or multiple initializers and binaries over the existing cache limit', () => {
  expect(() => externalizeRapierWasm('', '/')).toThrow('exactly one')
  expect(() => externalizeRapierWasm(initializer(binary).repeat(2), '/')).toThrow('exactly one')
  const large = Buffer.alloc(3 * 1024 * 1024 + 1)
  binary.copy(large)
  expect(() => externalizeRapierWasm(initializer(large), '/')).toThrow('3 MiB')
})
