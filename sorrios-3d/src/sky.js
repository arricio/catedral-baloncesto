/* ============================================================================
   SORRÍOS DE ORDÁS 3D — sky.js
   Reloj del juego (hora, día, estación), posición real del sol para la
   latitud de León, cúpula de cielo con shader, luna, estrellas, nubes,
   iluminación dinámica y meteorología (lluvia, tormenta y nieve).
   ========================================================================== */
(function (global) {
  'use strict';
  var S = global.SORRIOS3D, U = S.U;

  var DAYS_PER_SEASON = 28;
  var SEASONS = ['Primavera', 'Verano', 'Otoño', 'Invierno'];
  var DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  var LAT = 42.6 * Math.PI / 180;          // Sorríos de Ordás, León
  var WEATHERS = ['sol', 'nubes', 'lluvia', 'tormenta', 'nieve'];
  var WEATHER_NAME = { sol: 'Despejado', nubes: 'Nublado', lluvia: 'Lluvia', tormenta: 'Tormenta', nieve: 'Nieve' };
  var WEATHER_TABLE = [
    [0.44, 0.24, 0.26, 0.06, 0.00],
    [0.64, 0.20, 0.10, 0.06, 0.00],
    [0.36, 0.30, 0.28, 0.06, 0.00],
    [0.30, 0.28, 0.10, 0.02, 0.30]
  ];

  /* ================================================================ RELOJ */
  function Clock() {
    this.minutes = 7 * 60;
    this.day = 1; this.season = 0; this.year = 1; this.weekday = 0;
    this.dayCount = 1;
    this.weather = 'sol'; this.tomorrow = 'nubes';
    this.speed = 1;              // minutos de juego por segundo real
    this.paused = false;
    this.acc = 0;
    this.lightningT = 8;
  }
  Clock.prototype.hour = function () { return Math.floor(this.minutes / 60) % 24; };
  Clock.prototype.min = function () { return Math.floor(this.minutes % 60); };
  Clock.prototype.hourF = function () { return this.minutes / 60; };
  Clock.prototype.timeString = function () { return U.fmtHour(this.hour(), this.min()); };
  Clock.prototype.seasonName = function () { return SEASONS[this.season]; };
  Clock.prototype.weatherName = function () { return WEATHER_NAME[this.weather]; };
  Clock.prototype.dateString = function () {
    return DAYS[this.weekday] + ', ' + this.day + ' de ' + SEASONS[this.season] + ' · Año ' + this.year;
  };
  Clock.prototype.isRaining = function () { return this.weather === 'lluvia' || this.weather === 'tormenta'; };
  Clock.prototype.isSnowing = function () { return this.weather === 'nieve'; };

  Clock.prototype.update = function (dt) {
    if (this.paused) return null;
    var ev = null;
    this.minutes += dt * this.speed;
    if (this.minutes >= 26 * 60) { this.minutes = 26 * 60; ev = { collapse: true }; }
    if (this.weather === 'tormenta') {
      this.lightningT -= dt;
      if (this.lightningT <= 0) { this.lightningT = U.rnd(7, 20); ev = ev || {}; ev.lightning = true; }
    }
    return ev;
  };

  Clock.prototype.nextDay = function () {
    this.day++; this.dayCount++;
    this.weekday = (this.weekday + 1) % 7;
    if (this.day > DAYS_PER_SEASON) {
      this.day = 1; this.season++;
      if (this.season > 3) { this.season = 0; this.year++; }
    }
    this.minutes = 7 * 60;
    this.weather = this.tomorrow;
    this.tomorrow = this.rollWeather();
  };
  Clock.prototype.rollWeather = function () {
    var t = WEATHER_TABLE[this.season], r = Math.random(), acc = 0;
    for (var i = 0; i < t.length; i++) { acc += t[i]; if (r < acc) return WEATHERS[i]; }
    return 'sol';
  };

  // Declinación solar según el día del año → días largos en verano, cortos en invierno.
  Clock.prototype.declination = function () {
    var doy = this.season * DAYS_PER_SEASON + (this.day - 1);   // 0 = equinoccio de primavera
    var frac = doy / (DAYS_PER_SEASON * 4);
    return 23.44 * Math.PI / 180 * Math.sin(2 * Math.PI * frac);
  };
  // Devuelve {alt, az} en radianes: la posición real del sol en el cielo.
  Clock.prototype.sunPos = function () {
    var H = (this.hourF() - 12) * 15 * Math.PI / 180;
    var dec = this.declination();
    var sinAlt = Math.sin(LAT) * Math.sin(dec) + Math.cos(LAT) * Math.cos(dec) * Math.cos(H);
    var alt = Math.asin(U.clamp(sinAlt, -1, 1));
    var cosAz = (Math.sin(dec) - Math.sin(alt) * Math.sin(LAT)) / (Math.cos(alt) * Math.cos(LAT) || 1e-4);
    var az = Math.acos(U.clamp(cosAz, -1, 1));
    if (H > 0) az = 2 * Math.PI - az;
    return { alt: alt, az: az };
  };
  Clock.prototype.sunDir = function () {
    var p = this.sunPos();
    return new THREE.Vector3(
      Math.sin(p.az) * Math.cos(p.alt),
      Math.sin(p.alt),
      Math.cos(p.az) * Math.cos(p.alt)
    ).normalize();
  };
  // 0 noche cerrada, 1 pleno día
  Clock.prototype.daylight = function () {
    var alt = this.sunPos().alt;
    return U.clamp((Math.sin(alt) + 0.16) / 0.42, 0, 1);
  };
  Clock.prototype.isNight = function () { return this.daylight() < 0.2; };

  Clock.prototype.save = function () {
    return { minutes: this.minutes, day: this.day, season: this.season, year: this.year,
             weekday: this.weekday, dayCount: this.dayCount, weather: this.weather, tomorrow: this.tomorrow };
  };
  Clock.prototype.load = function (d) { if (d) for (var k in d) this[k] = d[k]; return this; };

  /* ============================================================== CIELO == */
  var SKY_VERT = [
    'varying vec3 vWorld;',
    'void main() {',
    '  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '}'
  ].join('\n');

  var SKY_FRAG = [
    'uniform vec3 uSun;',
    'uniform vec3 uZenith;',
    'uniform vec3 uHorizon;',
    'uniform vec3 uGround;',
    'uniform vec3 uSunColor;',
    'uniform float uNight;',
    'uniform float uCloud;',
    'uniform float uTime;',
    'uniform vec3 uMoon;',
    'varying vec3 vWorld;',

    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'float vnoise(vec2 p){',
    '  vec2 i = floor(p), f = fract(p);',
    '  vec2 u = f*f*(3.0-2.0*f);',
    '  return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y);',
    '}',
    'float fbm(vec2 p){',
    '  float v = 0.0, a = 0.5;',
    '  for(int i=0;i<5;i++){ v += a*vnoise(p); p *= 2.03; a *= 0.5; }',
    '  return v;',
    '}',

    'void main() {',
    '  vec3 dir = normalize(vWorld);',
    '  float h = clamp(dir.y, -1.0, 1.0);',
    '  float t = pow(clamp(h, 0.0, 1.0), 0.55);',
    '  vec3 col = mix(uHorizon, uZenith, t);',
    '  if (h < 0.0) col = mix(uHorizon, uGround, clamp(-h*3.0, 0.0, 1.0));',

    // resplandor del sol y disco
    '  float sd = max(dot(dir, uSun), 0.0);',
    '  col += uSunColor * pow(sd, 8.0) * 0.35;',
    '  col += uSunColor * pow(sd, 240.0) * 3.0;',
    '  float disc = smoothstep(0.9985, 0.9995, sd);',
    '  col = mix(col, uSunColor * 2.4, disc * clamp(uSun.y*4.0+0.3, 0.0, 1.0));',

    // luna y estrellas de noche
    '  float md = max(dot(dir, uMoon), 0.0);',
    '  float moonDisc = smoothstep(0.9990, 0.9997, md);',
    '  col = mix(col, vec3(0.92,0.94,1.0), moonDisc * uNight);',
    '  col += vec3(0.55,0.6,0.8) * pow(md, 90.0) * 0.25 * uNight;',
    '  if (uNight > 0.02 && h > -0.02) {',
    '    vec2 sp = dir.xz / max(abs(dir.y), 0.06) * 0.9;',
    '    float st = hash(floor(sp * 90.0));',
    '    float star = smoothstep(0.9965, 1.0, st) * uNight * clamp(h*2.5, 0.0, 1.0);',
    '    float tw = 0.6 + 0.4 * sin(uTime * 2.5 + st * 60.0);',
    '    col += vec3(0.9, 0.95, 1.0) * star * tw * 1.4;',
    '  }',

    // nubes procedurales proyectadas en la bóveda
    '  if (h > 0.005) {',
    '    vec2 cp = dir.xz / (h + 0.14);',
    '    float n = fbm(cp * 0.9 + vec2(uTime * 0.012, uTime * 0.005));',
    '    float n2 = fbm(cp * 2.2 - vec2(uTime * 0.02, 0.0));',
    '    float cover = smoothstep(0.62 - uCloud * 0.42, 0.94 - uCloud * 0.30, n * 0.7 + n2 * 0.3);',
    '    cover *= smoothstep(0.0, 0.22, h);',
    '    vec3 lit = mix(vec3(0.42,0.44,0.50), vec3(1.0,0.98,0.94), clamp(uSun.y*1.6+0.35, 0.0, 1.0));',
    '    vec3 shade = lit * mix(0.45, 0.85, clamp(uSun.y*2.0, 0.0, 1.0));',
    '    vec3 cloudCol = mix(shade, lit, smoothstep(0.35, 0.85, n));',
    '    cloudCol += uSunColor * pow(sd, 22.0) * 0.5 * (1.0 - uNight);',
    '    col = mix(col, cloudCol, cover * 0.92);',
    '  }',

    '  gl_FragColor = vec4(col, 1.0);',
    '  #include <tonemapping_fragment>',
    '  #include <colorspace_fragment>',
    '}'
  ].join('\n');

  function Sky(scene, quality) {
    this.scene = scene;
    this.q = quality;
    this.uniforms = {
      uSun: { value: new THREE.Vector3(0, 1, 0) },
      uMoon: { value: new THREE.Vector3(0, -1, 0) },
      uZenith: { value: new THREE.Color(0x2c5f9e) },
      uHorizon: { value: new THREE.Color(0xbcd2e8) },
      uGround: { value: new THREE.Color(0x3a4438) },
      uSunColor: { value: new THREE.Color(0xfff0d0) },
      uNight: { value: 0 },
      uCloud: { value: 0.15 },
      uTime: { value: 0 }
    };
    var geo = new THREE.SphereGeometry(1200, 32, 20);
    var mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
      side: THREE.BackSide, depthWrite: false, fog: false
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
    scene.add(this.mesh);

    // --- luces ---
    this.sun = new THREE.DirectionalLight(0xfff2dc, 3.0);
    this.sun.castShadow = true;
    var sd = quality.shadowDist;
    this.sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 260;
    this.sun.shadow.camera.left = -sd; this.sun.shadow.camera.right = sd;
    this.sun.shadow.camera.top = sd; this.sun.shadow.camera.bottom = -sd;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.045;
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.hemi = new THREE.HemisphereLight(0xbfd8f2, 0x4a5a38, 1.0);
    scene.add(this.hemi);
    this.ambient = new THREE.AmbientLight(0xffffff, 0.18);
    scene.add(this.ambient);

    scene.fog = new THREE.FogExp2(0xbcd2e8, 0.0022);

    this.flash = 0;
    this.cloudTarget = 0.15;
    this.cloud = 0.15;
    this._t = 0;
    this.buildWeather();
  }

  /* ------------------------------------------------- lluvia / nieve ------ */
  Sky.prototype.buildWeather = function () {
    var q = this.q;
    // Lluvia: segmentos verticales que caen dentro de una caja alrededor del jugador
    var N = q.level === 'alta' ? 6000 : 2600;
    var pos = new Float32Array(N * 2 * 3);
    this.rainCount = N;
    this.rainData = new Float32Array(N * 4); // x,y,z,vel
    for (var i = 0; i < N; i++) {
      this.rainData[i * 4] = U.rnd(-22, 22);
      this.rainData[i * 4 + 1] = U.rnd(0, 26);
      this.rainData[i * 4 + 2] = U.rnd(-22, 22);
      this.rainData[i * 4 + 3] = U.rnd(24, 34);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var m = new THREE.LineBasicMaterial({ color: 0xaecbe4, transparent: true, opacity: 0.42, fog: false });
    this.rain = new THREE.LineSegments(g, m);
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    this.scene.add(this.rain);

    // Nieve: puntos suaves que revolotean
    var SN = q.level === 'alta' ? 3500 : 1600;
    this.snowCount = SN;
    var sp = new Float32Array(SN * 3);
    this.snowData = new Float32Array(SN * 4);
    for (var j = 0; j < SN; j++) {
      this.snowData[j * 4] = U.rnd(-24, 24);
      this.snowData[j * 4 + 1] = U.rnd(0, 24);
      this.snowData[j * 4 + 2] = U.rnd(-24, 24);
      this.snowData[j * 4 + 3] = U.rnd(1.2, 2.6);
    }
    var sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    var flake = S.TX.cv(32, 32), fx = flake.getContext('2d');
    var grd = fx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.5, 'rgba(255,255,255,.55)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    fx.fillStyle = grd; fx.fillRect(0, 0, 32, 32);
    var sm = new THREE.PointsMaterial({
      size: 0.17, map: new THREE.CanvasTexture(flake), transparent: true,
      depthWrite: false, opacity: 0.9, fog: false, sizeAttenuation: true
    });
    this.snow = new THREE.Points(sg, sm);
    this.snow.frustumCulled = false;
    this.snow.visible = false;
    this.scene.add(this.snow);
  };

  Sky.prototype.updateWeather = function (dt, clock, camPos) {
    var raining = clock.isRaining(), snowing = clock.isSnowing();
    this.rain.visible = raining;
    this.snow.visible = snowing;
    var i, p;
    if (raining) {
      var arr = this.rain.geometry.attributes.position.array;
      var speedMul = clock.weather === 'tormenta' ? 1.35 : 1;
      for (i = 0; i < this.rainCount; i++) {
        p = i * 4;
        this.rainData[p + 1] -= this.rainData[p + 3] * dt * speedMul;
        if (this.rainData[p + 1] < -3) {
          this.rainData[p + 1] = U.rnd(20, 28);
          this.rainData[p] = U.rnd(-22, 22);
          this.rainData[p + 2] = U.rnd(-22, 22);
        }
        var x = camPos.x + this.rainData[p], y = camPos.y + this.rainData[p + 1], z = camPos.z + this.rainData[p + 2];
        var k = i * 6;
        arr[k] = x; arr[k + 1] = y; arr[k + 2] = z;
        arr[k + 3] = x + 0.12; arr[k + 4] = y - 0.85 * speedMul; arr[k + 5] = z;
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
    }
    if (snowing) {
      var sarr = this.snow.geometry.attributes.position.array;
      this._t += dt;
      for (i = 0; i < this.snowCount; i++) {
        p = i * 4;
        this.snowData[p + 1] -= this.snowData[p + 3] * dt;
        if (this.snowData[p + 1] < -2) {
          this.snowData[p + 1] = U.rnd(18, 26);
          this.snowData[p] = U.rnd(-24, 24);
          this.snowData[p + 2] = U.rnd(-24, 24);
        }
        sarr[i * 3] = camPos.x + this.snowData[p] + Math.sin(this._t * 0.8 + i) * 0.9;
        sarr[i * 3 + 1] = camPos.y + this.snowData[p + 1];
        sarr[i * 3 + 2] = camPos.z + this.snowData[p + 2] + Math.cos(this._t * 0.7 + i * 0.5) * 0.9;
      }
      this.snow.geometry.attributes.position.needsUpdate = true;
    }
  };

  /* ---------------------------------------------------------- actualizar */
  Sky.prototype.update = function (dt, clock, camPos, target) {
    var u = this.uniforms;
    this._time = (this._time || 0) + dt;
    u.uTime.value = this._time;

    var dir = clock.sunDir();
    var day = clock.daylight();
    var night = 1 - U.clamp(day * 1.6, 0, 1);
    u.uSun.value.copy(dir);
    u.uMoon.value.copy(dir).multiplyScalar(-1);
    u.uNight.value = night;

    // Nubosidad objetivo según el tiempo que haga
    var wc = { sol: 0.10, nubes: 0.62, lluvia: 0.86, tormenta: 0.96, nieve: 0.80 }[clock.weather];
    this.cloud = U.damp(this.cloud, wc, 0.6, dt);
    u.uCloud.value = this.cloud;

    // Colores del cielo: amanecer/atardecer cálidos, día azul, noche profunda
    var horizonDay = new THREE.Color(0xbcd2e8), zenithDay = new THREE.Color(0x2e6bb0);
    var horizonSet = new THREE.Color(0xff9a52), zenithSet = new THREE.Color(0x2a4d86);
    var horizonNight = new THREE.Color(0x0d1830), zenithNight = new THREE.Color(0x030814);
    var lowSun = U.clamp(1 - Math.abs(dir.y) * 5.0, 0, 1);       // sol cerca del horizonte
    var hz = horizonDay.clone().lerp(horizonSet, lowSun * 0.9).lerp(horizonNight, night);
    var zn = zenithDay.clone().lerp(zenithSet, lowSun * 0.7).lerp(zenithNight, night);
    // El mal tiempo apaga y desatura el cielo
    var gray = new THREE.Color(0x8d949c);
    var storm = clock.weather === 'tormenta' ? 0.62 : (clock.isRaining() ? 0.45 : (clock.weather === 'nubes' ? 0.22 : (clock.isSnowing() ? 0.3 : 0)));
    hz.lerp(gray, storm * (1 - night * 0.6));
    zn.lerp(gray.clone().multiplyScalar(0.6), storm * (1 - night * 0.6));
    u.uHorizon.value.copy(hz);
    u.uZenith.value.copy(zn);
    u.uGround.value.setHex(clock.season === 3 ? 0x9aa6ad : 0x46512f).lerp(new THREE.Color(0x05070c), night);

    var sunCol = new THREE.Color(0xfff4de).lerp(new THREE.Color(0xff8a3c), lowSun);
    u.uSunColor.value.copy(sunCol);

    // --- luz direccional (sol de día, luna de noche) ---
    var dist = 90;
    var lightDir = night > 0.85 ? dir.clone().multiplyScalar(-1) : dir;
    this.sun.position.copy(target).addScaledVector(lightDir, dist);
    this.sun.target.position.copy(target);
    this.sun.target.updateMatrixWorld();

    var strength = U.clamp(day, 0, 1);
    var weatherDim = clock.weather === 'tormenta' ? 0.18 : (clock.isRaining() ? 0.32 : (clock.weather === 'nubes' ? 0.6 : (clock.isSnowing() ? 0.55 : 1)));
    if (night > 0.85) {
      this.sun.color.setHex(0x9fb6e8);
      this.sun.intensity = 0.95 * (1 - storm * 0.45);
    } else {
      this.sun.color.copy(sunCol);
      this.sun.intensity = (0.25 + 3.1 * strength) * weatherDim;
    }
    this.sun.castShadow = this.sun.intensity > 0.25;

    // Luz ambiental del cielo
    this.hemi.color.copy(hz);
    this.hemi.groundColor.setHex(clock.season === 3 ? 0x6f7a80 : 0x4a5a38);
    this.hemi.intensity = U.lerp(0.62, 1.15, strength) * (0.6 + storm * 0.45);
    this.ambient.intensity = U.lerp(0.30, 0.26, strength);

    // Relámpago
    if (this.flash > 0) {
      this.flash -= dt * 2.6;
      var f = Math.max(0, this.flash);
      this.sun.intensity += f * 6;
      this.ambient.intensity += f * 1.6;
      u.uHorizon.value.lerp(new THREE.Color(0xdfe6ff), f * 0.8);
      u.uZenith.value.lerp(new THREE.Color(0xc8d6ff), f * 0.6);
    }

    // Niebla acorde al cielo y al tiempo
    var fogCol = hz.clone().lerp(new THREE.Color(0xffffff), clock.isSnowing() ? 0.25 : 0);
    this.scene.fog.color.copy(fogCol);
    this.scene.fog.density = clock.weather === 'tormenta' ? 0.0075
      : clock.isRaining() ? 0.0055
      : clock.isSnowing() ? 0.0065
      : clock.weather === 'nubes' ? 0.0030 : 0.0020;

    this.mesh.position.copy(camPos);
    this.updateWeather(dt, clock, camPos);
  };

  // Mapa de entorno derivado del propio cielo: sin esto, los metales (silo,
  // tractor, chapas) se ven negros y la luz indirecta queda plana.
  Sky.prototype.refreshEnvironment = function (renderer, scene, force) {
    var now = performance.now();
    if (!force && this._envT && now - this._envT < 4000) return;
    this._envT = now;
    try {
      if (!this._pmrem) this._pmrem = new THREE.PMREMGenerator(renderer);
      if (!this._envScene) {
        this._envScene = new THREE.Scene();
        var m = new THREE.Mesh(this.mesh.geometry, this.mesh.material);
        m.frustumCulled = false;
        this._envScene.add(m);
      }
      var rt = this._pmrem.fromScene(this._envScene, 0.05, 0.1, 2000);
      if (this._envRT) this._envRT.dispose();
      this._envRT = rt;
      scene.environment = rt.texture;
    } catch (e) { /* si falla, seguimos sin entorno */ }
  };

  Sky.prototype.lightning = function () { this.flash = 1; };

  S.Clock = Clock;
  S.Sky = Sky;
  S.SEASONS = SEASONS;
  S.DAYS = DAYS;
  S.DAYS_PER_SEASON = DAYS_PER_SEASON;
  S.WEATHER_NAME = WEATHER_NAME;

})(window);
