/**
 * テスト専用の、録音できる AudioContext の代役。
 * ゲームの効果音コードが作ったノード・接続・オートメーションをそのまま記録し、
 * offlineRender.ts で波形へ描き起こして音量を測れるようにする。
 * 実際のブラウザ（Web Audio API 仕様）の挙動のうち、効果音の大きさに効くものだけを再現する。
 */

type ParamEvent =
  | { type: 'set'; time: number; value: number }
  | { type: 'linear'; time: number; value: number; callTime: number }
  | { type: 'exp'; time: number; value: number; callTime: number }
  | { type: 'target'; time: number; value: number; timeConstant: number }
  | { type: 'curve'; time: number; values: Float32Array; duration: number }

export type FakeConnection = {
  from: FakeAudioNode
  to: FakeAudioNode | FakeAudioParam
  /** 接続した時刻。これより前の音は流れない。 */
  start: number
  /** disconnect した時刻。これ以降の音は流れない。 */
  end: number
}

export class FakeAudioParam {
  readonly inputs: FakeConnection[] = []
  events: ParamEvent[] = []
  private intrinsicValue: number
  readonly context: FakeAudioContext
  readonly owner: FakeAudioNode
  readonly defaultValue: number
  readonly minValue = -3.4028234663852886e38
  readonly maxValue = 3.4028234663852886e38
  automationRate: 'a-rate' | 'k-rate' = 'a-rate'

  constructor(context: FakeAudioContext, owner: FakeAudioNode, defaultValue: number) {
    this.context = context
    this.owner = owner
    this.defaultValue = defaultValue
    this.intrinsicValue = defaultValue
  }

  get value(): number {
    return this.valueAt(this.context.currentTime)
  }

  /** 仕様どおり、value の代入は現在時刻の setValueAtTime と同じに扱う。 */
  set value(value: number) {
    if (this.events.length === 0) this.intrinsicValue = value
    this.insert({ type: 'set', time: this.context.currentTime, value })
  }

  hasAutomation(): boolean {
    return this.events.length > 0
  }

  setValueAtTime(value: number, time: number): this {
    this.insert({ type: 'set', time, value })
    return this
  }

  linearRampToValueAtTime(value: number, time: number): this {
    this.insert({ type: 'linear', time, value, callTime: this.context.currentTime })
    return this
  }

  exponentialRampToValueAtTime(value: number, time: number): this {
    if (value === 0 || !Number.isFinite(value)) throw new RangeError('exponentialRampToValueAtTime: value must be non-zero')
    this.insert({ type: 'exp', time, value, callTime: this.context.currentTime })
    return this
  }

  setTargetAtTime(value: number, time: number, timeConstant: number): this {
    this.insert({ type: 'target', time, value, timeConstant: Math.max(1e-6, timeConstant) })
    return this
  }

  setValueCurveAtTime(values: ArrayLike<number>, time: number, duration: number): this {
    this.insert({ type: 'curve', time, values: Float32Array.from(values), duration })
    return this
  }

  cancelScheduledValues(time: number): this {
    this.events = this.events.filter((event) => event.time < time)
    return this
  }

  cancelAndHoldAtTime(time: number): this {
    const held = this.valueAt(time)
    this.cancelScheduledValues(time)
    this.insert({ type: 'set', time, value: held })
    return this
  }

  /** オートメーションだけから求めた値（音声入力による変調は含まない）。 */
  valueAt(time: number): number {
    return this.evaluate(time, this.events.length)
  }

  private insert(event: ParamEvent): void {
    if (!Number.isFinite(event.time)) throw new TypeError('AudioParam: time must be finite')
    // 同じ時刻のイベントは後から足したものを後ろへ置く（仕様の挿入規則）。
    let index = this.events.length
    while (index > 0 && this.events[index - 1].time > event.time) index--
    this.events.splice(index, 0, event)
  }

  /** events[0, limit) だけを見たときの time 時点の値。setTarget の起点計算で再帰的に使う。 */
  private evaluate(time: number, limit: number): number {
    const events = this.events
    let last = -1
    for (let i = 0; i < limit; i++) {
      if (events[i].time <= time) last = i
      else break
    }
    const next = last + 1 < limit ? events[last + 1] : undefined
    if (next && (next.type === 'linear' || next.type === 'exp')) {
      const start = this.rampStart(last, next)
      if (time < start.time) return start.value
      const span = next.time - start.time
      const progress = span > 0 ? (time - start.time) / span : 1
      if (next.type === 'linear') return start.value + (next.value - start.value) * progress
      if (start.value === 0 || start.value * next.value < 0) return start.value
      return start.value * (next.value / start.value) ** progress
    }
    if (last < 0) return this.intrinsicValue
    const event = events[last]
    switch (event.type) {
      case 'set':
      case 'linear':
      case 'exp':
        return event.value
      case 'target': {
        const from = this.evaluate(event.time, last)
        return event.value + (from - event.value) * Math.exp(-(time - event.time) / event.timeConstant)
      }
      case 'curve': {
        const { values, duration } = event
        if (values.length === 0) return this.intrinsicValue
        if (time >= event.time + duration) return values[values.length - 1]
        const position = ((time - event.time) / duration) * (values.length - 1)
        const index = Math.floor(position)
        const fraction = position - index
        const a = values[index]
        const b = values[Math.min(values.length - 1, index + 1)]
        return a + (b - a) * fraction
      }
    }
  }

  private rampStart(lastIndex: number, ramp: Extract<ParamEvent, { type: 'linear' | 'exp' }>): { time: number; value: number } {
    if (lastIndex < 0) return { time: ramp.callTime, value: this.intrinsicValue }
    const previous = this.events[lastIndex]
    if (previous.type === 'target') {
      const time = Math.max(previous.time, ramp.callTime)
      return { time, value: this.evaluate(time, lastIndex + 1) }
    }
    if (previous.type === 'curve') {
      return { time: previous.time + previous.duration, value: previous.values[previous.values.length - 1] ?? this.intrinsicValue }
    }
    return { time: previous.time, value: previous.value }
  }
}

let nextNodeId = 1

export class FakeAudioNode {
  readonly id = nextNodeId++
  readonly context: FakeAudioContext
  readonly inputs: FakeConnection[] = []
  readonly outputs: FakeConnection[] = []
  channelCount = 2
  channelCountMode: ChannelCountMode = 'max'
  channelInterpretation: ChannelInterpretation = 'speakers'
  numberOfInputs = 1
  numberOfOutputs = 1

  constructor(context: FakeAudioContext) {
    this.context = context
    context.nodes.push(this)
  }

  connect<T extends FakeAudioNode | FakeAudioParam>(target: T): T extends FakeAudioNode ? T : undefined {
    if (!(target instanceof FakeAudioNode) && !(target instanceof FakeAudioParam)) {
      throw new TypeError('connect: target must be an AudioNode or AudioParam')
    }
    const connection: FakeConnection = { from: this, to: target, start: this.context.currentTime, end: Infinity }
    this.outputs.push(connection)
    target.inputs.push(connection)
    return (target instanceof FakeAudioNode ? target : undefined) as T extends FakeAudioNode ? T : undefined
  }

  disconnect(target?: FakeAudioNode | FakeAudioParam | number): void {
    const now = this.context.currentTime
    for (const connection of this.outputs) {
      if (connection.end !== Infinity) continue
      if (target === undefined || typeof target === 'number' || connection.to === target) connection.end = now
    }
  }

  addEventListener(): void {}
  removeEventListener(): void {}
  dispatchEvent(): boolean { return true }
}

export class FakeAudioDestinationNode extends FakeAudioNode {
  maxChannelCount = 2
  numberOfOutputs = 0
}

export class FakeAudioScheduledSourceNode extends FakeAudioNode {
  startTime: number | undefined
  stopTime = Infinity
  onended: ((this: FakeAudioScheduledSourceNode, event: Event) => unknown) | null = null
  numberOfInputs = 0

  start(when = 0): void {
    if (this.startTime !== undefined) throw new Error('InvalidStateError: start() called twice')
    this.startTime = Math.max(when, this.context.currentTime)
    this.context.startedSources.push(this)
  }

  stop(when = 0): void {
    if (this.startTime === undefined) throw new Error('InvalidStateError: stop() before start()')
    this.stopTime = Math.max(when, this.context.currentTime)
  }
}

export class FakeOscillatorNode extends FakeAudioScheduledSourceNode {
  private oscillatorType: OscillatorType = 'sine'
  periodicWave: FakePeriodicWave | undefined
  readonly frequency: FakeAudioParam
  readonly detune: FakeAudioParam

  constructor(context: FakeAudioContext) {
    super(context)
    this.frequency = new FakeAudioParam(context, this, 440)
    this.detune = new FakeAudioParam(context, this, 0)
  }

  get type(): OscillatorType {
    return this.oscillatorType
  }

  set type(type: OscillatorType) {
    if (type === 'custom') throw new Error('InvalidStateError: use setPeriodicWave()')
    this.oscillatorType = type
    this.periodicWave = undefined
  }

  setPeriodicWave(wave: FakePeriodicWave): void {
    this.oscillatorType = 'custom'
    this.periodicWave = wave
  }
}

export class FakeGainNode extends FakeAudioNode {
  readonly gain: FakeAudioParam
  constructor(context: FakeAudioContext) {
    super(context)
    this.gain = new FakeAudioParam(context, this, 1)
  }
}

export class FakeBiquadFilterNode extends FakeAudioNode {
  type: BiquadFilterType = 'lowpass'
  readonly frequency: FakeAudioParam
  readonly detune: FakeAudioParam
  readonly Q: FakeAudioParam
  readonly gain: FakeAudioParam
  constructor(context: FakeAudioContext) {
    super(context)
    this.frequency = new FakeAudioParam(context, this, 350)
    this.detune = new FakeAudioParam(context, this, 0)
    this.Q = new FakeAudioParam(context, this, 1)
    this.gain = new FakeAudioParam(context, this, 0)
  }
  getFrequencyResponse(): void {}
}

export class FakeAudioBufferSourceNode extends FakeAudioScheduledSourceNode {
  buffer: FakeAudioBuffer | null = null
  loop = false
  loopStart = 0
  loopEnd = 0
  startOffset = 0
  readonly playbackRate: FakeAudioParam
  readonly detune: FakeAudioParam

  constructor(context: FakeAudioContext) {
    super(context)
    this.playbackRate = new FakeAudioParam(context, this, 1)
    this.detune = new FakeAudioParam(context, this, 0)
  }

  start(when = 0, offset = 0, duration?: number): void {
    super.start(when)
    this.startOffset = Math.max(0, offset)
    if (duration !== undefined && this.startTime !== undefined) this.stopTime = this.startTime + Math.max(0, duration)
  }
}

export class FakeDelayNode extends FakeAudioNode {
  readonly delayTime: FakeAudioParam
  readonly maxDelayTime: number
  constructor(context: FakeAudioContext, maxDelayTime = 1) {
    super(context)
    this.maxDelayTime = maxDelayTime
    this.delayTime = new FakeAudioParam(context, this, 0)
  }
}

export class FakeDynamicsCompressorNode extends FakeAudioNode {
  readonly threshold: FakeAudioParam
  readonly knee: FakeAudioParam
  readonly ratio: FakeAudioParam
  readonly attack: FakeAudioParam
  readonly release: FakeAudioParam
  readonly reduction = 0
  constructor(context: FakeAudioContext) {
    super(context)
    this.threshold = new FakeAudioParam(context, this, -24)
    this.knee = new FakeAudioParam(context, this, 30)
    this.ratio = new FakeAudioParam(context, this, 12)
    this.attack = new FakeAudioParam(context, this, 0.003)
    this.release = new FakeAudioParam(context, this, 0.25)
  }
}

export class FakeStereoPannerNode extends FakeAudioNode {
  readonly pan: FakeAudioParam
  constructor(context: FakeAudioContext) {
    super(context)
    this.pan = new FakeAudioParam(context, this, 0)
  }
}

export class FakePeriodicWave {
  readonly real: Float32Array
  readonly imag: Float32Array
  readonly normalize: boolean
  constructor(real: ArrayLike<number>, imag: ArrayLike<number>, normalize = true) {
    this.real = Float32Array.from(real)
    this.imag = Float32Array.from(imag)
    this.normalize = normalize
  }
}

export class FakeAudioBuffer {
  readonly numberOfChannels: number
  readonly length: number
  readonly sampleRate: number
  private readonly channels: Float32Array[]
  constructor(numberOfChannels: number, length: number, sampleRate: number) {
    this.numberOfChannels = numberOfChannels
    this.length = length
    this.sampleRate = sampleRate
    this.channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length))
  }
  get duration(): number {
    return this.length / this.sampleRate
  }
  getChannelData(channel: number): Float32Array {
    return this.channels[channel]
  }
  copyToChannel(source: Float32Array, channel: number, offset = 0): void {
    this.channels[channel].set(source.subarray(0, this.length - offset), offset)
  }
  copyFromChannel(destination: Float32Array, channel: number, offset = 0): void {
    destination.set(this.channels[channel].subarray(offset, offset + destination.length))
  }
}

export class FakeAudioContext {
  /** 測定の精度と速さの釣り合い。K特性フィルタと帯域制限オシレーターはこの値で計算する。 */
  static defaultSampleRate = 48_000
  static readonly instances: FakeAudioContext[] = []
  /** 新しい Context が作られたことを計測器へ知らせる（ピアノのように再生中に作るゲームがあるため）。 */
  static onCreate: ((context: FakeAudioContext) => void) | undefined

  readonly sampleRate: number
  readonly nodes: FakeAudioNode[] = []
  readonly startedSources: FakeAudioScheduledSourceNode[] = []
  readonly destination: FakeAudioDestinationNode
  currentTime = 0
  state: AudioContextState = 'running'
  baseLatency = 0
  outputLatency = 0
  onstatechange: (() => void) | null = null

  constructor(options?: { sampleRate?: number }) {
    this.sampleRate = options?.sampleRate ?? FakeAudioContext.defaultSampleRate
    this.destination = new FakeAudioDestinationNode(this)
    FakeAudioContext.instances.push(this)
    FakeAudioContext.onCreate?.(this)
  }

  resume(): Promise<void> {
    if (this.state !== 'closed') this.state = 'running'
    return Promise.resolve()
  }

  suspend(): Promise<void> {
    if (this.state !== 'closed') this.state = 'suspended'
    return Promise.resolve()
  }

  close(): Promise<void> {
    this.state = 'closed'
    return Promise.resolve()
  }

  createOscillator(): FakeOscillatorNode { return new FakeOscillatorNode(this) }
  createGain(): FakeGainNode { return new FakeGainNode(this) }
  createBiquadFilter(): FakeBiquadFilterNode { return new FakeBiquadFilterNode(this) }
  createBufferSource(): FakeAudioBufferSourceNode { return new FakeAudioBufferSourceNode(this) }
  createDelay(maxDelayTime = 1): FakeDelayNode { return new FakeDelayNode(this, maxDelayTime) }
  createDynamicsCompressor(): FakeDynamicsCompressorNode { return new FakeDynamicsCompressorNode(this) }
  createStereoPanner(): FakeStereoPannerNode { return new FakeStereoPannerNode(this) }

  createBuffer(numberOfChannels: number, length: number, sampleRate: number): FakeAudioBuffer {
    return new FakeAudioBuffer(numberOfChannels, length, sampleRate)
  }

  createPeriodicWave(real: ArrayLike<number>, imag: ArrayLike<number>, constraints?: { disableNormalization?: boolean }): FakePeriodicWave {
    return new FakePeriodicWave(real, imag, !constraints?.disableNormalization)
  }

  decodeAudioData(): Promise<FakeAudioBuffer> {
    return Promise.reject(new Error('FakeAudioContext cannot decode audio files'))
  }

  addEventListener(): void {}
  removeEventListener(): void {}
}
