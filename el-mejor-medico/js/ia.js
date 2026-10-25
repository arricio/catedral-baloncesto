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
  const e = ENF[pac.enfId], d = pac.edad < 10 && e.dNino ? { ...e.d, ...e.dNino } : e.d;
  const l = [];
  l.push(`Síntomas que nota (con sus palabras): ${[...(d.motivo || []), ...(d.dolor || [])].slice(0, 4).join(' / ')}`);
  if (d.inicio) l.push(`Desde cuándo: ${d.inicio[0]}`);
  if (d.fiebre) l.push(`Fiebre: ${d.fiebre[0]}`);
  if (d.extra) l.push(`Otras cosas que ha notado: ${d.extra.join(' / ')}`);
  l.push(`Enfermedades previas: ${pac.antecedentes.length ? pac.antecedentes.join(', ') : 'ninguna'}`);
  l.push(`Alergias: ${pac.alergia ? { aine: 'antiinflamatorios (ibuprofeno)', penicilina: 'penicilina', marisco: 'marisco' }[pac.alergia] : 'ninguna conocida'}`);
  if (pac.edad >= 15) l.push(`Hábitos: ${pac.fumador ? 'fuma' : 'no fuma'}; ${pac.bebedor ? 'bebe alcohol con frecuencia' : 'bebe poco'}`);
  if (e.d.habitosMentira && !pac.secretoRevelado) l.push(`Sobre sus hábitos MIENTE, dice cosas como: ${e.d.habitosMentira[0]}`);
  if (e.secreto) {
    if (pac.secretoRevelado) l.push(`Ya ha confesado esto al médico: ${e.secreto.t}`);
    else l.push(`Tiene un secreto que NO cuenta salvo que el médico se gane su confianza y le pregunte directamente: ${e.secreto.t}`);
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
  const persona = esAcomp
    ? `Eres ${(pac.acompanante || 'un familiar').replace(/^su /, 'el/la ')} de ${pac.nombre}, ${pac.sexo === 'm' ? 'una paciente' : 'un paciente'} de ${edad}. Contestas tú porque ${pac.edad < 10 ? 'es pequeño' : 'el paciente no puede explicarse bien'}. Hablas de ${pac.nombre} en tercera persona.`
    : `Eres ${pac.nombre} ${pac.apellidos}, ${pac.sexo === 'm' ? 'mujer' : 'hombre'} de ${edad}. Personalidad: ${personalidad(pac)}.`;
  const estilo = esAcomp ? 'Habla como un familiar preocupado.'
    : pac.edad < 7 ? 'Eres un niño o niña pequeño: frases muy cortas y sencillas, vocabulario infantil, sin palabras técnicas. Ejemplo: «Aquí, en la barriga. Me duele mucho».'
    : pac.edad < 13 ? 'Eres un niño o niña: frases cortas, lenguaje de colegio, nada técnico.'
    : pac.edad < 18 ? 'Eres adolescente: frases cortas, algo de vergüenza, lenguaje juvenil sin exagerar.'
    : pac.edad >= 76 ? 'Eres una persona muy mayor: ritmo pausado, expresiones de toda la vida (hijo, hija, ay, Dios mío), a veces te vas un poco por las ramas.'
    : pac.edad >= 61 ? 'Eres una persona mayor: lenguaje sencillo y cercano.'
    : 'Habla con naturalidad, como un paciente normal.';
  const sistema = [
    persona,
    'Estás en la consulta del médico del Hospital San Marcos, en León (España). Hablas SIEMPRE en español de España (nada de expresiones latinoamericanas), en primera persona y de forma natural.',
    estilo,
    'NO conoces tu diagnóstico ni usas nombres de enfermedades técnicos salvo que el médico te los haya dicho. Cuentas lo que sientes, tu historia y tus preocupaciones. Puedes dudar, tener miedo o pedir explicaciones.',
    'Responde SOLO a lo que te acaban de decir, con 1 a 3 frases cortas. No hagas de médico, no inventes pruebas ni tratamientos que no te hayan mandado, no cambies los datos de tu historia y no te contradigas con lo que ya has dicho.',
    'No escribas acotaciones, comillas, emojis ni el nombre del personaje: solo lo que dices en voz alta.',
    'Tu historia (no la recites entera; usa solo lo que venga a cuento):',
    ...hechos(pac).map(h => `- ${h}`),
    tratamiento ? `Lo que el médico te ha dicho o recetado: ${tratamiento}` : '',
    referencia ? `Respuesta orientativa coherente con el juego (puedes decirla con otras palabras y adaptarla a la pregunta): «${referencia}»` : '',
    `El médico se llama ${nombreDoctor}.`,
  ].filter(Boolean).join('\n');
  const mensajes = [{ role: 'system', content: sistema }];
  for (const h of historial.slice(-14)) mensajes.push({ role: h.quien === 'medico' ? 'user' : 'assistant', content: h.quien === 'medico' ? h.texto : `${h.quien === 'acomp' && !esAcomp ? '(Habló tu acompañante) ' : ''}${h.texto}` });
  mensajes.push({ role: 'user', content: pregunta });
  return mensajes;
}

// Limpia lo que devuelve el modelo: sin acotaciones, sin comillas y con longitud razonable
export function limpiarRespuesta(t) {
  let s = String(t || '').replace(/<think>[\s\S]*?<\/think>/g, '').replace(/^\s*[\w áéíóúñÁÉÍÓÚÑ]{1,30}:\s+/, '').replace(/\*[^*]*\*/g, '').replace(/^["«“]+|["»”]+$/g, '').replace(/\s+/g, ' ').trim();
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
      const r = await fetch(`${base}/api/chat`, { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: cfg.modelo, messages: mensajes, stream: false, options: { temperature: 0.8, num_predict: 120 } }) });
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

// Devuelve { texto, origen: 'ia' | 'predefinida', modelo, error }
export async function generarRespuesta(cfg, datos) {
  const ref = datos.referencia;
  if (!cfg || cfg.modo === 'predefinida') return { texto: ref, origen: 'predefinida' };
  try {
    const texto = limpiarRespuesta(await llamar(cfg, construirPrompt(datos)));
    if (!texto) throw new Error('respuesta vacía');
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
// modelo preferido entre los instalados: los que mejor hablan español con poca memoria
export function elegirModelo(lista, actual) {
  if (lista.includes(actual)) return actual;
  const pref = [/qwen2\.5:3b/, /qwen2\.5/, /gemma3?:4b/, /gemma/, /llama3\.2:3b/, /llama3/, /mistral/];
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
