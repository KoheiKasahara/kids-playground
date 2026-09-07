import * as THREE from 'three'
import type { AtmosphereSpec } from '../types'

/** 外縁へ透明になる薄い大気。画像・時間更新なし、既存の球を共有する。 */
export function createAtmosphereMaterial(spec: AtmosphereSpec): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(spec.color) },
      uOpacity: { value: spec.opacity },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        vec4 p = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewDir = -p.xyz;
        gl_Position = projectionMatrix * p;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        float facing = abs(dot(normalize(vNormal), normalize(vViewDir)));
        float alpha = smoothstep(0.0, 0.25, facing) * uOpacity;
        gl_FragColor = vec4(uColor, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.BackSide,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
}
