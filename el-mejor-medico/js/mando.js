// EL MEJOR MÉDICO — mando de Xbox (o cualquier mando estándar) con la Gamepad API.
// Cruceta y joystick izquierdo: moverse por los menús. A: confirmar. B: cancelar.
// X, Y, gatillos y bumpers: acciones que dependen de lo que se esté haciendo (las decide el juego).
// En las actividades con puntero (estetoscopio, imágenes, cirugía) el joystick mueve un cursor y RT hace de dedo.

const BOTONES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'VISTA', 'MENU', 'LS', 'RS', 'ARRIBA', 'ABAJO', 'IZQUIERDA', 'DERECHA'];
const SEL = 'button:not([disabled]), input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [data-mando]';

export const Mando = {
  conectado: false,
  nombre: '',
  sensibilidad: 1,     // velocidad del cursor
  zonaMuerta: 0.18,
  ultimaEntrada: 'raton', // 'raton' | 'teclado' | 'mando' | 'tactil'
  // el juego decide qué hace cada botón según el contexto; devuelve true si lo ha gestionado
  alAccion: null,
  // cuando la actividad usa puntero, el juego activa el cursor virtual
  modoCursor: false,
  alConectar: null,
  _prev: {}, _rep: {}, _foco: null, _cursor: null, _pos: { x: innerWidth / 2, y: innerHeight / 2 }, _pulsando: false, _teclado: null,

  iniciar() {
    addEventListener('gamepadconnected', () => this._detectar());
    addEventListener('gamepaddisconnected', () => this._detectar());
    addEventListener('pointerdown', (e) => { if (!e.isTrusted) return; this.ultimaEntrada = e.pointerType === 'touch' ? 'tactil' : 'raton'; this._quitarFoco(); }, true);
    addEventListener('keydown', (e) => { if (e.isTrusted) this.ultimaEntrada = 'teclado'; }, true);
    // se lee 60 veces por segundo, aunque el 3D vaya a menos fotogramas, para no perder pulsaciones
    setInterval(() => { try { this._leer(); } catch (e) {} }, 1000 / 60);
  },
  _mandos() { try { return [...(navigator.getGamepads ? navigator.getGamepads() : [])].filter(Boolean); } catch (e) { return []; } },
  _detectar() {
    const g = this._mandos()[0];
    const antes = this.conectado;
    this.conectado = !!g; this.nombre = g ? g.id : '';
    if (antes !== this.conectado) { this.alConectar && this.alConectar(this.conectado, this.nombre); if (!this.conectado) { this._quitarFoco(); this._ocultarCursor(); } }
  },
  _leer() {
    const g = this._mandos()[0];
    if (!!g !== this.conectado) this._detectar();
    if (!g) return;
    const ahora = performance.now();
    const est = {};
    BOTONES.forEach((n, i) => { const b = g.buttons[i]; est[n] = b ? (typeof b === 'object' ? b.pressed || b.value > 0.5 : b > 0.5) : false; });
    const ejes = g.axes || [];
    const dz = (v) => Math.abs(v || 0) < this.zonaMuerta ? 0 : v;
    const lx = dz(ejes[0]), ly = dz(ejes[1]), rx = dz(ejes[2]), ry = dz(ejes[3]);
    // el joystick izquierdo también navega por los menús
    if (!this.modoCursor) { est.ARRIBA ||= ly < -0.6; est.ABAJO ||= ly > 0.6; est.IZQUIERDA ||= lx < -0.6; est.DERECHA ||= lx > 0.6; }
    const algo = Object.values(est).some(Boolean) || lx || ly || rx || ry;
    if (algo) this.ultimaEntrada = 'mando';
    // pulsaciones nuevas (con repetición en las direcciones)
    for (const n of BOTONES) {
      if (est[n] && !this._prev[n]) { this._rep[n] = ahora + 380; this._boton(n); }
      else if (est[n] && /ARRIBA|ABAJO|IZQUIERDA|DERECHA/.test(n) && ahora > this._rep[n]) { this._rep[n] = ahora + 110; this._boton(n); }
      else if (!est[n] && this._prev[n]) this._soltar(n);
    }
    this._prev = est;
    // cursor virtual
    if (this.modoCursor) {
      this._mostrarCursor();
      const v = 14 * this.sensibilidad * (est.LT ? 0.35 : 1); // LT: movimiento fino de precisión
      if (lx || ly || rx || ry) {
        this._pos.x = Math.max(0, Math.min(innerWidth - 1, this._pos.x + (lx + rx * 0.5) * v));
        this._pos.y = Math.max(0, Math.min(innerHeight - 1, this._pos.y + (ly + ry * 0.5) * v));
        this._cursor.style.transform = `translate(${this._pos.x}px, ${this._pos.y}px)`;
        this._puntero(this._pulsando ? 'pointermove' : 'pointermove');
      }
    } else this._ocultarCursor();
  },
  _boton(n) {
    if (this._teclado) return this._teclado.boton(n);
    // RT hace de dedo con el cursor virtual
    if (this.modoCursor && n === 'RT') { this._pulsando = true; this._puntero('pointerdown'); return; }
    if (this.modoCursor && n === 'A' && !this._foco) { this._pulsando = true; this._puntero('pointerdown'); return; }
    if (this.alAccion && this.alAccion(n)) return;
    if (n === 'ARRIBA' || n === 'ABAJO' || n === 'IZQUIERDA' || n === 'DERECHA') return this.mover(n);
    if (n === 'A') return this.activar();
    if (n === 'B') return this.atras();
  },
  _soltar(n) {
    if (this.modoCursor && (n === 'RT' || n === 'A') && this._pulsando) { this._pulsando = false; this._puntero('pointerup'); this._puntero('click'); }
  },
  // ───── foco ─────
  raiz() {
    const modales = [...document.querySelectorAll('#modales .modal-fondo')];
    if (modales.length) return modales[modales.length - 1];
    return document.body;
  },
  visibles() {
    const r = this.raiz();
    return [...r.querySelectorAll(SEL)].filter(el => {
      if (el.closest('.oculto') || el.closest('[hidden]')) return false;
      const b = el.getBoundingClientRect();
      if (b.width < 2 || b.height < 2 || b.bottom < 0 || b.top > innerHeight || b.right < 0 || b.left > innerWidth) return false;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.pointerEvents === 'none' || +cs.opacity === 0) return false;
      // fuera del lienzo 3D y de capas apagadas
      let p = el; while (p && p !== document.body) { const s = getComputedStyle(p); if (s.display === 'none' || s.pointerEvents === 'none' && p !== el) return false; p = p.parentElement; }
      return true;
    });
  },
  enfocar(el) {
    this._quitarFoco();
    if (!el) return;
    this._foco = el; el.classList.add('foco-mando');
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (el.matches('input, textarea, select')) el.focus({ preventScroll: true });
  },
  _quitarFoco() { if (this._foco) this._foco.classList.remove('foco-mando'); this._foco = null; },
  mover(dir) {
    const lista = this.visibles();
    if (!lista.length) return;
    if (!this._foco || !lista.includes(this._foco)) return this.enfocar(lista[0]);
    const a = this._foco.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let mejor = null, ms = Infinity;
    for (const el of lista) {
      if (el === this._foco) continue;
      const b = el.getBoundingClientRect(), bx = b.left + b.width / 2, by = b.top + b.height / 2;
      const dx = bx - ax, dy = by - ay;
      const prim = dir === 'ARRIBA' ? -dy : dir === 'ABAJO' ? dy : dir === 'IZQUIERDA' ? -dx : dx;
      const sec = dir === 'ARRIBA' || dir === 'ABAJO' ? Math.abs(dx) : Math.abs(dy);
      if (prim <= 2) continue;
      const s = prim + sec * 2.2;
      if (s < ms) { ms = s; mejor = el; }
    }
    if (mejor) this.enfocar(mejor);
  },
  activar() {
    const el = this._foco && document.contains(this._foco) ? this._foco : null;
    if (!el) return this.mover('ABAJO');
    if (el.matches('input[type=range]')) { el.value = Math.min(+el.max, +el.value + (+el.step || 1)); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return; }
    if (el.matches('input[type=checkbox]')) { el.click(); return; }
    if (el.matches('select')) { el.selectedIndex = (el.selectedIndex + 1) % el.options.length; el.dispatchEvent(new Event('change', { bubbles: true })); return; }
    if (el.matches('input, textarea')) { this.abrirTeclado(el); return; }
    el.click();
  },
  atras() {
    const modales = [...document.querySelectorAll('#modales .modal-fondo')];
    const m = modales[modales.length - 1];
    const cerrar = m && m.querySelector('.cerrar');
    if (cerrar) { cerrar.click(); this._quitarFoco(); return; }
    if (this.alAccion) this.alAccion('ATRAS');
  },
  // ───── cursor virtual ─────
  _mostrarCursor() {
    if (!this._cursor) { const c = document.createElement('div'); c.id = 'cursor-mando'; document.body.appendChild(c); this._cursor = c; c.style.transform = `translate(${this._pos.x}px, ${this._pos.y}px)`; }
    this._cursor.style.display = 'block';
  },
  _ocultarCursor() { if (this._cursor) this._cursor.style.display = 'none'; },
  _puntero(tipo) {
    const x = this._pos.x, y = this._pos.y;
    if (this._cursor) this._cursor.style.display = 'none';
    const el = document.elementFromPoint(x, y);
    if (this._cursor) this._cursor.style.display = 'block';
    if (!el) return;
    const ini = { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 77, pointerType: 'mouse', isPrimary: true, buttons: this._pulsando ? 1 : 0 };
    el.dispatchEvent(tipo === 'click' ? new MouseEvent('click', ini) : new PointerEvent(tipo, ini));
  },
  // ───── teclado virtual para escribir sin teclado físico ─────
  abrirTeclado(campo) {
    if (this.ultimaEntrada !== 'mando') { campo.focus(); return; }
    const filas = [
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
      ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
      ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ñ'],
      ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '?'],
      ['á', 'é', 'í', 'ó', 'ú', 'ü', '¿', '¡', '!', '-'],
      ['⇧', 'ESPACIO', '⌫', 'ACEPTAR'],
    ];
    const t = document.createElement('div'); t.id = 'teclado-virtual';
    t.innerHTML = `<div class="tv-texto"></div><div class="tv-teclas">${filas.map((f, i) => `<div class="tv-fila">${f.map((k, j) => `<button data-f="${i}" data-c="${j}" class="${k.length > 1 ? 'ancha' : ''}">${k}</button>`).join('')}</div>`).join('')}</div>
      <p class="tv-ayuda">Cruceta: elegir · A: escribir · B: borrar · X: espacio · Y: mayúsculas · MENÚ: aceptar</p>`;
    document.body.appendChild(t);
    let f = 1, c = 0, mayus = true;
    const txt = t.querySelector('.tv-texto');
    const pintar = () => {
      txt.textContent = campo.value || ' ';
      t.querySelectorAll('button').forEach(b => { b.classList.toggle('foco-mando', +b.dataset.f === f && +b.dataset.c === c); if (b.textContent.length === 1) b.textContent = mayus ? b.textContent.toUpperCase() : b.textContent.toLowerCase(); });
    };
    const escribir = (k) => {
      if (k === 'ACEPTAR') return cerrar();
      if (k === '⌫') campo.value = campo.value.slice(0, -1);
      else if (k === 'ESPACIO') campo.value += ' ';
      else if (k === '⇧') mayus = !mayus;
      else { campo.value += mayus ? k.toUpperCase() : k; if (mayus && /[a-zñáéíóú]/i.test(k)) mayus = false; }
      if (/[.?!]$/.test(campo.value.trim())) mayus = true;
      campo.dispatchEvent(new Event('input', { bubbles: true }));
      pintar();
    };
    const cerrar = () => { t.remove(); this._teclado = null; campo.dispatchEvent(new Event('change', { bubbles: true })); this.enfocar(campo); };
    t.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { f = +b.dataset.f; c = +b.dataset.c; escribir(filas[f][c]); } });
    this._teclado = {
      boton: (n) => {
        if (n === 'ARRIBA') f = (f + filas.length - 1) % filas.length;
        else if (n === 'ABAJO') f = (f + 1) % filas.length;
        else if (n === 'IZQUIERDA') c--;
        else if (n === 'DERECHA') c++;
        else if (n === 'A') return escribir(filas[f][Math.min(c, filas[f].length - 1)]);
        else if (n === 'B') return escribir('⌫');
        else if (n === 'X') return escribir('ESPACIO');
        else if (n === 'Y') return escribir('⇧');
        else if (n === 'MENU') return cerrar();
        c = (c + filas[f].length) % filas[f].length;
        pintar();
      },
    };
    pintar();
  },
};
