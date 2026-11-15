/* Run with node scripts/benchmark-block-craft.mjs [--baseline=7634656] [--browser] [--hardware].
 * --browser uses the latest npm run build, Playwright Chromium and a mobile viewport.
 * --hardware requests GPU acceleration and prints the actual renderer used.
 */
import { execFileSync } from 'node:child_process'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import ts from 'typescript'
import * as THREE from 'three'
import { createServer, preview } from 'vite'

function median(run, count = 30) {
  for (let i = 0; i < 10; i++) run()
  const samples = []
  for (let i = 0; i < count; i++) {
    const start = performance.now()
    run()
    samples.push(performance.now() - start)
  }
  return +samples.sort((a, b) => a - b)[Math.floor(count / 2)].toFixed(3)
}

async function legacyWorld(revision, size) {
  const source = execFileSync('git', ['show', revision + ':src/games/block-craft/world.ts'], { encoding: 'utf8' })
  const compiled = ts.transpileModule(source.replace('export const SIZE = 16', 'export const SIZE = ' + size), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  return import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'))
}

function legacyMetrics(old, size) {
  const blocks = old.createWorld()
  const start = old.startWalker(blocks, 8, 8)
  const geometry = new THREE.BoxGeometry(0.97, 0.97, 0.97)
  const material = new THREE.MeshBasicMaterial()
  const counts = old.MATERIAL_DEFS.map(m => blocks.filter(b => b.material === m.id).length)
  // Use the same full rewrite and bounds pass without committing hundreds of MiB just for the baseline.
  const meshes = counts.map(count => new THREE.InstancedMesh(geometry, material, count))
  const matrix = new THREE.Matrix4()
  const rebuild = () => {
    meshes.forEach(mesh => { mesh.count = 0 })
    for (const b of blocks) {
      const index = old.MATERIAL_DEFS.findIndex(m => m.id === b.material)
      const { plant, height = 0.6 } = old.MATERIAL_DEFS[index]
      if (plant) matrix.makeScale(0.45, height, 0.45).setPosition(b.x, b.y - 0.485 * (1 - height), b.z)
      else matrix.makeTranslation(b.x, b.y, b.z)
      const mesh = meshes[index]
      mesh.setMatrixAt(mesh.count++, matrix)
    }
    for (const mesh of meshes) {
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
    }
  }
  rebuild()
  const ray = new THREE.Raycaster(new THREE.Vector3(8, 10, 8), new THREE.Vector3(0, -1, 0))
  const json = JSON.stringify(blocks)
  const result = {
    size, blocks: blocks.length,
    editMs: median(() => old.editWorld(blocks, { x: 8, y: 3, z: 8 }, 'brick', 'place')),
    treasuresMs: median(() => { old.foundTreasures(blocks); old.foundTreasures(blocks); old.foundTreasures(blocks) }),
    walkMs: median(() => old.walk(blocks, start, { x: 1, z: 0 })),
    settleMs: median(() => old.settleWalker(blocks, start)),
    rebuildMs: median(rebuild),
    pickMs: median(() => ray.intersectObjects(meshes)),
    matrixBytes: size ** 2 * old.HEIGHT * meshes.length * 64,
    saveChars: json.length,
    restores: !!old.decodeWorld(json),
  }
  for (const mesh of meshes) mesh.dispose()
  geometry.dispose()
  material.dispose()
  return result
}

async function browserMetrics(saves, saveKey) {
  const { chromium } = await import('@playwright/test')
  const server = await preview({ configFile: false, preview: { host: '127.0.0.1', port: 4187, strictPort: true } })
  let browser
  try {
    const hardware = process.argv.includes('--hardware')
    const args = ['--enable-unsafe-swiftshader']
    if (hardware) {
      args.push('--enable-gpu')
      if (process.platform === 'win32') args.push('--use-angle=d3d11')
    }
    browser = await chromium.launch({ args })
    console.log('Chromium ' + browser.version() + ', 390x844 touch, DPR 2, CDP CPU slowdown 4x, GPU as reported below')
    for (const [size, raw] of saves) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
      const cdp = await page.context().newCDPSession(page)
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
      await page.addInitScript(({ saveKey, raw }) => {
        localStorage.setItem(saveKey, raw)
        const prototype = WebGL2RenderingContext.prototype
        const originalClear = prototype.clear
        const originalDraw = prototype.drawElementsInstanced
        const originalBufferData = prototype.bufferData
        const originalDelete = prototype.deleteBuffer
        const capacities = new Map()
        const data = { frames: [], draws: [], capacities, gpu: null }
        globalThis.blockCraftBenchmark = data
        prototype.clear = function (...args) {
          if (this.canvas.closest('[role="application"]')) {
            if (!data.gpu) {
              const info = this.getExtension('WEBGL_debug_renderer_info')
              data.gpu = this.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : this.RENDERER)
            }
            data.frames.push(performance.now())
            data.draws.push(0)
          }
          return originalClear.apply(this, args)
        }
        prototype.drawElementsInstanced = function (...args) {
          if (this.canvas.closest('[role="application"]') && data.draws.length) data.draws[data.draws.length - 1]++
          return originalDraw.apply(this, args)
        }
        prototype.bufferData = function (target, source, usage, ...rest) {
          if (target === this.ARRAY_BUFFER && usage === this.DYNAMIC_DRAW && this.canvas.closest('[role="application"]')) {
            capacities.set(this.getParameter(this.ARRAY_BUFFER_BINDING), typeof source === 'number' ? source : source.byteLength)
          }
          return originalBufferData.call(this, target, source, usage, ...rest)
        }
        prototype.deleteBuffer = function (buffer) {
          capacities.delete(buffer)
          return originalDelete.call(this, buffer)
        }
      }, { saveKey, raw })
      await page.goto('http://127.0.0.1:4187/games/block-craft')
      await page.getByRole('button', { name: /つづきから あそぶ/ }).click()
      await page.locator('[role="application"] canvas').waitFor()
      const orbit = await page.evaluate(async () => {
        const data = globalThis.blockCraftBenchmark
        await new Promise(resolve => setTimeout(resolve, 1000))
        const save = [...document.querySelectorAll('button')].find(button => button.textContent.includes('💾 ほぞん'))
        const start = performance.now()
        save.click()
        return {
          orbitDraws: Math.max(...data.draws),
          orbitGpuMatrixBytes: [...data.capacities.values()].reduce((sum, n) => sum + n, 0),
          saveClickMs: +(performance.now() - start).toFixed(1),
        }
      })
      await page.getByRole('button', { name: 'あるく' }).click()
      const walking = await page.evaluate(async () => {
        const data = globalThis.blockCraftBenchmark
        const forward = document.querySelector('button[aria-label="まえへ すすむ"]')
        const turn = document.querySelector('button[aria-label="みぎを むく"]')
        let step = 0
        const move = setInterval(() => (++step % 8 ? forward : turn).click(), 125)
        await new Promise(resolve => setTimeout(resolve, 700))
        data.frames.length = data.draws.length = 0
        let ticks = 0
        let running = true
        const countTick = () => { if (running) { ticks++; requestAnimationFrame(countTick) } }
        requestAnimationFrame(countTick)
        const start = performance.now()
        await new Promise(resolve => setTimeout(resolve, 4000))
        running = false
        clearInterval(move)
        const elapsed = (performance.now() - start) / 1000
        return {
          renderedFps: +(data.frames.length / elapsed).toFixed(1),
          rafFps: +(ticks / elapsed).toFixed(1),
          maxWalkDraws: Math.max(...data.draws),
          loadedGpuMatrixBytes: [...data.capacities.values()].reduce((sum, n) => sum + n, 0),
          gpu: data.gpu,
        }
      })
      if (errors.length || !walking.renderedFps) throw new Error('Browser render failed: ' + JSON.stringify({ errors, walking }))
      const screenshot = process.env.BLOCK_CRAFT_SCREENSHOT
      if (screenshot) await page.screenshot({ path: screenshot + '-' + size + '.png' })
      console.log(JSON.stringify({ size, ...orbit, ...walking }))
      await page.close()
    }
  } finally {
    await browser?.close()
    await server.close()
  }
}

const ssr = await createServer({
  configFile: false,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, ws: false },
})
const saves = new Map()
let saveKey
try {
  const load = name => ssr.ssrLoadModule('/src/games/block-craft/' + name + '.ts')
  const { editWorld, foundTreasures, MATERIALS, settleWalker, undoChanges, walk, World } = await load('world')
  const { newGame, encodeGame, decodeGame, SAVE_KEY } = await load('save')
  const { encodeGrid } = await load('saveCodec')
  const { BLOCK_WIDTH, hitBlock } = await load('raycast')
  const { createTerrainMeshes } = await load('terrainMeshes')
  saveKey = SAVE_KEY
  console.log(process.version + ' ' + process.platform + ' ' + process.arch + ', 10 warmups, median of 30 samples, ms')
  const legacy = []
  const current = []
  const compression = []
  const baseline = process.argv.find(arg => arg.startsWith('--baseline='))?.slice('--baseline='.length)
  for (const size of [16, 64, 128]) {
    if (baseline) legacy.push(legacyMetrics(await legacyWorld(baseline, size), size))
    const dims = { size, height: 12 }
    const game = newGame('meadow', dims)
    const world = game.world
    const at = { x: Math.floor(size / 2), y: 3, z: Math.floor(size / 2) }
    const walker = settleWalker(world, at)
    const scene = new THREE.Scene()
    const geometry = new THREE.BoxGeometry(BLOCK_WIDTH, BLOCK_WIDTH, BLOCK_WIDTH)
    const materials = MATERIALS.map(() => new THREE.MeshBasicMaterial())
    const terrain = createTerrainMeshes(scene, geometry, materials)
    terrain.update(world)
    const blocks = [...world.blocks()].length
    let matrixBytes = 0, drawn = 0
    scene.traverse(mesh => { if (mesh.isInstancedMesh) { matrixBytes += mesh.instanceMatrix.array.byteLength; drawn += mesh.count } })
    const raw = encodeGame(game)
    const edit = () => editWorld(world, at, 'brick', 'place')
    const edits = median(() => { undoChanges(world, edit()) })
    const rebuild = median(() => { const change = edit(); terrain.update(world); undoChanges(world, change); terrain.update(world) })
    current.push({
      size, blocks, omitted: blocks - drawn, editAndUndoMs: edits,
      treasuresMs: median(() => { foundTreasures(world); foundTreasures(world); foundTreasures(world) }),
      walkMs: median(() => walk(world, walker, { x: 1, z: 0 })),
      settleMs: median(() => settleWalker(world, walker)),
      rebuildAndUndoMs: rebuild,
      pickMs: median(() => hitBlock(world, { ...at, y: 10 }, { x: 0, y: -1, z: 0 })),
      matrixBytes, saveChars: raw.length,
      initialMs: median(() => newGame('meadow', dims)),
      saveValidateMs: median(() => decodeGame(encodeGame(game))),
      resetMs: median(() => terrain.update(newGame('meadow', dims).world)),
      retainedGridBytesPerReset: world.volume + 2 * world.area,
      // Arrays only. The grid also owns small maps/sets and JS metadata.
    })
    for (const biome of ['meadow', 'snow', 'desert', 'island', 'dense random']) {
      const fixture = newGame(biome === 'dense random' ? 'meadow' : biome, dims)
      if (biome === 'dense random') {
        let seed = 101
        function* randomBlocks() {
          for (let y = 0; y < dims.height; y++) for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
            yield { x, y, z, material: MATERIALS[(seed >>> 16) % MATERIALS.length].id }
          }
        }
        fixture.world = new World(dims, randomBlocks())
      } else {
        for (let z = size - 4; z < size; z++) for (let x = size - 4; x < size; x++) {
          const top = fixture.world.topY(x, z)
          for (let y = top + 1; y <= top + 3 && y < dims.height; y++) editWorld(fixture.world, { x, y, z }, 'brick', 'place')
        }
      }
      const layers = encodeGame(fixture)
      const columns = JSON.stringify({ ...JSON.parse(layers), ...encodeGrid(fixture.world, 'columns') })
      compression.push({
        size, biome, v1BlockChars: JSON.stringify([...fixture.world.blocks()]).length, layersChars: layers.length,
        columnsChars: columns.length, layersDecodeMs: median(() => decodeGame(layers)), columnsDecodeMs: median(() => decodeGame(columns)),
      })
      if (biome === 'meadow' && size > 16) {
        for (let x = at.x + 3; x <= at.x + 6; x++) for (let z = at.z - 6; z <= at.z - 3; z++) {
          const top = fixture.world.topY(x, z)
          for (let y = top + 1; y <= top + 3; y++) editWorld(fixture.world, { x, y, z }, y === top + 3 ? 'glass' : 'brick', 'place')
        }
        saves.set(size, encodeGame(fixture))
      }
    }
    terrain.dispose()
    geometry.dispose()
    for (const material of materials) material.dispose()
  }
  if (legacy.length) { console.log('Legacy full scans, modeled CPU matrix capacity'); console.table(legacy) }
  console.log('Indexed world, CPU terrain matrix bytes and retained typed arrays per reset')
  console.table(current)
  console.log('Save sizes with buildings and dense seeded input')
  console.table(compression)
} finally { await ssr.close() }
if (process.argv.includes('--browser')) await browserMetrics(saves, saveKey)
