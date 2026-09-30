// three-globe が静的importしている「ちきゅうぎ」では使わない依存を、軽いスタブへ差し替えるViteプラグイン。
//
// three-globe 2.45 は hexBin / hexPolygon / heatmap レイヤーのために
// `three/webgpu`・`three/tsl`（WebGPU版three.js一式、未圧縮で約1.9MB）と
// `h3-js`（約0.55MB）を先頭で import している。ちきゅうぎは polygons レイヤーしか
// 使わないため、これらはダウンロード・パースの時間を増やすだけになっている。
// importer が three-globe のときだけ差し替え、他のモジュールの解決には影響させない。
// three-globe を更新したら、import 名と使っているレイヤーを再確認すること。

import type { Plugin } from 'vite'

const STUB_PREFIX = '\0three-globe-unused:'

function unusedFeatureError(name: string): string {
  return `throw new Error('three-globe: ${name} はちきゅうぎでは無効化しています（src/build/threeGlobeUnusedDeps.ts）')`
}

const STUB_SOURCES: Record<string, string> = {
  'three/webgpu': [
    `export class StorageInstancedBufferAttribute { constructor() { ${unusedFeatureError('StorageInstancedBufferAttribute')} } }`,
    `export class WebGPURenderer { constructor() { ${unusedFeatureError('WebGPURenderer')} } }`,
  ].join('\n'),
  // heatmap レイヤーの内部でだけ参照される名前。値は使われない前提なので undefined でよい。
  'three/tsl': ['Fn', 'If', 'uniform', 'storage', 'float', 'instanceIndex', 'Loop', 'sqrt', 'sin', 'cos', 'asin', 'exp', 'negate']
    .map((name) => (name === 'float' ? 'const float_ = undefined; export { float_ as float }' : `export const ${name} = undefined`))
    .join('\n'),
  'h3-js': ['latLngToCell', 'cellToLatLng', 'cellToBoundary', 'polygonToCells']
    .map((name) => `export function ${name}() { ${unusedFeatureError(name)} }`)
    .join('\n'),
}

function isThreeGlobeImporter(importer: string | undefined): boolean {
  return importer !== undefined && /[\\/]node_modules[\\/]three-globe[\\/]/.test(importer)
}

export function threeGlobeUnusedDeps(): Plugin {
  return {
    name: 'three-globe-unused-deps',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!(source in STUB_SOURCES) || !isThreeGlobeImporter(importer)) return null
      return STUB_PREFIX + source
    },
    load(id) {
      if (!id.startsWith(STUB_PREFIX)) return null
      return STUB_SOURCES[id.slice(STUB_PREFIX.length)]
    },
  }
}
