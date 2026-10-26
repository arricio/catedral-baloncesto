// EL MEJOR MÉDICO — respuestas de los pacientes: IA generativa (modelo local o servidor compatible)
// y respuestas predefinidas del juego como alternativa cuando no hay IA disponible.
import { ENF, normaliza, textoEdad } from './datos.js';

// ───────────────────────── Configuración ─────────────────────────
// modo: 'predefinida' (sin IA, funciona siempre y sin Internet)
//       'ollama'      (Ollama en este ordenador o en la red local: gratuito y sin Internet)
//       'openai'      (cualquier servidor con la API de OpenAI: LM Studio, llama.cpp, etc.)
export const IA_POR_DEFECTO = { modo: 'predefinida', url: 'http://localhost:11434', modelo: 'qwen2.5:3b', espera: 30 };

// ───────────────────────── Intención de la pregunta ─────────────────────────
// Se usa para que la conversación libre siga moviendo la mecánica del juego (hallazgos, confianza, secretos...)
const INTENCIONES = [
  ['acomp', /(esperar|espere|salir|salga|sal).{0,20}(fuera|afuera|un momento)|dejarnos solos|a solas/],
  ['secreto', /algo mas que (deba|deberia|tenga que) saber|confidencial|no (me|nos) (ha|has|han) contado|ocult|secreto|algo que no (me|nos) (hayas|haya|hayan)/],
  ['presionar', /no me (esta|estas|estan) (contando|diciendo) (toda )?la verdad|mintiendo|me (esta|estas) mintiendo|no me lo creo/],
  ['alergia', /alergi|alergic/],
  ['antecedentes', /enfermedad(es)?|medicacion|medicamento|pastilla|tratamiento (habitual|actual)|operad|antecedente|vacuna/],
  ['habitos', /fuma|tabaco|bebe|alcohol|habito|come|comida|dieta|deporte|ejercicio|duerme|cigarr/],
  ['fiebre', /fiebre|temperatura|escalofrio|tiritona|calentura/],
  ['inicio', /desde cuando|cuando (empezo|empezaron|comenzo|le paso|te paso)|cuanto tiempo|hace cuanto|cuantos dias/],
  ['dolor', /duele|dolor|molest|pincha|escuece|donde (le|te)/],
  ['extra', /algo mas|otra cosa|otros? sintoma|ha notado|has notado|han notado/],
  ['calmar', /tranquil|no se preocupe|no te preocupes|buenas manos|confie|confia|no pasa nada|no te voy a hacer dano/],
  ['motivo', /que le (pasa|ocurre|trae)|que te (pasa|ocurre)|que (les|os) trae|en que (le|te) puedo ayudar|cuenteme|cuentame|como (se encuentra|esta|estas)|que tal (esta|estas)|que le sucede/],
  ['nombre', /como (se llama|te llamas)|su nombre|tu nombre/],
  ['edad', /cuantos anos|que edad/],
  ['gracias', /gracias/],
  ['despedida', /adios|hasta luego|que se mejore|que te mejores|cuidese|cuidate/],
  ['saludo', /^(hola|buenos dias|buenas tardes|buenas noches|buenas)[\s.,!]*$/],
];
// todas las intenciones de una frase (una pregunta puede preguntar dos cosas a la vez)
export function intenciones(texto) {
  const t = normaliza(texto).replace(/[¿?¡!]/g, ' ').replace(/\s+/g, ' ').trim();
  return INTENCIONES.filter(([, re]) => re.test(t)).map(([id]) => id);
}
export function clasificar(texto) {
  const t = normaliza(texto).replace(/[¿?¡!]/g, ' ').replace(/\s+/g, ' ').trim();
  for (const [id, re] of INTENCIONES) if (re.test(t)) return id;
  if (/^(hola|buenos dias|buenas)/.test(t)) return 'motivo';
  return 'general';
}
// ¿El médico se dirige al niño (de tú) y no a sus padres?
export function hablaDeTu(texto) {
  const t = normaliza(texto);
  return /\b(te|tienes|estas|duele\s+a\s+ti|cuentame|dime|tu|campeon|campeona|guapo|guapa|cariño|carino|peque)\b/.test(t) && !/\b(usted|ustedes|le pasa|su hij)\b/.test(t);
}

// ───────────────────────── Personalidad estable ─────────────────────────
const PERSONALIDADES_ADULTO = ['habladora y simpática', 'reservada y de pocas palabras', 'nerviosa y algo exagerada', 'desconfiada con los médicos', 'educada y muy formal', 'bromista, quita hierro a las cosas', 'preocupada por todo', 'directa y práctica'];
const PERSONALIDADES_NINO = ['tímido o tímida, contesta con muy pocas palabras', 'charlatán o charlatana y curioso', 'asustado o asustada por estar en el médico', 'travieso o traviesa y movido'];
const PERSONALIDADES_MAYOR = ['entrañable, cuenta batallitas de su pueblo', 'quejica pero cariñoso', 'algo duro de oído, pide que le repitan', 'muy educado, de los de antes'];
export function personalidad(pac) {
  const l = pac.edad < 13 ? PERSONALIDADES_NINO : pac.edad >= 70 ? PERSONALIDADES_MAYOR : PERSONALIDADES_ADULTO;
  return l[(pac.id * 7 + (pac.nombre || '').length) % l.length];
}

// ───────────────────────── Datos que puede contar el paciente ─────────────────────────
function hechos(pac) {
  const e = ENF[pac.enfId], d0 = pac.edad < 10 && e.dNino ? { ...e.d, ...e.dNino } : e.d;
  // las frases del juego llevan marcas de género ({o}) y algunas están escritas para una paciente mujer
  const o = pac.sexo === 'm' ? 'a' : 'o';
  // en las enfermedades que cuenta un familiar («mi madre está rarísima»), se ajusta al sexo del paciente
  const g = (t) => { const s = String(t).replace(/\{o\}/g, o); return e.respondeAcomp ? s.replace(pac.sexo === 'm' ? /\b(mi|su) padre\b/g : /\b(mi|su) madre\b/g, (m, p) => `${p} ${pac.sexo === 'm' ? 'madre' : 'padre'}`) : s; };
  const d = Object.fromEntries(Object.entries(d0).map(([k, v]) => [k, Array.isArray(v) ? v.map(g) : v]));
  const l = [];
  l.push(`Síntomas que nota (con sus palabras): ${[...(d.motivo || []), ...(d.dolor || [])].slice(0, 4).join(' / ')}`);
  if (d.inicio) l.push(`Desde cuándo: ${d.inicio[0]}`);
  if (d.fiebre) l.push(`Fiebre: ${d.fiebre[0]}`);
  if (d.extra) l.push(`Otras cosas que ha notado: ${d.extra.join(' / ')}`);
  l.push(`Enfermedades previas: ${pac.antecedentes.length ? pac.antecedentes.join(', ') : 'ninguna'}`);
  l.push(`Alergias: ${pac.alergia ? { aine: 'antiinflamatorios (ibuprofeno)', penicilina: 'penicilina', marisco: 'marisco' }[pac.alergia] : 'ninguna conocida'}`);
  if (pac.edad >= 15) l.push(`Hábitos: ${pac.fumador ? 'fuma' : 'no fuma'}; ${pac.bebedor ? 'bebe alcohol con frecuencia' : 'bebe poco'}`);
  if (e.d.habitosMentira && !pac.secretoRevelado) l.push(`Sobre sus hábitos MIENTE, dice cosas como: ${g(e.d.habitosMentira[0])}`);
  if (e.secreto) {
    if (pac.secretoRevelado) l.push(`Ya ha confesado esto al médico: ${g(e.secreto.t)}`);
    else l.push(`Tiene un secreto que NO cuenta salvo que el médico se gane su confianza y le pregunte directamente: ${g(e.secreto.t)}`);
  }
  if (e.simulador && !pac.secretoRevelado) l.push('En realidad está fingiendo o exagerando para conseguir algo (por ejemplo, la baja); no lo admite fácilmente.');
  if (pac.acompanante) l.push(`Viene acompañado por ${pac.acompanante}.`);
  return l;
}

// ───────────────────────── Instrucciones para el modelo ─────────────────────────
export function construirPrompt({ pac, quien, nombreDoctor, historial, pregunta, referencia, tratamiento }) {
  const e = ENF[pac.enfId];
  const edad = textoEdad(pac.edad);
  const esAcomp = quien === 'acomp';
  const ella = pac.sexo === 'm';
  const parentesco = { 'su madre': ella ? 'hija' : 'hijo', 'su padre': ella ? 'hija' : 'hijo', 'su abuela': ella ? 'nieta' : 'nieto', 'su abuelo': ella ? 'nieta' : 'nieto', 'su hija': ella ? 'madre' : 'padre', 'su hijo': ella ? 'madre' : 'padre', 'su nieta': ella ? 'abuela' : 'abuelo', 'su nieto': ella ? 'abuela' : 'abuelo', 'su mujer': 'marido', 'su marido': 'mujer' }[pac.acompanante] || null;
  const persona = esAcomp
    ? `Eres ${(pac.acompanante || 'un familiar').replace(/^su /, 'el/la ')} de ${pac.nombre}. ${pac.nombre} es ${ella ? 'una paciente (mujer)' : 'un paciente (hombre)'} de ${edad}${parentesco ? `: es tu ${parentesco}` : ''}. Usa siempre el ${ella ? 'femenino' : 'masculino'} al hablar de ${ella ? 'ella' : 'él'}. Contestas tú porque ${pac.edad < 10 ? 'es pequeñ' + (ella ? 'a' : 'o') : (ella ? 'ella' : 'él') + ' no puede explicarse bien'}. Hablas de ${pac.nombre} en tercera persona.`
    : `Eres ${pac.nombre} ${pac.apellidos}, ${ella ? 'mujer' : 'hombre'} de ${edad}. Personalidad: ${personalidad(pac)}.${pac.edad < 10 ? ' Los datos de tu historia los contaron tus padres; tú hablas de ti mismo en primera persona («me duele», «tengo»), nunca como «tiene» o «le».' : ''}`;
  const estilo = esAcomp ? 'Habla como un familiar preocupado.'
    : pac.edad < 7 ? 'Eres un niño o niña pequeño: frases muy cortas y sencillas, vocabulario infantil, sin palabras técnicas ni de adulto (nada de «decaído», «molestias», «síntomas», «medicación»). Ejemplo: «Aquí, en la barriga. Me duele mucho».'
    : pac.edad < 13 ? 'Eres un niño o niña: frases cortas, lenguaje de colegio, nada técnico ni de adulto.'
    : pac.edad < 18 ? 'Eres adolescente: frases cortas, algo de vergüenza, lenguaje juvenil sin exagerar.'
    : pac.edad >= 76 ? 'Eres una persona muy mayor: ritmo pausado, expresiones de toda la vida (hijo, hija, ay, Dios mío), a veces te vas un poco por las ramas.'
    : pac.edad >= 61 ? 'Eres una persona mayor: lenguaje sencillo y cercano.'
    : 'Habla con naturalidad, como un paciente normal.';
  const sistema = [
    persona,
    'Estás en la consulta del médico del Hospital San Marcos, en León (España). Hablas SIEMPRE en español de España (nada de expresiones latinoamericanas), en primera persona y de forma natural.',
    estilo,
    'NO conoces tu diagnóstico ni usas nombres de enfermedades técnicos salvo que el médico te los haya dicho. Cuentas lo que sientes, tu historia y tus preocupaciones. Puedes dudar, tener miedo o pedir explicaciones.',
    'Responde SOLO a lo que te acaban de decir, con 1 a 3 frases cortas. Nunca repitas la pregunta del médico. No hagas de médico, no inventes pruebas ni tratamientos que no te hayan mandado, no cambies los datos de tu historia y no te contradigas con lo que ya has dicho.',
    'Cuenta tu historia con tus propias palabras: los datos de abajo son lo que te pasa, no frases para copiar. Varía la forma de decir las cosas y no repitas frases que ya hayas dicho.',
    'No escribas acotaciones, comillas, emojis ni el nombre del personaje: solo lo que dices en voz alta.',
    'Tu historia (no la recites entera; usa solo lo que venga a cuento):',
    ...hechos(pac).map(h => `- ${h}`),
    tratamiento ? `Lo que el médico te ha dicho o recetado: ${tratamiento}` : '',
    referencia ? `Datos que debe contener tu respuesta a esta pregunta (respétalos, pero dilos a tu manera, sin copiar la frase): ${referencia}` : '',
    'Le hablas al médico (o a la médica) de la consulta; no hace falta que digas su nombre.',
  ].filter(Boolean).join('\n');
  const mensajes = [{ role: 'system', content: sistema }];
  for (const h of historial.slice(-14)) mensajes.push({ role: h.quien === 'medico' ? 'user' : 'assistant', content: h.quien === 'medico' ? h.texto : `${h.quien === 'acomp' && !esAcomp ? '(Habló tu acompañante) ' : ''}${h.texto}` });
  mensajes.push({ role: 'user', content: pregunta });
  return mensajes;
}

// Limpia lo que devuelve el modelo: sin acotaciones, sin comillas y con longitud razonable
export function limpiarRespuesta(t) {
  let s = String(t || '').replace(/<think>[\s\S]*?<\/think>/g, '').replace(/^\s*[\w áéíóúñÁÉÍÓÚÑ]{1,30}:\s+/, '').replace(/\*[^*]*\*/g, '').replace(/^["«“]+|["»”]+$/g, '').replace(/\s+\/\s+/g, ' ').replace(/\s+/g, ' ').trim();
  const frases = s.match(/[^.!?…]+[.!?…]+["»]?|[^.!?…]+$/g) || [s];
  s = frases.slice(0, 3).join(' ').trim();
  if (s.length > 320) s = s.slice(0, 317).replace(/\s\S*$/, '') + '...';
  return s;
}

// ───────────────────────── Llamada al modelo ─────────────────────────
async function llamar(cfg, mensajes) {
  const ctl = new AbortController();
  const tmr = setTimeout(() => ctl.abort(), (cfg.espera || 30) * 1000);
  try {
    const base = cfg.url.replace(/\/+$/, '');
    if (cfg.modo === 'ollama') {
      const r = await fetch(`${base}/api/chat`, { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: cfg.modelo, messages: mensajes, stream: false, keep_alive: '30m', options: { temperature: 0.8, num_predict: 120 } }) });
      if (!r.ok) throw new Error(`Ollama respondió ${r.status}`);
      const j = await r.json();
      return j.message?.content || '';
    }
    const r = await fetch(`${base}/v1/chat/completions`, { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: cfg.modelo, messages: mensajes, temperature: 0.8, max_tokens: 120 }) });
    if (!r.ok) throw new Error(`El servidor respondió ${r.status}`);
    const j = await r.json();
    return j.choices?.[0]?.message?.content || '';
  } finally { clearTimeout(tmr); }
}

// ¿La respuesta sólo repite lo que ha dicho el médico? (fallo típico de los modelos pequeños)
export function esEco(respuesta, pregunta) {
  const pal = (s) => normaliza(s).replace(/[^a-zñ0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2);
  const r = pal(respuesta), q = new Set(pal(pregunta));
  if (!r.length || !q.size) return false;
  return r.filter(w => q.has(w)).length / r.length > 0.6;
}
// Devuelve { texto, origen: 'ia' | 'predefinida', modelo, error }
export async function generarRespuesta(cfg, datos) {
  const ref = datos.referencia;
  if (!cfg || cfg.modo === 'predefinida') return { texto: ref, origen: 'predefinida' };
  try {
    const mensajes = construirPrompt(datos);
    let texto = limpiarRespuesta(await llamar(cfg, mensajes));
    // si repite la pregunta o no dice nada, se le pide otra vez que conteste como paciente
    if (!texto || esEco(texto, datos.pregunta)) {
      mensajes.push({ role: 'assistant', content: texto || '...' }, { role: 'user', content: '(Eso es repetir lo que ha dicho el médico. Contesta tú, como paciente, a su pregunta.)' });
      texto = limpiarRespuesta(await llamar(cfg, mensajes));
    }
    if (!texto || esEco(texto, datos.pregunta)) throw new Error('la IA no ha dado una respuesta válida');
    return { texto, origen: 'ia', modelo: cfg.modelo };
  } catch (e) {
    return { texto: ref, origen: 'predefinida', error: e.name === 'AbortError' ? 'la IA tardó demasiado' : e.message };
  }
}

// ¿Hay un Ollama funcionando? Devuelve la lista de modelos instalados (vacía si no hay)
export async function detectarOllama(url = IA_POR_DEFECTO.url) {
  const ctl = new AbortController(); const tmr = setTimeout(() => ctl.abort(), 1500);
  try {
    const r = await fetch(`${url.replace(/\/+$/, '')}/api/tags`, { signal: ctl.signal });
    if (!r.ok) return [];
    const j = await r.json();
    return (j.models || []).map(m => m.name);
  } catch (e) { return []; } finally { clearTimeout(tmr); }
}
// Carga el modelo en memoria antes de la primera pregunta (si no, la primera respuesta tarda medio minuto)
export function precalentar(cfg) {
  if (cfg?.modo !== 'ollama') return Promise.resolve();
  return fetch(`${cfg.url.replace(/\/+$/, '')}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: cfg.modelo, messages: [], keep_alive: '30m' }) }).catch(() => {});
}
// modelo preferido entre los instalados: los que mejor hablan español con poca memoria
export function elegirModelo(lista, actual) {
  if (lista.includes(actual)) return actual;
  const pref = [/qwen2\.5:3b/i, /qwen2\.5/i, /gemma3?:4b/i, /gemma/i, /llama3\.2:3b/i, /llama3/i, /mistral/i];
  for (const re of pref) { const m = lista.find(x => re.test(x)); if (m) return m; }
  return lista[0];
}

export async function probarIA(cfg) {
  try {
    const t = await llamar({ ...cfg, espera: Math.max(cfg.espera || 30, 60) }, [{ role: 'system', content: 'Responde en español de España con una frase corta.' }, { role: 'user', content: 'Di «Hola, doctor».' }]);
    return { ok: !!t, texto: limpiarRespuesta(t) };
  } catch (e) { return { ok: false, error: e.name === 'AbortError' ? 'no contesta (tiempo agotado)' : e.message }; }
}

// ───────────────────────── Respuestas predefinidas para preguntas libres ─────────────────────────
// Se usan cuando la pregunta no corresponde a ninguna mecánica del juego y no hay IA.
const az = (l) => l[Math.floor(Math.random() * l.length)];
export function respuestaGeneral(pac, intencion, quien) {
  const o = pac.sexo === 'm' ? 'a' : 'o';
  if (quien === 'acomp') {
    if (intencion === 'nombre') return `Se llama ${pac.nombre}.`;
    if (intencion === 'edad') return `Tiene ${textoEdad(pac.edad)}.`;
    if (intencion === 'gracias') return 'Gracias a usted, doctor.';
    if (intencion === 'despedida') return 'Muchas gracias, doctor. Hasta luego.';
    return az(['Pues no sabría decirle, doctor.', 'Eso no lo sé... ¿es importante?', 'Hmm, no me había fijado. Pregúnteme lo que necesite.']);
  }
  if (pac.edad < 1.5) return az(['(balbucea) Agú...', '(le mira con los ojos muy abiertos)', '(hace pucheros)']);
  if (intencion === 'nombre') return pac.edad < 13 ? `Me llamo ${pac.nombre}.` : `${pac.nombre} ${pac.apellidos}, doctor.`;
  if (intencion === 'edad') return pac.edad < 13 ? `Tengo ${Math.floor(pac.edad)} años.` : `${textoEdad(pac.edad)}, doctor.`;
  if (intencion === 'gracias') return pac.edad < 13 ? 'De nada...' : az(['A usted, doctor.', 'Gracias a usted.']);
  if (intencion === 'despedida') return pac.edad < 13 ? '¡Adiós!' : az(['Hasta luego, doctor. Muchas gracias.', 'Adiós, doctor.']);
  if (intencion === 'saludo') return pac.edad < 13 ? 'Hola...' : pac.edad > 75 ? 'Buenos días. Ay, qué joven es usted, doctor.' : 'Buenos días, doctor.';
  if (pac.edad < 7) return az(['No sé...', '(se encoge de hombros)', '¿Eh?', 'Mi mamá lo sabe.']);
  if (pac.edad < 13) return az(['No sé...', 'Eso no lo sé.', '¿Me lo repites?']);
  if (pac.edad > 75) return az(['¿Cómo dice, hijo? Es que oigo regular.', 'Ay, pues eso no sabría decirle.', 'Uy, eso ya ni me acuerdo.']);
  return az(['Pues... no sabría decirle, doctor.', 'No sé, la verdad. ¿Por qué lo pregunta?', 'Hmm... no me había fijado.']);
}

// Lectura en voz alta: abreviaturas y números de una receta se leen de forma natural sin cambiar su significado
export function leerNatural(t) {
  // F: fin de abreviatura (lo que sigue no es una letra, tampoco acentuada)
  const F = '(?![a-záéíóúüñ])';
  const re = (s, f = 'gi') => new RegExp(s.replace(/F/g, F), f);
  return String(t)
    .replace(re('(\\d)\\s*mgF'), '$1 miligramos').replace(re('(\\d)\\s*(?:mcg|µg)F'), '$1 microgramos').replace(re('(\\d)\\s*mlF'), '$1 mililitros').replace(re('(\\d)\\s*gF'), '$1 gramos').replace(re('(\\d)\\s*kgF'), '$1 kilos').replace(re('(\\d)\\s*UIF', 'g'), '$1 unidades')
    .replace(re('\\bc\\/\\s*(\\d+)\\s*hF'), 'cada $1 horas').replace(re('(\\d+)\\s*hF'), '$1 horas').replace(re('(\\d+)\\s*minF'), '$1 minutos')
    .replace(/\bcomp\.?(?=\s|,|$)/gi, 'comprimido').replace(/\bcaps\.?(?=\s|,|$)/gi, 'cápsula').replace(/\bsobr\.?(?=\s|,|$)/gi, 'sobre')
    .replace(/\bv\.\s?o\.(?=\s|,|$)/gi, 'por vía oral').replace(re('\\bx\\s*(\\d+)\\s*d[ií]asF'), 'durante $1 días').replace(re('(\\d+)\\s*dF'), '$1 días')
    .replace(/\bp\.?\s?ej\.?/gi, 'por ejemplo').replace(/\bDr\./g, 'doctor').replace(/\bDra\./g, 'doctora')
    .replace(/(\d)\/(\d+)\b/g, (m, a, b) => ({ '1/2': 'medio', '1/4': 'un cuarto', '3/4': 'tres cuartos' }[`${a}/${b}`] || `${a} de ${b}`));
}
