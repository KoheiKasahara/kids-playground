import * as THREE from 'three'

/** One opaque surface: no reflection buffer, transparency sorting or wave meshes. */
export function createCoastalWater() {
  const geometry = new THREE.PlaneGeometry(820, 1800)
  geometry.rotateX(-Math.PI / 2).translate(590, 0.025, 0)
  const material = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, shallow: { value: new THREE.Color('#48c4c5') },
      deep: { value: new THREE.Color('#146893') }, foam: { value: new THREE.Color('#d7f2e4') } },
    vertexShader: `varying vec3 waterPosition;
      void main() { waterPosition = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec3 waterPosition; uniform float time; uniform vec3 shallow; uniform vec3 deep; uniform vec3 foam;
      void main() {
        vec2 p = waterPosition.xz;
        float offshore = p.x - 180.0;
        vec3 color = mix(shallow, deep, smoothstep(0.0, 130.0, offshore));
        float swell = sin(p.x * 0.39 + p.y * 0.09 - time * 0.8)
          * sin(p.y * 0.17 - p.x * 0.08 + time * 0.35);
        color *= 1.0 + swell * 0.065;
        float wave = sin(offshore * 1.1 + sin(p.y * 0.08) * 0.8 - time * 1.1);
        float wash = smoothstep(0.78, 1.0, wave) * (1.0 - smoothstep(2.0, 22.0, offshore));
        float glint = pow(max(swell, 0.0), 12.0) * 0.16;
        color = mix(color, foam, wash * 0.65 + glint);
        // Fade distant water into the same pale, sunlit horizon as the sky.
        float distanceToEye = distance(cameraPosition.xz, p);
        color = mix(color, vec3(0.69, 0.85, 0.80), smoothstep(280.0, 850.0, distanceToEye));
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = 'coastal-water'
  return { mesh, update(seconds: number) { material.uniforms.time!.value = seconds },
    dispose() { geometry.dispose(); material.dispose(); mesh.removeFromParent() } }
}
