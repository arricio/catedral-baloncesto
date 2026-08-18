/* ============================================================================
   SORRÍOS DE ORDÁS 3D — post.js
   Cadena de post-proceso escrita a mano (three.js no trae el compositor en la
   compilación UMD): oclusión ambiental a partir de la profundidad, resplandor
   de las luces, curva de tono ACES, ajuste de color, viñeteado y grano.
   Es lo que separa un render "de juego" de una imagen que parece foto.
   ========================================================================== */
(function (global) {
  'use strict';
  var S = global.SORRIOS3D, U = S.U;

  var VERT = [
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = uv;',
    '  gl_Position = vec4(position.xy, 0.0, 1.0);',
    '}'
  ].join('\n');

  /* ------------------------------------------------- oclusión ambiental -- */
  var AO_FRAG = [
    'varying vec2 vUv;',
    'uniform sampler2D tDepth;',
    'uniform mat4 uProjInv;',
    'uniform mat4 uProj;',
    'uniform vec2 uRes;',
    'uniform float uRadio;',
    'uniform float uFuerza;',
    'uniform float uNear;',
    'uniform float uFar;',

    'float depthLin(float d) {',
    '  float z = d * 2.0 - 1.0;',
    '  return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));',
    '}',
    'vec3 posVista(vec2 uv, float d) {',
    '  vec4 clip = vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);',
    '  vec4 v = uProjInv * clip;',
    '  return v.xyz / v.w;',
    '}',
    'float hash12(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',

    'void main() {',
    '  float d = texture2D(tDepth, vUv).x;',
    '  if (d >= 0.9999) { gl_FragColor = vec4(1.0); return; }',
    '  vec3 P = posVista(vUv, d);',
    '  vec3 N = normalize(cross(dFdy(P), dFdx(P)));',
    '  float giro = hash12(vUv * uRes) * 6.283;',
    '  float oclusion = 0.0;',
    '  const int MUESTRAS = 12;',
    '  for (int i = 0; i < MUESTRAS; i++) {',
    '    float fi = float(i);',
    '    float ang = giro + fi * 2.399963;',           // ángulo áureo
    '    float rad = uRadio * (0.25 + 0.75 * fi / float(MUESTRAS));',
    '    vec3 dir = vec3(cos(ang), sin(ang), 0.0);',
    '    dir = normalize(dir + N * 0.55);',
    '    vec3 M = P + dir * rad;',
    '    vec4 proj = uProj * vec4(M, 1.0);',
    '    vec2 uvM = (proj.xy / proj.w) * 0.5 + 0.5;',
    '    if (uvM.x < 0.0 || uvM.x > 1.0 || uvM.y < 0.0 || uvM.y > 1.0) continue;',
    '    float dM = texture2D(tDepth, uvM).x;',
    '    vec3 Q = posVista(uvM, dM);',
    '    vec3 dif = Q - P;',
    '    float dist = length(dif);',
    '    if (dist < 0.0001) continue;',
    '    if (dist > uRadio * 3.0) continue;',
    '    float cae = smoothstep(uRadio * 2.5, uRadio * 0.25, dist);',
    '    oclusion += max(0.0, dot(normalize(dif), N) - 0.12) * cae;',
    '  }',
    '  oclusion = 1.0 - clamp(oclusion / float(MUESTRAS) * uFuerza, 0.0, 1.0);',
    '  gl_FragColor = vec4(vec3(oclusion), 1.0);',
    '}'
  ].join('\n');

  var BLUR_FRAG = [
    'varying vec2 vUv;',
    'uniform sampler2D tSrc;',
    'uniform vec2 uPaso;',
    'void main() {',
    '  vec4 c = texture2D(tSrc, vUv) * 0.227027;',
    '  c += texture2D(tSrc, vUv + uPaso * 1.3846) * 0.316216;',
    '  c += texture2D(tSrc, vUv - uPaso * 1.3846) * 0.316216;',
    '  c += texture2D(tSrc, vUv + uPaso * 3.2308) * 0.070270;',
    '  c += texture2D(tSrc, vUv - uPaso * 3.2308) * 0.070270;',
    '  gl_FragColor = c;',
    '}'
  ].join('\n');

  var BRILLO_FRAG = [
    'varying vec2 vUv;',
    'uniform sampler2D tSrc;',
    'uniform float uUmbral;',
    'void main() {',
    '  vec3 c = texture2D(tSrc, vUv).rgb;',
    '  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));',
    '  float f = smoothstep(uUmbral, uUmbral * 2.0, l);',
    '  gl_FragColor = vec4(c * f, 1.0);',
    '}'
  ].join('\n');

  /* ------------------------------------------------------- composición -- */
  var FINAL_FRAG = [
    'varying vec2 vUv;',
    'uniform sampler2D tColor;',
    'uniform sampler2D tAO;',
    'uniform sampler2D tBloom;',
    'uniform vec2 uRes;',
    'uniform float uExposicion;',
    'uniform float uBloom;',
    'uniform float uAO;',
    'uniform float uVineta;',
    'uniform float uGrano;',
    'uniform float uTiempo;',
    'uniform vec3 uSombras;',
    'uniform vec3 uLuces;',
    'uniform float uNitidez;',

    // Curva de tono ACES (la que usan los motores de cine)
    'vec3 aces(vec3 x) {',
    '  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;',
    '  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);',
    '}',
    'vec3 aSRGB(vec3 c) {',
    '  return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));',
    '}',
    'float hash12(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',

    'void main() {',
    '  vec3 col = texture2D(tColor, vUv).rgb;',
    // nitidez: recupera el detalle que se pierde al escalar
    '  if (uNitidez > 0.001) {',
    '    vec2 px = 1.0 / uRes;',
    '    vec3 suma = texture2D(tColor, vUv + vec2(px.x, 0.0)).rgb',
    '              + texture2D(tColor, vUv - vec2(px.x, 0.0)).rgb',
    '              + texture2D(tColor, vUv + vec2(0.0, px.y)).rgb',
    '              + texture2D(tColor, vUv - vec2(0.0, px.y)).rgb;',
    '    col += (col * 4.0 - suma) * uNitidez * 0.25;',
    '  }',
    // oclusión ambiental sobre la luz indirecta
    '  float ao = texture2D(tAO, vUv).r;',
    '  ao = mix(1.0, ao, uAO);',
    '  col *= ao;',
    // resplandor
    '  vec3 bloom = texture2D(tBloom, vUv).rgb;',
    '  col += bloom * uBloom;',
    // exposición y curva de tono
    '  col *= uExposicion;',
    '  col = aces(col);',
    // ajuste de color: sombras algo frías, luces cálidas, contraste suave
    '  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));',
    '  col = mix(col * uSombras, col * uLuces, smoothstep(0.15, 0.85, l));',
    '  col = clamp((col - 0.5) * 1.04 + 0.5, 0.0, 1.0);',
    // fotográfico: bajamos un punto la saturación, que el verde se disparaba
    '  col = mix(vec3(l), col, 0.90);',
    // viñeteado
    '  vec2 q = vUv - 0.5;',
    '  float vin = 1.0 - dot(q, q) * uVineta;',
    '  col *= clamp(vin, 0.0, 1.0);',
    // grano de película
    '  float g = hash12(vUv * uRes + uTiempo) - 0.5;',
    '  col += g * uGrano;',
    '  gl_FragColor = vec4(aSRGB(clamp(col, 0.0, 1.0)), 1.0);',
    '}'
  ].join('\n');

  /* ================================================================ POST */
  function Post(renderer, scene, camera, q) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.q = q;
    this.activo = false;
    try {
      if (!renderer.capabilities.isWebGL2) return;   // sin WebGL2 no hay post
      this.conAO = q.level === 'alta';
      this.conBloom = q.level !== 'baja';
      this.iniciar();
      this.activo = true;
      // el tonemapping lo hacemos nosotros al componer
      renderer.toneMapping = THREE.NoToneMapping;
    } catch (e) {
      console.warn('Post-proceso no disponible:', e.message);
      this.activo = false;
    }
  }

  Post.prototype.iniciar = function () {
    var r = this.renderer;
    var size = r.getDrawingBufferSize(new THREE.Vector2());
    var w = Math.max(2, size.x), h = Math.max(2, size.y);

    var depth = new THREE.DepthTexture(w, h);
    depth.type = THREE.UnsignedIntType;
    this.rtColor = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      depthTexture: depth, depthBuffer: true,
      samples: this.q.level === 'alta' ? 4 : 0
    });

    var wa = Math.max(2, Math.floor(w / 2)), ha = Math.max(2, Math.floor(h / 2));
    this.rtAO = this.hacerRT(wa, ha);
    this.rtAO2 = this.hacerRT(wa, ha);
    var wb = Math.max(2, Math.floor(w / 4)), hb = Math.max(2, Math.floor(h / 4));
    this.rtBloom = this.hacerRT(wb, hb, THREE.HalfFloatType);
    this.rtBloom2 = this.hacerRT(wb, hb, THREE.HalfFloatType);

    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
    this.quad.frustumCulled = false;
    this.escenaQuad = new THREE.Scene();
    this.escenaQuad.add(this.quad);
    this.camQuad = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.matAO = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: AO_FRAG, depthTest: false, depthWrite: false,
      uniforms: {
        tDepth: { value: this.rtColor.depthTexture },
        uProjInv: { value: new THREE.Matrix4() },
        uProj: { value: new THREE.Matrix4() },
        uRes: { value: new THREE.Vector2(wa, ha) },
        uRadio: { value: 0.85 },
        uFuerza: { value: 1.05 },
        uNear: { value: 0.1 }, uFar: { value: 2400 }
      }
    });
    this.matBlur = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: BLUR_FRAG, depthTest: false, depthWrite: false,
      uniforms: { tSrc: { value: null }, uPaso: { value: new THREE.Vector2() } }
    });
    this.matBrillo = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: BRILLO_FRAG, depthTest: false, depthWrite: false,
      uniforms: { tSrc: { value: null }, uUmbral: { value: 1.05 } }
    });
    this.matFinal = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FINAL_FRAG, depthTest: false, depthWrite: false,
      uniforms: {
        tColor: { value: this.rtColor.texture },
        tAO: { value: this.rtAO.texture },
        tBloom: { value: this.rtBloom.texture },
        uRes: { value: new THREE.Vector2(w, h) },
        uExposicion: { value: 1.05 },
        uBloom: { value: this.conBloom ? 0.42 : 0.0 },
        uAO: { value: this.conAO ? 0.62 : 0.0 },
        uVineta: { value: 0.42 },
        uGrano: { value: 0.016 },
        uTiempo: { value: 0 },
        uSombras: { value: new THREE.Vector3(0.93, 0.97, 1.08) },
        uLuces: { value: new THREE.Vector3(1.05, 1.01, 0.95) },
        uNitidez: { value: this.q.level === 'baja' ? 0.0 : 0.35 }
      }
    });
    this.blanco = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    this.blanco.needsUpdate = true;
    if (!this.conAO) this.matFinal.uniforms.tAO.value = this.blanco;
    this.negro = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    this.negro.needsUpdate = true;
    if (!this.conBloom) this.matFinal.uniforms.tBloom.value = this.negro;
  };

  Post.prototype.hacerRT = function (w, h, tipo) {
    return new THREE.WebGLRenderTarget(w, h, {
      type: tipo || THREE.UnsignedByteType,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      depthBuffer: false, stencilBuffer: false
    });
  };

  Post.prototype.resize = function () {
    if (!this.activo) return;
    var size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    var w = Math.max(2, size.x), h = Math.max(2, size.y);
    this.rtColor.setSize(w, h);
    if (this.rtColor.depthTexture) this.rtColor.depthTexture.image = { width: w, height: h };
    this.rtAO.setSize(Math.floor(w / 2), Math.floor(h / 2));
    this.rtAO2.setSize(Math.floor(w / 2), Math.floor(h / 2));
    this.rtBloom.setSize(Math.floor(w / 4), Math.floor(h / 4));
    this.rtBloom2.setSize(Math.floor(w / 4), Math.floor(h / 4));
    this.matFinal.uniforms.uRes.value.set(w, h);
    this.matAO.uniforms.uRes.value.set(w / 2, h / 2);
  };

  Post.prototype.pasada = function (mat, destino) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(destino || null);
    this.renderer.render(this.escenaQuad, this.camQuad);
  };

  Post.prototype.render = function () {
    var r = this.renderer, cam = this.camera;
    // 1) la escena, en alto rango dinámico
    r.setRenderTarget(this.rtColor);
    r.clear();
    r.render(this.scene, cam);

    // 2) oclusión ambiental a partir de la profundidad
    if (this.conAO) {
      this.matAO.uniforms.uProj.value.copy(cam.projectionMatrix);
      this.matAO.uniforms.uProjInv.value.copy(cam.projectionMatrixInverse);
      this.matAO.uniforms.uNear.value = cam.near;
      this.matAO.uniforms.uFar.value = cam.far;
      this.pasada(this.matAO, this.rtAO);
      // suavizado en dos direcciones
      var wa = this.rtAO.width, ha = this.rtAO.height;
      this.matBlur.uniforms.tSrc.value = this.rtAO.texture;
      this.matBlur.uniforms.uPaso.value.set(1 / wa, 0);
      this.pasada(this.matBlur, this.rtAO2);
      this.matBlur.uniforms.tSrc.value = this.rtAO2.texture;
      this.matBlur.uniforms.uPaso.value.set(0, 1 / ha);
      this.pasada(this.matBlur, this.rtAO);
    }

    // 3) resplandor de las zonas brillantes
    if (this.conBloom) {
      this.matBrillo.uniforms.tSrc.value = this.rtColor.texture;
      this.pasada(this.matBrillo, this.rtBloom);
      var wb = this.rtBloom.width, hb = this.rtBloom.height;
      for (var i = 0; i < 2; i++) {
        this.matBlur.uniforms.tSrc.value = this.rtBloom.texture;
        this.matBlur.uniforms.uPaso.value.set((1 + i) / wb, 0);
        this.pasada(this.matBlur, this.rtBloom2);
        this.matBlur.uniforms.tSrc.value = this.rtBloom2.texture;
        this.matBlur.uniforms.uPaso.value.set(0, (1 + i) / hb);
        this.pasada(this.matBlur, this.rtBloom);
      }
    }

    // 4) composición final a pantalla
    this.matFinal.uniforms.uTiempo.value = (performance.now() % 10000) * 0.001;
    this.pasada(this.matFinal, null);
    r.setRenderTarget(null);
  };

  Post.prototype.ajustar = function (o) {
    if (!this.activo) return;
    for (var k in o) if (this.matFinal.uniforms[k]) this.matFinal.uniforms[k].value = o[k];
  };

  S.Post = Post;

})(window);
