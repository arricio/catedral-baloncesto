// Pincel: pinta directamente sobre el modelo. Si la malla tiene textura se pinta
// en la textura (en el punto UV tocado); si no, en los colores de los vértices.
import * as THREE from 'three';

export class Pincel {
  constructor(visor) {
    this.visor = visor;
    this.activo = false;
    this.color = new THREE.Color('#ff3b6b');
    this.tamano = 0.03;      // radio relativo a la altura del modelo
    this.dureza = 0.8;
    this.pintando = false;
    this.alCambiar = null;
    this.lienzos = new Map(); // material -> {canvas, ctx, textura}
    visor.alPulsar = (e, ray) => { if (this.activo) { this.pintando = true; this.pintar(ray); e.preventDefault(); } };
    visor.alMover = (e, ray) => { if (this.activo && this.pintando) this.pintar(ray); };
    visor.alSoltar = () => {
      if (this.pintando) { this.pintando = false; this.alCambiar?.(); }
    };
  }

  activar(si) {
    this.activo = si;
    this.visor.controles.enabled = !si;
    if (si) this.visor.aplicarModo('textura');
  }

  prepararTextura(material) {
    if (this.lienzos.has(material)) return this.lienzos.get(material);
    const img = material.map.image;
    const w = Math.min(2048, img.width || 1024), h = Math.min(2048, img.height || 1024);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    const tex = new THREE.CanvasTexture(canvas);
    tex.flipY = material.map.flipY;
    tex.colorSpace = material.map.colorSpace;
    tex.wrapS = material.map.wrapS;
    tex.wrapT = material.map.wrapT;
    tex.channel = material.map.channel;
    tex.anisotropy = 4;
    material.map = tex;
    material.needsUpdate = true;
    const datos = { canvas, ctx, tex };
    this.lienzos.set(material, datos);
    return datos;
  }

  pintar(ray) {
    const mallas = this.visor.mallasPintables();
    const golpe = ray.intersectObjects(mallas, false)[0];
    if (!golpe) return;
    const malla = golpe.object;
    const mat = Array.isArray(malla.material) ? malla.material[0] : malla.material;
    const caja = new THREE.Box3().setFromObject(this.visor.modelo);
    const radioMundo = this.tamano * (caja.max.y - caja.min.y);

    if (mat.map && golpe.uv) {
      const { canvas, ctx, tex } = this.prepararTextura(mat);
      // Radio en píxeles: compara la superficie del triángulo en el mundo y en la textura.
      const g = malla.geometry;
      const uv = g.attributes.uv;
      const pos = g.attributes.position;
      const f = golpe.face;
      const a = new THREE.Vector3().fromBufferAttribute(pos, f.a).applyMatrix4(malla.matrixWorld);
      const b = new THREE.Vector3().fromBufferAttribute(pos, f.b).applyMatrix4(malla.matrixWorld);
      const ua = new THREE.Vector2().fromBufferAttribute(uv, f.a);
      const ub = new THREE.Vector2().fromBufferAttribute(uv, f.b);
      const mundo = a.distanceTo(b) || 1e-6;
      const texel = ua.distanceTo(ub) * canvas.width || 1;
      const r = Math.max(2, Math.min(canvas.width / 4, radioMundo * (texel / mundo)));
      const x = golpe.uv.x * canvas.width;
      const y = (tex.flipY ? 1 - golpe.uv.y : golpe.uv.y) * canvas.height;
      const grad = ctx.createRadialGradient(x, y, r * this.dureza, x, y, r);
      const c = `#${this.color.getHexString()}`;
      grad.addColorStop(0, c);
      grad.addColorStop(1, `${c}00`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      tex.needsUpdate = true;
      return;
    }

    // Colores por vértice.
    const g = malla.geometry;
    const pos = g.attributes.position;
    if (!g.attributes.color) {
      const base = mat.color ?? new THREE.Color(1, 1, 1);
      const arr = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) { arr[i * 3] = base.r; arr[i * 3 + 1] = base.g; arr[i * 3 + 2] = base.b; }
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      mat.color?.set(1, 1, 1);
      mat.vertexColors = true;
      mat.needsUpdate = true;
    }
    const col = g.attributes.color;
    const inv = malla.matrixWorld.clone().invert();
    const local = golpe.point.clone().applyMatrix4(inv);
    const escala = new THREE.Vector3().setFromMatrixScale(malla.matrixWorld).x || 1;
    const rl = radioMundo / escala;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const d = v.distanceTo(local);
      if (d > rl) continue;
      const k = d < rl * this.dureza ? 1 : 1 - (d - rl * this.dureza) / (rl * (1 - this.dureza) || 1);
      col.setXYZ(i,
        col.getX(i) + (this.color.r - col.getX(i)) * k,
        col.getY(i) + (this.color.g - col.getY(i)) * k,
        col.getZ(i) + (this.color.b - col.getZ(i)) * k);
    }
    col.needsUpdate = true;
  }
}
