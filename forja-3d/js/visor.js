// Visor 3D: escena three.js con controles orbitales, modos de vista y estadísticas.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

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

    this.modelo = null;
    this.modoVista = 'textura';
    this.materialesOriginales = new Map();

    new ResizeObserver(() => this.ajustarTamano()).observe(contenedor);
    this.ajustarTamano();
    this.renderer.setAnimationLoop(() => {
      this.controles.update();
      this.renderer.render(this.escena, this.camara);
    });
  }

  ajustarTamano() {
    const { clientWidth: w, clientHeight: h } = this.contenedor;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camara.aspect = w / h;
    this.camara.updateProjectionMatrix();
  }

  /** Carga un GLB/GLTF desde un Blob o ArrayBuffer. */
  async cargarGLB(datos) {
    const buffer = datos instanceof Blob ? await datos.arrayBuffer() : datos;
    const gltf = await new GLTFLoader().parseAsync(buffer, '');
    this.mostrar(gltf.scene);
  }

  /** Coloca un objeto en la escena: centrado, apoyado en el suelo y con altura 1. */
  mostrar(objeto) {
    this.quitarModelo();
    const raiz = new THREE.Group();
    raiz.name = 'modelo';
    raiz.add(objeto);
    objeto.updateMatrixWorld(true);
    const caja = new THREE.Box3().setFromObject(objeto);
    const tam = caja.getSize(new THREE.Vector3());
    const centro = caja.getCenter(new THREE.Vector3());
    const escala = 1 / Math.max(tam.x, tam.y, tam.z, 1e-6);
    objeto.position.sub(centro);
    raiz.scale.setScalar(escala);
    raiz.position.y = (tam.y * escala) / 2;
    raiz.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        this.materialesOriginales.set(o, o.material);
      }
    });
    this.modelo = raiz;
    this.escena.add(raiz);
    this.aplicarModo(this.modoVista);
    this.encuadrar();
  }

  quitarModelo() {
    if (!this.modelo) return;
    this.escena.remove(this.modelo);
    this.modelo.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry?.dispose();
      const mats = [this.materialesOriginales.get(o), o.material].flat().filter(Boolean);
      for (const m of new Set(mats)) {
        for (const v of Object.values(m)) if (v?.isTexture) v.dispose();
        m.dispose();
      }
    });
    this.materialesOriginales.clear();
    this.modelo = null;
  }

  encuadrar() {
    if (!this.modelo) return;
    const caja = new THREE.Box3().setFromObject(this.modelo);
    const centro = caja.getCenter(new THREE.Vector3());
    const radio = caja.getBoundingSphere(new THREE.Sphere()).radius;
    const dist = radio / Math.sin(THREE.MathUtils.degToRad(this.camara.fov / 2)) * 1.15;
    const dir = new THREE.Vector3(0.75, 0.45, 1).normalize();
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
    this.modelo.traverse((o) => {
      if (!o.isMesh) return;
      const original = this.materialesOriginales.get(o);
      o.material = { textura: original, arcilla, malla, normales }[modo] ?? original;
    });
  }

  set autoRotar(v) { this.controles.autoRotate = v; }
  set verSuelo(v) { this.suelo.visible = v; }

  estadisticas() {
    if (!this.modelo) return null;
    let triangulos = 0, vertices = 0;
    this.modelo.traverse((o) => {
      if (!o.isMesh) return;
      const g = o.geometry;
      vertices += g.attributes.position.count;
      triangulos += (g.index ? g.index.count : g.attributes.position.count) / 3;
    });
    const tam = new THREE.Box3().setFromObject(this.modelo).getSize(new THREE.Vector3());
    return { triangulos: Math.round(triangulos), vertices, proporcion: tam };
  }

  /** Objeto del modelo con los materiales originales (para exportar). */
  objetoExportable() {
    if (!this.modelo) return null;
    const anterior = this.modoVista;
    this.aplicarModo('textura');
    const copia = this.modelo.clone(true);
    this.aplicarModo(anterior);
    return copia;
  }

  /** Captura PNG con fondo transparente (Blob). */
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
}
