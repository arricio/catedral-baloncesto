// EL MEJOR MÉDICO — imágenes médicas dibujadas por código: radiografías, TAC, ecografías, ECG y garganta.

function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
}
function blob(ctx, x, y, r, color, alfa = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color.replace('A', alfa));
  g.addColorStop(1, color.replace('A', 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}
function grano(ctx, w, h, fuerza = 18, R = Math.random) {
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (R() - 0.5) * fuerza; d[i] += n; d[i + 1] += n; d[i + 2] += n * 1.05; }
  ctx.putImageData(img, 0, 0);
}
function hueso(ctx, x1, y1, x2, y2, grosor, alfa = 0.85) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = `rgba(235,240,245,${alfa * 0.55})`; ctx.lineWidth = grosor; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.strokeStyle = `rgba(250,252,255,${alfa * 0.5})`; ctx.lineWidth = grosor * 0.35;
  const nx = -(y2 - y1), ny = x2 - x1, L = Math.hypot(nx, ny) || 1, o = grosor * 0.36;
  ctx.beginPath(); ctx.moveTo(x1 + nx / L * o, y1 + ny / L * o); ctx.lineTo(x2 + nx / L * o, y2 + ny / L * o); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x1 - nx / L * o, y1 - ny / L * o); ctx.lineTo(x2 - nx / L * o, y2 - ny / L * o); ctx.stroke();
  // epífisis
  blob(ctx, x1, y1, grosor * 0.9, 'rgba(240,245,250,A)', alfa * 0.6);
  blob(ctx, x2, y2, grosor * 0.9, 'rgba(240,245,250,A)', alfa * 0.6);
  ctx.restore();
}

// ───────── Radiografía ─────────
// Devuelve la zona de interés {x,y,r} normalizada (0..1) si hay hallazgo.
export function dibujarRx(ctx, w, h, { zona = 'torax', hallazgo = 'normal', lado = 'izq', seed = 7 } = {}) {
  const R = rng(seed);
  ctx.save();
  ctx.fillStyle = '#050607'; ctx.fillRect(0, 0, w, h);
  const s = Math.min(w, h) / 512;
  ctx.translate(w / 2, h / 2); ctx.scale(s, s); ctx.translate(-256, -256);
  let roi = null;
  if (zona === 'torax') {
    // partes blandas
    blob(ctx, 256, 280, 330, 'rgba(120,128,135,A)', 0.55);
    // pulmones (oscuros)
    const pulmon = (dx, sg) => {
      ctx.save(); ctx.beginPath();
      ctx.moveTo(256 + sg * 28, 90);
      ctx.bezierCurveTo(256 + sg * 120, 70, 256 + sg * 200, 160, 256 + sg * 205, 390);
      ctx.quadraticCurveTo(256 + sg * 140, 360, 256 + sg * 40, 410);
      ctx.bezierCurveTo(256 + sg * 30, 300, 256 + sg * 22, 170, 256 + sg * 28, 90);
      ctx.closePath();
      const g = ctx.createLinearGradient(256, 80, 256, 420);
      g.addColorStop(0, 'rgba(20,22,26,0.92)'); g.addColorStop(1, 'rgba(35,38,42,0.85)');
      ctx.fillStyle = g; ctx.fill(); ctx.clip();
      // trama vascular desde el hilio
      ctx.strokeStyle = 'rgba(170,180,190,0.16)';
      for (let i = 0; i < 46; i++) {
        let x = 256 + sg * 50, y = 220 + R() * 40; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x, y);
        const ang = (R() - 0.5) * 2.4 + (sg > 0 ? 0 : Math.PI);
        for (let k = 0; k < 6; k++) { x += Math.cos(ang + (R() - 0.5) * 0.6) * 22; y += Math.sin(ang + (R() - 0.5) * 0.6) * 22; ctx.lineTo(x, y); ctx.lineWidth *= 0.8; }
        ctx.stroke();
      }
      ctx.restore();
    };
    pulmon(0, -1); pulmon(0, 1);
    // corazón (a la derecha de la imagen = izquierda del paciente)
    const grande = hallazgo === 'cardiomegalia' ? 1.35 : 1;
    ctx.save(); ctx.beginPath(); ctx.ellipse(275 + (grande - 1) * 40, 330, 92 * grande, 78 * grande, -0.35, 0, Math.PI * 2);
    const gc = ctx.createRadialGradient(270, 330, 10, 275, 330, 100); gc.addColorStop(0, 'rgba(225,230,235,0.85)'); gc.addColorStop(1, 'rgba(180,188,195,0.15)');
    ctx.fillStyle = gc; ctx.fill(); ctx.restore();
    blob(ctx, 256, 200, 40, 'rgba(210,215,220,A)', 0.5);
    // columna
    for (let i = 0; i < 13; i++) { ctx.fillStyle = `rgba(215,222,228,${0.28 + (i > 6 ? 0.1 : 0)})`; ctx.beginPath(); ctx.roundRect(240, 40 + i * 33, 32, 27, 6); ctx.fill(); }
    // costillas
    ctx.lineCap = 'round';
    for (let sg of [-1, 1]) for (let i = 0; i < 10; i++) {
      const y0 = 70 + i * 30;
      ctx.strokeStyle = 'rgba(230,236,242,0.32)'; ctx.lineWidth = 9;
      ctx.beginPath(); ctx.moveTo(256 + sg * 22, y0);
      ctx.bezierCurveTo(256 + sg * 120, y0 - 26, 256 + sg * 200, y0 + 6, 256 + sg * (205 - i * 3), y0 + 60);
      ctx.stroke();
      if (hallazgo === 'fractura_costal' && i === 6 && ((lado === 'izq' && sg > 0) || (lado === 'der' && sg < 0))) {
        const fx = 256 + sg * 168, fy = y0 + 6;
        ctx.strokeStyle = '#08090a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(fx - 4, fy - 9); ctx.lineTo(fx + 5, fy + 10); ctx.stroke();
        roi = { x: fx / 512, y: fy / 512, r: 0.09 };
      }
      // costillas anteriores, más tenues
      ctx.strokeStyle = 'rgba(220,226,232,0.12)'; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(256 + sg * 190, y0 + 30); ctx.quadraticCurveTo(256 + sg * 120, y0 + 70, 256 + sg * 40, y0 + 95); ctx.stroke();
    }
    // clavículas
    ctx.strokeStyle = 'rgba(235,240,245,0.55)'; ctx.lineWidth = 12;
    for (let sg of [-1, 1]) { ctx.beginPath(); ctx.moveTo(256 + sg * 25, 95); ctx.bezierCurveTo(256 + sg * 80, 70, 256 + sg * 140, 95, 256 + sg * 200, 60); ctx.stroke(); }
    // hombros
    for (let sg of [-1, 1]) blob(ctx, 256 + sg * 228, 70, 44, 'rgba(220,226,232,A)', 0.5);
    // diafragma
    ctx.fillStyle = 'rgba(200,206,212,0.55)';
    ctx.beginPath(); ctx.moveTo(40, 512); ctx.lineTo(40, 400); ctx.quadraticCurveTo(140, 330, 250, 410); ctx.quadraticCurveTo(370, 350, 472, 395); ctx.lineTo(472, 512); ctx.fill();
    if (hallazgo === 'masa') {
      const x = lado === 'izq' ? 372 : 140, y = 270;
      for (let i = 0; i < 9; i++) blob(ctx, x + (R() - 0.5) * 44, y + (R() - 0.5) * 40, 28 + R() * 26, 'rgba(235,240,245,A)', 0.55);
      blob(ctx, x, y, 52, 'rgba(245,248,250,A)', 0.6);
      roi = { x: x / 512, y: y / 512, r: 0.12 };
    }
    if (hallazgo === 'cardiomegalia') {
      // corazón grande y líquido en las bases
      for (const sg of [-1, 1]) for (let i = 0; i < 6; i++) blob(ctx, 256 + sg * (120 + R() * 60), 380 + R() * 30, 45, 'rgba(205,210,215,A)', 0.3);
      ctx.strokeStyle = 'rgba(210,215,220,0.25)'; ctx.lineWidth = 2;
      for (let i = 0; i < 30; i++) { const x = 70 + R() * 370, y = 120 + R() * 220; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (x < 256 ? -16 : 16), y + 2); ctx.stroke(); }
      roi = { x: 300 / 512, y: 330 / 512, r: 0.2 };
    }
    if (hallazgo === 'consolidacion') {
      const x = lado === 'izq' ? 360 : 150, y = 340;
      for (let i = 0; i < 14; i++) blob(ctx, x + (R() - 0.5) * 120, y + (R() - 0.5) * 70, 40 + R() * 30, 'rgba(210,215,220,A)', 0.3);
      ctx.strokeStyle = 'rgba(15,15,15,0.5)'; ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x - 30 + i * 18, y - 40); ctx.lineTo(x - 50 + i * 25, y + 30); ctx.stroke(); }
      roi = { x: x / 512, y: y / 512, r: 0.16 };
    }
  } else if (zona === 'muneca') {
    blob(ctx, 256, 300, 260, 'rgba(110,118,125,A)', 0.5);
    ctx.save(); ctx.globalAlpha = 0.9;
    hueso(ctx, 215, 520, 222, 300, 40); // radio
    hueso(ctx, 300, 520, 292, 305, 28); // cúbito
    // carpo
    const carpo = [[225, 275], [258, 270], [290, 278], [215, 245], [248, 240], [280, 243], [308, 252], [236, 215]];
    carpo.forEach(([x, y]) => { blob(ctx, x, y, 22, 'rgba(235,240,245,A)', 0.55); });
    // metacarpianos y dedos
    const base = [[205, 205], [235, 195], [262, 192], [288, 196], [312, 208]];
    base.forEach(([x, y], i) => {
      const ang = -Math.PI / 2 + (i - 2) * 0.17 + (i === 0 ? -0.5 : 0);
      let px = x, py = y; const largos = i === 0 ? [55, 38, 30] : [70, 42, 28, 22];
      largos.forEach((L, k) => { const nx = px + Math.cos(ang) * L, ny = py + Math.sin(ang) * L; hueso(ctx, px, py, nx, ny, 15 - k * 2.5, 0.8); px = nx + Math.cos(ang) * 4; py = ny + Math.sin(ang) * 4; });
    });
    ctx.restore();
    if (hallazgo === 'fractura') {
      ctx.strokeStyle = '#0a0b0c'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(195, 330); ctx.lineTo(208, 322); ctx.lineTo(220, 334); ctx.lineTo(240, 325); ctx.stroke();
      roi = { x: 218 / 512, y: 328 / 512, r: 0.1 };
    }
  } else if (zona === 'tobillo') {
    blob(ctx, 256, 300, 260, 'rgba(110,118,125,A)', 0.5);
    hueso(ctx, 240, 0, 245, 300, 58); hueso(ctx, 315, 0, 312, 320, 22);
    blob(ctx, 250, 335, 50, 'rgba(235,240,245,A)', 0.7); // astrágalo
    blob(ctx, 185, 390, 70, 'rgba(230,235,240,A)', 0.65); // calcáneo
    for (let i = 0; i < 5; i++) hueso(ctx, 290 + i * 8, 360 + i * 6, 470, 380 + i * 14, 14, 0.7);
  } else if (zona === 'craneo') {
    ctx.beginPath(); ctx.ellipse(256, 240, 175, 205, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(90,96,102,0.6)'; ctx.fill();
    ctx.lineWidth = 22; ctx.strokeStyle = 'rgba(235,240,245,0.75)'; ctx.stroke();
    for (const sg of [-1, 1]) { ctx.beginPath(); ctx.ellipse(256 + sg * 62, 270, 42, 36, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(15,16,18,0.8)'; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(230,235,240,0.5)'; ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(130, 360); ctx.quadraticCurveTo(256, 520, 382, 360); ctx.lineWidth = 18; ctx.strokeStyle = 'rgba(235,240,245,0.65)'; ctx.stroke();
    for (let i = 0; i < 12; i++) { ctx.fillStyle = 'rgba(245,248,250,0.7)'; ctx.fillRect(190 + i * 11, 382 + Math.abs(i - 5.5) * 2, 8, 22); }
    blob(ctx, 256, 330, 26, 'rgba(15,16,18,A)', 0.7);
  } else if (zona === 'cadera') {
    blob(ctx, 256, 260, 320, 'rgba(110,118,125,A)', 0.55);
    // pelvis y sacro
    ctx.strokeStyle = 'rgba(225,232,238,0.55)'; ctx.lineWidth = 30;
    for (const sg of [-1, 1]) { ctx.beginPath(); ctx.moveTo(256 + sg * 25, 140); ctx.bezierCurveTo(256 + sg * 110, 60, 256 + sg * 215, 110, 256 + sg * 190, 230); ctx.stroke(); }
    ctx.fillStyle = 'rgba(225,232,238,0.45)'; ctx.beginPath(); ctx.moveTo(220, 120); ctx.lineTo(292, 120); ctx.lineTo(275, 250); ctx.lineTo(237, 250); ctx.fill();
    ctx.lineWidth = 16; ctx.beginPath(); ctx.arc(256, 330, 70, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    for (const sg of [-1, 1]) {
      // cabeza, cuello y diáfisis del fémur (la derecha del paciente queda a la izquierda de la imagen)
      const cx = 256 + sg * 150, cy = 250;
      blob(ctx, cx, cy, 42, 'rgba(240,244,248,A)', 0.75);
      const rota = hallazgo === 'fractura_cadera' && ((lado === 'der' && sg < 0) || (lado === 'izq' && sg > 0));
      const dx = rota ? 12 : 0, dy = rota ? 16 : 0;
      hueso(ctx, cx + sg * 20 + dx, cy + 30 + dy, cx + sg * 55 + dx, cy + 75 + dy, 30, 0.85);
      hueso(ctx, cx + sg * 55 + dx, cy + 75 + dy, cx + sg * 40 + dx, 512, 40, 0.85);
      blob(ctx, cx + sg * 72 + dx, cy + 70 + dy, 26, 'rgba(235,240,245,A)', 0.6);
      if (rota) { ctx.strokeStyle = '#06070a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(cx + sg * 8, cy + 18); ctx.lineTo(cx + sg * 28, cy + 44); ctx.lineTo(cx + sg * 22, cy + 52); ctx.stroke(); roi = { x: (cx + sg * 20) / 512, y: (cy + 35) / 512, r: 0.1 }; }
    }
  } else { // abdomen y lumbar
    blob(ctx, 256, 260, 320, 'rgba(110,118,125,A)', 0.6);
    for (let i = 0; i < (zona === 'lumbar' ? 7 : 6); i++) { ctx.fillStyle = 'rgba(225,232,238,0.5)'; ctx.beginPath(); ctx.roundRect(226, 20 + i * 52, 60, 42, 10); ctx.fill(); for (const sg of [-1, 1]) { ctx.fillRect(256 + sg * 30 - (sg < 0 ? 26 : 0), 32 + i * 52, 26, 10); } }
    // pelvis
    ctx.strokeStyle = 'rgba(225,232,238,0.5)'; ctx.lineWidth = 26;
    for (const sg of [-1, 1]) { ctx.beginPath(); ctx.moveTo(256 + sg * 30, 360); ctx.bezierCurveTo(256 + sg * 120, 280, 256 + sg * 210, 330, 256 + sg * 200, 420); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(256, 470, 60, Math.PI, 0); ctx.lineWidth = 16; ctx.stroke();
    if (zona === 'abdomen') {
      for (let i = 0; i < 24; i++) blob(ctx, 110 + R() * 290, 120 + R() * 250, 12 + R() * 18, 'rgba(10,10,12,A)', 0.55);
      ctx.strokeStyle = 'rgba(225,232,238,0.25)'; ctx.lineWidth = 8;
      for (const sg of [-1, 1]) for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(256 + sg * 40, 30 + i * 28); ctx.quadraticCurveTo(256 + sg * 160, 30 + i * 28, 256 + sg * 220, 80 + i * 28); ctx.stroke(); }
    }
    if (hallazgo === 'calculo') {
      const x = lado === 'der' ? 205 : 307, y = 270;
      blob(ctx, x, y, 12, 'rgba(255,255,255,A)', 0.95);
      roi = { x: x / 512, y: y / 512, r: 0.08 };
    }
    if (hallazgo === 'moneda') {
      // moneda en el estómago: círculo blanquísimo de bordes nítidos
      const x = 300, y = 150;
      ctx.fillStyle = 'rgba(252,253,255,0.97)'; ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(200,205,210,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI * 2); ctx.stroke();
      roi = { x: x / 512, y: y / 512, r: 0.08 };
    }
  }
  ctx.restore();
  grano(ctx, w, h, 16, R);
  return roi;
}

// ───────── TAC ─────────
export function dibujarTac(ctx, w, h, { zona = 'torax', hallazgo = 'normal', lado = 'izq', seed = 11 } = {}) {
  const R = rng(seed);
  ctx.save(); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
  const s = Math.min(w, h) / 512; ctx.translate(w / 2, h / 2); ctx.scale(s, s); ctx.translate(-256, -256);
  let roi = null;
  const elipse = (x, y, rx, ry, c, rot = 0) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); ctx.fillStyle = c; ctx.fill(); };
  if (zona === 'craneo') {
    elipse(256, 256, 190, 225, '#d9dcdf'); elipse(256, 256, 172, 207, '#6e7276');
    for (let i = 0; i < 400; i++) { ctx.fillStyle = `rgba(${90 + R() * 20 | 0},${92 + R() * 20 | 0},${95 + R() * 20 | 0},0.5)`; ctx.fillRect(100 + R() * 312, 70 + R() * 372, 4, 4); }
    elipse(230, 240, 14, 46, '#1d1f22', 0.2); elipse(282, 240, 14, 46, '#1d1f22', -0.2);
    ctx.strokeStyle = '#2b2e31'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(256, 60); ctx.lineTo(256, 450); ctx.stroke();
  } else {
    elipse(256, 260, 225, 165, '#55595d');
    elipse(256, 260, 210, 150, '#6c7074');
    // grasa subcutánea
    ctx.strokeStyle = '#3c3f42'; ctx.lineWidth = 10; ctx.beginPath(); ctx.ellipse(256, 260, 215, 155, 0, 0, Math.PI * 2); ctx.stroke();
    // vértebra
    elipse(256, 375, 32, 28, '#e6e9ec'); elipse(256, 375, 22, 18, '#9da2a6'); elipse(256, 412, 10, 18, '#e6e9ec');
    if (zona === 'torax') {
      for (const sg of [-1, 1]) {
        ctx.beginPath(); ctx.ellipse(256 + sg * 105, 255, 88, 120, sg * 0.15, 0, Math.PI * 2); ctx.fillStyle = '#0b0c0d'; ctx.fill();
        for (let i = 0; i < 40; i++) { ctx.fillStyle = 'rgba(140,145,150,0.6)'; ctx.beginPath(); ctx.arc(256 + sg * (60 + R() * 90), 170 + R() * 170, 1.5 + R() * 2.5, 0, 7); ctx.fill(); }
      }
      elipse(262, 230, 60, 55, '#8d9296'); elipse(250, 180, 16, 16, '#a7acb0');
      for (let i = 0; i < 12; i++) { const a = Math.PI * (0.1 + i / 12 * 0.8) + (i > 5 ? 0.25 : -0.25); ctx.fillStyle = '#dfe2e5'; ctx.beginPath(); ctx.ellipse(256 + Math.cos(a) * 205 * (i > 5 ? 1 : -1) * -1, 260 + Math.sin(a) * 148, 9, 6, a, 0, 7); ctx.fill(); }
      if (hallazgo === 'masa') {
        const x = lado === 'izq' ? 360 : 152, y = 290;
        for (let i = 0; i < 8; i++) elipse(x + (R() - 0.5) * 30, y + (R() - 0.5) * 30, 20 + R() * 10, 18 + R() * 10, '#909498');
        roi = { x: x / 512, y: y / 512, r: 0.1 };
      }
      if (hallazgo === 'consolidacion') {
        const x = lado === 'izq' ? 355 : 157, y = 315;
        for (let i = 0; i < 10; i++) elipse(x + (R() - 0.5) * 70, y + (R() - 0.5) * 30, 26, 20, 'rgba(160,165,170,0.7)');
        roi = { x: x / 512, y: y / 512, r: 0.14 };
      }
      if (hallazgo === 'fractura_costal') roi = { x: (lado === 'izq' ? 455 : 57) / 512, y: 230 / 512, r: 0.08 };
    } else if (zona === 'abdomen') {
      ctx.beginPath(); ctx.moveTo(60, 230); ctx.bezierCurveTo(70, 120, 230, 110, 270, 170); ctx.bezierCurveTo(240, 260, 150, 330, 70, 320); ctx.closePath(); ctx.fillStyle = '#8b8f93'; ctx.fill(); // hígado (izquierda de la imagen)
      elipse(330, 190, 55, 40, '#5c6064'); elipse(330, 190, 40, 28, '#2a2d30'); // estómago
      elipse(175, 330, 30, 42, '#9a9ea2', 0.3); elipse(337, 330, 30, 42, '#9a9ea2', -0.3); // riñones
      elipse(270, 335, 13, 13, '#a9aeb2'); elipse(240, 340, 13, 13, '#7d8185');
      for (let i = 0; i < 14; i++) { const x = 160 + R() * 200, y = 230 + R() * 80; elipse(x, y, 16, 12, '#4c5054'); elipse(x, y, 9, 6, '#1a1c1e'); }
      if (hallazgo === 'colecistitis') {
        const x = 175, y = 245; elipse(x, y, 34, 24, '#e2e5e8'); elipse(x, y, 28, 18, '#3e4245');
        for (let i = 0; i < 4; i++) elipse(x - 12 + i * 8, y + 5, 5, 5, '#f5f6f7');
        roi = { x: x / 512, y: y / 512, r: 0.1 };
      }
      if (hallazgo === 'apendicitis') {
        const x = 150, y = 300; elipse(x, y, 20, 20, '#c9cdd1'); elipse(x, y, 11, 11, '#2c2f32');
        for (let i = 0; i < 10; i++) elipse(x + (R() - 0.5) * 50, y + (R() - 0.5) * 50, 6, 6, 'rgba(150,155,160,0.5)');
        roi = { x: x / 512, y: y / 512, r: 0.09 };
      }
      if (hallazgo === 'calculo') {
        const x = lado === 'der' ? 195 : 317, y = 360; elipse(x, y, 7, 7, '#ffffff');
        roi = { x: x / 512, y: y / 512, r: 0.08 };
      }
    } else {
      elipse(220, 260, 40, 40, '#e1e4e7'); elipse(220, 260, 25, 25, '#a3a8ac'); elipse(300, 270, 26, 26, '#e1e4e7');
      if (hallazgo === 'fractura' || hallazgo === 'fractura_cadera') { ctx.strokeStyle = '#000'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(190, 240); ctx.lineTo(250, 282); ctx.stroke(); roi = { x: 220 / 512, y: 260 / 512, r: 0.1 }; }
    }
  }
  ctx.restore();
  ctx.fillStyle = '#9fe'; ctx.font = `${12 * w / 400}px monospace`; ctx.fillText('120 kV  W:400 L:40', 8, h - 8);
  grano(ctx, w, h, 14, R);
  return roi;
}

// ───────── Ecografía ─────────
export function dibujarEco(ctx, w, h, { hallazgo = 'normal', seed = 5 } = {}) {
  const R = rng(seed);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
  const cx = w / 2, cy = h * 0.04, r = h * 0.92;
  ctx.save(); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, Math.PI / 2 - 0.65, Math.PI / 2 + 0.65); ctx.closePath(); ctx.clip();
  for (let i = 0; i < 9000; i++) { const v = 40 + R() * 120 | 0; ctx.fillStyle = `rgba(${v},${v},${v},0.55)`; ctx.fillRect(R() * w, R() * h, 2 + R() * 3, 1.5); }
  const negro = (x, y, rx, ry) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fillStyle = '#060606'; ctx.fill(); };
  let roi = null;
  if (hallazgo === 'colecistitis') {
    const x = cx, y = h * 0.45; ctx.lineWidth = 10; ctx.strokeStyle = '#b8b8b8'; ctx.beginPath(); ctx.ellipse(x, y, w * 0.18, h * 0.12, 0.1, 0, 7); ctx.stroke(); negro(x, y, w * 0.16, h * 0.1);
    for (let i = 0; i < 3; i++) { const sx = x - 20 + i * 22, sy = y + h * 0.06; ctx.fillStyle = '#f2f2f2'; ctx.beginPath(); ctx.arc(sx, sy, 9, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(sx - 8, sy + 9, 16, h); }
    roi = { x: x / w, y: y / h, r: 0.18 };
  } else if (hallazgo === 'apendicitis') {
    const x = cx, y = h * 0.5; for (let k = 0; k < 4; k++) { ctx.lineWidth = 8; ctx.strokeStyle = k % 2 ? '#222' : '#cfcfcf'; ctx.beginPath(); ctx.arc(x, y, 50 - k * 11, 0, 7); ctx.stroke(); }
    roi = { x: x / w, y: y / h, r: 0.14 };
  } else if (hallazgo === 'hidronefrosis') {
    const x = cx, y = h * 0.5; ctx.fillStyle = '#7a7a7a'; ctx.beginPath(); ctx.ellipse(x, y, w * 0.22, h * 0.14, 0.2, 0, 7); ctx.fill(); negro(x, y, w * 0.1, h * 0.06); negro(x + 30, y - 18, 16, 10); negro(x - 30, y + 14, 16, 10);
    roi = { x: x / w, y: y / h, r: 0.16 };
  } else if (hallazgo === 'hernia') {
    const x = cx, y = h * 0.4; ctx.fillStyle = '#9c9c9c'; ctx.beginPath(); ctx.ellipse(x, y, w * 0.16, h * 0.09, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#ddd'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx - w * 0.3, y + h * 0.1); ctx.lineTo(x - 30, y + h * 0.1); ctx.moveTo(x + 30, y + h * 0.1); ctx.lineTo(cx + w * 0.3, y + h * 0.1); ctx.stroke();
    roi = { x: x / w, y: y / h, r: 0.16 };
  } else {
    negro(cx - w * 0.08, h * 0.55, w * 0.04, h * 0.03); negro(cx + w * 0.1, h * 0.4, w * 0.03, h * 0.02);
  }
  ctx.restore();
  ctx.fillStyle = '#7cf'; ctx.font = `${11 * w / 400}px monospace`; ctx.fillText('C5-2  13 cm  GAN 54', 8, 16);
  return roi;
}

// ───────── ECG ─────────
export function ecgValor(f, tipo = 'normal', t = 0) {
  if (tipo === 'fv') return 0.5 * Math.sin(t * 31) + 0.35 * Math.sin(t * 47 + 1) + 0.2 * Math.sin(t * 13);
  if (tipo === 'asistolia') return 0.02 * Math.sin(t * 3);
  const g = (c, a, s) => a * Math.exp(-((f - c) ** 2) / (2 * s * s));
  let v = g(0.18, 0.15, 0.025) - g(0.29, 0.12, 0.008) + g(0.31, 1.2, 0.01) - g(0.335, 0.28, 0.01) + g(0.55, 0.3, 0.045);
  if (tipo === 'st') v += (f > 0.33 && f < 0.6 ? 0.38 : 0) * Math.min(1, (f - 0.33) / 0.02) + g(0.5, 0.15, 0.05);
  return v;
}
export function dibujarEcg(ctx, w, h, tipo = 'normal', fc = 75) {
  ctx.fillStyle = '#fff4f4'; ctx.fillRect(0, 0, w, h);
  const mm = w / 250;
  for (let x = 0; x < w; x += mm) { ctx.fillStyle = Math.round(x / mm) % 5 ? 'rgba(240,150,150,0.25)' : 'rgba(220,90,90,0.45)'; ctx.fillRect(x, 0, 1, h); }
  for (let y = 0; y < h; y += mm) { ctx.fillStyle = Math.round(y / mm) % 5 ? 'rgba(240,150,150,0.25)' : 'rgba(220,90,90,0.45)'; ctx.fillRect(0, y, w, 1); }
  const der = ['II', 'V2', 'V5'];
  const tipoReal = tipo === 'taqui' ? 'normal' : tipo;
  const fcReal = tipo === 'taqui' ? Math.max(fc, 112) : fc;
  der.forEach((n, k) => {
    const y0 = h * (0.2 + k * 0.3); ctx.strokeStyle = '#111'; ctx.lineWidth = 1.6; ctx.beginPath();
    const periodo = 60 / fcReal * 25 * mm; // 25 mm/s
    for (let x = 0; x < w; x++) {
      const f = ((x + k * 17) % periodo) / periodo;
      const amp = k === 1 ? 0.9 : 1.1;
      const y = y0 - ecgValor(f, tipoReal) * 10 * mm * amp * (k === 0 && tipo === 'st' ? 1 : (tipo === 'st' && k > 0 ? 0.6 : 1));
      x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke(); ctx.fillStyle = '#333'; ctx.font = `bold ${4 * mm}px sans-serif`; ctx.fillText(n, 4, y0 - 8 * mm);
  });
  ctx.fillStyle = '#555'; ctx.font = `${3.2 * mm}px sans-serif`; ctx.fillText(`25 mm/s   10 mm/mV   FC ${fcReal} lpm`, 4, h - 6);
}

// ───────── Garganta ─────────
export function dibujarGarganta(ctx, w, h, tipo = 'normal') {
  ctx.fillStyle = '#1a0b0b'; ctx.fillRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2;
  ctx.fillStyle = '#7b1f22'; ctx.beginPath(); ctx.ellipse(cx, cy, w * 0.42, h * 0.4, 0, 0, 7); ctx.fill();
  const rojo = tipo === 'normal' ? '#c4525a' : '#d8323c';
  const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, w * 0.4); g.addColorStop(0, '#3a0a0c'); g.addColorStop(0.5, rojo); g.addColorStop(1, '#8b2a2e');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, w * 0.38, h * 0.36, 0, 0, 7); ctx.fill();
  // paladar y úvula
  ctx.fillStyle = tipo === 'normal' ? '#e48a8e' : '#ee6d74'; ctx.beginPath(); ctx.ellipse(cx, cy - h * 0.3, w * 0.36, h * 0.12, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx, cy - h * 0.12, w * 0.035, h * 0.09, 0, 0, 7); ctx.fill();
  // amígdalas
  for (const sg of [-1, 1]) {
    const x = cx + sg * w * 0.22, y = cy;
    ctx.fillStyle = tipo === 'normal' ? '#d0636a' : '#e2424b'; ctx.beginPath(); ctx.ellipse(x, y, w * (tipo === 'placas' ? 0.11 : 0.07), h * 0.13, 0, 0, 7); ctx.fill();
    if (tipo === 'placas') for (let i = 0; i < 6; i++) { ctx.fillStyle = 'rgba(250,246,220,0.95)'; ctx.beginPath(); ctx.ellipse(x + (Math.sin(i * 2.3) * w * 0.05), y + Math.cos(i * 1.7) * h * 0.08, 7 + (i % 3) * 3, 5 + (i % 2) * 3, i, 0, 7); ctx.fill(); }
  }
  // lengua
  ctx.fillStyle = '#d97b80'; ctx.beginPath(); ctx.ellipse(cx, cy + h * 0.38, w * 0.4, h * 0.22, 0, Math.PI, 0); ctx.fill();
  // depresor
  ctx.fillStyle = '#e8d3a8'; ctx.fillRect(cx - w * 0.06, cy + h * 0.2, w * 0.12, h * 0.4);
}
