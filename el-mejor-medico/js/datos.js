// EL MEJOR MÉDICO — datos: enfermedades, recetario, nombres y generador de pacientes.

export const azar = (a) => a[Math.floor(Math.random() * a.length)];
export const entre = (a, b) => a + Math.random() * (b - a);
export const entreInt = (a, b) => Math.floor(entre(a, b + 1));
export const prob = (p) => Math.random() < p;
export const normaliza = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

// ───────────────────────── Personas ─────────────────────────
export const NOMBRES_H = ['Manuel', 'José', 'Antonio', 'Francisco', 'Juan', 'Pedro', 'Luis', 'Ángel', 'Miguel', 'Javier', 'Carlos', 'Ramón', 'Froilán', 'Isidoro', 'Fermín', 'Andrés', 'Pablo', 'Sergio', 'Alberto', 'Eloy', 'Benito', 'Celestino', 'Valentín', 'Rubén', 'Daniel', 'Tomás', 'Agustín', 'Marcelino', 'Gonzalo', 'Iván'];
export const NOMBRES_M = ['María', 'Carmen', 'Josefa', 'Isabel', 'Ana', 'Pilar', 'Lucía', 'Laura', 'Marta', 'Elena', 'Rosario', 'Encarnación', 'Begoña', 'Nieves', 'Asunción', 'Rocío', 'Sara', 'Paula', 'Cristina', 'Raquel', 'Herminia', 'Visitación', 'Ascensión', 'Teresa', 'Inés', 'Beatriz', 'Patricia', 'Noelia', 'Sonia', 'Amparo'];
export const APELLIDOS = ['García', 'Fernández', 'González', 'Álvarez', 'Rodríguez', 'Martínez', 'López', 'Díez', 'Pérez', 'Sánchez', 'Gutiérrez', 'Robles', 'Alonso', 'Llamazares', 'Fuertes', 'Cubillas', 'Prieto', 'Valcarce', 'Barrios', 'Rabanal', 'Villanueva', 'Castro', 'Morán', 'Lorenzana', 'Carbajo', 'Del Río', 'Tascón', 'Arias', 'Marcos', 'Ordás'];
export const PUEBLOS = ['León', 'Ponferrada', 'Astorga', 'La Bañeza', 'Sahagún', 'Valencia de Don Juan', 'Villablino', 'Cistierna', 'Bembibre', 'Riaño', 'Boñar', 'La Robla', 'Villaquilambre', 'San Andrés del Rabanedo', 'Valverde de la Virgen', 'Villafranca del Bierzo', 'Cacabelos', 'Mansilla de las Mulas', 'Hospital de Órbigo', 'Santa María del Páramo', 'Toreno', 'Fabero', 'Valderas', 'Grajal de Campos'];
export const CALLES = ['C/ Ancha', 'C/ Ordoño II', 'Av. Padre Isla', 'C/ La Rúa', 'Pl. Mayor', 'C/ del Cid', 'Av. de la Constitución', 'C/ San Marcelo', 'C/ Real', 'C/ Mayor', 'Av. José Aguado', 'C/ El Paseo', 'Travesía de la Iglesia', 'C/ de los Herreros'];

export const ANTECEDENTES = ['Dolor de espalda', 'Coágulos', 'Dolores de cabeza', 'Depresión', 'VIH', 'Cálculos renales', 'Enfermedad pulmonar', 'Neuropatía', 'Párkinson', 'Hipertensión', 'Diabetes', 'Asma', 'Cardiopatía', 'Úlcera'];

// ───────────────────────── Analíticas ─────────────────────────
export const SANGRE = [
  { k: 'hb', n: 'Hemoglobina', u: 'g/dL', r: [13, 17], d: 1 },
  { k: 'leu', n: 'Leucocitos', u: '/µL', r: [4000, 11000], d: 0 },
  { k: 'pla', n: 'Plaquetas', u: 'mil/µL', r: [150, 400], d: 0 },
  { k: 'glu', n: 'Glucosa', u: 'mg/dL', r: [70, 110], d: 0 },
  { k: 'urea', n: 'Urea', u: 'mg/dL', r: [15, 45], d: 0 },
  { k: 'cre', n: 'Creatinina', u: 'mg/dL', r: [0.6, 1.2], d: 2 },
  { k: 'na', n: 'Sodio', u: 'mEq/L', r: [135, 145], d: 0 },
  { k: 'k', n: 'Potasio', u: 'mEq/L', r: [3.5, 5.0], d: 1 },
  { k: 'pcr', n: 'Proteína C reactiva', u: 'mg/L', r: [0, 5], d: 1 },
  { k: 'trop', n: 'Troponina', u: 'ng/mL', r: [0, 0.04], d: 2 },
  { k: 'got', n: 'GOT', u: 'U/L', r: [5, 40], d: 0 },
  { k: 'ggt', n: 'GGT', u: 'U/L', r: [8, 55], d: 0 },
  { k: 'bil', n: 'Bilirrubina', u: 'mg/dL', r: [0.3, 1.2], d: 1 },
  { k: 'ami', n: 'Amilasa', u: 'U/L', r: [25, 100], d: 0 },
  { k: 'fer', n: 'Ferritina', u: 'ng/mL', r: [30, 300], d: 0 },
  { k: 'oh', n: 'Alcohol en sangre', u: 'g/L', r: [0, 0], d: 2 },
];
export const ORINA = [
  { k: 'leu', n: 'Leucocitos' }, { k: 'nit', n: 'Nitritos' }, { k: 'san', n: 'Sangre' }, { k: 'glu', n: 'Glucosa' }, { k: 'pro', n: 'Proteínas' }, { k: 'cet', n: 'Cuerpos cetónicos' },
];

export const PRUEBAS = {
  sangre: { n: 'Análisis de sangre', precio: 30, min: 20 },
  orina: { n: 'Análisis de orina', precio: 10, min: 10 },
  rx: { n: 'Radiografía', precio: 60, min: 15 },
  ecg: { n: 'Electrocardiograma', precio: 25, min: 5 },
  eco: { n: 'Ecografía', precio: 80, min: 20, requiere: 'ecografo' },
  tac: { n: 'TAC (tomografía)', precio: 250, min: 30, requiere: 'tac' },
};
export const ZONAS_RX = { torax: 'Tórax', abdomen: 'Abdomen', muneca: 'Muñeca y mano', tobillo: 'Tobillo y pie', craneo: 'Cráneo', lumbar: 'Columna lumbar' };

// ───────────────────────── Cirugías ─────────────────────────
// pasos posibles: desinfectar, incision, separar, pinzar, aspirar, extirpar, malla, reducir, suturar
export const CIRUGIAS = {
  apendicectomia: { n: 'Apendicectomía', anestesia: ['general'], zona: 'fid', organo: 'apendice', pasos: ['desinfectar', 'incision', 'separar', 'pinzar', 'extirpar', 'aspirar', 'suturar'], pago: 900, objetivo: 'Extirpar el apéndice inflamado' },
  colecistectomia: { n: 'Colecistectomía', anestesia: ['general'], zona: 'hcd', organo: 'vesicula', pasos: ['desinfectar', 'incision', 'separar', 'pinzar', 'extirpar', 'aspirar', 'suturar'], pago: 1200, objetivo: 'Extirpar la vesícula con piedras' },
  reseccion: { n: 'Resección pulmonar en cuña', anestesia: ['general'], zona: 'torax_izq', organo: 'tumor', pasos: ['desinfectar', 'incision', 'separar', 'pinzar', 'extirpar', 'aspirar', 'suturar'], pago: 2400, objetivo: 'Completar la sección en cuña del tumor' },
  hernioplastia: { n: 'Hernioplastia inguinal', anestesia: ['raquidea', 'general'], zona: 'ingle', organo: 'hernia', pasos: ['desinfectar', 'incision', 'separar', 'reducir', 'malla', 'suturar'], pago: 800, objetivo: 'Reducir la hernia y colocar la malla' },
  sutura: { n: 'Sutura de herida', anestesia: ['local'], zona: 'antebrazo', organo: 'herida', pasos: ['desinfectar', 'aspirar', 'suturar'], pago: 250, objetivo: 'Cerrar la herida con puntos' },
  osteosintesis: { n: 'Reducción y osteosíntesis de muñeca', anestesia: ['regional', 'general'], zona: 'muneca', organo: 'hueso', pasos: ['desinfectar', 'incision', 'separar', 'reducir', 'malla', 'suturar'], pago: 1100, objetivo: 'Alinear el hueso y fijarlo con una placa' },
};
export const ANESTESIAS = { general: 'Anestesia general', raquidea: 'Raquídea (de cintura para abajo)', regional: 'Bloqueo regional del brazo', local: 'Anestesia local', sedacion: 'Sedación ligera' };

// ───────────────────────── Enfermedades ─────────────────────────
// {o} se cambia por o/a según el sexo del paciente.
export const ENFERMEDADES = [
  {
    id: 'gastroenteritis', n: 'Gastroenteritis aguda', grav: 1, edad: [8, 85], sexo: 'a', peso: 10,
    motivo: ['Tengo diarrea desde ayer y he vomitado varias veces. No retengo nada.', 'Llevo dos días con diarrea, vómitos y retortijones. Estoy hech{o} polvo.'],
    sintomas: ['Diarrea', 'Vómitos', 'Fiebre leve', 'Retortijones'],
    d: {
      motivo: ['Doctor, llevo desde ayer que no salgo del baño. Diarrea, vómitos, retortijones... no retengo ni el agua.', 'Pues mire, tengo una diarrea horrible y he vomitado tres veces esta mañana.'],
      inicio: ['Empezó ayer por la tarde, después de comer fuera.', 'Desde anteayer. En casa también lo ha tenido mi hijo.'],
      dolor: ['Me duele toda la tripa, como retortijones que van y vienen.', 'Es un dolor de barriga difuso, como cólicos.'],
      fiebre: ['Unas décimas, treinta y siete y medio más o menos.', 'Algo de fiebre sí, y escalofríos por la noche.'],
    },
    expl: { temp: [37.3, 38.2], tas: [100, 125], tad: [60, 80], fc: [88, 110], sat: [96, 99], pulmon: 'normal', corazon: 'taquicardia', palpacion: { zona: 'difuso', texto: 'Abdomen blando, molestia difusa, ruidos intestinales aumentados.' }, garganta: 'normal', zona: 'Mucosas algo secas. Signos de deshidratación leve.' },
    pruebas: { sangre: { leu: [11000, 14000], urea: [48, 70], na: [131, 136], k: [3.1, 3.5], pcr: [8, 30] }, orina: { cet: '++' }, rx: { zona: 'abdomen', hallazgo: 'normal', texto: 'Gas intestinal aumentado, sin obstrucción.' }, ecg: { tipo: 'taqui', texto: 'Taquicardia sinusal leve.' }, eco: { hallazgo: 'normal', texto: 'Asas intestinales con líquido. Sin otros hallazgos.' }, tac: { zona: 'abdomen', hallazgo: 'normal', texto: 'Engrosamiento leve de asas intestinales. Sin complicaciones.' } },
    trat: { accion: 'casa', prio: 'baja', med: [['suero', 'isotonica']], evitar: ['alcohol', 'grasa', 'frito', 'picante', 'lacteo', 'contundente', 'embutido', 'cafeina', 'refresco', 'laxante', 'fibra', 'marisco', 'antidiarreico_fuerte'], buena: ['blanda', 'astringente', 'caldo', 'agua', 'suero', 'isotonica', 'infusion'] },
    noticia: 'leve',
  },
  {
    id: 'intoxicacion', n: 'Intoxicación alimentaria', grav: 2, edad: [16, 80], sexo: 'a', peso: 6,
    motivo: ['Vómitos y diarrea desde la cena de anoche en una boda.', 'Después de comer en una boda estoy fatal del estómago.'],
    sintomas: ['Vómitos', 'Diarrea', 'Náuseas', 'Dolor abdominal'],
    d: {
      motivo: ['Doctor, estoy fatal. Anoche fui a una boda y desde las cuatro de la mañana no paro de vomitar.', 'Vengo con vómitos y diarrea. Y no soy el único, media mesa de la boda está igual.'],
      inicio: ['Empezó unas horas después de la cena. Comimos ensaladilla y unas ostras...', 'Esta madrugada, tres o cuatro horas después de cenar.'],
      dolor: ['Me duele la boca del estómago y toda la barriga.', 'Tengo calambres en la tripa y muchas náuseas.'],
      fiebre: ['No creo, pero tengo escalofríos.', 'Un poco de fiebre, treinta y siete ocho.'],
    },
    expl: { temp: [37.2, 38.3], tas: [95, 120], tad: [55, 75], fc: [92, 115], sat: [96, 99], pulmon: 'normal', corazon: 'taquicardia', palpacion: { zona: 'difuso', texto: 'Dolor difuso a la palpación, sin defensa ni signos de peritonitis.' }, garganta: 'normal', zona: 'Mucosas secas, ojeras marcadas.' },
    pruebas: { sangre: { leu: [11500, 15000], urea: [50, 80], na: [130, 135], pcr: [10, 40] }, orina: { cet: '++' }, rx: { zona: 'abdomen', hallazgo: 'normal', texto: 'Sin hallazgos significativos.' }, ecg: { tipo: 'taqui', texto: 'Taquicardia sinusal.' }, eco: { hallazgo: 'normal', texto: 'Sin hallazgos.' }, tac: { zona: 'abdomen', hallazgo: 'normal', texto: 'Sin hallazgos.' } },
    trat: { accion: 'casa', prio: 'baja', med: [['suero', 'isotonica']], evitar: ['alcohol', 'grasa', 'frito', 'marisco', 'crudo', 'lacteo', 'contundente', 'embutido', 'picante', 'refresco'], buena: ['blanda', 'astringente', 'caldo', 'agua', 'suero', 'isotonica'] },
    noticia: 'leve',
  },
  {
    id: 'gripe', n: 'Gripe', grav: 1, edad: [10, 90], sexo: 'a', peso: 10,
    motivo: ['Fiebre alta, escalofríos y me duele todo el cuerpo.', 'Tengo fiebre de treinta y nueve y estoy molid{o}.'],
    sintomas: ['Fiebre alta', 'Escalofríos', 'Dolor muscular', 'Tos seca'],
    d: {
      motivo: ['Ay, doctor, tengo un trancazo... Fiebre, escalofríos y me duelen hasta las pestañas.', 'Estoy con fiebre muy alta desde hace dos días y me duelen todos los huesos.'],
      inicio: ['Desde anteayer. Empezó de golpe, de repente.', 'Hace dos días. En el trabajo están todos igual.'],
      dolor: ['Me duele todo: la cabeza, la espalda, las piernas... como si me hubiera pasado un camión por encima.', 'Me duelen los músculos y la cabeza.'],
      fiebre: ['Sí, ayer llegué a treinta y nueve y medio. Y tiritaba de frío.', 'Mucha fiebre y escalofríos, sobre todo por la noche.'],
    },
    expl: { temp: [38.5, 39.6], tas: [110, 130], tad: [65, 85], fc: [95, 112], sat: [95, 98], pulmon: 'normal', corazon: 'taquicardia', palpacion: { zona: null, texto: 'Abdomen normal.' }, garganta: 'roja', zona: 'Malestar general. Faringe algo enrojecida, sin placas.' },
    pruebas: { sangre: { leu: [3500, 6000], pcr: [8, 25] }, orina: {}, rx: { zona: 'torax', hallazgo: 'normal', texto: 'Tórax sin condensaciones.' }, ecg: { tipo: 'taqui', texto: 'Taquicardia sinusal por la fiebre.' }, eco: { hallazgo: 'normal', texto: 'Sin hallazgos.' }, tac: { zona: 'torax', hallazgo: 'normal', texto: 'Sin hallazgos.' } },
    trat: { accion: 'casa', prio: 'baja', med: [['antitermico']], evitar: ['antibiotico', 'alcohol', 'alcohol_fuerte', 'frio', 'ejercicio', 'tabaco'], buena: ['caldo', 'liquido', 'agua', 'vitc', 'infusion', 'miel', 'reposo', 'sueno', 'antiviral'] },
    noticia: 'leve',
  },
  {
    id: 'faringitis', n: 'Faringoamigdalitis bacteriana', grav: 1, edad: [6, 60], sexo: 'a', peso: 7,
    motivo: ['Me duele mucho la garganta, casi no puedo tragar.', 'Dolor de garganta con fiebre.'],
    sintomas: ['Dolor de garganta', 'Fiebre', 'Placas en amígdalas'],
    d: {
      motivo: ['Me duele muchísimo la garganta. No puedo ni tragar la saliva.', 'Tengo la garganta como si me hubiera tragado cristales.'],
      inicio: ['Desde hace tres días, y cada vez peor.', 'Empezó el sábado.'],
      dolor: ['Me duele al tragar, y también el oído cuando trago.', 'La garganta, y tengo los ganglios del cuello hinchados.'],
      fiebre: ['Sí, treinta y ocho y pico todos los días.', 'Fiebre sí, de treinta y ocho y medio.'],
    },
    expl: { temp: [38.2, 39.2], tas: [110, 130], tad: [65, 80], fc: [88, 105], sat: [97, 99], pulmon: 'normal', corazon: 'normal', palpacion: { zona: null, texto: 'Abdomen normal. Ganglios del cuello aumentados y dolorosos.' }, garganta: 'placas', zona: 'Amígdalas grandes con placas blancas de pus. Ganglios cervicales dolorosos.' },
    pruebas: { sangre: { leu: [13000, 18000], pcr: [40, 110] }, orina: {}, rx: { zona: 'torax', hallazgo: 'normal', texto: 'Normal.' }, ecg: { tipo: 'normal', texto: 'Normal.' }, eco: { hallazgo: 'normal', texto: 'Adenopatías cervicales reactivas.' }, tac: { zona: 'craneo', hallazgo: 'normal', texto: 'Sin abscesos.' } },
    trat: { accion: 'casa', prio: 'baja', med: [['antibiotico'], ['analgesico', 'aine']], evitar: ['alcohol', 'alcohol_fuerte', 'picante', 'acido', 'tabaco'], buena: ['liquido', 'miel', 'gargaras', 'blanda', 'helado', 'caldo', 'infusion'] },
    noticia: 'leve',
  },
  {
    id: 'otitis', n: 'Otitis media aguda', grav: 1, edad: [6, 60], sexo: 'a', peso: 4,
    motivo: ['Me duele muchísimo el oído derecho.', 'Dolor de oído desde hace dos días.'],
    sintomas: ['Dolor de oído', 'Fiebre', 'Oye peor'],
    d: {
      motivo: ['Me duele el oído derecho que no puedo ni dormir. Es como un pinchazo.', 'Tengo un dolor de oído horrible y además oigo como si estuviera debajo del agua.'],
      inicio: ['Después de un catarro, hace dos días.', 'Desde el fin de semana, que estuve en la piscina.'],
      dolor: ['Dentro del oído derecho, pulsátil, como latidos.', 'En el oído, y se me va hacia la mandíbula.'],
      fiebre: ['Unas décimas por la noche.', 'Treinta y ocho ayer.'],
    },
    expl: { temp: [37.5, 38.5], tas: [110, 130], tad: [65, 80], fc: [80, 98], sat: [97, 99], pulmon: 'normal', corazon: 'normal', palpacion: { zona: null, texto: 'Abdomen normal.' }, garganta: 'roja', zona: 'Otoscopia: tímpano derecho enrojecido y abombado.' },
    pruebas: { sangre: { leu: [10500, 14000], pcr: [15, 50] }, orina: {}, rx: { zona: 'craneo', hallazgo: 'normal', texto: 'Normal.' }, ecg: { tipo: 'normal', texto: 'Normal.' }, eco: { hallazgo: 'normal', texto: 'Normal.' }, tac: { zona: 'craneo', hallazgo: 'normal', texto: 'Ocupación del oído medio derecho.' } },
    trat: { accion: 'casa', prio: 'baja', med: [['antibiotico'], ['analgesico', 'aine']], evitar: ['agua_oido', 'tabaco', 'alcohol_fuerte'], buena: ['calor', 'reposo', 'liquido'] },
    noticia: 'leve',
  },
  {
    id: 'neumonia', n: 'Neumonía', grav: 3, edad: [25, 92], sexo: 'a', peso: 6,
    motivo: ['Tos con flemas amarillas, fiebre y me ahogo un poco.', 'Fiebre alta y me duele el costado al respirar.'],
    sintomas: ['Fiebre alta', 'Tos con flemas', 'Dificultad para respirar', 'Dolor en el costado'],
    d: {
      motivo: ['Tengo una tos muy fuerte, con flemas verdosas, fiebre... y me cuesta respirar.', 'Doctor, me pincha el costado derecho cada vez que respiro, y tengo fiebre muy alta.'],
      inicio: ['Hace cuatro o cinco días. Empezó como un catarro y ha ido a peor.', 'Desde el lunes. Al principio pensé que era un resfriado.'],
      dolor: ['En el costado derecho, como una punzada al coger aire.', 'En el pecho, abajo a la derecha. Al toser es horrible.'],
      fiebre: ['Treinta y nueve y pico, con tiritonas.', 'Sí, mucha fiebre y sudo por las noches.'],
    },
    expl: { temp: [38.6, 39.8], tas: [100, 125], tad: [60, 80], fc: [100, 120], sat: [88, 93], pulmon: 'crepitantes_der', corazon: 'taquicardia', palpacion: { zona: null, texto: 'Abdomen normal.' }, garganta: 'normal', zona: 'Respira rápido (24 por minuto). Algo de tiraje.' },
    pruebas: { sangre: { leu: [15000, 22000], pcr: [120, 280] }, orina: {}, rx: { zona: 'torax', hallazgo: 'consolidacion', lado: 'der', texto: 'Condensación en la base del pulmón derecho.' }, ecg: { tipo: 'taqui', texto: 'Taquicardia sinusal.' }, eco: { hallazgo: 'normal', texto: 'Pequeño derrame pleural derecho.' }, tac: { zona: 'torax', hallazgo: 'consolidacion', lado: 'der', texto: 'Consolidación del lóbulo inferior derecho con broncograma aéreo.' } },
    trat: { accion: 'hospitalizar', prio: 'media', med: [['antibiotico'], ['antitermico', 'oxigeno']], evitar: ['alcohol', 'alcohol_fuerte', 'tabaco', 'antitusivo', 'benzodiacepina', 'frio'], buena: ['liquido', 'caldo', 'oxigeno', 'reposo', 'agua', 'mucolitico'] },
    noticia: 'moderada',
  },
  {
    id: 'cancer_pulmon', n: 'Cáncer de pulmón', grav: 5, edad: [45, 80], sexo: 'a', peso: 4,
    motivo: ['Toso mucho y me duele la espalda entre los omóplatos. A veces echo sangre al toser. No puedo trabajar porque estoy cansado todo el rato, mareado, y duermo mal por la tos. Empezó hace medio año.'],
    sintomas: ['Tos crónica', 'Sangre al toser', 'Cansancio', 'Pérdida de peso', 'Dolor de espalda'],
    d: {
      motivo: ['Pues mire, toso muchísimo desde hace meses y me duele la espalda entre los omóplatos. Estoy siempre cansad{o}.', 'Tengo una tos que no se me quita, me canso por nada y he perdido peso sin hacer dieta.'],
      inicio: ['Hará unos cinco o seis meses. Al principio pensé que era del invierno.', 'Medio año, más o menos.'],
      dolor: ['Entre los omóplatos, un dolor sordo que no se va. Y en el pecho, a la izquierda.', 'La espalda, por detrás, y a veces el pecho del lado izquierdo.'],
      fiebre: ['Fiebre no, pero sudo mucho por las noches.', 'Alguna décima por la tarde, nada más.'],
      habitosMentira: ['¿Fumar? Algún cigarrillo suelto... muy poco, de verdad.', 'Fumo poco, doctor. Socialmente.'],
      extra: ['¿Sangre? Bueno... alguna vez... una sola vez, nada.'],
    },
    secreto: { v: 2, t: 'Mire, doctor... le he mentido. Fumo dos paquetes al día desde los quince años. Y lo de la sangre al toser... me pasa casi todas las semanas. Me daba vergüenza decirlo delante de mi familia.', hallazgo: 'Gran fumador (2 paquetes/día). Hemoptisis frecuente.' },
    expl: { temp: [36.8, 37.6], tas: [115, 140], tad: [70, 88], fc: [82, 100], sat: [91, 95], pulmon: 'disminuido_izq', corazon: 'normal', palpacion: { zona: null, texto: 'Abdomen normal. Hígado no palpable.' }, garganta: 'normal', zona: 'Aspecto delgado. Dedos en palillo de tambor. Adenopatía supraclavicular izquierda.' },
    pruebas: { sangre: { leu: [11200, 13500], hb: [11, 12.5], pcr: [15, 45] }, orina: {}, rx: { zona: 'torax', hallazgo: 'masa', lado: 'izq', texto: 'Lesión masiva en el pulmón izquierdo.' }, ecg: { tipo: 'normal', texto: 'Normal.' }, eco: { hallazgo: 'normal', texto: 'No valorable para pulmón.' }, tac: { zona: 'torax', hallazgo: 'masa', lado: 'izq', texto: 'Masa de 4 cm en el lóbulo inferior izquierdo, resecable. Sin metástasis visibles.' } },
    trat: { accion: 'cirugia', cir: 'reseccion', prio: 'alta', med: [], evitar: ['tabaco', 'alcohol_fuerte'], buena: ['antitabaco', 'analgesico', 'proteina', 'nicotina', 'fruta', 'verdura'] },
    noticia: 'grave',
  },
  {
    id: 'apendicitis', n: 'Apendicitis aguda', grav: 4, edad: [8, 60], sexo: 'a', peso: 7,
    motivo: ['Dolor muy fuerte en la parte baja derecha de la tripa, con náuseas.', 'Me duele la barriga abajo a la derecha desde anoche.'],
    sintomas: ['Dolor abdominal (fosa ilíaca derecha)', 'Náuseas', 'Fiebre', 'Falta de apetito'],
    d: {
      motivo: ['Doctor, me duele muchísimo la barriga, abajo a la derecha. No puedo ni andar derecho.', 'Tengo un dolor de tripa horrible desde anoche y he vomitado.'],
      inicio: ['Empezó ayer por la noche alrededor del ombligo y luego se fue hacia la derecha.', 'Desde anoche. Primero en el ombligo y ahora aquí abajo.'],
      dolor: ['Abajo a la derecha. Si toso o me muevo, me muero de dolor.', 'Aquí, a la derecha, cerca de la cadera. Es un dolor fijo y cada vez más fuerte.'],
      fiebre: ['Treinta y siete ocho.', 'Algo de fiebre, sí.'],
    },
    expl: { temp: [37.6, 38.6], tas: [110, 135], tad: [65, 85], fc: [95, 115], sat: [96, 99], pulmon: 'normal', corazon: 'taquicardia', palpacion: { zona: 'fid', texto: 'Dolor intenso en fosa ilíaca derecha. Signo de Blumberg positivo. Defensa abdominal.' }, garganta: 'normal', zona: 'Camina encorvado. Dolor al saltar sobre la pierna derecha.' },
    pruebas: { sangre: { leu: [14000, 20000], pcr: [50, 160] }, orina: {}, rx: { zona: 'abdomen', hallazgo: 'normal', texto: 'Sin hallazgos concluyentes.' }, ecg: { tipo: 'taqui', texto: 'Taquicardia sinusal.' }, eco: { hallazgo: 'apendicitis', texto: 'Apéndice engrosado (11 mm), no compresible, con líquido alrededor.' }, tac: { zona: 'abdomen', hallazgo: 'apendicitis', texto: 'Apendicitis aguda sin perforación.' } },
    trat: { accion: 'cirugia', cir: 'apendicectomia', prio: 'alta', med: [], evitar: ['comida', 'alcohol', 'laxante', 'calor'], buena: ['ayuno', 'antibiotico', 'analgesico', 'suero'] },
    noticia: 'moderada',
  },
  {
    id: 'colecistitis', n: 'Colecistitis aguda (piedras en la vesícula)', grav: 3, edad: [35, 85], sexo: 'a', peso: 5,
    motivo: ['Dolor fuerte debajo de las costillas a la derecha después de comer.', 'Me duele el costado derecho desde la comida del domingo.'],
    sintomas: ['Dolor en hipocondrio derecho', 'Náuseas', 'Fiebre', 'Dolor tras comidas grasas'],
    d: {
      motivo: ['Doctor, me duele mucho aquí, debajo de las costillas a la derecha. Me empezó después de comer.', 'Tengo un dolor fuerte en el lado derecho, bajo las costillas, y vómitos.'],
      inicio: ['Desde el domingo, después de un cocido leonés con todo: chorizo, tocino, morcilla...', 'Después de una comida familiar: unos callos y luego lechazo. Desde ayer.'],
      dolor: ['Aquí, bajo las costillas derechas, y se me va hacia la espalda y el hombro.', 'En el costado derecho, como un cólico que no para.'],
      fiebre: ['Treinta y ocho ayer por la noche.', 'Fiebre y escalofríos, sí.'],
    },
    expl: { temp: [37.8, 38.8], tas: [115, 140], tad: [70, 88], fc: [90, 110], sat: [96, 99], pulmon: 'normal', corazon: 'normal', palpacion: { zona: 'hcd', texto: 'Dolor en hipocondrio derecho. Signo de Murphy positivo.' }, garganta: 'normal', zona: 'Leve tinte amarillento en los ojos.' },
    pruebas: { sangre: { leu: [13000, 18000], pcr: [60, 180], bil: [1.4, 2.6], got: [45, 90], ggt: [80, 200] }, orina: {}, rx: { zona: 'abdomen', hallazgo: 'normal', texto: 'Sin hallazgos concluyentes.' }, ecg: { tipo: 'normal', texto: 'Normal.' }, eco: { hallazgo: 'colecistitis', texto: 'Vesícula con piedras y pared engrosada. Murphy ecográfico positivo.' }, tac: { zona: 'abdomen', hallazgo: 'colecistitis', texto: 'Colecistitis aguda litiásica.' } },
    trat: { accion: 'cirugia', cir: 'colecistectomia', prio: 'media', med: [], evitar: ['grasa', 'frito', 'contundente', 'embutido', 'alcohol', 'comida'], buena: ['ayuno', 'antibiotico', 'analgesico', 'espasmolitico', 'suero'] },
    noticia: 'moderada',
  },
  {
    id: 'hernia', n: 'Hernia inguinal', grav: 2, edad: [30, 80], sexo: 'h', peso: 4,
    motivo: ['Tengo un bulto en la ingle que me molesta al hacer fuerza.', 'Me ha salido un bulto en la ingle derecha.'],
    sintomas: ['Bulto en la ingle', 'Molestia al hacer esfuerzos'],
    d: {
      motivo: ['Pues verá, doctor... me duele un poco la tripa, por abajo.', 'Vengo porque me molesta la parte baja del abdomen... cuando cojo peso.'],
      inicio: ['Desde que estuve descargando sacos de patatas, hace un mes.', 'Hace unas semanas, después de mover un armario.'],
      dolor: ['Abajo, en la ingle derecha. Más al final del día.', 'Por abajo... en la ingle. Es más una molestia que dolor.'],
      fiebre: ['No, fiebre no.', 'Nada de fiebre.'],
    },
    secreto: { v: 2, t: 'Bueno... la verdad es que tengo un bulto en la ingle, al lado de... bueno, ahí abajo. Cuando toso se hace más grande. Me daba muchísima vergüenza decirlo.', hallazgo: 'Bulto en ingle derecha que aumenta al toser.' },
    expl: { temp: [36.3, 36.9], tas: [120, 140], tad: [70, 85], fc: [65, 80], sat: [97, 99], pulmon: 'normal', corazon: 'normal', palpacion: { zona: 'ingle', texto: 'Bulto en la ingle derecha que protruye con la tos y se reduce con la presión.' }, garganta: 'normal', zona: 'Bulto inguinal derecho reductible.' },
    pruebas: { sangre: {}, orina: {}, rx: { zona: 'abdomen', hallazgo: 'normal', texto: 'Normal.' }, ecg: { tipo: 'normal', texto: 'Normal.' }, eco: { hallazgo: 'hernia', texto: 'Hernia inguinal derecha con contenido graso, reductible.' }, tac: { zona: 'abdomen', hallazgo: 'normal', texto: 'Hernia inguinal derecha.' } },
    trat: { accion: 'cirugia', cir: 'hernioplastia', prio: 'baja', med: [], evitar: ['ejercicio', 'laxante_no'], buena: ['analgesico', 'reposo', 'fibra'] },
    noticia: 'leve',
  },
  {
    id: 'infarto', n: 'Infarto agudo de miocardio', grav: 5, edad: [45, 85], sexo: 'a', peso: 5,
    motivo: ['Dolor en el pecho como una losa, que se va al brazo izquierdo. Estoy sudando.', 'Opresión en el pecho desde hace una hora.'],
    sintomas: ['Dolor torácico opresivo', 'Irradiado al brazo izquierdo', 'Sudoración fría', 'Náuseas'],
    d: {
      motivo: ['Doctor... me duele el pecho, como si me pusieran una losa encima. Y se me va al brazo izquierdo.', 'Tengo una opresión muy fuerte en el pecho, sudor frío... me encuentro muy mal.'],
      inicio: ['Hará una hora, estaba subiendo las escaleras de casa.', 'Empezó hace como cuarenta minutos, de golpe.'],
      dolor: ['En el centro del pecho, aprieta muchísimo. Y baja por el brazo izquierdo hasta los dedos.', 'Es una presión en el pecho que me sube hasta la mandíbula.'],
      fiebre: ['No, fiebre no. Pero estoy empapad{o} de sudor.', 'No... solo sudor frío.'],
    },
    secreto: { v: 1, t: 'Bueno... también tomo unas pastillas azules que me compré por internet, ya sabe... para el dormitorio. Me tomé una anoche.', hallazgo: 'Tomó sildenafilo (Viagra) anoche: ¡contraindicada la nitroglicerina!' },
    expl: { temp: [36.2, 36.9], tas: [95, 150], tad: [60, 95], fc: [98, 125], sat: [92, 96], pulmon: 'normal', corazon: 'taquicardia', palpacion: { zona: null, texto: 'Abdomen normal.' }, garganta: 'normal', zona: 'Pálido, sudoroso, con cara de angustia. Se lleva el puño al pecho.' },
    pruebas: { sangre: { trop: [0.8, 6.5], got: [45, 120], glu: [130, 180] }, orina: {}, rx: { zona: 'torax', hallazgo: 'normal', texto: 'Silueta cardíaca normal. Sin congestión.' }, ecg: { tipo: 'st', texto: 'Elevación del ST en derivaciones inferiores: INFARTO.' }, eco: { hallazgo: 'normal', texto: 'Hipocinesia de la pared inferior del corazón.' }, tac: { zona: 'torax', hallazgo: 'normal', texto: 'Sin disección de aorta.' } },
    trat: { accion: 'hospitalizar', prio: 'alta', med: [['antiagregante'], ['nitrato', 'opioide', 'oxigeno', 'anticoagulante']], evitar: ['alcohol', 'alcohol_fuerte', 'cafeina', 'energetica', 'grasa', 'tabaco', 'sildenafilo', 'ejercicio', 'aine_no'], buena: ['reposo', 'oxigeno', 'estatina', 'betabloqueante'] },
    noticia: 'grave',
  },
  {
    id: 'ansiedad', n: 'Crisis de ansiedad', grav: 1, edad: [18, 65], sexo: 'a', peso: 8,
    motivo: ['Me late el corazón muy rápido, me ahogo y estoy muy nervios{o}.', 'Siento que me voy a morir, me falta el aire.'],
    sintomas: ['Nerviosismo', 'Palpitaciones', 'Sensación de ahogo', 'Hormigueo en las manos'],
    d: {
      motivo: ['Doctor, creo que me está dando un infarto. El corazón me va a mil, no puedo respirar...', 'Estoy muy nervios{o}, me tiemblan las manos, me falta el aire y me hormiguean los dedos.'],
      inicio: ['Hoy en el trabajo, de repente. Ya me ha pasado otras veces.', 'Esta mañana. Llevo unas semanas muy malas.'],
      dolor: ['Una presión en el pecho, como un nudo, y hormigueo en las manos y en la boca.', 'No es dolor... es como que no me entra el aire.'],
      fiebre: ['No, nada de fiebre.', 'No.'],
    },
    secreto: { v: 2, t: 'La verdad es que... me estoy divorciando y en el trabajo me quieren echar. No duermo, no como... y me tomo cinco o seis cafés al día para aguantar.', hallazgo: 'Estrés intenso (divorcio, trabajo). 5-6 cafés al día.' },
    expl: { temp: [36.4, 36.9], tas: [130, 150], tad: [80, 92], fc: [105, 125], sat: [98, 100], pulmon: 'normal', corazon: 'taquicardia', palpacion: { zona: null, texto: 'Abdomen normal.' }, garganta: 'normal', zona: 'Respira muy rápido. Manos frías y temblorosas.' },
    pruebas: { sangre: { glu: [95, 115] }, orina: {}, rx: { zona: 'torax', hallazgo: 'normal', texto: 'Normal.' }, ecg: { tipo: 'taqui', texto: 'Taquicardia sinusal. Sin signos de isquemia.' }, eco: { hallazgo: 'normal', texto: 'Normal.' }, tac: { zona: 'torax', hallazgo: 'normal', texto: 'Normal.' } },
    trat: { accion: 'casa', prio: 'baja', med: [['ansiolitico', 'ansiolitico_suave', 'psico', 'relajacion', 'relajante_suave', 'antidepresivo']], evitar: ['cafeina', 'energetica', 'alcohol', 'alcohol_fuerte'], buena: ['infusion', 'relajante_suave', 'sueno', 'ejercicio', 'vacaciones', 'psico', 'relajacion'] },
    noticia: 'leve',
  },
  {
    id: 'fractura_muneca', n: 'Fractura de muñeca', grav: 2, edad: [8, 90], sexo: 'a', peso: 6,
    motivo: ['Me he caído y me duele muchísimo la muñeca.', 'Resbalé en el hielo y apoyé la mano.'],
    sintomas: ['Golpe', 'Dolor en la muñeca', 'Hinchazón', 'Deformidad'],
    d: {
      motivo: ['Me he resbalado en la calle con el hielo y he apoyado la mano. Me duele una barbaridad.', 'Me caí de la bici y me he hecho daño en la muñeca. Mire qué hinchada.'],
      inicio: ['Hace un par de horas.', 'Esta mañana, a primera hora.'],
      dolor: ['En la muñeca derecha. No la puedo mover nada.', 'Aquí, en la muñeca. Y se me ha puesto torcida.'],
      fiebre: ['No, no.', 'Nada.'],
    },
    expl: { temp: [36.3, 36.9], tas: [120, 145], tad: [70, 90], fc: [80, 100], sat: [97, 99], pulmon: 'normal', corazon: 'normal', palpacion: { zona: null, texto: 'Abdomen normal.' }, garganta: 'normal', zona: 'Muñeca derecha hinchada, con deformidad en "dorso de tenedor". Dolor intenso al tocar el radio.' },
    pruebas: { sangre: {}, orina: {}, rx: { zona: 'muneca', hallazgo: 'fractura', texto: 'Fractura de radio distal (de Colles), poco desplazada.' }, ecg: { tipo: 'normal', texto: 'Normal.' }, eco: { hallazgo: 'normal', texto: 'Hematoma en la muñeca.' }, tac: { zona: 'muneca', hallazgo: 'fractura', texto: 'Fractura de radio distal sin afectar la articulación.' } },
    trat: { accion: 'casa', prio: 'media', med: [['inmovilizacion'], ['analgesico', 'aine']], evitar: ['calor', 'ejercicio', 'fisio'], buena: ['hielo', 'reposo', 'proteina', 'lacteo', 'vitd'], altCir: 'osteosintesis' },
    noticia: 'leve',
  },
  {
    id: 'esguince', n: 'Esguince de tobillo', grav: 1, edad: [12, 70], sexo: 'a', peso: 6,
    motivo: ['Me he torcido el tobillo jugando al fútbol.', 'Pisé mal bajando un bordillo y se me hinchó el tobillo.'],
    sintomas: ['Golpe', 'Dolor en el tobillo', 'Hinchazón'],
    d: {
      motivo: ['Me he torcido el tobillo jugando un partido. Se me ha hinchado como un melón.', 'Bajando un bordillo pisé mal y se me dobló el pie.'],
      inicio: ['Ayer por la tarde.', 'Esta mañana.'],
      dolor: ['Por fuera del tobillo derecho. Puedo apoyar, pero me duele.', 'En el tobillo, por la parte de fuera.'],
      fiebre: ['No.', 'No, nada.'],
    },
    expl: { temp: [36.3, 36.9], tas: [115, 135], tad: [70, 85], fc: [70, 88], sat: [97, 99], pulmon: 'normal', corazon: 'normal', palpacion: { zona: null, texto: 'Abdomen normal.' }, garganta: 'normal', zona: 'Tobillo hinchado con hematoma bajo el maléolo externo. Puede apoyar con dolor. Los huesos no duelen al tocar.' },
    pruebas: { sangre: {}, orina: {}, rx: { zona: 'tobillo', hallazgo: 'normal', texto: 'Sin fracturas.' }, ecg: { tipo: 'normal', texto: 'Normal.' }, eco: { hallazgo: 'normal', texto: 'Rotura parcial del ligamento peroneoastragalino anterior.' }, tac: { zona: 'tobillo', hallazgo: 'normal', texto: 'Sin fracturas.' } },
    trat: { accion: 'casa', prio: 'baja', med: [['hielo', 'vendaje', 'inmovilizacion_suave', 'inmovilizacion'], ['aine', 'analgesico']], evitar: ['calor', 'ejercicio'], buena: ['reposo', 'muletas', 'hielo'] },
    noticia: 'leve',
  },
  {
    id: 'fractura_costal', n: 'Fractura de costilla', grav: 2, edad: [20, 90], sexo: 'a', peso: 4,
    motivo: ['Me caí de la escalera y me duele el costado al respirar.', 'Me di un golpe en las costillas.'],
    sintomas: ['Golpe', 'Dolor en el costado', 'Dolor al respirar'],
    d: {
      motivo: ['Estaba cogiendo cerezas y me caí de la escalera. Me di contra el borde de un cajón en las costillas.', 'Me he dado un golpe tremendo en el costado y ahora me duele al respirar.'],
      inicio: ['Ayer por la tarde.', 'Hace tres días, pero no se me pasa.'],
      dolor: ['En el costado izquierdo. Al toser o reírme, veo las estrellas.', 'Aquí, en las costillas de la izquierda. Si respiro hondo, me duele mucho.'],
      fiebre: ['No.', 'No.'],
    },
    expl: { temp: [36.3, 36.9], tas: [120, 140], tad: [70, 88], fc: [80, 98], sat: [95, 98], pulmon: 'normal', corazon: 'normal', palpacion: { zona: null, texto: 'Abdomen normal.' }, garganta: 'normal', zona: 'Hematoma en el costado izquierdo. Dolor muy localizado al apretar la séptima costilla.' },
    pruebas: { sangre: {}, orina: {}, rx: { zona: 'torax', hallazgo: 'fractura_costal', lado: 'izq', texto: 'Fractura de la séptima costilla izquierda, sin neumotórax.' }, ecg: { tipo: 'normal', texto: 'Normal.' }, eco: { hallazgo: 'normal', texto: 'Sin derrame.' }, tac: { zona: 'torax', hallazgo: 'fractura_costal', lado: 'izq', texto: 'Fractura costal sin complicaciones.' } },
    trat: { accion: 'casa', prio: 'baja', med: [['analgesico', 'aine', 'opioide']], evitar: ['ejercicio', 'tabaco', 'antitusivo_no'], buena: ['reposo', 'calor', 'hielo'] },
    noticia: 'leve',
  },
  {
    id: 'herida', n: 'Herida incisa en el antebrazo', grav: 2, edad: [16, 80], sexo: 'a', peso: 5,
    motivo: ['Me he cortado con un cristal y no para de sangrar.', 'Corte profundo en el brazo.'],
    sintomas: ['Herida', 'Sangrado'],
    d: {
      motivo: ['Me he cortado con una botella rota y sangra muchísimo. Me he puesto este trapo.', 'Estaba cortando jamón con un cuchillo y se me fue. Mire qué tajo.'],
      inicio: ['Hace media hora.', 'Ahora mismo, hace un rato.'],
      dolor: ['En el antebrazo izquierdo. Escuece y palpita.', 'Aquí, en el brazo. Me escuece muchísimo.'],
      fiebre: ['No.', 'No.'],
    },
    expl: { temp: [36.3, 36.9], tas: [110, 135], tad: [65, 85], fc: [85, 100], sat: [97, 99], pulmon: 'normal', corazon: 'normal', palpacion: { zona: null, texto: 'Abdomen normal.' }, garganta: 'normal', zona: 'Herida de 5 cm en el antebrazo, bordes limpios, sangrado venoso. Mueve bien los dedos.' },
    pruebas: { sangre: {}, orina: {}, rx: { zona: 'muneca', hallazgo: 'normal', texto: 'Sin cuerpos extraños.' }, ecg: { tipo: 'normal', texto: 'Normal.' }, eco: { hallazgo: 'normal', texto: 'Sin lesión de tendones.' }, tac: { zona: 'muneca', hallazgo: 'normal', texto: 'Normal.' } },
    trat: { accion: 'cirugia', cir: 'sutura', prio: 'media', med: [], evitar: ['anticoagulante', 'alcohol_fuerte'], buena: ['antiseptico', 'analgesico', 'antibiotico_topico', 'vendaje'] },
    noticia: 'leve',
  },
  {
    id: 'colico_renal', n: 'Cólico renal', grav: 2, edad: [20, 75], sexo: 'a', peso: 6,
    motivo: ['Dolor horrible en la espalda que baja hacia la ingle. No encuentro postura.', 'El peor dolor de mi vida en el riñón.'],
    sintomas: ['Dolor lumbar intenso', 'Irradiado a la ingle', 'Sangre en la orina', 'Náuseas'],
    d: {
      motivo: ['¡Ay, doctor! Me duele el riñón que me muero. No encuentro postura, ni sentad{o} ni de pie.', 'Tengo un dolor brutal en la espalda, en el lado derecho, que me baja hasta la ingle.'],
      inicio: ['Hace tres horas, de repente.', 'Esta madrugada me despertó.'],
      dolor: ['En la espalda, abajo a la derecha, y se me va hacia delante, a la ingle.', 'En el riñón derecho. Viene en oleadas.'],
      fiebre: ['No, fiebre no.', 'No, pero he vomitado del dolor.'],
      extra: ['Y la orina la tengo como rosada.'],
    },
    expl: { temp: [36.4, 37.2], tas: [135, 160], tad: [80, 95], fc: [90, 110], sat: [97, 99], pulmon: 'normal', corazon: 'taquicardia', palpacion: { zona: 'fosa_lumbar', texto: 'Puñopercusión renal derecha muy dolorosa. Abdomen blando.' }, garganta: 'normal', zona: 'Muy inquieto, no para de moverse. Sudoroso.' },
    pruebas: { sangre: { leu: [9000, 12000], cre: [1.0, 1.4] }, orina: { san: '+++' }, rx: { zona: 'abdomen', hallazgo: 'calculo', lado: 'der', texto: 'Imagen cálcica de 5 mm en el trayecto del uréter derecho.' }, ecg: { tipo: 'normal', texto: 'Normal.' }, eco: { hallazgo: 'hidronefrosis', texto: 'Riñón derecho dilatado (hidronefrosis leve).' }, tac: { zona: 'abdomen', hallazgo: 'calculo', lado: 'der', texto: 'Cálculo de 5 mm en uréter derecho.' } },
    trat: { accion: 'casa', prio: 'media', med: [['aine', 'analgesico', 'espasmolitico', 'opioide']], evitar: ['sal', 'embutido', 'alcohol', 'alcohol_fuerte', 'refresco'], buena: ['agua', 'liquido', 'alfabloqueante', 'calor', 'limon'] },
    noticia: 'leve',
  },
  {
    id: 'ulcera', n: 'Gastritis / úlcera de estómago', grav: 2, edad: [25, 80], sexo: 'a', peso: 6,
    motivo: ['Me arde el estómago, sobre todo por la noche.', 'Ardor en la boca del estómago desde hace semanas.'],
    sintomas: ['Ardor de estómago', 'Dolor en epigastrio', 'Náuseas'],
    d: {
      motivo: ['Me arde el estómago muchísimo, como fuego. Sobre todo de madrugada.', 'Tengo ardores y un dolor en la boca del estómago que no se me quita.'],
      inicio: ['Hace un mes o así.', 'Unas semanas. Desde que me duele la rodilla y tomo pastillas.'],
      dolor: ['Aquí, en la boca del estómago. Se me alivia un poco al comer y luego vuelve.', 'Arriba, en el centro. Es como un ardor que sube.'],
      fiebre: ['No.', 'No.'],
      habitosMentira: ['Bebo lo normal, doctor. Un vinito en la comida.', 'Alcohol, lo justo.'],
    },
    secreto: { v: 1, t: 'Bueno, para la rodilla me tomo tres o cuatro ibuprofenos al día. Y después de comer... siempre un orujito. O dos. Para hacer la digestión, ¿sabe?', hallazgo: 'Toma 3-4 ibuprofenos al día y orujo a diario.' },
    expl: { temp: [36.3, 36.9], tas: [115, 135], tad: [70, 85], fc: [70, 88], sat: [97, 99], pulmon: 'normal', corazon: 'normal', palpacion: { zona: 'epigastrio', texto: 'Dolor a la palpación en epigastrio. Sin defensa.' }, garganta: 'normal', zona: 'Aliento a alcohol.' },
    pruebas: { sangre: { hb: [11.5, 13], ggt: [70, 160] }, orina: {}, rx: { zona: 'abdomen', hallazgo: 'normal', texto: 'Normal.' }, ecg: { tipo: 'normal', texto: 'Normal.' }, eco: { hallazgo: 'normal', texto: 'Hígado algo graso.' }, tac: { zona: 'abdomen', hallazgo: 'normal', texto: 'Engrosamiento de la pared del estómago.' } },
    trat: { accion: 'casa', prio: 'baja', med: [['ibp', 'antiacido']], evitar: ['aine', 'alcohol', 'alcohol_fuerte', 'cafeina', 'picante', 'acido', 'tabaco', 'frito', 'grasa', 'refresco', 'embutido', 'antiagregante'], buena: ['blanda', 'infusion', 'digestiva'] },
    noticia: 'leve',
  },
  {
    id: 'hipertension', n: 'Hipertensión arterial', grav: 2, edad: [40, 90], sexo: 'a', peso: 6,
    motivo: ['Dolor de cabeza en la nuca y mareos.', 'Me noto la cabeza cargada y zumbidos en los oídos.'],
    sintomas: ['Dolor de cabeza', 'Mareos', 'Zumbido de oídos'],
    d: {
      motivo: ['Llevo días con dolor de cabeza en la nuca, y me mareo un poco al levantarme.', 'Tengo la cabeza como cargada, me pitan los oídos y veo lucecitas.'],
      inicio: ['Desde hace un par de semanas.', 'Hace tiempo, pero ahora más.'],
      dolor: ['En la nuca, sobre todo por la mañana.', 'La cabeza, por detrás.'],
      fiebre: ['No.', 'No.'],
      habitosMentira: ['Como sano, doctor. Mucha verdura.', 'Yo como de todo, pero poco.'],
    },
    secreto: { v: 1, t: 'Bueno... verdura poca. Desayuno cecina, a media mañana un bocadillo de chorizo, y para cenar embutido variado. Y la sal, le echo a todo. Hasta a la fruta.', hallazgo: 'Dieta con muchísima sal y embutido.' },
    expl: { temp: [36.3, 36.9], tas: [165, 190], tad: [98, 112], fc: [75, 92], sat: [96, 99], pulmon: 'normal', corazon: 'normal', palpacion: { zona: null, texto: 'Abdomen normal.' }, garganta: 'normal', zona: 'Cara enrojecida. Fondo de ojo con arterias estrechas.' },
    pruebas: { sangre: { cre: [1.1, 1.4], na: [142, 146] }, orina: { pro: '+' }, rx: { zona: 'torax', hallazgo: 'normal', texto: 'Corazón algo aumentado de tamaño.' }, ecg: { tipo: 'normal', texto: 'Signos de crecimiento del ventrículo izquierdo.' }, eco: { hallazgo: 'normal', texto: 'Normal.' }, tac: { zona: 'craneo', hallazgo: 'normal', texto: 'Sin hemorragias.' } },
    trat: { accion: 'casa', prio: 'media', med: [['antihipertensivo']], evitar: ['sal', 'embutido', 'alcohol_fuerte', 'cafeina', 'energetica', 'aine', 'tabaco', 'refresco', 'sildenafilo_no'], buena: ['verdura', 'fruta', 'ejercicio', 'pescado', 'potasio', 'agua'] },
    noticia: 'moderada',
  },
  {
    id: 'diabetes', n: 'Diabetes tipo 2', grav: 2, edad: [35, 85], sexo: 'a', peso: 6,
    motivo: ['Tengo mucha sed, orino a todas horas y estoy cansad{o}.', 'Bebo agua sin parar y he adelgazado.'],
    sintomas: ['Mucha sed', 'Orina mucho', 'Cansancio', 'Visión borrosa'],
    d: {
      motivo: ['Doctor, tengo una sed que no se me quita con nada, y me levanto cuatro veces por la noche a orinar.', 'Estoy siempre cansad{o}, con mucha sed y veo un poco borroso.'],
      inicio: ['Hace unos meses.', 'Desde el verano, más o menos.'],
      dolor: ['Dolor no... a veces me hormiguean los pies.', 'No me duele nada, solo cansancio.'],
      fiebre: ['No.', 'No.'],
      habitosMentira: ['Dulces casi nada, doctor.', 'Como poco dulce.'],
    },
    secreto: { v: 1, t: 'Bueno, mantecadas de Astorga... caen unas cuantas cada día. Y me bebo un litro y medio de Coca-Cola. Y alguna nicanor de Boñar.', hallazgo: 'Come muchos dulces y 1,5 litros de refresco al día.' },
    expl: { temp: [36.3, 36.9], tas: [130, 150], tad: [80, 92], fc: [75, 90], sat: [97, 99], pulmon: 'normal', corazon: 'normal', palpacion: { zona: null, texto: 'Abdomen normal, algo de sobrepeso.' }, garganta: 'normal', zona: 'Sobrepeso. Piel seca. Sensibilidad algo disminuida en los pies.' },
    pruebas: { sangre: { glu: [240, 340], cre: [0.9, 1.2] }, orina: { glu: '+++', cet: '+' }, rx: { zona: 'torax', hallazgo: 'normal', texto: 'Normal.' }, ecg: { tipo: 'normal', texto: 'Normal.' }, eco: { hallazgo: 'normal', texto: 'Hígado graso.' }, tac: { zona: 'abdomen', hallazgo: 'normal', texto: 'Hígado graso.' } },
    trat: { accion: 'casa', prio: 'media', med: [['antidiabetico', 'insulina']], evitar: ['azucar', 'dulce', 'refresco', 'alcohol', 'alcohol_fuerte', 'energetica', 'frito'], buena: ['verdura', 'fibra', 'legumbre', 'ejercicio', 'pescado', 'agua'] },
    noticia: 'moderada',
  },
  {
    id: 'migrana', n: 'Migraña', grav: 1, edad: [15, 60], sexo: 'a', peso: 6,
    motivo: ['Dolor de cabeza horrible de un lado, la luz me molesta.', 'Tengo jaqueca y vomito.'],
    sintomas: ['Dolor de cabeza pulsátil', 'Molestia con la luz', 'Náuseas'],
    d: {
      motivo: ['Tengo un dolor de cabeza terrible en un lado. La luz y los ruidos me matan.', 'Me ha dado una jaqueca de las mías, con náuseas. Antes vi como lucecitas en zigzag.'],
      inicio: ['Desde esta mañana. Me pasa varias veces al mes.', 'Empezó anoche. Mi madre también las tenía.'],
      dolor: ['En el lado derecho de la cabeza, detrás del ojo. Late como un tambor.', 'Media cabeza, como martillazos.'],
      fiebre: ['No.', 'No.'],
    },
    expl: { temp: [36.3, 36.9], tas: [115, 135], tad: [70, 85], fc: [70, 88], sat: [97, 99], pulmon: 'normal', corazon: 'normal', palpacion: { zona: null, texto: 'Abdomen normal.' }, garganta: 'normal', zona: 'Exploración neurológica normal. Cierra los ojos por la luz.' },
    pruebas: { sangre: {}, orina: {}, rx: { zona: 'craneo', hallazgo: 'normal', texto: 'Normal.' }, ecg: { tipo: 'normal', texto: 'Normal.' }, eco: { hallazgo: 'normal', texto: 'Normal.' }, tac: { zona: 'craneo', hallazgo: 'normal', texto: 'Normal. Sin hemorragias ni tumores.' } },
    trat: { accion: 'casa', prio: 'baja', med: [['triptan', 'aine', 'analgesico']], evitar: ['alcohol', 'vino', 'energetica', 'tabaco'], buena: ['oscuridad', 'sueno', 'agua', 'reposo', 'antiemetico'] },
    noticia: 'leve',
  },
  {
    id: 'lumbalgia', n: 'Lumbalgia mecánica', grav: 1, edad: [25, 75], sexo: 'a', peso: 7,
    motivo: ['Me he quedado enganchad{o} de la espalda.', 'Dolor en la parte baja de la espalda.'],
    sintomas: ['Dolor de espalda', 'Contractura'],
    d: {
      motivo: ['Me agaché a coger una caja de leña y me quedé enganchad{o}. No me puedo ni poner derech{o}.', 'Tengo un dolor de riñones que no me deja moverme.'],
      inicio: ['Desde ayer.', 'Hace tres días.'],
      dolor: ['Abajo de la espalda, en el centro. No se me va a las piernas.', 'En la zona lumbar, como si tuviera una piedra.'],
      fiebre: ['No.', 'No.'],
    },
    expl: { temp: [36.3, 36.9], tas: [120, 140], tad: [70, 88], fc: [70, 88], sat: [97, 99], pulmon: 'normal', corazon: 'normal', palpacion: { zona: null, texto: 'Abdomen normal.' }, garganta: 'normal', zona: 'Contractura de la musculatura lumbar. Lasègue negativo. Fuerza y reflejos normales.' },
    pruebas: { sangre: {}, orina: {}, rx: { zona: 'lumbar', hallazgo: 'normal', texto: 'Columna lumbar con algo de artrosis. Sin fracturas.' }, ecg: { tipo: 'normal', texto: 'Normal.' }, eco: { hallazgo: 'normal', texto: 'Normal.' }, tac: { zona: 'lumbar', hallazgo: 'normal', texto: 'Sin hernias discales.' } },
    trat: { accion: 'casa', prio: 'baja', med: [['aine', 'analgesico', 'relajante']], evitar: ['reposo_absoluto'], buena: ['calor', 'ejercicio', 'fisio'] },
    noticia: 'leve',
  },
  {
    id: 'cistitis', n: 'Infección de orina (cistitis)', grav: 1, edad: [18, 85], sexo: 'm', peso: 6,
    motivo: ['Me escuece al orinar y voy al baño cada poco.', 'Molestias al orinar.'],
    sintomas: ['Escozor al orinar', 'Ganas frecuentes de orinar', 'Dolor bajo vientre'],
    d: {
      motivo: ['Me escuece muchísimo al orinar, y voy cada diez minutos aunque salgan cuatro gotas.', 'Tengo escozor al hacer pis y dolor abajo en la tripa.'],
      inicio: ['Desde ayer.', 'Hace dos días.'],
      dolor: ['Abajo, encima del pubis. Y al terminar de orinar, escozor.', 'En el bajo vientre.'],
      fiebre: ['No, fiebre no.', 'No.'],
    },
    expl: { temp: [36.4, 37.2], tas: [110, 130], tad: [65, 80], fc: [70, 88], sat: [97, 99], pulmon: 'normal', corazon: 'normal', palpacion: { zona: 'hipogastrio', texto: 'Molestia en hipogastrio. Puñopercusión renal negativa.' }, garganta: 'normal', zona: 'Sin otros hallazgos.' },
    pruebas: { sangre: { leu: [9500, 11500] }, orina: { leu: '+++', nit: '+', san: '+' }, rx: { zona: 'abdomen', hallazgo: 'normal', texto: 'Normal.' }, ecg: { tipo: 'normal', texto: 'Normal.' }, eco: { hallazgo: 'normal', texto: 'Vejiga con pared algo engrosada.' }, tac: { zona: 'abdomen', hallazgo: 'normal', texto: 'Normal.' } },
    trat: { accion: 'casa', prio: 'baja', med: [['antibiotico_urinario', 'antibiotico']], evitar: ['alcohol', 'alcohol_fuerte', 'cafeina', 'picante'], buena: ['agua', 'arandano', 'liquido'] },
    noticia: 'leve',
  },
  {
    id: 'alergia', n: 'Reacción alérgica (urticaria)', grav: 3, edad: [10, 70], sexo: 'a', peso: 5,
    motivo: ['Me han salido ronchas por todo el cuerpo y se me hinchan los labios.', 'Picor y habones tras comer.'],
    sintomas: ['Ronchas (habones)', 'Picor', 'Labios hinchados'],
    d: {
      motivo: ['Doctor, mire: me han salido ronchas por todas partes y se me están hinchando los labios.', 'Me pica todo el cuerpo y me han salido como picaduras gigantes.'],
      inicio: ['Hace una hora, después de comer en una marisquería.', 'Después de comer unas gambas al ajillo. Hace un rato.'],
      dolor: ['No duele, pero me pica muchísimo. Y noto la garganta un poco rara.', 'Me pica todo. Y los labios los noto gordos.'],
      fiebre: ['No.', 'No.'],
    },
    expl: { temp: [36.4, 37.0], tas: [100, 120], tad: [60, 75], fc: [95, 112], sat: [95, 98], pulmon: 'sibilancias', corazon: 'taquicardia', palpacion: { zona: null, texto: 'Abdomen normal.' }, garganta: 'roja', zona: 'Habones por todo el cuerpo. Labios hinchados (angioedema leve). Voz normal.' },
    pruebas: { sangre: { leu: [9000, 12000] }, orina: {}, rx: { zona: 'torax', hallazgo: 'normal', texto: 'Normal.' }, ecg: { tipo: 'taqui', texto: 'Taquicardia sinusal.' }, eco: { hallazgo: 'normal', texto: 'Normal.' }, tac: { zona: 'torax', hallazgo: 'normal', texto: 'Normal.' } },
    trat: { accion: 'casa', prio: 'media', med: [['antihistaminico'], ['corticoide', 'adrenalina']], evitar: ['marisco', 'aine', 'alcohol', 'alcohol_fuerte'], buena: ['agua'] },
    noticia: 'moderada',
  },
  {
    id: 'anemia', n: 'Anemia por falta de hierro', grav: 1, edad: [18, 55], sexo: 'm', peso: 5,
    motivo: ['Estoy cansadísima, me mareo y me noto pálida.', 'No tengo fuerzas para nada.'],
    sintomas: ['Cansancio', 'Palidez', 'Mareos', 'Uñas frágiles'],
    d: {
      motivo: ['Doctor, estoy cansadísima. Subo dos pisos y me ahogo. Y mire qué pálida estoy.', 'No tengo fuerzas, me mareo al levantarme y se me cae el pelo.'],
      inicio: ['Desde hace unos meses.', 'Hace tiempo, cada vez peor.'],
      dolor: ['Dolor no, solo cansancio y a veces dolor de cabeza.', 'Nada concreto.'],
      fiebre: ['No.', 'No.'],
    },
    secreto: { v: 1, t: 'Bueno... es que las reglas las tengo muy abundantes desde hace un año. Me da apuro hablar de eso.', hallazgo: 'Reglas muy abundantes desde hace un año.' },
    expl: { temp: [36.2, 36.8], tas: [100, 115], tad: [60, 72], fc: [90, 105], sat: [97, 99], pulmon: 'normal', corazon: 'soplo', palpacion: { zona: null, texto: 'Abdomen normal.' }, garganta: 'normal', zona: 'Piel y mucosas pálidas. Uñas quebradizas.' },
    pruebas: { sangre: { hb: [8.2, 9.8], fer: [4, 12] }, orina: {}, rx: { zona: 'torax', hallazgo: 'normal', texto: 'Normal.' }, ecg: { tipo: 'taqui', texto: 'Taquicardia sinusal leve.' }, eco: { hallazgo: 'normal', texto: 'Normal.' }, tac: { zona: 'abdomen', hallazgo: 'normal', texto: 'Normal.' } },
    trat: { accion: 'casa', prio: 'baja', med: [['hierro_med']], evitar: ['cafeina_comida'], buena: ['hierro', 'carne_roja', 'legumbre', 'vitc', 'verdura'] },
    noticia: 'leve',
  },
  {
    id: 'conmocion', n: 'Traumatismo craneal (conmoción)', grav: 3, edad: [10, 90], sexo: 'a', peso: 4,
    motivo: ['Me di un golpe fuerte en la cabeza y he vomitado.', 'Golpe en la cabeza, mareos.'],
    sintomas: ['Golpe en la cabeza', 'Mareo', 'Vómitos', 'Confusión'],
    d: {
      motivo: ['Me di un golpe con la viga de la bodega y desde entonces estoy mareado y he vomitado dos veces.', 'Me caí de la moto, sin casco... y me duele mucho la cabeza.'],
      inicio: ['Hace unas tres horas.', 'Esta mañana.'],
      dolor: ['Aquí, en la frente. Y me cuesta concentrarme.', 'Toda la cabeza. Y no me acuerdo bien de lo que pasó.'],
      fiebre: ['No.', 'No.'],
    },
    expl: { temp: [36.3, 36.9], tas: [125, 145], tad: [75, 90], fc: [65, 85], sat: [97, 99], pulmon: 'normal', corazon: 'normal', palpacion: { zona: null, texto: 'Abdomen normal.' }, garganta: 'normal', zona: 'Chichón frontal. Algo desorientado. No recuerda el golpe. Pupilas iguales.' },
    pruebas: { sangre: {}, orina: {}, rx: { zona: 'craneo', hallazgo: 'normal', texto: 'Sin fracturas visibles.' }, ecg: { tipo: 'normal', texto: 'Normal.' }, eco: { hallazgo: 'normal', texto: 'No valorable.' }, tac: { zona: 'craneo', hallazgo: 'normal', texto: 'Sin hemorragia intracraneal. Conmoción.' } },
    trat: { accion: 'hospitalizar', prio: 'media', med: [['analgesico']], evitar: ['alcohol', 'alcohol_fuerte', 'benzodiacepina', 'hipnotico', 'antiagregante', 'anticoagulante', 'opioide'], buena: ['reposo', 'oscuridad', 'antiemetico'] },
    noticia: 'moderada',
  },
  {
    id: 'bronquitis', n: 'Bronquitis aguda', grav: 1, edad: [15, 85], sexo: 'a', peso: 6,
    motivo: ['Tos persistente con pitos en el pecho.', 'Tos desde hace una semana.'],
    sintomas: ['Tos', 'Pitos al respirar', 'Mucosidad'],
    d: {
      motivo: ['Tengo una tos que no me deja dormir, y por la noche me silba el pecho.', 'Llevo una semana tosiendo con flemas blancas.'],
      inicio: ['Hace una semana, después de un resfriado.', 'Desde el catarro de la semana pasada.'],
      dolor: ['Me duele el pecho de tanto toser.', 'Solo de toser, por el centro del pecho.'],
      fiebre: ['Al principio algo, ahora no.', 'Unas décimas los primeros días.'],
    },
    expl: { temp: [36.6, 37.4], tas: [115, 135], tad: [70, 85], fc: [75, 92], sat: [95, 98], pulmon: 'sibilancias', corazon: 'normal', palpacion: { zona: null, texto: 'Abdomen normal.' }, garganta: 'roja', zona: 'Tos frecuente. Buen estado general.' },
    pruebas: { sangre: { pcr: [5, 18] }, orina: {}, rx: { zona: 'torax', hallazgo: 'normal', texto: 'Sin condensaciones.' }, ecg: { tipo: 'normal', texto: 'Normal.' }, eco: { hallazgo: 'normal', texto: 'Normal.' }, tac: { zona: 'torax', hallazgo: 'normal', texto: 'Engrosamiento bronquial leve.' } },
    trat: { accion: 'casa', prio: 'baja', med: [['broncodilatador', 'mucolitico', 'antitusivo', 'analgesico', 'vahos']], evitar: ['tabaco', 'antibiotico', 'frio'], buena: ['vahos', 'liquido', 'miel', 'infusion', 'antitabaco'] },
    noticia: 'leve',
  },
  {
    id: 'resaca', n: 'Intoxicación etílica (resaca)', grav: 1, edad: [18, 65], sexo: 'a', peso: 4,
    motivo: ['Dolor de cabeza, náuseas y me tiembla todo.', 'Me encuentro fatal desde esta mañana.'],
    sintomas: ['Dolor de cabeza', 'Náuseas', 'Mareo', 'Sed'],
    d: {
      motivo: ['Doctor, me encuentro fatal: me va a explotar la cabeza, tengo náuseas y una sed terrible.', 'Estoy mareado, con vómitos y la boca seca como un estropajo.'],
      inicio: ['Desde que me he levantado esta mañana.', 'Esta mañana... bueno, a mediodía, que me levanté tarde.'],
      dolor: ['La cabeza entera. Y la luz me molesta.', 'Me duele la cabeza y el estómago.'],
      fiebre: ['No.', 'No.'],
      habitosMentira: ['Yo no bebo, doctor. Nada.', '¿Alcohol? Qué va, una cervecita sin.'],
    },
    secreto: { v: 1, t: 'Vale, vale... anoche fueron las fiestas del pueblo. Cañas, vino, luego unos cubatas... y para rematar, la queimada y unos chupitos de orujo. No me acuerdo de cómo llegué a casa.', hallazgo: 'Borrachera en las fiestas del pueblo anoche.' },
    expl: { temp: [36.3, 37.0], tas: [110, 130], tad: [65, 85], fc: [88, 105], sat: [97, 99], pulmon: 'normal', corazon: 'taquicardia', palpacion: { zona: 'epigastrio', texto: 'Molestia leve en epigastrio.' }, garganta: 'normal', zona: 'Aliento a alcohol, ojos rojos, ojeras.' },
    pruebas: { sangre: { oh: [0.4, 1.1], glu: [62, 75], ggt: [60, 120] }, orina: { cet: '+' }, rx: { zona: 'craneo', hallazgo: 'normal', texto: 'Normal.' }, ecg: { tipo: 'taqui', texto: 'Taquicardia sinusal.' }, eco: { hallazgo: 'normal', texto: 'Normal.' }, tac: { zona: 'craneo', hallazgo: 'normal', texto: 'Normal.' } },
    trat: { accion: 'casa', prio: 'baja', med: [['suero', 'agua', 'isotonica', 'liquido']], evitar: ['alcohol', 'alcohol_fuerte', 'paracetamol', 'grasa', 'frito'], buena: ['caldo', 'sueno', 'fruta', 'blanda', 'antiemetico', 'aine'] },
    noticia: 'leve',
  },
  {
    id: 'simulador', n: 'Paciente sano (está fingiendo)', grav: 0, edad: [20, 60], sexo: 'a', peso: 5, simulador: true,
    motivo: ['Me duele todo. Mucho. Necesito la baja.', 'Me encuentro muy mal, de todo un poco.'],
    sintomas: ['Síntomas vagos', 'Pide la baja'],
    d: {
      motivo: ['Uf, doctor, estoy fatal. Me duele... todo. La cabeza, la espalda, la pierna... Creo que necesito la baja unas semanas.', 'Me encuentro muy mal, muy mal. No puedo ir a trabajar, de verdad.'],
      inicio: ['Desde el viernes... o el jueves... bueno, desde hace días.', 'Pues desde... ¿qué día es hoy? Desde el lunes.'],
      dolor: ['Aquí... no, aquí. Bueno, por todas partes. Va cambiando.', 'En la espalda. Y en la rodilla. Y en el codo, a veces.'],
      fiebre: ['Muchísima fiebre, de cuarenta... bueno, no me la he puesto, pero seguro.', 'Fiebre altísima, se lo juro.'],
    },
    secreto: { v: 3, t: 'Está bien, me ha pillado... El lunes empiezan las fiestas de San Juan y San Pedro en León y mi jefe no me da vacaciones. Me encuentro perfectamente.', hallazgo: 'Confiesa que está fingiendo para ir a las fiestas.' },
    expl: { temp: [36.3, 36.8], tas: [115, 128], tad: [70, 82], fc: [65, 80], sat: [98, 100], pulmon: 'normal', corazon: 'normal', palpacion: { zona: 'cambiante', texto: 'Se queja de dolor en sitios distintos cada vez. Sin defensa. Cuando se distrae, no le duele.' }, garganta: 'normal', zona: 'Exploración normal. Contradicciones evidentes.' },
    pruebas: { sangre: {}, orina: {}, rx: { zona: 'lumbar', hallazgo: 'normal', texto: 'Normal.' }, ecg: { tipo: 'normal', texto: 'Normal.' }, eco: { hallazgo: 'normal', texto: 'Normal.' }, tac: { zona: 'craneo', hallazgo: 'normal', texto: 'Normal.' } },
    trat: { accion: 'casa', prio: 'baja', med: [], evitar: ['baja', 'opioide', 'benzodiacepina', 'antibiotico', 'vacaciones'], buena: ['placebo', 'agua', 'ejercicio', 'nada'] },
    noticia: 'leve',
  },
];
export const ENF = Object.fromEntries(ENFERMEDADES.map(e => [e.id, e]));

// ───────────────────────── Recetario ─────────────────────────
const MED = `Paracetamol 1 g|analgesico,antitermico,paracetamol
Paracetamol 650 mg|analgesico,antitermico,paracetamol
Ibuprofeno 600 mg|aine,analgesico,antitermico,antiinflamatorio
Ibuprofeno 400 mg|aine,analgesico,antitermico,antiinflamatorio
Dexketoprofeno (Enantyum) 25 mg|aine,analgesico,antiinflamatorio
Naproxeno 550 mg|aine,analgesico,antiinflamatorio
Diclofenaco (Voltarén) 50 mg|aine,analgesico,antiinflamatorio
Metamizol (Nolotil) 575 mg|analgesico,antitermico,espasmolitico
Aspirina 500 mg|aine,analgesico,antitermico,antiagregante
Ácido acetilsalicílico (Adiro) 100 mg|antiagregante
Clopidogrel 75 mg|antiagregante
Nitroglicerina sublingual (Cafinitrina)|nitrato
Tramadol 50 mg|opioide,analgesico
Morfina|opioide,analgesico
Codeína|opioide,antitusivo
Amoxicilina 500 mg|antibiotico,penicilina
Amoxicilina/clavulánico 875/125 mg|antibiotico,penicilina
Penicilina V oral|antibiotico,penicilina
Azitromicina 500 mg|antibiotico
Claritromicina 500 mg|antibiotico
Ciprofloxacino 500 mg|antibiotico,quinolona
Levofloxacino 500 mg|antibiotico,quinolona
Cefuroxima 500 mg|antibiotico,cefalosporina
Ceftriaxona intravenosa|antibiotico,cefalosporina,iv
Fosfomicina 3 g (Monurol)|antibiotico_urinario
Nitrofurantoína|antibiotico_urinario
Metronidazol|antibiotico,disulfiram
Cloxacilina|antibiotico,penicilina
Mupirocina pomada|antibiotico_topico
Gotas óticas antibióticas|antibiotico_topico,agua_oido
Omeprazol 20 mg|ibp
Pantoprazol 40 mg|ibp
Esomeprazol 40 mg|ibp
Almax (almagato)|antiacido
Bicarbonato|antiacido
Metoclopramida (Primperan)|antiemetico
Ondansetrón|antiemetico
Domperidona|antiemetico
Loperamida (Fortasec)|antidiarreico
Racecadotrilo (Tiorfan)|antidiarreico
Suero oral (Sueroral)|suero,liquido
Sueroterapia intravenosa|suero,iv
Butilescopolamina (Buscapina)|espasmolitico
Lactulosa (Duphalac)|laxante
Plantago ovata|laxante,fibra
Probióticos|probiotico
Loratadina 10 mg|antihistaminico
Cetirizina 10 mg|antihistaminico
Ebastina 20 mg|antihistaminico
Dexclorfeniramina (Polaramine)|antihistaminico
Prednisona 30 mg|corticoide
Metilprednisolona (Urbason) intravenosa|corticoide,iv
Hidrocortisona crema|corticoide_topico
Adrenalina intramuscular|adrenalina
Salbutamol inhalador (Ventolin)|broncodilatador
Budesonida inhalada|corticoide_inhalado
Bromuro de ipratropio|broncodilatador
Acetilcisteína (Fluimucil)|mucolitico
Ambroxol (Mucosan)|mucolitico
Dextrometorfano (Romilar) jarabe|antitusivo
Lorazepam 1 mg|benzodiacepina,ansiolitico
Diazepam 5 mg (Valium)|benzodiacepina,ansiolitico,relajante
Alprazolam (Trankimazin)|benzodiacepina,ansiolitico
Sertralina 50 mg|antidepresivo
Escitalopram 10 mg|antidepresivo
Zolpidem (Stilnox)|hipnotico
Melatonina|hipnotico_suave,sueno
Valeriana|ansiolitico_suave
Enalapril 10 mg|antihipertensivo
Losartán 50 mg|antihipertensivo
Amlodipino 5 mg|antihipertensivo
Hidroclorotiazida 25 mg|antihipertensivo,diuretico
Furosemida (Seguril)|diuretico
Bisoprolol 5 mg|antihipertensivo,betabloqueante
Atorvastatina 20 mg|estatina
Simvastatina 20 mg|estatina
Metformina 850 mg|antidiabetico
Insulina glargina|insulina,antidiabetico
Insulina rápida|insulina,antidiabetico
Sitagliptina|antidiabetico
Levotiroxina (Eutirox)|tiroides
Sulfato ferroso (Ferro Sanol)|hierro_med
Ácido fólico|folico
Vitamina B12|b12
Vitamina D|vitd
Vitamina C efervescente|vitc
Sumatriptán 50 mg|triptan
Rizatriptán (Maxalt)|triptan
Ciclobenzaprina (Yurelax)|relajante
Tamsulosina|alfabloqueante
Enoxaparina (Clexane)|anticoagulante
Acenocumarol (Sintrom)|anticoagulante
Apixabán (Eliquis)|anticoagulante
Digoxina|antiarritmico
Amiodarona|antiarritmico
Atropina|atropina
Oxígeno en gafas nasales|oxigeno
Quimioterapia|quimio
Radioterapia|radio
Aciclovir|antiviral
Oseltamivir (Tamiflu)|antiviral
Clotrimazol crema|antifungico
Fluconazol|antifungico
Povidona yodada (Betadine)|antiseptico
Clorhexidina|antiseptico
Agua oxigenada|antiseptico
Suero fisiológico para lavados|lavado
Lágrimas artificiales|colirio
Pastillas para la garganta|garganta_suave
Sildenafilo (Viagra)|sildenafilo
Parches de nicotina|nicotina,antitabaco
Vareniclina (Champix)|antitabaco
Placebo (pastilla de azúcar)|placebo
Betahistina (Serc)|antivertiginoso
Dimenhidrinato (Biodramina)|antiemetico,antivertiginoso
Vacuna de la gripe|vacuna
Vacuna del tétanos|vacuna,antitetanica`;

const OTROS = `Reposo relativo|reposo
Reposo absoluto en cama|reposo,reposo_absoluto
Dieta absoluta (nada por boca)|ayuno
Hielo local 20 minutos|hielo
Calor local (manta eléctrica)|calor
Escayola (yeso)|inmovilizacion
Férula|inmovilizacion
Vendaje compresivo|vendaje,inmovilizacion_suave
Muletas|muletas
Fisioterapia|fisio
Pasear 30 minutos al día|ejercicio
Ir al gimnasio|ejercicio
Correr una maratón|ejercicio
Dejar de fumar|antitabaco
Dormir 8 horas|sueno
Siesta después de comer|sueno
Baja laboral|baja
Vacaciones en la playa|vacaciones
Gárgaras de agua con sal|gargaras
Vahos de eucalipto|vahos
Habitación a oscuras y en silencio|oscuridad
Psicoterapia|psico
Meditación y respiración|relajacion
Yoga|relajacion,ejercicio
Tabaco|tabaco
Puro habano|tabaco
Ver la tele en el sofá|nada
Rezar a San Froilán|nada
Ir de procesiones|nada,ejercicio
Jugar al mus en el bar|nada
Bañarse en el río Bernesga|frio
Tumbarse al sol|nada`;

const COMIDA = `Cocido leonés|grasa,sal,contundente,proteina,legumbre,embutido
Cocido maragato|grasa,sal,contundente,proteina,legumbre,embutido
Sopa del cocido|caldo,liquido,sal
Callos a la madrileña|grasa,picante,contundente,sal
Callos con garbanzos|grasa,contundente,legumbre,sal
Botillo del Bierzo|grasa,sal,contundente,embutido
Cecina de León|embutido,sal,proteina,hierro,carne_roja
Morcilla de León|embutido,grasa,hierro,sal
Chorizo de León|embutido,grasa,sal,picante
Salchichón|embutido,grasa,sal
Lomo embuchado|embutido,sal,proteina
Jamón serrano|embutido,sal,proteina,hierro
Jamón ibérico de bellota|embutido,sal,proteina,hierro
Jamón de York|proteina,blanda
Pechuga de pavo|blanda,proteina
Lacón con grelos|grasa,sal,contundente,verdura
Fabada asturiana|grasa,legumbre,contundente,sal,embutido
Lentejas con chorizo|legumbre,hierro,grasa,embutido
Lentejas estofadas con verduras|legumbre,hierro,fibra,verdura
Garbanzos con espinacas|legumbre,fibra,hierro,verdura
Alubias de La Bañeza|legumbre,fibra,hierro
Judías verdes|verdura,fibra,blanda
Ensalada|verdura,fibra
Espinacas|verdura,hierro,fibra
Pimientos asados del Bierzo|verdura
Sopa de ajo|caldo,liquido,sal
Caldo de pollo|caldo,liquido,blanda,sal
Consomé|caldo,liquido
Sopa de fideos|caldo,blanda,liquido
Arroz blanco|blanda,astringente
Arroz con leche|azucar,lacteo,dulce
Paella de marisco|contundente,marisco
Pollo hervido|blanda,proteina
Pollo asado|proteina
Pollo frito|frito,grasa,proteina
Tortilla de patatas|grasa,proteina
Huevo cocido|proteina
Huevos fritos con chorizo|frito,grasa,embutido
Patatas cocidas|blanda
Patatas fritas|frito,grasa,sal
Puré de patatas|blanda
Puré de verduras|blanda,verdura
Pan|carbohidrato
Pan tostado|blanda,astringente
Manzana|fruta,fibra
Manzana asada|blanda,fruta,astringente
Plátano|fruta,blanda,potasio
Naranja|fruta,vitc
Kiwi|fruta,vitc,fibra
Limón|vitc,limon
Fresas|fruta,vitc
Cerezas del Bierzo|fruta
Arándanos|fruta,arandano
Yogur natural|lacteo,probiotico,blanda
Leche|lacteo
Queso de Valdeón|lacteo,grasa,sal
Queso manchego|lacteo,grasa,sal
Mantecadas de Astorga|azucar,dulce,grasa
Nicanores de Boñar|azucar,dulce
Hojaldres de Astorga|azucar,dulce,grasa
Chocolate|azucar,dulce
Churros con chocolate|frito,azucar,grasa,dulce
Torrijas|azucar,dulce,frito
Bollería industrial|azucar,dulce,grasa
Helado|azucar,dulce,frio,lacteo,helado
Miel|azucar,dulce,miel
Gominolas|azucar,dulce
Hamburguesa|grasa,proteina
Pizza|grasa,sal
Kebab|grasa,picante
Guindillas|picante
Pimientos de Padrón|verdura,picante
Ajo crudo|ajo
Filete de ternera|proteina,hierro,carne_roja
Chuletón de buey|proteina,hierro,carne_roja,grasa
Hígado encebollado|hierro,proteina,carne_roja
Cordero asado|grasa,proteina,carne_roja
Lechazo asado|grasa,proteina,carne_roja
Cochinillo asado|grasa,proteina
Conejo al ajillo|proteina
Ancas de rana|proteina
Merluza cocida|pescado,blanda,proteina
Merluza a la romana|pescado,frito
Bacalao al ajoarriero|pescado,sal
Trucha a la leonesa|pescado,proteina
Sardinas asadas|pescado,proteina
Salmón a la plancha|pescado,proteina
Atún|pescado,proteina
Boquerones en vinagre|pescado,crudo,acido
Rodaballo|pescado,blanda,proteina
Lenguado a la plancha|pescado,blanda,proteina
Sushi|pescado,crudo
Pulpo a la gallega|marisco,picante
Mejillones|marisco,hierro
Berberechos|marisco,hierro
Almejas a la marinera|marisco,hierro
Gambas al ajillo|marisco,picante
Langostinos|marisco
Centollo|marisco
Nécoras|marisco
Percebes|marisco
Bogavante|marisco
Langosta|marisco
Ostras|marisco,crudo
Calamares fritos|marisco,frito
Mariscada completa|marisco,contundente
Sepia a la plancha|marisco
Zamburiñas|marisco`;

const BEBIDA = `Agua|liquido,agua
Agua con gas|liquido,agua
Agua de Vichy|liquido,agua
Suero casero (agua, sal, azúcar y limón)|suero,liquido
Limonada alcalina|suero,liquido
Infusión de manzanilla|infusion,liquido,digestiva
Tila|infusion,liquido,relajante_suave
Poleo menta|infusion,liquido,digestiva
Té verde|infusion,cafeina,liquido
Café solo|cafeina,liquido
Café con leche|cafeina,lacteo,liquido
Descafeinado|liquido
Leche caliente con miel|lacteo,miel,liquido
Zumo de naranja natural|vitc,fruta,liquido,acido
Zumo de arándanos|arandano,liquido
Taza de caldo|caldo,liquido
Coca-Cola|refresco,azucar,cafeina
Coca-Cola Zero|refresco,cafeina
Fanta de naranja|refresco,azucar
Fanta de limón|refresco,azucar
Kas de manzana|refresco,azucar
Gaseosa|refresco
Aquarius|isotonica,liquido,azucar
Red Bull|cafeina,azucar,energetica
Batido de chocolate|lacteo,azucar
Horchata|azucar,liquido
Vino tinto del Bierzo|alcohol,vino
Vino Prieto Picudo|alcohol,vino
Vino blanco|alcohol,vino
Vino rosado|alcohol,vino
Clarete|alcohol,vino
Cava|alcohol,vino
Champán|alcohol,vino
Cerveza|alcohol,cerveza
Caña de cerveza|alcohol,cerveza
Cerveza sin alcohol|cerveza_sin,liquido
Sidra|alcohol
Vermut|alcohol
Sangría|alcohol,azucar
Tinto de verano|alcohol,azucar
Calimocho|alcohol,azucar,refresco
Orujo blanco|alcohol,alcohol_fuerte
Orujo de hierbas|alcohol,alcohol_fuerte
Licor café|alcohol,alcohol_fuerte,cafeina
Queimada|alcohol,alcohol_fuerte
Coñac|alcohol,alcohol_fuerte
Brandy|alcohol,alcohol_fuerte
Ron|alcohol,alcohol_fuerte
Cubata de ron con Coca-Cola|alcohol,alcohol_fuerte,azucar,cafeina
Whisky|alcohol,alcohol_fuerte
Gin-tonic|alcohol,alcohol_fuerte
Vodka|alcohol,alcohol_fuerte
Tequila|alcohol,alcohol_fuerte
Anís del Mono|alcohol,alcohol_fuerte
Pacharán|alcohol,alcohol_fuerte
Licor de hierbas|alcohol,alcohol_fuerte
Carajillo|alcohol,alcohol_fuerte,cafeina
Ponche Caballero|alcohol,alcohol_fuerte
Chupito de Jägermeister|alcohol,alcohol_fuerte
Absenta|alcohol,alcohol_fuerte`;

const parse = (txt, cat) => txt.split('\n').map(l => { const [n, t] = l.split('|'); const tags = t.split(','); if (cat === 'comida') tags.push('comida'); if (cat === 'bebida' && !tags.includes('agua') && !tags.includes('suero')) tags.push('bebida'); return { n, cat, tags }; });
export const RECETARIO = [...parse(MED, 'med'), ...parse(OTROS, 'otro'), ...parse(COMIDA, 'comida'), ...parse(BEBIDA, 'bebida')];
export const CAT_NOMBRE = { med: 'Medicamento', otro: 'Indicación', comida: 'Comida', bebida: 'Bebida' };

// Si el médico escribe algo que no está en el recetario, se le intenta adivinar la naturaleza.
const PISTAS = [
  [/orujo|cona?c|brandy|\bron\b|whisky|vodka|ginebra|gin|tequila|anis|pacharan|licor|chupito|absenta|aguardiente|cubata|queimada|carajillo|mezcal|grappa|ratafia/, 'bebida', ['alcohol', 'alcohol_fuerte']],
  [/vino|cerveza|cana\b|sidra|vermu|sangria|calimocho|cava|champ|tinto|clarete|mosto|birra/, 'bebida', ['alcohol']],
  [/cola|fanta|refresco|kas\b|sprite|seven|7up|gaseosa|nestea|tonica|pepsi/, 'bebida', ['refresco', 'azucar']],
  [/cafe|te\b|red ?bull|monster|energet/, 'bebida', ['cafeina']],
  [/agua/, 'bebida', ['agua', 'liquido']],
  [/zumo|batido|leche|infusion|manzanilla|tila|poleo/, 'bebida', ['liquido']],
  [/marisco|gamba|langost|cigala|centollo|necora|percebe|bogavante|ostra|mejillon|almeja|berberecho|pulpo|calamar|sepia|chipiron|navaja|vieira|zamburi|cangrejo|bueyes/, 'comida', ['marisco']],
  [/merluza|bacalao|trucha|sardina|salmon|atun|bonito|boqueron|anchoa|rodaballo|lenguado|dorada|lubina|besugo|rape|pescado|sushi|caballa|pez/, 'comida', ['pescado', 'proteina']],
  [/chorizo|salchichon|morcilla|cecina|jamon|lomo|embutido|botillo|fuet|sobrasada|mortadela|salami|panceta|tocino|chistorra/, 'comida', ['embutido', 'grasa', 'sal']],
  [/cocido|callos|fabada|lacon|olla|potaje|guiso|estofado/, 'comida', ['contundente', 'grasa']],
  [/frit|rebozad|empanad|croqueta|churro|porra|bravas/, 'comida', ['frito', 'grasa']],
  [/pastel|tarta|dulce|bollo|magdalena|galleta|mantecad|chocolate|caramelo|azucar|helado|flan|natillas|donut|croissant|turron|polvoron|rosquilla|bizcocho/, 'comida', ['azucar', 'dulce']],
  [/lenteja|garbanzo|alubia|judion|frijol|legumbre/, 'comida', ['legumbre', 'fibra']],
  [/ternera|buey|vaca|chuleton|filete|entrecot|solomillo|cordero|lechazo|cabrito|higado/, 'comida', ['proteina', 'carne_roja', 'hierro']],
  [/pollo|pavo|conejo|cerdo|cochinillo|carne|hamburguesa|albondiga/, 'comida', ['proteina']],
  [/ensalada|verdura|lechuga|tomate|pimiento|espinaca|acelga|brocoli|coliflor|zanahoria|calabac|berenjena|judia verde|puerro|cebolla/, 'comida', ['verdura', 'fibra']],
  [/manzana|pera|platano|naranja|mandarina|kiwi|fresa|uva|melon|sandia|cereza|melocoton|pina|mango|fruta|limon|arandano/, 'comida', ['fruta', 'vitc']],
  [/arroz|pasta|macarron|espagueti|fideo|pan|patata|pure|sopa|caldo/, 'comida', ['blanda']],
  [/queso|yogur|natillas|cuajada|lacteo/, 'comida', ['lacteo']],
  [/picante|guindilla|chile|wasabi|curry|tabasco/, 'comida', ['picante']],
  [/pizza|kebab|burger|perrito|nachos|patatas fritas/, 'comida', ['grasa', 'sal']],
  [/cilina|micina|floxacino|cef|penicilina|antibiotic/, 'med', ['antibiotico']],
  [/prazol/, 'med', ['ibp']],
  [/profeno|fenaco|xeno|aine|antiinflamatorio/, 'med', ['aine', 'analgesico']],
  [/paracetamol|gelocatil|efferalgan|dolocatil|termalgin/, 'med', ['analgesico', 'antitermico', 'paracetamol']],
  [/pam\b|zepam|zolam|ansiolitico|tranquilizante/, 'med', ['benzodiacepina', 'ansiolitico']],
  [/pril\b|sartan|dipino|tension/, 'med', ['antihipertensivo']],
  [/insulina|metformina|gliptina|glifozina|diabet/, 'med', ['antidiabetico']],
  [/morfina|fentanilo|tramadol|oxicodona|opio/, 'med', ['opioide', 'analgesico']],
  [/tadina|cetirizina|loratadina|alergia|antihistam/, 'med', ['antihistaminico']],
  [/sona\b|solona|cortico|urbason/, 'med', ['corticoide']],
  [/hierro|ferro/, 'med', ['hierro_med']],
  [/vitamina/, 'med', ['vitamina']],
  [/suero/, 'med', ['suero']],
  [/hielo|frio/, 'otro', ['hielo']],
  [/reposo|descanso|cama|dormir|sueno|siesta/, 'otro', ['reposo', 'sueno']],
  [/escayola|yeso|ferula|vendaje|inmoviliz/, 'otro', ['inmovilizacion']],
  [/deporte|gimnasio|correr|andar|caminar|pasear|nadar|ejercicio|bici/, 'otro', ['ejercicio']],
  [/tabaco|cigarr|puro|fumar|porro/, 'otro', ['tabaco']],
];
export function itemLibre(texto) {
  const t = normaliza(texto);
  for (const [re, cat, tags] of PISTAS) if (re.test(t)) return { n: texto.trim(), cat, tags: [...tags, ...(cat === 'comida' ? ['comida'] : cat === 'bebida' && !tags.includes('agua') ? ['bebida'] : [])], libre: true };
  return { n: texto.trim(), cat: 'otro', tags: ['desconocido'], libre: true };
}
export function buscarReceta(q, limite = 12) {
  const t = normaliza(q);
  if (!t) return [];
  const palabras = t.split(/\s+/);
  const res = [];
  for (const it of RECETARIO) {
    const n = normaliza(it.n);
    if (palabras.every(p => n.includes(p))) res.push({ it, s: n.startsWith(t) ? 0 : n.split(/[\s(]/).some(w => w.startsWith(palabras[0])) ? 1 : 2 });
  }
  return res.sort((a, b) => a.s - b.s || a.it.n.length - b.it.n.length).slice(0, limite).map(r => r.it);
}
export const PAUTAS = ['1 cada 8 horas', '1 cada 12 horas', '1 al día', 'Cada 6 horas', 'En cada comida', 'Solo si hay dolor', 'Una vez', 'A todas horas', 'Por la noche', 'En ayunas'];
export const DURACIONES = ['1 día', '3 días', '5 días', '7 días', '10 días', '1 mes', 'Para siempre'];

// ───────────────────────── Frases ─────────────────────────
export const CUESTIONAN = [
  'Pues mi cuñado, que ve muchos documentales, dice que lo mío es otra cosa.',
  'He mirado en internet y dice que puede ser cáncer, doctor.',
  '¿Usted no es un poco joven para ser médico?',
  'El médico de antes me daba unas pastillas rosas que me iban muy bien.',
  'La vecina del quinto tuvo lo mismo y le dieron un jarabe.',
  'Oiga, ¿y usted está seguro de lo que hace?',
  'En la tele dijeron que eso se cura con miel y limón.',
  'Mi madre dice que todo esto es del frío de León.',
];
export const RESPUESTAS_AUTORIDAD = [
  ['Entiendo su preocupación, pero confíe en mí: le estoy examinando con cuidado.', 1],
  ['Internet no le ha hecho la exploración. Yo sí.', 0],
  ['Aquí el médico soy yo.', -1],
];

export function fmt(t, pac) {
  return t.replace(/\{o\}/g, pac.sexo === 'm' ? 'a' : 'o');
}

// ───────────────────────── Generador de pacientes ─────────────────────────
const PIELES = ['#f1c7a8', '#e8b48f', '#d9a07a', '#c58c62', '#a86f4c', '#8a5638', '#6b3f28', '#f3d1b7'];
const PELOS = ['#1f1611', '#3a2617', '#5b3a22', '#8a5a2b', '#b98b55', '#d8c08a', '#7c7c7c', '#bdbdbd', '#e6e6e6', '#6b2b18'];
let contadorId = 1;

export function generarPaciente({ dia = 1, rep = 50, equipos = {}, forzar = null } = {}) {
  let pool = ENFERMEDADES.filter(e => (dia >= 2 || e.grav <= 3) && (equipos.quirofano2 || e.grav < 5 || dia >= 3));
  let enf = forzar ? ENF[forzar] : null;
  if (!enf) {
    const tot = pool.reduce((s, e) => s + e.peso, 0);
    let r = Math.random() * tot;
    for (const e of pool) { r -= e.peso; if (r <= 0) { enf = e; break; } }
    enf = enf || pool[0];
  }
  const sexo = enf.sexo === 'a' ? (prob(0.5) ? 'h' : 'm') : enf.sexo;
  const edad = entreInt(enf.edad[0], enf.edad[1]);
  const nombre = azar(sexo === 'h' ? NOMBRES_H : NOMBRES_M);
  const apellidos = `${azar(APELLIDOS)} ${azar(APELLIDOS)}`;
  const viejo = edad > 62;
  const ex = enf.expl;
  const vit = {
    temp: +entre(ex.temp[0], ex.temp[1]).toFixed(1),
    tas: entreInt(ex.tas[0], ex.tas[1]), tad: entreInt(ex.tad[0], ex.tad[1]),
    fc: entreInt(ex.fc[0], ex.fc[1]), sat: entreInt(ex.sat[0], ex.sat[1]),
    fr: enf.id === 'neumonia' ? entreInt(22, 28) : enf.id === 'ansiedad' ? entreInt(24, 30) : entreInt(13, 18),
  };
  // Analítica: valores normales + los propios de la enfermedad
  const sangre = {};
  for (const p of SANGRE) {
    const o = enf.pruebas.sangre[p.k];
    let r = o || p.r;
    if (!o && p.k === 'hb' && sexo === 'm') r = [13.1, 15];
    if (!o && p.k === 'oh') r = [0, 0];
    if (!o && p.k === 'trop') r = [0.0, 0.02];
    if (!o && p.k === 'pcr') r = [0.4, 4];
    const pad = o ? 0 : (r[1] - r[0]) * 0.15;
    sangre[p.k] = +entre(r[0] + pad, r[1] - pad).toFixed(p.d);
  }
  const orina = {};
  for (const p of ORINA) orina[p.k] = enf.pruebas.orina[p.k] || 'Negativo';

  const antecedentes = [];
  if (enf.id === 'hipertension' || (viejo && prob(0.4))) antecedentes.push('Hipertensión');
  if (enf.id === 'cancer_pulmon') antecedentes.push('Dolor de espalda', 'Dolores de cabeza', 'Enfermedad pulmonar');
  if (enf.id === 'colico_renal' && prob(0.6)) antecedentes.push('Cálculos renales');
  if (enf.id === 'migrana') antecedentes.push('Dolores de cabeza');
  if (enf.id === 'ansiedad' && prob(0.6)) antecedentes.push('Depresión');
  if (enf.id === 'ulcera' && prob(0.5)) antecedentes.push('Úlcera');
  if (enf.id === 'lumbalgia' || prob(0.15)) antecedentes.push('Dolor de espalda');
  if (prob(0.08)) antecedentes.push('Asma');
  if (viejo && prob(0.2)) antecedentes.push('Diabetes');
  if (viejo && prob(0.12)) antecedentes.push('Cardiopatía');

  const fumador = enf.id === 'cancer_pulmon' || prob(0.25);
  const bebedor = ['ulcera', 'resaca'].includes(enf.id) || prob(0.2);
  const alergia = prob(0.18) ? azar(['penicilina', 'penicilina', 'aine', 'marisco']) : (enf.id === 'alergia' ? 'marisco' : null);
  const acompanante = enf.secreto && enf.secreto.v >= 2 && prob(0.75) ? azar(sexo === 'h' ? ['su mujer', 'su hija', 'su madre'] : ['su marido', 'su hija', 'su madre']) : (prob(0.2) ? azar(['su hijo', 'su hermana', 'un amigo']) : null);

  const apariencia = {
    sexo, edad,
    piel: azar(PIELES),
    pelo: viejo ? azar(['#7c7c7c', '#bdbdbd', '#e6e6e6', '#9a9a9a']) : azar(PELOS.slice(0, 6).concat(['#6b2b18'])),
    estilo: sexo === 'h' ? (viejo && prob(0.5) ? 0 : azar([1, 1, 2, 3])) : azar([3, 4, 5, 6, 7]),
    barba: sexo === 'h' && prob(0.4) ? entreInt(1, 5) : 0,
    gafas: prob(viejo ? 0.5 : 0.15) ? entreInt(1, 3) : 0,
    ojos: azar(['#4a2e1a', '#4a2e1a', '#2b1a10', '#3d6a8a', '#4f6b3a', '#6b6f73']),
    cara: entre(0.94, 1.06), nariz: entre(0.85, 1.2),
    complexion: entre(0.92, 1.18),
    altura: sexo === 'h' ? entre(0.98, 1.06) : entre(0.92, 0.99),
    palido: ['anemia', 'infarto', 'cancer_pulmon'].includes(enf.id),
  };
  const voz = { tono: (sexo === 'h' ? 0.85 : 1.15) * (viejo ? 0.92 : 1) + entre(-0.08, 0.08), vel: (viejo ? 0.9 : 1.02) + entre(-0.05, 0.08) };
  const pac = {
    id: contadorId++, nombre, apellidos, sexo, edad, enfId: enf.id,
    direccion: `${azar(CALLES)} ${entreInt(1, 60)}, ${azar(PUEBLOS)}`,
    seguro: `SACYL ${String(entreInt(100000, 999999))}-${String.fromCharCode(65 + entreInt(0, 25))}${String.fromCharCode(65 + entreInt(0, 25))}`,
    vit, sangre, orina, antecedentes, fumador, bebedor, alergia, acompanante,
    apariencia, voz,
    confianza: acompanante ? 0 : 1,
    secretoRevelado: false, hallazgos: [], pruebas: {}, preguntas: {},
    tomoViagra: enf.id === 'infarto' && prob(0.5),
    cuestiona: prob(0.35) ? azar(CUESTIONAN) : null,
    motivoEscrito: fmt(azar(enf.motivo), { sexo }),
  };
  return pac;
}

// Frases de hábitos generadas a partir del paciente (la enfermedad puede mentir)
export function fraseHabitos(pac) {
  const e = ENF[pac.enfId];
  if (e.d.habitosMentira && !pac.secretoRevelado) return azar(e.d.habitosMentira);
  const f = pac.fumador ? azar(['Fumo, sí, unos diez cigarrillos al día.', 'Fumo medio paquete al día. Ya sé que debería dejarlo.']) : azar(['No fumo, nunca he fumado.', 'Fumar no. Lo dejé hace años.']);
  const b = pac.bebedor ? azar(['Y bebo... un vino en cada comida y alguna caña.', 'Alcohol, los fines de semana bastante.']) : azar(['Alcohol, muy poco. En las fiestas.', 'No bebo casi nada.']);
  const c = azar(['Como de todo: mucha legumbre, cocido los domingos...', 'Como bastante embutido, la verdad.', 'Intento comer sano, pescado y verdura.', 'Como en el bar casi todos los días.']);
  return `${f} ${b} ${c}`;
}
export function fraseAntecedentes(pac) {
  if (!pac.antecedentes.length) return azar(['No, estoy sano como un roble. No tomo nada.', 'Nada, doctor. Ni una pastilla.']);
  return `Pues tengo ${pac.antecedentes.map(a => a.toLowerCase()).join(', ').replace(/, ([^,]*)$/, ' y $1')}. ${azar(['Tomo las pastillas que me mandó el médico de cabecera.', 'Para eso tomo mi medicación.', 'Pero lo llevo bien.'])}`;
}
export function fraseAlergia(pac) {
  if (!pac.alergia) return azar(['No, que yo sepa no soy alérgico a nada.', 'A nada, doctor.']).replace('alérgico', pac.sexo === 'm' ? 'alérgica' : 'alérgico');
  return { penicilina: 'Sí, a la penicilina. Una vez me puse hinchad{o} como un globo.', aine: 'Sí, el ibuprofeno y esas cosas me sientan fatal, me salen ronchas.', marisco: 'Al marisco. Bueno... eso dicen, pero a mí me encanta.' }[pac.alergia];
}

// ───────────────────────── Evaluación del tratamiento ─────────────────────────
// plan: { diag, accion, prio, cir, receta:[{n,cat,tags,pauta,dur}] }
export function evaluarTratamiento(pac, plan) {
  const e = ENF[pac.enfId], t = e.trat;
  const notas = [];
  let q = 0;
  const diagOk = plan.diag === e.id;
  if (diagOk) { q += 40; notas.push(['bien', 'Diagnóstico correcto.']); } else notas.push(['mal', `Diagnóstico incorrecto. Era: ${e.n}.`]);

  let accionOk = plan.accion === t.accion;
  if (accionOk && t.accion === 'cirugia' && plan.cir !== t.cir) accionOk = false;
  if (!accionOk && e.id === 'fractura_muneca' && plan.accion === 'cirugia' && plan.cir === 'osteosintesis') accionOk = true;
  if (accionOk) { q += 20; notas.push(['bien', 'Decisión correcta sobre el paciente.']); }
  else if (e.id === 'colico_renal' && plan.accion === 'hospitalizar') { q += 12; notas.push(['medio', 'Ingresar un cólico renal no hacía falta, pero no es grave.']); }
  else if (t.accion === 'casa' && plan.accion === 'hospitalizar') { q += 8; notas.push(['medio', 'Ha ingresado a un paciente que podía irse a casa (cama ocupada sin necesidad).']); }
  else notas.push(['mal', `Lo correcto era: ${t.accion === 'casa' ? 'mandar a casa' : t.accion === 'hospitalizar' ? 'hospitalizar' : 'operar (' + CIRUGIAS[t.cir].n + ')'}.`]);

  if (plan.prio === t.prio) q += 3;

  const tags = new Set(plan.receta.flatMap(r => r.tags));
  // Medicación necesaria
  if (t.med.length) {
    const ok = t.med.filter(g => g.some(x => tags.has(x))).length;
    q += Math.round(25 * ok / t.med.length);
    if (ok === t.med.length) notas.push(['bien', 'La medicación es la adecuada.']);
    else notas.push(['mal', `Faltaba en la receta: ${t.med.filter(g => !g.some(x => tags.has(x))).map(g => nombreTag(g[0])).join(', ')}.`]);
  } else {
    q += plan.receta.some(r => r.cat === 'med' && !r.tags.includes('placebo') && !t.buena.some(b => r.tags.includes(b))) ? 15 : 25;
  }
  // Cosas a evitar
  const malos = plan.receta.filter(r => r.tags.some(x => t.evitar.includes(x)));
  for (const r of malos.slice(0, 4)) notas.push(['mal', `«${r.n}» no le conviene a este paciente.`]);
  q -= Math.min(35, malos.length * 9);
  const buenos = plan.receta.filter(r => r.tags.some(x => t.buena.includes(x)));
  if (buenos.length) { q += Math.min(8, buenos.length * 3); notas.push(['bien', `Buenas recomendaciones: ${buenos.slice(0, 3).map(r => r.n).join(', ')}.`]); }

  let peligro = 0;
  const alcohol = plan.receta.filter(r => r.tags.includes('alcohol'));
  if (pac.alergia === 'penicilina' && tags.has('penicilina')) { peligro = Math.max(peligro, 2); notas.push(['mal', '¡Era alérgic' + (pac.sexo === 'm' ? 'a' : 'o') + ' a la penicilina! Reacción alérgica.']); q -= 30; }
  if (pac.alergia === 'aine' && tags.has('aine')) { peligro = Math.max(peligro, 1); notas.push(['mal', 'Era alérgico a los antiinflamatorios: le salieron ronchas.']); q -= 15; }
  if (pac.alergia === 'marisco' && tags.has('marisco')) { peligro = Math.max(peligro, e.id === 'alergia' ? 3 : 2); notas.push(['mal', '¡Le recetó marisco a un alérgico al marisco! Shock anafiláctico.']); q -= 40; }
  if (tags.has('nitrato') && tags.has('sildenafilo')) { peligro = 3; notas.push(['mal', '¡Nitroglicerina con Viagra! Bajada brutal de tensión.']); q -= 40; }
  if (pac.tomoViagra && tags.has('nitrato') && !tags.has('sildenafilo')) { peligro = Math.max(peligro, 2); notas.push(['mal', 'Había tomado Viagra la noche anterior: la nitroglicerina le provocó una bajada de tensión grave.']); q -= 25; }
  if (tags.has('benzodiacepina') && alcohol.length) { peligro = Math.max(peligro, 2); notas.push(['mal', 'Tranquilizantes con alcohol: depresión respiratoria.']); q -= 20; }
  if (tags.has('disulfiram') && alcohol.length) { peligro = Math.max(peligro, 1); notas.push(['mal', 'Metronidazol con alcohol: efecto antabús, vómitos y sofocos.']); q -= 12; }
  if (tags.has('anticoagulante') && tags.has('aine')) { peligro = Math.max(peligro, 1); notas.push(['mal', 'Anticoagulante con antiinflamatorio: riesgo de hemorragia.']); q -= 10; }
  const fuertes = plan.receta.filter(r => r.tags.includes('alcohol_fuerte') && /todas horas|6 horas|cada 8|cada comida/i.test(r.pauta || ''));
  if (fuertes.length) { peligro = Math.max(peligro, 1); notas.push(['mal', `«${fuertes[0].n}» ${fuertes[0].pauta.toLowerCase()}... el paciente acabó en Urgencias con una buena cogorza.`]); q -= 10; }
  if (alcohol.length && !malos.some(r => r.tags.includes('alcohol'))) { q -= 4 * Math.min(2, alcohol.length); notas.push(['medio', 'Recetar alcohol nunca es buena idea, aunque esta vez no ha sido grave.']); }
  if (tags.has('tabaco')) { q -= 8; notas.push(['mal', 'Recetar tabaco... el Colegio de Médicos le ha abierto un expediente.']); }
  if (e.simulador) {
    if (diagOk && !plan.receta.some(r => r.tags.includes('baja'))) notas.push(['bien', 'No se ha dejado engañar por el simulador.']);
    if (plan.receta.some(r => r.tags.includes('baja'))) notas.push(['mal', 'Le ha dado la baja a alguien que estaba fingiendo.']);
  }
  q = Math.max(0, Math.min(100, q));
  // Gravedad del error
  let riesgo = 0;
  if (e.grav >= 4 && (!accionOk || !diagOk)) riesgo = (plan.accion === 'casa') ? 0.55 : 0.2;
  if (e.grav === 3 && plan.accion === 'casa' && t.accion !== 'casa') riesgo = 0.25;
  if (peligro === 3) riesgo = Math.max(riesgo, 0.6);
  if (peligro === 2) riesgo = Math.max(riesgo, 0.15);
  return { q, notas, diagOk, accionOk, peligro, riesgo };
}

const NOMBRES_TAG = { suero: 'suero oral / rehidratación', antitermico: 'antitérmico (para la fiebre)', antibiotico: 'antibiótico', analgesico: 'analgésico', antiagregante: 'antiagregante (aspirina)', nitrato: 'nitroglicerina o calmante del dolor', ansiolitico: 'algo para la ansiedad', inmovilizacion: 'inmovilización (escayola/férula)', hielo: 'hielo / vendaje', aine: 'antiinflamatorio', ibp: 'protector de estómago (omeprazol)', antihipertensivo: 'medicación para la tensión', antidiabetico: 'medicación para el azúcar', triptan: 'tratamiento para la migraña', antibiotico_urinario: 'antibiótico urinario', antihistaminico: 'antihistamínico', corticoide: 'corticoide', hierro_med: 'hierro', broncodilatador: 'algo para la tos o los bronquios' };
export const nombreTag = (t) => NOMBRES_TAG[t] || t;

// Reacción del paciente a lo que le recetan
export function reaccionReceta(pac, it) {
  const e = ENF[pac.enfId], t = e.trat;
  const malo = it.tags.some(x => t.evitar.includes(x));
  const bueno = it.tags.some(x => t.buena.includes(x)) || t.med.some(g => g.some(x => it.tags.includes(x)));
  const n = it.n.toLowerCase();
  if (pac.alergia === 'marisco' && it.tags.includes('marisco')) return `¿${it.n}? Doctor... que soy alérgic${pac.sexo === 'm' ? 'a' : 'o'} al marisco.`;
  if (pac.alergia === 'penicilina' && it.tags.includes('penicilina') && pac.preguntas.alergia) return '¿Eso no es penicilina? Le he dicho que soy alérgico...';
  if (it.tags.includes('alcohol_fuerte')) return malo ? azar([`¿${it.n}? ¿Con lo que tengo? Usted quiere matarme, doctor.`, `Hombre, un ${n} nunca viene mal... pero, ¿seguro que con esto?`]) : azar([`¡${it.n}! Esto sí que es un médico como Dios manda.`, `¡Ja! ${it.n}. Se lo pienso contar a todo el pueblo.`]);
  if (it.tags.includes('alcohol')) return malo ? `¿${it.n}? Pues mire, no sé yo si me va a sentar bien...` : azar([`¿${it.n}? Bueno, si lo manda el médico, habrá que obedecer.`, `${it.n}... me gusta esta receta.`]);
  if (it.tags.includes('contundente') || it.tags.includes('embutido')) return malo ? azar([`¿${it.n}? ¿Con cómo tengo el cuerpo? Ni loc${pac.sexo === 'm' ? 'a' : 'o'}.`, `¿${it.n}? Doctor, que no estoy para esos trotes.`]) : `¡${it.n}! Eso me lo hace mi madre como nadie.`;
  if (it.tags.includes('marisco')) return malo ? `¿Marisco? ¿Ahora? No sé yo...` : `¡${it.n}! Pues no me parece mal tratamiento.`;
  if (it.tags.includes('tabaco')) return '¿Tabaco? ¿Un médico recetando tabaco? Esto lo cuento en la radio.';
  if (it.tags.includes('baja')) return e.simulador ? '¡La baja! Gracias, doctor, es usted el mejor.' : 'La baja... bueno, si hace falta.';
  if (it.tags.includes('desconocido')) return `¿${it.n}? No sé ni lo que es, pero si usted lo dice...`;
  if (it.tags.includes('placebo')) return e.simulador ? 'Ah, ¿y esto me va a curar? Bueno...' : '¿Y esto qué es, doctor? Parece un caramelo.';
  if (malo) return azar([`¿${it.n}? ¿Está seguro?`, `Hmm... ${n}... no sé yo, doctor.`]);
  if (bueno) return azar(['Vale, doctor.', 'De acuerdo, lo tomaré.', 'Muy bien, gracias.', 'Apuntado.']);
  return azar(['Bueno...', 'Si usted lo dice...', 'Vale.']);
}
