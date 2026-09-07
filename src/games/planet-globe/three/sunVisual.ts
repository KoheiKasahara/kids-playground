import * as THREE from 'three'

/**
 * 太陽(kind: 'star')専用の見た目。個別観察・全体表示で共有する。
 *
 * 他の天体はすべて`MeshStandardMaterial`(光源に照らされる通常の天体)だが、恒星は
 * 「自分で光っていて、影になる面がない」見た目のほうが太陽らしい。そこで太陽の球面だけ
 * 光源に依存しないShaderMaterialへ差し替え、既存の表面テクスチャ(帯+黒点)の上へ
 * 低コストな流れるノイズ、細かな粒状感、Fresnel状の縁発光を重ねる。
 *
 * ノイズはfbmではなく、速度の異なる大きめの流れ2つと細かな粒状信号1つだけを
 * value noiseで合成する(uTimeで動かす)。Canvas側の黒点・帯模様
 * (`celestialBodies.ts`のsurface)はそのまま活かし、シェーダーの計算量を抑えたまま
 * 「表面が流れて動く」印象を作る。
 */

/** 対流の谷(赤橙)と山(明るい黄白)。天体データではなくここに固定する
 *  (恒星は太陽1つしかなく、他天体へ流用する予定もないため)。 */
const SUN_COOL_COLOR = '#c83e08'
const SUN_HOT_COLOR_FALLBACK = '#fff3c4'
const SUN_RIM_COLOR_FALLBACK = '#ffb347'

const SUN_VERTEX_SHADER = `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
  vUv = uv;
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

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

void main() {
  vec3 base = texture2D(uMap, vUv).rgb;

  // 速度・向きの異なる2枚のノイズを混ぜ、渦・ゆらぎのある流れに見せる(fbmの多重ループはしない)。
  vec2 flowA = vUv * vec2(16.0, 9.0) + vec2(uTime * 0.075, uTime * 0.04);
  vec2 flowB = vUv * vec2(15.0, 6.6) - vec2(uTime * 0.045, -uTime * 0.035);
  float flow = valueNoise(flowA) * 0.6 + valueNoise(flowB) * 0.4;
  // smoothstepでなだらかな平均値ではなく「対流の谷/山」がはっきり分かれた模様にする。
  float t = smoothstep(0.32, 0.7, flow);

  vec3 flowColor = mix(uCoolColor, uHotColor, t);
  vec3 color = mix(base, flowColor, uFlowStrength);
  // 暗い黒点は混色で消さず、既存のスポット位置を維持する。
  color *= mix(0.48, 1.0, smoothstep(0.16, 0.65, dot(base, vec3(0.299, 0.587, 0.114))));

  // 3つ目のvalue noiseは細かな粒状信号だけに使い、表面へ軽いセル感を足す。
  // 明るい側へ少しだけ寄せることで、暗い赤いランダムノイズにはしない。
  vec2 granulationUv = vUv * vec2(48.0, 28.0) + vec2(uTime * 0.026, -uTime * 0.015);
  float granulation = valueNoise(granulationUv);
  float fineCells = smoothstep(0.36, 0.82, granulation);
  color = mix(color, uHotColor, fineCells * 0.24);

  // 大きな流れと細粒の重なりをしきい値にし、いくつかの自然な明るい領域を作る。
  float brightRegions = smoothstep(0.68, 0.84, flow) * smoothstep(0.46, 0.74, granulation);
  color = mix(color, uHotColor, brightRegions * 0.12);

  // ゆっくりした全体の明滅("呼吸")。点滅ではなく緩やかな正弦波1つだけ。
  color *= 1.0 + 0.06 * sin(uTime * 0.6);

  // Fresnel状の縁発光。球の内側だけへ控えめに加え、外側の霧には見せない。
  float fresnel = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewDir)), 0.0, 1.0), 2.0);
  color += uRimColor * fresnel * 0.12;

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
