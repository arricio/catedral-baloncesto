// Visor 3D: escena three.js con controles, modos de vista, animación, esqueleto,
// edición de articulaciones, grabación de vídeo y capturas.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { guardarReposo, ponerReposo } from './geometria.js';

export class Visor {
  constructor(contenedor) {
    this.contenedor = contenedor;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    contenedor.appendChild(this.renderer.domElement);

    this.escena = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.escena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    this.camara = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
    this.camara.position.set(1.6, 1.1, 2.2);
    this.controles = new OrbitControls(this.camara, this.renderer.domElement);
    this.controles.enableDamping = true;
    this.controles.autoRotate = true;
    this.controles.autoRotateSpeed = 1.6;

    const sol = new THREE.DirectionalLight(0xffffff, 1.6);
    sol.position.set(2, 4, 3);
    sol.castShadow = true;
    sol.shadow.mapSize.set(1024, 1024);
    Object.assign(sol.shadow.camera, { left: -1.5, right: 1.5, top: 1.5, bottom: -1.5, near: 0.1, far: 12 });
    this.escena.add(sol, new THREE.HemisphereLight(0xbfd4ff, 0x30283a, 0.6));

    this.suelo = new THREE.Group();
    const rejilla = new THREE.GridHelper(4, 32, 0x4b4f7a, 0x262a45);
    rejilla.material.transparent = true;
    rejilla.material.opacity = 0.55;
    const sombra = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.ShadowMaterial({ opacity: 0.3 }));
    sombra.rotation.x = -Math.PI / 2;
    sombra.receiveShadow = true;
    this.suelo.add(rejilla, sombra);
    this.escena.add(this.suelo);

    this.modelo = null;      // grupo raíz normalizado
    this.objeto = null;      // contenido real (lo que se edita y exporta)
    this.modoVista = 'textura';
    this.materialesOriginales = new Map();
    this.reloj = new THREE.Clock();
    this.mezclador = null;
    this.accion = null;
    this.clips = [];
    this.velocidad = 1;
    this.ayudaEsqueleto = null;
    this.marcadores = null;

    new ResizeObserver(() => this.ajustarTamano()).observe(contenedor);
    this.ajustarTamano();
    this.renderer.setAnimationLoop(() => {
      const dt = this.reloj.getDelta();
      if (this.mezclador) this.mezclador.update(dt * this.velocidad);
      this.controles.update();
      this.alDibujar?.(dt);
      this.renderer.render(this.escena, this.camara);
    });
    this.instalarArrastre();
  }

  ajustarTamano() {
    const { clientWidth: w, clientHeight: h } = this.contenedor;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camara.aspect = w / h;
    this.camara.updateProjectionMatrix();
  }

  /** Carga un GLB y devuelve {objeto, clips}. */
  async leerGLB(datos) {
    const buffer = datos instanceof Blob ? await datos.arrayBuffer() : datos;
    const gltf = await new GLTFLoader().parseAsync(buffer, '');
    return { objeto: gltf.scene, clips: gltf.animations ?? [] };
  }

  /**
   * Muestra un objeto: centrado, apoyado en el suelo y con altura 1.
   * El objeto anterior NO se libera (lo gestiona el historial).
   */
  establecer(objeto, { clips = [], encuadrar = true } = {}) {
    this.detenerAnimacion();
    this.quitarMarcadores();
    this.verEsqueleto(false);
    if (this.modelo) {
      this.restaurarMateriales();
      this.modelo.remove(this.objeto);
      this.escena.remove(this.modelo);
    }
    const raiz = new THREE.Group();
    raiz.name = 'modelo';
    objeto.position.set(0, 0, 0);
    objeto.updateMatrixWorld(true);
    // Medimos en la pose de reposo.
    guardarReposo(objeto);
    ponerReposo(objeto);
    const caja = new THREE.Box3().setFromObject(objeto);
    const tam = caja.getSize(new THREE.Vector3());
    const centro = caja.getCenter(new THREE.Vector3());
    const escala = 1 / Math.max(tam.x, tam.y, tam.z, 1e-6);
    raiz.add(objeto);
    objeto.position.sub(centro);
    raiz.scale.setScalar(escala);
    raiz.position.y = (tam.y * escala) / 2;
    raiz.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        if (o.isSkinnedMesh) o.frustumCulled = false;
      }
    });
    this.modelo = raiz;
    this.objeto = objeto;
    this.escena.add(raiz);
    raiz.updateMatrixWorld(true);
    this.guardarMateriales();
    this.aplicarModo(this.modoVista);
    this.clips = clips;
    this.mezclador = clips.length || this.tieneHuesos() ? new THREE.AnimationMixer(objeto) : null;
    if (encuadrar) this.encuadrar();
  }

  tieneHuesos() {
    let si = false;
    this.objeto?.traverse((o) => { if (o.isSkinnedMesh) si = true; });
    return si;
  }

  guardarMateriales() {
    this.materialesOriginales.clear();
    this.modelo?.traverse((o) => { if (o.isMesh && !o.userData.ayuda) this.materialesOriginales.set(o, o.material); });
  }

  restaurarMateriales() {
    for (const [o, m] of this.materialesOriginales) o.material = m;
  }

  /** Vuelve a leer los materiales actuales como «originales» (tras pintar o cambiar material). */
  materialesCambiados() {
    this.restaurarMateriales();
    this.guardarMateriales();
    this.aplicarModo(this.modoVista);
  }

  encuadrar() {
    if (!this.modelo) return;
    const caja = new THREE.Box3().setFromObject(this.modelo);
    const centro = caja.getCenter(new THREE.Vector3());
    const radio = caja.getBoundingSphere(new THREE.Sphere()).radius;
    const dist = radio / Math.sin(THREE.MathUtils.degToRad(this.camara.fov / 2)) * 1.15;
    const dir = new THREE.Vector3(0.55, 0.35, 1).normalize();
    this.camara.position.copy(centro).addScaledVector(dir, dist);
    this.controles.target.copy(centro);
    this.controles.update();
  }

  aplicarModo(modo) {
    this.modoVista = modo;
    if (!this.modelo) return;
    const arcilla = new THREE.MeshStandardMaterial({ color: 0xc9c4d6, roughness: 0.8, metalness: 0 });
    const malla = new THREE.MeshBasicMaterial({ color: 0x8b7bff, wireframe: true });
    const normales = new THREE.MeshNormalMaterial();
    const porColor = new Map();
    for (const [o, original] of this.materialesOriginales) {
      let m = original;
      if (modo === 'arcilla') m = arcilla;
      else if (modo === 'malla') m = malla;
      else if (modo === 'normales') m = normales;
      else if (modo === 'partes') {
        let p = o;
        while (p && !p.userData.parte) p = p.parent;
        const color = p?.userData.parte.color ?? '#9aa0c3';
        if (!porColor.has(color)) porColor.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
        m = porColor.get(color);
      }
      o.material = m;
    }
  }

  set autoRotar(v) { this.controles.autoRotate = v; }
  get autoRotar() { return this.controles.autoRotate; }
  set verSuelo(v) { this.suelo.visible = v; }

  estadisticas() {
    if (!this.modelo) return null;
    let triangulos = 0, vertices = 0, huesos = 0;
    this.objeto.traverse((o) => {
      if (o.isBone) huesos++;
      if (!o.isMesh || o.userData.ayuda) return;
      const g = o.geometry;
      vertices += g.attributes.position.count;
      triangulos += (g.index ? g.index.count : g.attributes.position.count) / 3;
    });
    if (!this.accion) ponerReposo(this.objeto);
    const tam = new THREE.Box3().setFromObject(this.objeto).getSize(new THREE.Vector3());
    return { triangulos: Math.round(triangulos), vertices, huesos, proporcion: tam };
  }

  // --- Animación -----------------------------------------------------------
  reproducir(clip) {
    if (!this.mezclador || !clip) return;
    this.mezclador.stopAllAction();
    ponerReposo(this.objeto);
    this.accion = this.mezclador.clipAction(clip);
    this.accion.reset().play();
    this.clipActual = clip;
  }

  detenerAnimacion() {
    if (this.mezclador) this.mezclador.stopAllAction();
    this.accion = null;
    this.clipActual = null;
    ponerReposo(this.objeto);
  }

  set pausa(v) { if (this.accion) this.accion.paused = v; }
  get pausa() { return this.accion?.paused ?? true; }

  verEsqueleto(si) {
    if (this.ayudaEsqueleto) {
      this.escena.remove(this.ayudaEsqueleto);
      this.ayudaEsqueleto.dispose?.();
      this.ayudaEsqueleto = null;
    }
    if (si && this.objeto && this.tieneHuesos()) {
      const h = new THREE.SkeletonHelper(this.objeto);
      h.material.depthTest = false;
      h.material.linewidth = 2;
      h.renderOrder = 10;
      this.ayudaEsqueleto = h;
      this.escena.add(h);
    }
  }

  // --- Articulaciones editables -------------------------------------------
  /**
   * Muestra marcadores arrastrables para un plan de articulaciones (en coordenadas
   * del mundo). Llama a alCambiar(plan) al soltar.
   */
  mostrarMarcadores(plan, { simetria = true, alCambiar } = {}) {
    this.quitarMarcadores();
    const g = new THREE.Group();
    g.name = 'marcadores';
    const tam = 0.022;
    const geo = new THREE.SphereGeometry(tam, 16, 12);
    const porNombre = new Map(plan.articulaciones.map((a) => [a.nombre, a]));
    const lineasPos = new Float32Array(plan.articulaciones.length * 6);
    const lineas = new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(lineasPos, 3)),
      new THREE.LineBasicMaterial({ color: 0x22d3ee, depthTest: false, transparent: true }),
    );
    lineas.renderOrder = 20;
    const actualizarLineas = () => {
      let k = 0;
      for (const a of plan.articulaciones) {
        if (!a.padre) continue;
        const p = porNombre.get(a.padre).pos;
        lineasPos.set([p.x, p.y, p.z, a.pos.x, a.pos.y, a.pos.z], k);
        k += 6;
      }
      lineas.geometry.setDrawRange(0, k / 3);
      lineas.geometry.attributes.position.needsUpdate = true;
    };
    for (const a of plan.articulaciones) {
      const color = a.lado > 0 ? 0x51cf66 : a.lado < 0 ? 0xff6b6b : 0xfcc419;
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: a.rol === 'hoja' ? 0.55 : 0.95 }));
      m.renderOrder = 21;
      m.position.copy(a.pos);
      m.userData = { articulacion: a, ayuda: true };
      g.add(m);
    }
    g.add(lineas);
    actualizarLineas();
    this.escena.add(g);
    this.marcadores = { grupo: g, plan, simetria, alCambiar, actualizarLineas, porNombre };
    this.verEsqueleto(false);
  }

  quitarMarcadores() {
    if (!this.marcadores) return;
    this.escena.remove(this.marcadores.grupo);
    this.marcadores = null;
  }

  set simetria(v) { if (this.marcadores) this.marcadores.simetria = v; }

  instalarArrastre() {
    const el = this.renderer.domElement;
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const plano = new THREE.Plane();
    const punto = new THREE.Vector3();
    let arrastre = null;
    const aNdc = (e) => {
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    };
    el.addEventListener('pointerdown', (e) => {
      aNdc(e);
      ray.setFromCamera(ndc, this.camara);
      if (this.marcadores) {
        const golpe = ray.intersectObjects(this.marcadores.grupo.children.filter((o) => o.isMesh), false)[0];
        if (golpe) {
          arrastre = golpe.object;
          this.controles.enabled = false;
          plano.setFromNormalAndCoplanarPoint(this.camara.getWorldDirection(new THREE.Vector3()), arrastre.position);
          el.setPointerCapture(e.pointerId);
          e.preventDefault();
          return;
        }
      }
      this.alPulsar?.(e, ray);
    });
    el.addEventListener('pointermove', (e) => {
      aNdc(e);
      ray.setFromCamera(ndc, this.camara);
      if (arrastre) {
        if (ray.ray.intersectPlane(plano, punto)) {
          const a = arrastre.userData.articulacion;
          const delta = punto.clone().sub(a.pos);
          a.pos.copy(punto);
          arrastre.position.copy(punto);
          const { simetria, plan, grupo } = this.marcadores;
          if (simetria && a.lado !== 0) {
            const gemelo = plan.articulaciones.find((b) => b.nombre === a.nombre.replace(/_([id])$/, (_, s) => (s === 'i' ? '_d' : '_i')));
            if (gemelo && gemelo !== a) {
              gemelo.pos.add(new THREE.Vector3(-delta.x, delta.y, delta.z));
              grupo.children.find((m) => m.userData.articulacion === gemelo)?.position.copy(gemelo.pos);
            }
          }
          this.marcadores.actualizarLineas();
        }
        return;
      }
      this.alMover?.(e, ray);
    });
    const soltar = (e) => {
      if (arrastre) {
        arrastre = null;
        this.controles.enabled = true;
        this.marcadores?.alCambiar?.(this.marcadores.plan);
      }
      this.alSoltar?.(e);
    };
    el.addEventListener('pointerup', soltar);
    el.addEventListener('pointercancel', soltar);
  }

  /** Malla bajo el puntero (para el pincel). */
  mallasPintables() {
    const r = [];
    this.objeto?.traverse((o) => { if (o.isMesh && !o.userData.ayuda) r.push(o); });
    return r;
  }

  // --- Capturas y vídeo -----------------------------------------------------
  async captura(tamano = 0) {
    const suelo = this.suelo.visible;
    this.suelo.visible = false;
    let anterior = null;
    if (tamano) {
      anterior = new THREE.Vector2();
      this.renderer.getSize(anterior);
      this.renderer.setSize(tamano, tamano, false);
      this.camara.aspect = 1;
      this.camara.updateProjectionMatrix();
    }
    this.renderer.render(this.escena, this.camara);
    const blob = await new Promise((ok) => this.renderer.domElement.toBlob(ok, 'image/png'));
    this.suelo.visible = suelo;
    if (anterior) {
      this.renderer.setSize(anterior.x, anterior.y, false);
      this.ajustarTamano();
    }
    return blob;
  }

  /** Graba un vídeo del lienzo durante `segundos`. Devuelve {blob, extension}. */
  async grabar(segundos, alProgresar) {
    const lienzo = this.renderer.domElement;
    if (!lienzo.captureStream || typeof MediaRecorder === 'undefined') throw new Error('Tu navegador no permite grabar vídeo');
    const tipos = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    const tipo = tipos.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
    const flujo = lienzo.captureStream(30);
    const grab = new MediaRecorder(flujo, { mimeType: tipo || undefined, videoBitsPerSecond: 6_000_000 });
    const trozos = [];
    grab.ondataavailable = (e) => { if (e.data.size) trozos.push(e.data); };
    const fin = new Promise((ok) => { grab.onstop = ok; });
    grab.start(250);
    const t0 = performance.now();
    await new Promise((ok) => {
      const tic = () => {
        const p = (performance.now() - t0) / (segundos * 1000);
        alProgresar?.(Math.min(1, p));
        if (p >= 1) ok(); else requestAnimationFrame(tic);
      };
      tic();
    });
    grab.stop();
    await fin;
    flujo.getTracks().forEach((t) => t.stop());
    const mime = grab.mimeType || tipo || 'video/webm';
    return { blob: new Blob(trozos, { type: mime }), extension: mime.includes('mp4') ? 'mp4' : 'webm' };
  }
}
