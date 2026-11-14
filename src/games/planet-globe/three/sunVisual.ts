import * as THREE from 'three'

/**
 * 太陽(kind: 'star')専用の見た目。個別観察・全体表示で共有する。
 *
 * 他の天体はすべて`MeshStandardMaterial`(光源に照らされる通常の天体)だが、恒星は
 * 「自分で光っていて、影になる面がない」見た目のほうが太陽らしい。そこで太陽の球面だけ
 * 光源に依存しないShaderMaterialへ差し替え、既存の表面テクスチャ(帯+黒点)の上へ
 * 低コストな流れるノイズ、細かな粒状感、周縁減光(縁ほど少し暗く赤くなる)を重ねる。
 *
 * ノイズはUVではなく球面上の位置(3D)でサンプルする。UVで格子ノイズを引くと、球に貼ったときに
 * 格子の四角いマス目が目立ち、極ではすぼまった筋になるため。fbmの多重ループはせず、
 * 速度の異なる大きめの流れ2つと細かな粒状信号1つだけをvalue noiseで合成する(uTimeで動かす)。
 * Canvas側の黒点・帯模様(`celestialBodies.ts`のsurface)はそのまま活かす。
 */

/** 対流の谷(赤橙)と山(明るい黄白)。天体データではなくここに固定する
 *  (恒星は太陽1つしかなく、他天体へ流用する予定もないため)。 */
const SUN_COOL_COLOR = '#b8360a'
const SUN_HOT_COLOR_FALLBACK = '#fff3c4'
const SUN_RIM_COLOR_FALLBACK = '#ffb347'

const SUN_VERTEX_SHADER = `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vObjectPos;

void main() {
  vUv = uv;
  // 共有球は半径1なので、ローカル座標がそのまま球面上の単位ベクトルになる(自転にも追従する)。
  vObjectPos = position;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vViewDir = normalize(-mvPosition.xyz);
  gl_Position = projectionMatrix * mvPosition;
}
`

const SUN_FRAGMENT_SHADER = `
uniform sampler2D uMap;
uniform float uTime;
uniform vec3 uCoolColor;
uniform vec3 uHotColor;
uniform float uFlowStrength;
uniform vec3 uRimColor;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vObjectPos;

float hash(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}

// 3Dのvalue noise。8隅をsmoothstep補間する(1回あたりのhashは8回で、fbmのループはしない)。
float valueNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  float n000 = hash(i);
  float n100 = hash(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash(i + vec3(1.0, 1.0, 1.0));
  return mix(
    mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
    mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y),
    u.z
  );
}

void main() {
  vec3 base = texture2D(uMap, vUv).rgb;
  vec3 p = normalize(vObjectPos);

  // 速度・向きの異なる2枚のノイズを混ぜ、渦・ゆらぎのある流れに見せる。
  // 2枚目の入力を1枚目でわずかにずらし(ドメインワープ)、格子の向きが揃って見えないようにする。
  float flowA = valueNoise(p * 4.2 + vec3(uTime * 0.05, uTime * 0.03, -uTime * 0.02));
  float flowB = valueNoise(p * 7.5 + flowA * 1.4 - vec3(uTime * 0.03, -uTime * 0.025, uTime * 0.02));
  float flow = flowA * 0.55 + flowB * 0.45;
  // smoothstepでなだらかな平均値ではなく「対流の谷/山」がはっきり分かれた模様にする。
  float t = smoothstep(0.3, 0.72, flow);

  // 3つ目のvalue noiseは細かな粒状信号(粒状斑)だけに使い、表面へ軽いつぶつぶ感を足す。
  vec3 granulationUv = p * 20.0 + vec3(uTime * 0.02, -uTime * 0.015, uTime * 0.01);
  float granulation = valueNoise(granulationUv);
  float fineCells = smoothstep(0.2, 0.9, granulation);

  // 大きな流れと細粒の重なりをしきい値にし、いくつかの自然な明るい領域(白斑)を作る。
  float brightRegions = smoothstep(0.66, 0.84, flow) * smoothstep(0.46, 0.74, granulation);

  // 周縁減光: 本物の太陽は縁ほど温度の低い層が見え、暗く赤みが増す。
  float mu = clamp(dot(normalize(vNormal), normalize(vViewDir)), 0.0, 1.0);
  float limb = 1.0 - mu;

  // 「熱さ」1つの値に模様をまとめ、赤橙→橙→黄→白の色の並びへ写す。
  // 色を直接混ぜると彩度が抜けて桃色っぽく見えるため、温度の色並びから選ぶ。
  float heat = 0.62 + (t - 0.5) * 0.5 * uFlowStrength + (fineCells - 0.5) * 0.1 + brightRegions * 0.12;
  heat -= 0.42 * pow(limb, 1.6);
  heat = clamp(heat, 0.0, 1.0);
  // 中間色はリニア値(sRGBの #ff7a10 と #ffd75a)。uniformの色はTHREE.Colorがリニアへ変換済み。
  vec3 color = mix(uCoolColor, vec3(1.0, 0.195, 0.006), smoothstep(0.0, 0.42, heat));
  color = mix(color, uRimColor, smoothstep(0.38, 0.62, heat));
  color = mix(color, vec3(1.0, 0.68, 0.1), smoothstep(0.58, 0.8, heat));
  color = mix(color, uHotColor, smoothstep(0.78, 1.0, heat));

  // 暗い黒点(Canvas側のテクスチャ)は消さず、既存のスポット位置を維持する。
  float baseLuma = dot(base, vec3(0.299, 0.587, 0.114));
  color *= mix(0.4, 1.0, smoothstep(0.16, 0.65, baseLuma));

  // ゆっくりした全体の明滅("呼吸")。点滅ではなく緩やかな正弦波1つだけ。
  color *= 1.0 + 0.05 * sin(uTime * 0.6);
  // 縁へ向かって少しだけ暗くし、球の丸みを出す。
  color *= 1.0 - 0.22 * pow(limb, 2.4);

  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export type SunSurfaceMaterialParams = {
  map: THREE.CanvasTexture
  hotColor: string
  flowStrength: number
  rimColor: string
}

/** 太陽の球面用ShaderMaterialを作る。mapは呼び出し側がnullでないことを確認してから渡す
 *  (Canvas 2Dが使えない環境では呼び出し側がMeshStandardMaterialへフォールバックする)。 */
export function createSunSurfaceMaterial(params: SunSurfaceMaterialParams): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: SUN_VERTEX_SHADER,
    fragmentShader: SUN_FRAGMENT_SHADER,
    uniforms: {
      uMap: { value: params.map },
      uTime: { value: 0 },
      uCoolColor: { value: new THREE.Color(SUN_COOL_COLOR) },
      uHotColor: { value: new THREE.Color(params.hotColor || SUN_HOT_COLOR_FALLBACK) },
      uFlowStrength: { value: params.flowStrength },
      uRimColor: { value: new THREE.Color(params.rimColor || SUN_RIM_COLOR_FALLBACK) },
    },
  })
}

/** uTimeを進める。reduced-motionのときは呼び出し側がそもそも呼ばず、初期値0の静止した1コマのままにする。 */
export function updateSunSurfaceMaterial(material: THREE.ShaderMaterial, elapsedSeconds: number): void {
  material.uniforms.uTime.value = elapsedSeconds
}

/** 共有球の1.18倍の殻1枚。追加画像・粒子・ポストプロセスなしで外炎を描く。 */
export const SUN_CORONA_SCALE = 1.18

export function createSunCoronaMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: SUN_VERTEX_SHADER,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        vec3 n = normalize(vNormal);
        float facing = abs(dot(n, normalize(vViewDir)));
        float radius = sqrt(max(0.0, 1.0 - facing * facing));
        float angle = atan(n.y, n.x);
        // 整数周波数で角度の継ぎ目をなくす。外へ流れる細い炎と大きい舌を合成する。
        float wave = sin(angle * 19.0 + sin(angle * 7.0 + uTime * 0.7) * 2.0
          - uTime * 1.4 + radius * 25.0);
        float tongues = pow(0.5 + 0.5 * wave, 3.0);
        float reach = 0.88 + 0.095 * tongues + 0.014 * sin(angle * 11.0 - uTime);
        float flame = 1.0 - smoothstep(reach - 0.045, reach, radius);
        float halo = (1.0 - smoothstep(0.84, 1.0, radius)) * 0.16;
        float alpha = (flame * 0.72 + halo) * smoothstep(0.72, 0.85, radius);
        vec3 color = mix(vec3(1.0, 0.48, 0.035), vec3(1.0, 0.075, 0.008),
          smoothstep(0.84, 0.99, radius));
        gl_FragColor = vec4(color, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    uniforms: { uTime: { value: 0 } },
    side: THREE.BackSide,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
}

/** 外炎のさらに外へ広がる、やわらかい光のにじみ。直径を球半径の何倍にするか。 */
export const SUN_GLOW_DIAMETER_RATIO = 3.4

/** jsdomのように2Dコンテキストを持たない環境でも、例外にせず光のにじみだけ省く。 */
function get2dContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  try {
    return canvas.getContext('2d')
  } catch {
    return null
  }
}

/**
 * 太陽のまわりの光のにじみ(グロー)。小さな放射グラデーションのCanvasを1枚だけ焼き、
 * 常にカメラを向くSpriteとして球の後ろへ重ねる。ポストプロセス(ブルーム)を使わないため、
 * スマホでも描画コストは板1枚ぶんで済む。球より内側は太陽本体に隠れるので、縁から外だけが光って見える。
 * マテリアルを破棄するとテクスチャも一緒に破棄する(呼び出し側の破棄処理を増やさない)。
 */
export function createSunGlow(sunRadius: number): THREE.Sprite | null {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = get2dContext(canvas)
  if (ctx === null) return null

  const center = size / 2
  // 球の縁(半径比 1/3.4 ≒ 0.29)あたりから外へ、黄→橙→透明へ落とす。
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, center)
  gradient.addColorStop(0, 'rgba(255, 236, 170, 0.9)')
  gradient.addColorStop(0.28, 'rgba(255, 206, 110, 0.75)')
  gradient.addColorStop(0.36, 'rgba(255, 160, 60, 0.38)')
  gradient.addColorStop(0.55, 'rgba(255, 120, 40, 0.14)')
  gradient.addColorStop(0.78, 'rgba(255, 96, 32, 0.04)')
  gradient.addColorStop(1, 'rgba(255, 90, 30, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  material.addEventListener('dispose', () => texture.dispose())

  const sprite = new THREE.Sprite(material)
  sprite.scale.setScalar(sunRadius * SUN_GLOW_DIAMETER_RATIO)
  // 背景の星より手前、太陽本体・外炎より先に描く。
  sprite.renderOrder = -0.5
  return sprite
}
