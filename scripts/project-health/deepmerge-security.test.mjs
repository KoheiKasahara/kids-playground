import { createRequire } from 'node:module'
import { expect, test } from 'vitest'

// Resolve exactly the implementation used by Workbox's Rollup resolver.
const require = createRequire(import.meta.url)
const resolverRequire = createRequire(require.resolve('@rollup/plugin-node-resolve'))
const merge = resolverRequire('deepmerge')

const payload = () => JSON.parse('{"__proto__":{"injected":true}}')

test.each([
  ['null prototype', () => Object.create(null), payload],
  ['null placeholder', () => ({ session: null }), () => ({ session: payload() })],
  ['primitive placeholder', () => ({ session: 0 }), () => ({ session: payload() })],
  ['own proto key in target', payload, () => ({ safe: true })],
  ['own proto key in both inputs', payload, payload],
])('blocks prototype poisoning with %s (CVE-2026-93753)', (_name, target, source) => {
  const result = merge(target(), source())
  for (const value of [result, result.session].filter((value) => value && typeof value === 'object')) {
    expect(Object.getPrototypeOf(value)).toBe(Object.prototype)
    expect(value.injected).toBeUndefined()
    expect(Object.hasOwn(value, '__proto__')).toBe(false)
  }
  expect({}.injected).toBeUndefined()
})

test('preserves resolver configuration merging and input immutability', () => {
  const defaults = { extensions: ['.js'], nested: { browser: false } }
  const options = { extensions: ['.ts'], nested: { preferBuiltins: true } }
  expect(merge(defaults, options)).toEqual({
    extensions: ['.js', '.ts'],
    nested: { browser: false, preferBuiltins: true },
  })
  expect(defaults).toEqual({ extensions: ['.js'], nested: { browser: false } })
  expect(options).toEqual({ extensions: ['.ts'], nested: { preferBuiltins: true } })
})
