// Exporta pacientes del juego (datos.js e ia.js, sin duplicar la medicina) para la prueba piloto en Unreal Engine.
// Uso: node herramientas\exportar-casos-unreal.mjs <ruta de salida casos.json> [número de pacientes por sexo]
// Cada paciente lleva las instrucciones para la IA (las mismas que construirPrompt, sin historial) y las respuestas
// predefinidas por intención, que son la referencia de la IA y la alternativa sin IA.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { ENFERMEDADES, ENF, generarPaciente, dialogo, fraseHabitos, fraseAntecedentes, fraseAlergia, fmt, textoEdad } from '../js/datos.js';
import { construirPrompt, respuestaGeneral } from '../js/ia.js';

const salida = process.argv[2];
const porSexo = +(process.argv[3] || 6);
if (!salida) { console.error('Falta la ruta de salida'); process.exit(1); }

// la consulta piloto: un paciente adulto, sentado y sin acompañante, que habla por sí mismo
const aptas = ENFERMEDADES.filter(e => !e.infantil && !e.respondeAcomp && e.edad[1] >= 30 && e.grav <= 3);
const varias = (f, n = 4) => [...new Set(Array.from({ length: n * 3 }, f))].slice(0, n);
const pacientes = [];
for (const sexo of ['h', 'm']) {
  let i = 0;
  for (let intento = 0; pacientes.filter(p => p.sexo === sexo).length < porSexo && intento < 500; intento++) {
    const e = aptas[(i++) % aptas.length];
    if (e.sexo !== 'a' && e.sexo !== sexo) continue;
    const de = Math.max(30, e.edad[0]), a = Math.min(68, e.edad[1]);
    if (de > a) continue;
    const edad = de + Math.random() * (a - de);
    let p = null;
    for (let k = 0; k < 40 && (!p || p.sexo !== sexo); k++) p = generarPaciente({ dia: 2, forzar: e.id, edadForzada: edad });
    if (p.sexo !== sexo || pacientes.some(x => x.enfId === p.enfId && x.sexo === sexo)) continue;
    p.acompanante = null; p.confianza = 1;
    const d = dialogo(p);
    const sistema = construirPrompt({ pac: p, quien: 'paciente', nombreDoctor: '', historial: [], pregunta: '', referencia: '', tratamiento: '' })[0].content;
    const lista = (arr) => (arr || []).map(t => fmt(t, p));
    pacientes.push({
      id: `${p.enfId}_${sexo}`, enfermedad: ENF[p.enfId].n, nombre: p.nombre, apellidos: p.apellidos, sexo, edad: p.edad, textoEdad: textoEdad(p.edad),
      voz: p.voz, sistema,
      respuestas: {
        motivo: lista(d.motivo), inicio: lista(d.inicio), dolor: lista(d.dolor), fiebre: lista(d.fiebre), extra: lista(d.extra),
        habitos: varias(() => fmt(fraseHabitos(p), p)), antecedentes: varias(() => fraseAntecedentes(p)), alergia: varias(() => fmt(fraseAlergia(p), p)),
        calmar: [fmt('Gracias, doctor. Es que estoy muy preocupad{o}.', p), fmt('Vale... me quedo más tranquil{o}.', p), 'Se agradece, doctor.'],
        nombre: [respuestaGeneral(p, 'nombre', 'paciente')], edad: [respuestaGeneral(p, 'edad', 'paciente')],
        gracias: varias(() => respuestaGeneral(p, 'gracias', 'paciente'), 2), despedida: varias(() => respuestaGeneral(p, 'despedida', 'paciente'), 2),
        general: varias(() => respuestaGeneral(p, 'general', 'paciente')),
        saludo: [p.edad > 75 ? 'Buenos días. Ay, qué joven es usted.' : 'Buenos días, doctor.'],
      },
    });
  }
}
mkdirSync(dirname(salida), { recursive: true });
writeFileSync(salida, JSON.stringify({ version: 1, generado: new Date().toISOString(), pacientes }, null, 1));
console.log(`${pacientes.length} pacientes exportados a ${salida}: ${pacientes.map(p => `${p.nombre} (${p.edad}, ${p.enfermedad})`).join(' · ')}`);
