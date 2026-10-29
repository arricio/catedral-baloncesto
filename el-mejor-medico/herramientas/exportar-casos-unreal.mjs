// Exporta pacientes del juego (datos.js e ia.js, sin duplicar la medicina) para la prueba piloto en Unreal Engine.
// Uso: node herramientas\exportar-casos-unreal.mjs <ruta de salida casos.json> [pacientes por enfermedad y sexo]
// Cada paciente lleva las instrucciones para la IA (las mismas que construirPrompt, sin historial; también las del
// acompañante si viene con alguien), las respuestas predefinidas por intención, sus constantes, analítica y resultados
// de pruebas, y lo que su enfermedad necesita y debe evitar (para la evolución tras el tratamiento).
// Se exportan todas las enfermedades y edades: el juego en Unreal sólo elige los casos para los que tiene personaje.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { ENFERMEDADES, ENF, SANGRE, ORINA, generarPaciente, dialogo, fraseHabitos, fraseAntecedentes, fraseAlergia, fmt, textoEdad, RECETARIO, PISTAS } from '../js/datos.js';
import { construirPrompt, respuestaGeneral } from '../js/ia.js';

const salida = process.argv[2];
const porGrupo = +(process.argv[3] || 2);
if (!salida) { console.error('Falta la ruta de salida'); process.exit(1); }

const CRONICAS = ['hipertension', 'diabetes', 'insuficiencia_cardiaca', 'cancer_pulmon', 'anemia'];
const varias = (f, n = 4) => [...new Set(Array.from({ length: n * 3 }, f))].slice(0, n);
const pacientes = [];
for (const e of ENFERMEDADES) {
  for (const sexo of ['h', 'm']) {
    if (e.sexo !== 'a' && e.sexo !== sexo) continue;
    for (let i = 0; i < porGrupo; i++) {
      // edades repartidas por el rango de la enfermedad (una más joven y otra mayor)
      const [de, a] = e.edad;
      const edad = de + (a - de) * ((i + 0.15 + Math.random() * 0.7) / porGrupo);
      let p = null;
      for (let k = 0; k < 60 && (!p || p.sexo !== sexo); k++) p = generarPaciente({ dia: 3, forzar: e.id, edadForzada: edad });
      if (!p || p.sexo !== sexo) continue;
      p.confianza = 1;
      const d = dialogo(p);
      const base = { pac: p, nombreDoctor: '', historial: [], pregunta: '', referencia: '', tratamiento: '' };
      const sistema = construirPrompt({ ...base, quien: 'paciente' })[0].content;
      const sistemaAcomp = p.acompanante ? construirPrompt({ ...base, quien: 'acomp' })[0].content : '';
      const lista = (arr) => (arr || []).map(t => fmt(t, p));
      const personalidad = (sistema.match(/Personalidad: ([^.]+)\./) || [])[1] || '';
      const pr = ENF[p.enfId].pruebas;
      pacientes.push({
        id: `${p.enfId}_${sexo}_${i + 1}`, enfermedad: ENF[p.enfId].n, nombre: p.nombre, apellidos: p.apellidos, sexo, edad: p.edad, textoEdad: textoEdad(p.edad),
        voz: p.voz, sistema, sistemaAcomp, enfId: p.enfId, personalidad,
        // quién viene y quién habla: los bebés no hablan; los niños pequeños y los mayores confusos los explica el acompañante
        acompanante: p.acompanante || '', hablaAcomp: !!(ENF[p.enfId].respondeAcomp || p.edad < 7), bebe: p.edad < 2,
        grav: ENF[p.enfId].grav, cronica: CRONICAS.includes(p.enfId),
        trat: { med: ENF[p.enfId].trat.med, buena: ENF[p.enfId].trat.buena, evitar: ENF[p.enfId].trat.evitar },
        alergia: p.alergia || '', antecedentes: p.antecedentes || [], fumador: !!p.fumador, bebedor: !!p.bebedor,
        // constantes, analítica y resultados de pruebas (los mismos que verá el juego web)
        constantes: p.vit, sangre: p.sangre, orina: p.orina,
        pruebas: Object.fromEntries(['rx', 'ecg', 'eco', 'tac'].filter(k => pr[k] && pr[k].texto).map(k => [k, pr[k].texto])),
        apariencia: { complexion: p.apariencia?.complexion ?? 1, altura: p.apariencia?.altura ?? 1, gafas: !!p.apariencia?.gafas },
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
}
// recetario y pistas del texto libre (las mismas del juego web) para reconocer lo que el médico receta
const recetario = RECETARIO.map(r => ({ n: r.n, cat: r.cat, tags: r.tags }));
const pistas = PISTAS.map(([re, cat, tags]) => ({ re: re.source, cat, tags }));
const referencias = { sangre: SANGRE.map(s => ({ k: s.k, n: s.n, u: s.u, r: s.r, d: s.d })), orina: ORINA };
mkdirSync(dirname(salida), { recursive: true });
writeFileSync(salida, JSON.stringify({ version: 3, generado: new Date().toISOString(), pacientes, recetario, pistas, referencias }, null, 1));
const edades = (f) => pacientes.filter(f).length;
console.log(`${pacientes.length} pacientes exportados a ${salida}: bebés ${edades(p => p.edad < 2)}, niños ${edades(p => p.edad >= 2 && p.edad < 13)}, adolescentes ${edades(p => p.edad >= 13 && p.edad < 18)}, adultos ${edades(p => p.edad >= 18 && p.edad < 65)}, mayores ${edades(p => p.edad >= 65)}; con acompañante ${edades(p => p.acompanante)}`);
