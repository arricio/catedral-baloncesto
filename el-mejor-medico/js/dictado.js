// EL MEJOR MÉDICO — dictado por micrófono (reconocimiento de voz del navegador, en español de España).
// La grabación nunca se reproduce: sólo se convierte en texto, que el jugador revisa antes de que hable el médico.
// En la aplicación de Android (Capacitor) se usa el reconocedor del sistema si está instalado su complemento.

const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
const capacitorSR = () => window.Capacitor?.Plugins?.SpeechRecognition || null;

export const Dictado = {
  escuchando: false,
  _rec: null,
  get disponible() { return !!(SR || capacitorSR()); },
  get motivoNoDisponible() {
    if (this.disponible) return '';
    return 'Este navegador no tiene reconocimiento de voz. Usa Chrome o Edge, o el dictado del teclado (en Windows: tecla Windows + H; en Android: el micrófono del teclado).';
  },
  // alTexto(textoProvisional, esFinal); alFin(error)
  async iniciar({ alTexto, alFin }) {
    if (this.escuchando) return;
    const cap = capacitorSR();
    if (cap && !SR) {
      try {
        const p = await cap.requestPermissions?.();
        if (p && p.speechRecognition && p.speechRecognition !== 'granted') throw new Error('permiso denegado');
        this.escuchando = true;
        cap.addListener?.('partialResults', (d) => alTexto((d.matches || [])[0] || '', false));
        const r = await cap.start({ language: 'es-ES', maxResults: 1, partialResults: true, popup: false });
        alTexto((r?.matches || [])[0] || '', true);
        this.escuchando = false; alFin && alFin(null);
      } catch (e) { this.escuchando = false; alFin && alFin(e.message || String(e)); }
      return;
    }
    if (!SR) { alFin && alFin(this.motivoNoDisponible); return; }
    const rec = new SR();
    rec.lang = 'es-ES'; rec.interimResults = true; rec.continuous = true; rec.maxAlternatives = 1;
    let final = '';
    rec.onresult = (ev) => {
      let prov = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) final += (final ? ' ' : '') + r[0].transcript.trim();
        else prov += r[0].transcript;
      }
      alTexto((final + (prov ? ' ' + prov.trim() : '')).trim(), !prov);
    };
    rec.onerror = (ev) => { this._error = ev.error === 'not-allowed' ? 'No hay permiso para usar el micrófono.' : ev.error === 'no-speech' ? 'No se ha oído nada.' : ev.error === 'network' ? 'El reconocimiento de voz de este navegador necesita Internet.' : `Error del micrófono: ${ev.error}`; };
    rec.onend = () => { this.escuchando = false; this._rec = null; const e = this._error; this._error = null; alFin && alFin(e || null); };
    this._rec = rec; this.escuchando = true; this._error = null;
    try { rec.start(); } catch (e) { this.escuchando = false; this._rec = null; alFin && alFin(e.message); }
  },
  parar() {
    if (this._rec) { try { this._rec.stop(); } catch (e) {} }
    const cap = capacitorSR(); if (cap && this.escuchando && !SR) { try { cap.stop(); } catch (e) {} }
  },
};
