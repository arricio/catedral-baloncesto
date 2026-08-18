/* ============================================================================
   SORRÍOS DE ORDÁS 3D — terrain.js
   Terreno con relieve (valle llano rodeado de montes), mezcla de texturas
   para caminos y eras, río con agua animada y un manto de hierba instanciada
   que sigue al jugador y se mueve con el viento.
   ========================================================================== */
(function (global) {
  'use strict';
  var S = global.SORRIOS3D, U = S.U, TX = S.TX;

  var SIZE = 420;          // metros de lado del mapa
  var RES = 257;           // vértices por lado
  var H_MIN = -4, H_RANGE = 24;   // rango codificado en la textura de altura

  /* ============================================================ TERRENO == */
  function Terrain(scene, quality, season) {
    this.size = SIZE;
    this.res = RES;
    this.q = quality;
    this.heights = new Float32Array(RES * RES);
    this.scene = scene;
    this.season = season || 0;

    this.buildMaps();
    this.buildHeights();
    this.buildMesh();
    this.buildDataTexture();
  }

  Terrain.prototype.worldToMap = function (x, z) {
    return { u: (x + SIZE / 2) / SIZE, v: (z + SIZE / 2) / SIZE };
  };

  /* --- mapas de control: dónde aplanar y dónde hay camino/tierra --------- */
  Terrain.prototype.buildMaps = function () {
    var N = 512;
    // mapa de aplanado (blanco = llano)
    var flat = TX.cv(N, N), f = flat.getContext('2d');
    f.fillStyle = '#000'; f.fillRect(0, 0, N, N);
    var self = this;
    function toPx(x, z) { return [(x + SIZE / 2) / SIZE * N, (z + SIZE / 2) / SIZE * N]; }
    function padRect(x, z, w, h, blur) {
      var p = toPx(x - w / 2, z - h / 2);
      f.save();
      f.filter = 'blur(' + (blur || 10) + 'px)';
      f.fillStyle = '#fff';
      f.fillRect(p[0], p[1], w / SIZE * N, h / SIZE * N);
      f.restore();
    }
    // El valle central donde está todo: granja, pueblo y campos
    padRect(0, 0, 300, 250, 26);
    padRect(-70, -40, 150, 120, 18);   // granja
    padRect(70, 50, 160, 140, 18);     // pueblo
    this.flatMap = f.getImageData(0, 0, N, N).data;
    this.flatN = N;

    // mapa de caminos y tierra (splat)
    var road = TX.cv(N, N), r = road.getContext('2d');
    r.fillStyle = '#000'; r.fillRect(0, 0, N, N);
    r.lineCap = 'round'; r.lineJoin = 'round';
    function roadLine(pts, width, color) {
      r.strokeStyle = color || '#fff';
      r.lineWidth = width / SIZE * N;
      r.beginPath();
      var p0 = toPx(pts[0][0], pts[0][1]);
      r.moveTo(p0[0], p0[1]);
      for (var i = 1; i < pts.length; i++) {
        var p = toPx(pts[i][0], pts[i][1]);
        r.lineTo(p[0], p[1]);
      }
      r.stroke();
    }
    function dirtRect(x, z, w, h, blur) {
      var p = toPx(x - w / 2, z - h / 2);
      r.save();
      if (blur) r.filter = 'blur(' + blur + 'px)';
      r.fillStyle = '#fff';
      r.fillRect(p[0], p[1], w / SIZE * N, h / SIZE * N);
      r.restore();
    }
    // Carretera principal granja -> pueblo, y ramales
    S.ROADS = [
      [[-70, -20], [-70, 20], [-40, 40], [10, 45], [45, 45], [70, 40]],
      [[70, 40], [70, 80], [40, 95]],
      [[-70, -20], [-70, -60], [-30, -75]],
      [[10, 45], [10, 90]],
      [[45, 45], [60, 15], [95, 5]]
    ];
    for (var ri = 0; ri < S.ROADS.length; ri++) roadLine(S.ROADS[ri], ri === 0 ? 7 : 5);
    // Eras y patios de tierra
    dirtRect(-64, -46, 30, 18, 7);     // patio de la granja
    dirtRect(70, 45, 34, 26, 7);       // plaza del pueblo
    this.roadMap = r.getImageData(0, 0, N, N).data;
    this.roadN = N;
    this.roadCanvas = road;
  };

  Terrain.prototype.sampleMap = function (data, N, x, z) {
    var u = (x + SIZE / 2) / SIZE * (N - 1);
    var v = (z + SIZE / 2) / SIZE * (N - 1);
    var xi = U.clamp(Math.round(u), 0, N - 1), zi = U.clamp(Math.round(v), 0, N - 1);
    return data[(zi * N + xi) * 4] / 255;
  };

  /* --- alturas ---------------------------------------------------------- */
  Terrain.prototype.buildHeights = function () {
    var n = S.Noise(1337), n2 = S.Noise(4242);
    var half = SIZE / 2;
    for (var j = 0; j < RES; j++) {
      for (var i = 0; i < RES; i++) {
        var x = -half + (i / (RES - 1)) * SIZE;
        var z = -half + (j / (RES - 1)) * SIZE;
        // Colinas suaves + montes en el borde del valle
        var base = (n.fbm(x * 0.006 + 10, z * 0.006 + 10, 5) - 0.5) * 9;
        var d = Math.sqrt(x * x + z * z);
        var ring = U.smooth(U.clamp((d - 130) / 90, 0, 1));
        var mountains = ring * (12 + n2.fbm(x * 0.012, z * 0.012, 5) * 34);
        var h = base + mountains;
        // Aplanar donde vive el pueblo
        var flat = this.sampleMap(this.flatMap, this.flatN, x, z);
        var micro = (n2.fbm(x * 0.05, z * 0.05, 3) - 0.5) * 0.32;
        h = U.lerp(h, micro, flat);
        // Cauce del río
        var riverZ = this.riverZAt(x);
        var rd = Math.abs(z - riverZ);
        if (rd < 12) {
          var t = 1 - U.smooth(U.clamp(rd / 12, 0, 1));
          h = U.lerp(h, -2.4, t * 0.95);
        }
        this.heights[j * RES + i] = h;
      }
    }
  };

  // El río cruza el valle de este a oeste, algo serpenteante
  Terrain.prototype.riverZAt = function (x) {
    return -110 + Math.sin(x * 0.018) * 12 + Math.sin(x * 0.005 + 2) * 8;
  };

  Terrain.prototype.heightAt = function (x, z) {
    var half = SIZE / 2;
    var fx = (x + half) / SIZE * (RES - 1);
    var fz = (z + half) / SIZE * (RES - 1);
    var xi = Math.floor(fx), zi = Math.floor(fz);
    if (xi < 0 || zi < 0 || xi >= RES - 1 || zi >= RES - 1) return 0;
    var tx = fx - xi, tz = fz - zi;
    var h00 = this.heights[zi * RES + xi], h10 = this.heights[zi * RES + xi + 1];
    var h01 = this.heights[(zi + 1) * RES + xi], h11 = this.heights[(zi + 1) * RES + xi + 1];
    return U.lerp(U.lerp(h00, h10, tx), U.lerp(h01, h11, tx), tz);
  };

  // Normal del terreno (para orientar vehículos y objetos)
  Terrain.prototype.normalAt = function (x, z) {
    var e = 1.0;
    var hL = this.heightAt(x - e, z), hR = this.heightAt(x + e, z);
    var hD = this.heightAt(x, z - e), hU = this.heightAt(x, z + e);
    return new THREE.Vector3(hL - hR, 2 * e, hD - hU).normalize();
  };

  Terrain.prototype.isRoad = function (x, z) {
    return this.sampleMap(this.roadMap, this.roadN, x, z) > 0.4;
  };

  /* --- malla ------------------------------------------------------------ */
  Terrain.prototype.buildMesh = function () {
    var geo = new THREE.PlaneGeometry(SIZE, SIZE, RES - 1, RES - 1);
    geo.rotateX(-Math.PI / 2);
    var pos = geo.attributes.position;
    var splat = new Float32Array(pos.count);
    var half = SIZE / 2;
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, this.heightAt(x, z));
      var road = this.sampleMap(this.roadMap, this.roadN, x, z);
      // También hay tierra en las cotas altas de los montes (roca pelada)
      var rocky = U.clamp((this.heightAt(x, z) - 16) / 12, 0, 1);
      splat[i] = U.clamp(road * 1.15 + rocky, 0, 1);
    }
    geo.setAttribute('aSplat', new THREE.BufferAttribute(splat, 1));
    geo.computeVertexNormals();

    var grassC = TX.grassCanvas(this.season, 512);
    var dirtC = TX.dirtCanvas(512, this.season === 3);
    this.grassCanvas = grassC;

    var mat = new THREE.MeshStandardMaterial({
      map: TX.tex(grassC, 150, 16),
      normalMap: TX.texLinear(TX.normalMapFrom(grassC, 1.6), 150),
      roughness: 0.96, metalness: 0
    });
    var dirtTex = TX.tex(dirtC, 60, 16);
    mat.onBeforeCompile = function (sh) {
      mat.userData.sh = sh;
      sh.uniforms.map2 = { value: dirtTex };
      var macroC = TX.macroCanvas(256, 61);
      sh.uniforms.mapMacro = { value: TX.tex(macroC, 1, 8) };
      sh.uniforms.macroAvg = { value: TX.avgLinear(macroC) };
      sh.uniforms.map2Rep = { value: new THREE.Vector2(150, 150) };
      sh.vertexShader = 'attribute float aSplat;\nvarying float vSplat;\n' +
        sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vSplat = aSplat;');
      sh.fragmentShader = 'uniform sampler2D map2;\nuniform sampler2D mapMacro;\nuniform vec3 macroAvg;\nuniform vec2 map2Rep;\nvarying float vSplat;\n' +
        sh.fragmentShader.replace('#include <map_fragment>',
          '#include <map_fragment>\n' +
          '  { vec4 c2 = texture2D(map2, vMapUv / 150.0 * map2Rep);\n' +
          '    diffuseColor.rgb = mix(diffuseColor.rgb, c2.rgb, clamp(vSplat, 0.0, 1.0));\n' +
          // manchas grandes: dos frecuencias, normalizadas por su media,
          // para que no se vea la baldosa de 2,8 m del suelo
          '    vec3 m1 = texture2D(mapMacro, vMapUv * 0.021).rgb / macroAvg;\n' +
          '    vec3 m2 = texture2D(mapMacro, vMapUv * 0.0067 + vec2(0.37)).rgb / macroAvg;\n' +
          '    diffuseColor.rgb *= mix(vec3(1.0), m1, 0.34) * mix(vec3(1.0), m2, 0.30); }');
    };
    mat.customProgramCacheKey = function () { return 'terreno'; };

    this.dirtTex = dirtTex;
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.receiveShadow = true;
    this.mesh.name = 'terreno';
    this.scene.add(this.mesh);
    this.material = mat;
  };

  // Cambia el manto del suelo al entrar la estación: el prado amarillea en
  // otoño y en invierno se hiela, y los caminos se cubren de nieve.
  Terrain.prototype.setSeason = function (season) {
    if (season === this.season) return;
    this.season = season;
    var grassC = TX.grassCanvas(season, 512);
    var dirtC = TX.dirtCanvas(512, season === 3);
    this.grassCanvas = grassC;
    var m = this.material;
    if (m.map) m.map.dispose();
    if (m.normalMap) m.normalMap.dispose();
    m.map = TX.tex(grassC, 150, 16);
    m.normalMap = TX.texLinear(TX.normalMapFrom(grassC, 1.6), 150);
    m.needsUpdate = true;
    if (this.dirtTex) {
      var nuevo = TX.tex(dirtC, 60, 16);
      this.dirtTex.dispose();
      this.dirtTex = nuevo;
      if (m.userData && m.userData.sh) m.userData.sh.uniforms.map2.value = nuevo;
    }
  };

  /* --- textura de datos para la hierba (altura + máscara) --------------- */
  Terrain.prototype.buildDataTexture = function () {
    var N = 256;
    var data = new Uint8Array(N * N * 4);
    for (var j = 0; j < N; j++) {
      for (var i = 0; i < N; i++) {
        var x = -SIZE / 2 + (i / (N - 1)) * SIZE;
        var z = -SIZE / 2 + (j / (N - 1)) * SIZE;
        var h = this.heightAt(x, z);
        var p = (j * N + i) * 4;
        data[p] = U.clamp((h - H_MIN) / H_RANGE, 0, 1) * 255;
        var road = this.sampleMap(this.roadMap, this.roadN, x, z);
        data[p + 1] = U.clamp(1 - road * 1.4, 0, 1) * 255;   // 0 = sin hierba
        data[p + 2] = 255;
        data[p + 3] = 255;
      }
    }
    var t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
    t.minFilter = t.magFilter = THREE.LinearFilter;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.needsUpdate = true;
    this.dataTex = t;
    this.dataArr = data;
    this.dataN = N;
  };

  // Marca una zona sin hierba (patios, eras, campos labrados)
  Terrain.prototype.clearGrass = function (x, z, radius) {
    var N = this.dataN;
    var half = SIZE / 2;
    var i0 = Math.floor((x - radius + half) / SIZE * (N - 1));
    var i1 = Math.ceil((x + radius + half) / SIZE * (N - 1));
    var j0 = Math.floor((z - radius + half) / SIZE * (N - 1));
    var j1 = Math.ceil((z + radius + half) / SIZE * (N - 1));
    for (var j = Math.max(0, j0); j <= Math.min(N - 1, j1); j++) {
      for (var i = Math.max(0, i0); i <= Math.min(N - 1, i1); i++) {
        var wx = -half + (i / (N - 1)) * SIZE, wz = -half + (j / (N - 1)) * SIZE;
        if (Math.hypot(wx - x, wz - z) <= radius) this.dataArr[(j * N + i) * 4 + 1] = 0;
      }
    }
    this.dataTex.needsUpdate = true;
  };
  Terrain.prototype.clearGrassRect = function (x, z, w, d) {
    var N = this.dataN, half = SIZE / 2;
    for (var j = 0; j < N; j++) {
      for (var i = 0; i < N; i++) {
        var wx = -half + (i / (N - 1)) * SIZE, wz = -half + (j / (N - 1)) * SIZE;
        if (Math.abs(wx - x) <= w / 2 && Math.abs(wz - z) <= d / 2) this.dataArr[(j * N + i) * 4 + 1] = 0;
      }
    }
    this.dataTex.needsUpdate = true;
  };


  // Une dos geometrías simples (mismo formato de atributos) sin depender de
  // BufferGeometryUtils, que no viene en la compilación UMD de three.js.
  function mergeTwo(a, b) {
    var g = new THREE.BufferGeometry();
    ['position', 'normal', 'uv'].forEach(function (k) {
      var A = a.attributes[k], B = b.attributes[k];
      var arr = new Float32Array(A.array.length + B.array.length);
      arr.set(A.array, 0); arr.set(B.array, A.array.length);
      g.setAttribute(k, new THREE.BufferAttribute(arr, A.itemSize));
    });
    var ia = a.index.array, ib = b.index.array;
    var off = a.attributes.position.count;
    var idx = new Uint16Array(ia.length + ib.length);
    idx.set(ia, 0);
    for (var i = 0; i < ib.length; i++) idx[ia.length + i] = ib[i] + off;
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    return g;
  }
  function mergeAll(list) {
    var g = list[0];
    for (var i = 1; i < list.length; i++) g = mergeTwo(g, list[i]);
    return g;
  }
  /* ============================================================= HIERBA = */
  function Grass(scene, terrain, quality, season) {
    this.terrain = terrain;
    var N = quality.grass, R = quality.grassRadius;
    this.radius = R;

    // Mata de hierba: dos planos cruzados en aspa, así tiene volumen desde
    // cualquier ángulo en vez de parecer una pegatina plana.
    // Mata de cuatro hojas cruzadas y algo abiertas: con el mismo número
    // de instancias el prado se ve mucho más tupido que con briznas sueltas.
    var hojas = [], hr = S.RNG(404);
    for (var b = 0; b < 4; b++) {
      var alto = 0.16 + hr() * 0.10;
      var pl = new THREE.PlaneGeometry(0.032 + hr() * 0.014, alto, 1, 3);
      // la brizna se estrecha hacia la punta y se arquea: un rectángulo
      // recto se ve como una esquirla de cristal
      var pp = pl.attributes.position, arco = 0.045 + hr() * 0.05;
      for (var v = 0; v < pp.count; v++) {
        var yy = pp.getY(v), tt = (yy + alto * 0.5) / alto;
        pp.setX(v, pp.getX(v) * (1.0 - 0.78 * tt * tt));
        pp.setZ(v, pp.getZ(v) + arco * tt * tt);
        pp.setY(v, yy - arco * 0.35 * tt * tt);
      }
      pl.computeVertexNormals();
      pl.translate(0, alto * 0.5, 0);
      pl.rotateZ((hr() - 0.5) * 0.55);          // la mata se abre en abanico
      pl.rotateY(b * 0.79 + hr() * 0.4);
      pl.translate((hr() - 0.5) * 0.075, 0, (hr() - 0.5) * 0.075);
      hojas.push(pl);
    }
    var g = mergeAll(hojas);
    var geo = new THREE.InstancedBufferGeometry();
    geo.index = g.index;
    geo.attributes.position = g.attributes.position;
    geo.attributes.normal = g.attributes.normal;
    geo.attributes.uv = g.attributes.uv;

    var off = new Float32Array(N * 2), rot = new Float32Array(N), sc = new Float32Array(N), tint = new Float32Array(N);
    var rnd = S.RNG(99);
    for (var i = 0; i < N; i++) {
      // Distribución en disco con densidad mayor cerca
      var a = rnd() * Math.PI * 2, r = Math.pow(rnd(), 1.25) * R;
      off[i * 2] = Math.cos(a) * r;
      off[i * 2 + 1] = Math.sin(a) * r;
      rot[i] = rnd() * Math.PI;
      sc[i] = 0.70 + rnd() * 0.60;
      tint[i] = rnd();
    }
    geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(off, 2));
    geo.setAttribute('aRot', new THREE.InstancedBufferAttribute(rot, 1));
    geo.setAttribute('aScale', new THREE.InstancedBufferAttribute(sc, 1));
    geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(tint, 1));
    geo.instanceCount = N;

    var cols = [
      { a: 0x4c6b39, b: 0x86a35d },
      { a: 0x506c33, b: 0x8ba758 },
      { a: 0x6e7442, b: 0xa89f68 },
      { a: 0x8b9490, b: 0xcdd6d2 }
    ][season];

    var mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, color: 0xffffff });
    var uniforms = {
      uPlayer: { value: new THREE.Vector3() },
      uTime: { value: 0 },
      uRadius: { value: R },
      uData: { value: terrain.dataTex },
      uMapSize: { value: SIZE },
      uHMin: { value: H_MIN },
      uHRange: { value: H_RANGE },
      uColA: { value: new THREE.Color(cols.a) },
      uColB: { value: new THREE.Color(cols.b) },
      uWind: { value: 1 }
    };
    this.uniforms = uniforms;
    mat.onBeforeCompile = function (sh) {
      for (var k in uniforms) sh.uniforms[k] = uniforms[k];
      sh.vertexShader = sh.vertexShader.replace('#include <beginnormal_vertex>',
        '#include <beginnormal_vertex>\n  objectNormal = normalize(vec3(objectNormal.x * 0.30, 1.0, objectNormal.z * 0.30));');
      sh.vertexShader = [
        'attribute vec2 aOffset;',
        'attribute float aRot;',
        'attribute float aScale;',
        'attribute float aTint;',
        'uniform vec3 uPlayer;',
        'uniform float uTime;',
        'uniform float uRadius;',
        'uniform sampler2D uData;',
        'uniform float uMapSize;',
        'uniform float uHMin;',
        'uniform float uHRange;',
        'uniform float uWind;',
        'varying float vTint;',
        'varying float vFade;',
        'varying float vUp;'
      ].join('\n') + '\n' + sh.vertexShader.replace('#include <begin_vertex>', [
        '  vec3 transformed = vec3(position);',
        '  vTint = aTint;',
        '  vUp = uv.y;',
        // Posición envolvente alrededor del jugador: el manto le sigue siempre
        '  vec2 base = aOffset + uPlayer.xz;',
        '  vec2 rel = base - uPlayer.xz;',
        '  vec2 wpos = uPlayer.xz + rel;',
        '  vec2 uvw = (wpos + uMapSize * 0.5) / uMapSize;',
        '  vec4 d = texture2D(uData, uvw);',
        '  float ground = d.r * uHRange + uHMin;',
        '  float mask = d.g;',
        // giro de la brizna
        '  float c = cos(aRot), s = sin(aRot);',
        '  transformed.xz = mat2(c, -s, s, c) * transformed.xz;',
        '  transformed *= aScale;',
        // viento: se dobla más cuanto más arriba
        '  float bend = (sin(uTime * 1.7 + wpos.x * 0.35 + wpos.y) * 0.5 + 0.5);',
        '  float gust = sin(uTime * 0.6 + wpos.x * 0.06 + wpos.y * 0.05) * 0.5 + 0.5;',
        '  float sway = uv.y * uv.y * (0.09 + gust * 0.22) * uWind * (0.4 + bend);',
        '  transformed.x += sway;',
        '  transformed.z += sway * 0.4;',
        // desvanecido en el borde del manto y allí donde no hay hierba
        '  float dist = length(rel);',
        '  vFade = 1.0 - smoothstep(uRadius * 0.68, uRadius, dist);',
        '  float grow = vFade * step(0.35, mask);',
        '  transformed.y *= grow;',
        '  transformed.xz += wpos - uPlayer.xz;',
        '  transformed.x += uPlayer.x; transformed.z += uPlayer.z;',
        '  transformed.y += ground;'
      ].join('\n'));
      // el manto se dibuja en coordenadas de mundo
      sh.vertexShader = sh.vertexShader.replace(
        '#include <project_vertex>',
        '  vec4 mvPosition = viewMatrix * vec4(transformed, 1.0);\n  gl_Position = projectionMatrix * mvPosition;'
      );
      sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>',
        '#include <normal_fragment_begin>\n  normal = normalize(vec3(normal.x, abs(normal.y) + 0.35, normal.z));');
      sh.fragmentShader = [
        'uniform vec3 uColA;',
        'uniform vec3 uColB;',
        'varying float vTint;',
        'varying float vFade;',
        'varying float vUp;'
      ].join('\n') + '\n' + sh.fragmentShader.replace('#include <color_fragment>',
        '#include <color_fragment>\n' +
        '  vec3 gc = mix(uColA, uColB, vTint * 0.55 + vUp * 0.45);\n' +
        '  diffuseColor.rgb *= gc * (0.66 + vUp * vUp * 0.46);');
    };
    mat.customProgramCacheKey = function () { return 'hierba'; };

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = true;
    this.mesh.renderOrder = 1;
    scene.add(this.mesh);
  }
  Grass.prototype.update = function (dt, playerPos, wind) {
    this.uniforms.uTime.value += dt;
    this.uniforms.uPlayer.value.copy(playerPos);
    this.uniforms.uWind.value = wind == null ? 1 : wind;
  };
  Grass.prototype.setSeason = function (season) {
    var cols = [
      { a: 0x4c6b39, b: 0x86a35d }, { a: 0x506c33, b: 0x8ba758 },
      { a: 0x6e7442, b: 0xa89f68 }, { a: 0x8b9490, b: 0xcdd6d2 }
    ][season];
    this.uniforms.uColA.value.setHex(cols.a);
    this.uniforms.uColB.value.setHex(cols.b);
  };

  /* ============================================================== AGUA == */
  function Water(scene, terrain) {
    var geo = new THREE.PlaneGeometry(SIZE, 40, 64, 8);
    geo.rotateX(-Math.PI / 2);
    var pos = geo.attributes.position;
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i);
      pos.setZ(i, pos.getZ(i) + terrain.riverZAt(x) + 110);
    }
    geo.computeVertexNormals();
    var nrm = TX.texLinear(TX.waterNormalCanvas(256), 14);
    var mat = new THREE.MeshStandardMaterial({
      color: 0x2f6d8c, transparent: true, opacity: 0.86,
      roughness: 0.12, metalness: 0.15,
      normalMap: nrm, envMapIntensity: 1.2
    });
    mat.normalScale.set(0.45, 0.45);
    this.mat = mat;
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.set(0, -1.9, -110);
    this.mesh.receiveShadow = false;
    scene.add(this.mesh);
    this.t = 0;
  }
  Water.prototype.update = function (dt) {
    this.t += dt;
    if (this.mat.normalMap) {
      this.mat.normalMap.offset.set(this.t * 0.04, this.t * 0.022);
    }
  };

  S.Terrain = Terrain;
  S.Grass = Grass;
  S.Water = Water;
  S.MAP_SIZE = SIZE;

})(window);
