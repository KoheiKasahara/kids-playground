/**
 * fakeAudioContext.ts が記録したノードの配線を、モノラルの波形へ描き起こすテスト専用のレンダラー。
 * Web Audio と同じく 128 サンプルずつ処理し、DelayNode を含む帰還ループも扱える。
 * オシレーターは帯域制限した波形表で鳴らし、折り返しノイズで音量が水増しされないようにする。
 */
import {
  FakeAudioBufferSourceNode,
  FakeAudioParam,
  FakeBiquadFilterNode,
  FakeDelayNode,
  FakeGainNode,
  FakeOscillatorNode,
  FakePeriodicWave,
  type FakeAudioContext,
  type FakeAudioNode,
  type FakeAudioScheduledSourceNode,
} from './fakeAudioContext'

const QUANTUM = 128
const TABLE_SIZE = 2048
const TABLE_MASK = TABLE_SIZE - 1

export type RenderOptions = {
  /** 描き起こす音源。録音区間中に start() されたノードだけを渡す。 */
  sources: readonly FakeAudioScheduledSourceNode[]
  /** この先へ流れた音を「出力された音」として集計する（共通出口や destination）。 */
  sinks: ReadonlySet<FakeAudioNode>
  from: number
  duration: number
}

type NodeState = {
  node: FakeAudioNode
  output: Float32Array
  input: Float32Array
  phase: number
  bufferPosition: number
  filter: { x1: number; x2: number; y1: number; y2: number }
  delayLine?: Float32Array
  delayWrite: number
}

export function renderMono(context: FakeAudioContext, options: RenderOptions): Float32Array {
  const sampleRate = context.sampleRate
  const totalSamples = Math.max(QUANTUM, Math.ceil((options.duration * sampleRate) / QUANTUM) * QUANTUM)
  const mix = new Float32Array(totalSamples)
  const relevant = collectRelevantNodes(options.sources, options.sinks)
  if (relevant.size === 0) return mix

  const order = sortForProcessing(relevant)
  const states = new Map<FakeAudioNode, NodeState>()
  for (const node of order) {
    states.set(node, {
      node,
      output: new Float32Array(QUANTUM),
      input: new Float32Array(QUANTUM),
      phase: 0,
      bufferPosition: node instanceof FakeAudioBufferSourceNode && node.buffer ? node.startOffset * node.buffer.sampleRate : 0,
      filter: { x1: 0, x2: 0, y1: 0, y2: 0 },
      delayLine: node instanceof FakeDelayNode
        ? new Float32Array(Math.ceil((node.maxDelayTime + 0.1) * sampleRate) + QUANTUM * 2)
        : undefined,
      delayWrite: 0,
    })
  }
  const paramScratch = new Map<FakeAudioParam, Float32Array>()
  const param = (target: FakeAudioParam, blockStart: number): Float32Array => {
    let values = paramScratch.get(target)
    if (!values) {
      values = new Float32Array(QUANTUM)
      paramScratch.set(target, values)
    }
    fillParam(target, blockStart, sampleRate, values, relevant, states)
    return values
  }

  for (let offset = 0; offset < totalSamples; offset += QUANTUM) {
    const blockStart = options.from + offset / sampleRate
    for (const node of order) {
      const state = states.get(node)!
      if (node instanceof FakeDelayNode) {
        readDelay(state, node, param(node.delayTime, blockStart), sampleRate)
        continue
      }
      sumInputs(state, relevant, states, blockStart)
      if (node instanceof FakeOscillatorNode) renderOscillator(state, node, blockStart, sampleRate, param)
      else if (node instanceof FakeAudioBufferSourceNode) renderBufferSource(state, node, blockStart, sampleRate, param)
      else if (node instanceof FakeGainNode) {
        const gain = param(node.gain, blockStart)
        for (let i = 0; i < QUANTUM; i++) state.output[i] = state.input[i] * gain[i]
      } else if (node instanceof FakeBiquadFilterNode) renderBiquad(state, node, blockStart, sampleRate, param)
      else state.output.set(state.input) // 合成に効かないノード（パンなど）は素通しにする
    }
    // DelayNode は「過去の入力」だけを出すので、全ノードを処理し終えてから今回の入力を書き込む。
    for (const node of order) {
      if (!(node instanceof FakeDelayNode)) continue
      const state = states.get(node)!
      sumInputs(state, relevant, states, blockStart)
      writeDelay(state)
    }
    for (const sink of options.sinks) {
      for (const connection of sink.inputs) {
        if (!relevant.has(connection.from) || !isActive(connection, blockStart)) continue
        const source = states.get(connection.from)!.output
        for (let i = 0; i < QUANTUM; i++) mix[offset + i] += source[i]
      }
    }
  }
  return mix
}

/** 音源から出口まで実際に音が届くノードだけを集める（無関係な古いノードは描かない）。 */
function collectRelevantNodes(
  sources: readonly FakeAudioScheduledSourceNode[],
  sinks: ReadonlySet<FakeAudioNode>,
): Set<FakeAudioNode> {
  const forward = new Set<FakeAudioNode>()
  const stack: FakeAudioNode[] = [...sources]
  while (stack.length > 0) {
    const node = stack.pop()!
    if (forward.has(node) || sinks.has(node)) continue
    forward.add(node)
    for (const connection of node.outputs) {
      const next = connection.to instanceof FakeAudioParam ? connection.to.owner : connection.to
      if (!forward.has(next)) stack.push(next)
    }
  }
  const reachesSink = new Set<FakeAudioNode>()
  let changed = true
  while (changed) {
    changed = false
    for (const node of forward) {
      if (reachesSink.has(node)) continue
      const reaches = node.outputs.some((connection) => {
        const next = connection.to instanceof FakeAudioParam ? connection.to.owner : connection.to
        return sinks.has(next) || reachesSink.has(next)
      })
      if (reaches) {
        reachesSink.add(node)
        changed = true
      }
    }
  }
  return reachesSink
}

/** 依存の少ない順に並べる。DelayNode は過去の入力しか使わないので、帰還ループの切れ目として先頭側へ置ける。 */
function sortForProcessing(nodes: Set<FakeAudioNode>): FakeAudioNode[] {
  const dependencies = new Map<FakeAudioNode, Set<FakeAudioNode>>()
  for (const node of nodes) {
    const deps = new Set<FakeAudioNode>()
    if (!(node instanceof FakeDelayNode)) {
      for (const connection of node.inputs) if (nodes.has(connection.from)) deps.add(connection.from)
    }
    for (const value of Object.values(node)) {
      if (!(value instanceof FakeAudioParam)) continue
      for (const connection of value.inputs) if (nodes.has(connection.from)) deps.add(connection.from)
    }
    dependencies.set(node, deps)
  }
  const ordered: FakeAudioNode[] = []
  const done = new Set<FakeAudioNode>()
  while (ordered.length < nodes.size) {
    let progressed = false
    for (const node of nodes) {
      if (done.has(node)) continue
      if ([...dependencies.get(node)!].every((dep) => done.has(dep))) {
        ordered.push(node)
        done.add(node)
        progressed = true
      }
    }
    if (!progressed) throw new Error('offlineRender: DelayNode を含まない帰還ループは描けません')
  }
  return ordered
}

function isActive(connection: { start: number; end: number }, time: number): boolean {
  return connection.start <= time + 1e-9 && time < connection.end
}

function sumInputs(state: NodeState, relevant: Set<FakeAudioNode>, states: Map<FakeAudioNode, NodeState>, blockStart: number): void {
  state.input.fill(0)
  for (const connection of state.node.inputs) {
    if (!relevant.has(connection.from) || !isActive(connection, blockStart)) continue
    const source = states.get(connection.from)!.output
    for (let i = 0; i < QUANTUM; i++) state.input[i] += source[i]
  }
}

function fillParam(
  target: FakeAudioParam,
  blockStart: number,
  sampleRate: number,
  out: Float32Array,
  relevant: Set<FakeAudioNode>,
  states: Map<FakeAudioNode, NodeState>,
): void {
  if (target.hasAutomation()) {
    for (let i = 0; i < QUANTUM; i++) out[i] = target.valueAt(blockStart + i / sampleRate)
  } else {
    out.fill(target.valueAt(blockStart))
  }
  for (const connection of target.inputs) {
    if (!relevant.has(connection.from) || !isActive(connection, blockStart)) continue
    const source = states.get(connection.from)!.output
    for (let i = 0; i < QUANTUM; i++) out[i] += source[i]
  }
}

type ParamReader = (target: FakeAudioParam, blockStart: number) => Float32Array

function renderOscillator(state: NodeState, node: FakeOscillatorNode, blockStart: number, sampleRate: number, param: ParamReader): void {
  const output = state.output
  output.fill(0)
  const start = node.startTime ?? Infinity
  const blockEnd = blockStart + QUANTUM / sampleRate
  if (blockEnd <= start || blockStart >= node.stopTime) return
  const frequency = param(node.frequency, blockStart)
  const detune = node.detune.hasAutomation() || node.detune.inputs.length > 0 ? param(node.detune, blockStart) : undefined
  const nyquist = sampleRate / 2
  for (let i = 0; i < QUANTUM; i++) {
    const time = blockStart + i / sampleRate
    if (time < start || time >= node.stopTime) continue
    let hz = frequency[i]
    if (detune) hz *= 2 ** (detune[i] / 1200)
    if (!Number.isFinite(hz) || Math.abs(hz) >= nyquist) {
      continue
    }
    const table = waveTable(node, Math.abs(hz), nyquist)
    const position = state.phase * TABLE_SIZE
    const index = Math.floor(position)
    const fraction = position - index
    const a = table[index & TABLE_MASK]
    const b = table[(index + 1) & TABLE_MASK]
    output[i] = a + (b - a) * fraction
    state.phase += hz / sampleRate
    state.phase -= Math.floor(state.phase)
  }
}

function renderBufferSource(state: NodeState, node: FakeAudioBufferSourceNode, blockStart: number, sampleRate: number, param: ParamReader): void {
  const output = state.output
  output.fill(0)
  const buffer = node.buffer
  const start = node.startTime ?? Infinity
  if (!buffer || buffer.length === 0) return
  const blockEnd = blockStart + QUANTUM / sampleRate
  if (blockEnd <= start || blockStart >= node.stopTime) return
  const rate = param(node.playbackRate, blockStart)
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, channel) => buffer.getChannelData(channel))
  const step = buffer.sampleRate / sampleRate
  const loopStart = node.loop && node.loopEnd > node.loopStart ? node.loopStart * buffer.sampleRate : 0
  const loopEnd = node.loop && node.loopEnd > node.loopStart ? Math.min(buffer.length, node.loopEnd * buffer.sampleRate) : buffer.length
  for (let i = 0; i < QUANTUM; i++) {
    const time = blockStart + i / sampleRate
    if (time < start || time >= node.stopTime) continue
    let position = state.bufferPosition
    if (node.loop) {
      const span = loopEnd - loopStart
      if (span > 0 && position >= loopEnd) position = loopStart + ((position - loopStart) % span)
    } else if (position >= buffer.length) {
      continue
    }
    const index = Math.floor(position)
    const fraction = position - index
    let sample = 0
    for (const data of channels) {
      const a = data[index] ?? 0
      const b = data[Math.min(buffer.length - 1, index + 1)] ?? 0
      sample += a + (b - a) * fraction
    }
    output[i] = sample / channels.length
    state.bufferPosition = position + rate[i] * step
  }
}

function renderBiquad(state: NodeState, node: FakeBiquadFilterNode, blockStart: number, sampleRate: number, param: ParamReader): void {
  // 係数は 32 サンプルごとに更新する（周波数スイープでも十分滑らかで、計算量を抑えられる）。
  const frequency = param(node.frequency, blockStart)
  const q = param(node.Q, blockStart)
  const gain = param(node.gain, blockStart)
  const detune = param(node.detune, blockStart)
  const s = state.filter
  let coefficients = biquadCoefficients(node.type, frequency[0] * 2 ** (detune[0] / 1200), q[0], gain[0], sampleRate)
  for (let i = 0; i < QUANTUM; i++) {
    if (i > 0 && i % 32 === 0) coefficients = biquadCoefficients(node.type, frequency[i] * 2 ** (detune[i] / 1200), q[i], gain[i], sampleRate)
    const [b0, b1, b2, a1, a2] = coefficients
    const x = state.input[i]
    const y = b0 * x + b1 * s.x1 + b2 * s.x2 - a1 * s.y1 - a2 * s.y2
    s.x2 = s.x1
    s.x1 = x
    s.y2 = s.y1
    s.y1 = Number.isFinite(y) ? y : 0
    state.output[i] = s.y1
  }
}

/** Web Audio 仕様（Audio EQ Cookbook 準拠）の BiquadFilter 係数。a0 で正規化して返す。 */
export function biquadCoefficients(
  type: BiquadFilterType,
  frequency: number,
  q: number,
  gainDb: number,
  sampleRate: number,
): [number, number, number, number, number] {
  const nyquist = sampleRate / 2
  const f0 = Math.min(Math.max(frequency, 1), nyquist * 0.999)
  const w0 = (2 * Math.PI * f0) / sampleRate
  const cos = Math.cos(w0)
  const sin = Math.sin(w0)
  const A = 10 ** (gainDb / 40)
  const alphaQ = sin / (2 * Math.max(q, 1e-4))
  const alphaQdB = sin / (2 * 10 ** (q / 20))
  const alphaS = (sin / 2) * Math.SQRT2
  let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number
  switch (type) {
    case 'highpass':
      b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = (1 + cos) / 2
      a0 = 1 + alphaQdB; a1 = -2 * cos; a2 = 1 - alphaQdB
      break
    case 'bandpass':
      b0 = alphaQ; b1 = 0; b2 = -alphaQ
      a0 = 1 + alphaQ; a1 = -2 * cos; a2 = 1 - alphaQ
      break
    case 'notch':
      b0 = 1; b1 = -2 * cos; b2 = 1
      a0 = 1 + alphaQ; a1 = -2 * cos; a2 = 1 - alphaQ
      break
    case 'allpass':
      b0 = 1 - alphaQ; b1 = -2 * cos; b2 = 1 + alphaQ
      a0 = 1 + alphaQ; a1 = -2 * cos; a2 = 1 - alphaQ
      break
    case 'peaking':
      b0 = 1 + alphaQ * A; b1 = -2 * cos; b2 = 1 - alphaQ * A
      a0 = 1 + alphaQ / A; a1 = -2 * cos; a2 = 1 - alphaQ / A
      break
    case 'lowshelf': {
      const k = 2 * alphaS * Math.sqrt(A)
      b0 = A * ((A + 1) - (A - 1) * cos + k); b1 = 2 * A * ((A - 1) - (A + 1) * cos); b2 = A * ((A + 1) - (A - 1) * cos - k)
      a0 = (A + 1) + (A - 1) * cos + k; a1 = -2 * ((A - 1) + (A + 1) * cos); a2 = (A + 1) + (A - 1) * cos - k
      break
    }
    case 'highshelf': {
      const k = 2 * alphaS * Math.sqrt(A)
      b0 = A * ((A + 1) + (A - 1) * cos + k); b1 = -2 * A * ((A - 1) + (A + 1) * cos); b2 = A * ((A + 1) + (A - 1) * cos - k)
      a0 = (A + 1) - (A - 1) * cos + k; a1 = 2 * ((A - 1) - (A + 1) * cos); a2 = (A + 1) - (A - 1) * cos - k
      break
    }
    case 'lowpass':
    default:
      b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = (1 - cos) / 2
      a0 = 1 + alphaQdB; a1 = -2 * cos; a2 = 1 - alphaQdB
      break
  }
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0]
}

function readDelay(state: NodeState, node: FakeDelayNode, delayTime: Float32Array, sampleRate: number): void {
  const line = state.delayLine!
  for (let i = 0; i < QUANTUM; i++) {
    // 帰還ループ内の遅延はブラウザでも最低 1 レンダー単位（128 サンプル）になる。
    const delaySamples = Math.min(Math.max(delayTime[i] * sampleRate, QUANTUM), node.maxDelayTime * sampleRate + QUANTUM)
    let read = state.delayWrite + i - delaySamples
    while (read < 0) read += line.length
    const index = Math.floor(read)
    const fraction = read - index
    const a = line[index % line.length]
    const b = line[(index + 1) % line.length]
    state.output[i] = a + (b - a) * fraction
  }
}

function writeDelay(state: NodeState): void {
  const line = state.delayLine!
  for (let i = 0; i < QUANTUM; i++) line[(state.delayWrite + i) % line.length] = state.input[i]
  state.delayWrite = (state.delayWrite + QUANTUM) % line.length
}

// ---- 帯域制限した波形表 -------------------------------------------------------

/** 倍音数の段階。周波数ごとに表を作り直さず、この段階のどれかへ丸めて使い回す。 */
const HARMONIC_LADDER = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128, 160, 192, 256, 320, 384, 512, 640, 768, 1023]
const SIN_TABLE = Float32Array.from({ length: TABLE_SIZE }, (_, i) => Math.sin((2 * Math.PI * i) / TABLE_SIZE))
const builtInTables = new Map<string, Float32Array>()
const builtInScale = new Map<OscillatorType, number>()
const customTables = new WeakMap<FakePeriodicWave, Map<number, Float32Array>>()
const customScale = new WeakMap<FakePeriodicWave, number>()

function ladderStep(maxHarmonics: number): number {
  let chosen = 1
  for (const step of HARMONIC_LADDER) if (step <= maxHarmonics) chosen = step
  return chosen
}

function builtInCoefficient(type: OscillatorType, k: number): number {
  switch (type) {
    case 'square':
      return k % 2 === 1 ? 4 / (Math.PI * k) : 0
    case 'sawtooth':
      return ((k % 2 === 1 ? 1 : -1) * 2) / (Math.PI * k)
    case 'triangle':
      return k % 2 === 1 ? ((((k - 1) / 2) % 2 === 0 ? 1 : -1) * 8) / (Math.PI * Math.PI * k * k) : 0
    case 'sine':
    default:
      return k === 1 ? 1 : 0
  }
}

function synthesize(harmonics: number, coefficient: (k: number) => { real: number; imag: number }): Float32Array {
  const table = new Float32Array(TABLE_SIZE)
  const quarter = TABLE_SIZE / 4
  for (let k = 1; k <= harmonics; k++) {
    const { real, imag } = coefficient(k)
    if (real === 0 && imag === 0) continue
    for (let j = 0; j < TABLE_SIZE; j++) {
      const angle = (k * j) & TABLE_MASK
      table[j] += imag * SIN_TABLE[angle] + real * SIN_TABLE[(angle + quarter) & TABLE_MASK]
    }
  }
  return table
}

function peak(table: Float32Array): number {
  let max = 0
  for (const value of table) max = Math.max(max, Math.abs(value))
  return max || 1
}

/** ブラウザと同じく、全帯域の波形の最大値が 1 になる倍率で、帯域制限版もそろえて縮める。 */
function waveTable(node: FakeOscillatorNode, frequency: number, nyquist: number): Float32Array {
  const maxHarmonics = Math.max(1, Math.floor(nyquist / Math.max(frequency, 1e-3)))
  const wave = node.periodicWave
  if (node.type === 'custom' && wave) {
    const available = Math.max(1, Math.max(wave.real.length, wave.imag.length) - 1)
    const harmonics = ladderStep(Math.min(maxHarmonics, available))
    let tables = customTables.get(wave)
    if (!tables) {
      tables = new Map()
      customTables.set(wave, tables)
    }
    let table = tables.get(harmonics)
    if (!table) {
      const coefficient = (k: number) => ({ real: wave.real[k] ?? 0, imag: wave.imag[k] ?? 0 })
      let scale = customScale.get(wave)
      if (scale === undefined) {
        scale = wave.normalize ? 1 / peak(synthesize(available, coefficient)) : 1
        customScale.set(wave, scale)
      }
      table = synthesize(Math.min(harmonics, available), coefficient).map((value) => value * scale!)
      tables.set(harmonics, table)
    }
    return table
  }
  const type = node.type === 'custom' ? 'sine' : node.type
  const harmonics = type === 'sine' ? 1 : ladderStep(maxHarmonics)
  const key = `${type}:${harmonics}`
  let table = builtInTables.get(key)
  if (!table) {
    const coefficient = (k: number) => ({ real: 0, imag: builtInCoefficient(type, k) })
    let scale = builtInScale.get(type)
    if (scale === undefined) {
      scale = 1 / peak(synthesize(type === 'sine' ? 1 : 1023, coefficient))
      builtInScale.set(type, scale)
    }
    table = synthesize(harmonics, coefficient).map((value) => value * scale!)
    builtInTables.set(key, table)
  }
  return table
}
