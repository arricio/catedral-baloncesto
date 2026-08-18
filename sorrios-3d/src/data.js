/* ============================================================================
   SORRÍOS DE ORDÁS 3D — data.js
   Contenido del juego: productos, cultivos, ganado, vecinos y tiendas.
   ========================================================================== */
(function (global) {
  'use strict';
  var S = global.SORRIOS3D;

  var PRIMAVERA = 0, VERANO = 1, OTONO = 2, INVIERNO = 3;

  /* ------------------------------------------------------------- PRODUCTOS */
  // ic: emoji para el inventario (la interfaz es HTML, se ve nítido siempre)
  var ITEMS = {
    // herramientas de mano
    azada:     { n: 'Azada', t: 'tool', ic: '⛏️', d: 'Labra la tierra del huerto.' },
    regadera:  { n: 'Regadera', t: 'tool', ic: '🚿', d: 'Riega lo sembrado. Se llena en el pozo o el río.' },
    cubo:      { n: 'Cubo de ordeñar', t: 'tool', ic: '🪣', d: 'Para ordeñar vacas y ovejas a mano.' },
    hoz:       { n: 'Hoz', t: 'tool', ic: '🌾', d: 'Siega hierba y maleza.' },
    tijeras:   { n: 'Tijeras de esquilar', t: 'tool', ic: '✂️', d: 'Esquila la lana de las ovejas.' },
    hacha:     { n: 'Hacha', t: 'tool', ic: '🪓', d: 'Corta leña.' },
    pala:      { n: 'Pala', t: 'tool', ic: '🥄', d: 'Cava y saca piedras.' },
    rastrillo: { n: 'Rastrillo', t: 'tool', ic: '🧹', d: 'Limpia el huerto.' },

    // semillas
    sem_patata:    { n: 'Patata de siembra', t: 'seed', crop: 'patata', ic: '🥔', buy: 55, sell: 25 },
    sem_lechuga:   { n: 'Semilla de lechuga', t: 'seed', crop: 'lechuga', ic: '🥬', buy: 40, sell: 18 },
    sem_cebolla:   { n: 'Semilla de cebolla', t: 'seed', crop: 'cebolla', ic: '🧅', buy: 45, sell: 20 },
    sem_ajo:       { n: 'Diente de ajo', t: 'seed', crop: 'ajo', ic: '🧄', buy: 42, sell: 19 },
    sem_zanahoria: { n: 'Semilla de zanahoria', t: 'seed', crop: 'zanahoria', ic: '🥕', buy: 44, sell: 20 },
    sem_garbanzo:  { n: 'Garbanzo de siembra', t: 'seed', crop: 'garbanzo', ic: '🫘', buy: 80, sell: 38 },
    sem_alubia:    { n: 'Alubia de siembra', t: 'seed', crop: 'alubia', ic: '🫛', buy: 75, sell: 35 },
    sem_tomate:    { n: 'Semilla de tomate', t: 'seed', crop: 'tomate', ic: '🍅', buy: 78, sell: 36 },
    sem_pimiento:  { n: 'Semilla de pimiento', t: 'seed', crop: 'pimiento', ic: '🫑', buy: 78, sell: 36 },
    sem_calabaza:  { n: 'Semilla de calabaza', t: 'seed', crop: 'calabaza', ic: '🎃', buy: 150, sell: 70 },
    sem_trigo:     { n: 'Trigo de siembra', t: 'seed', crop: 'trigo', ic: '🌾', buy: 30, sell: 14, campo: true },
    sem_cebada:    { n: 'Cebada de siembra', t: 'seed', crop: 'cebada', ic: '🌾', buy: 28, sell: 13, campo: true },
    sem_maiz:      { n: 'Maíz de siembra', t: 'seed', crop: 'maiz', ic: '🌽', buy: 46, sell: 22, campo: true },
    sem_alfalfa:   { n: 'Alfalfa de siembra', t: 'seed', crop: 'alfalfa', ic: '🍀', buy: 34, sell: 16, campo: true },
    sem_berza:     { n: 'Semilla de berza', t: 'seed', crop: 'berza', ic: '🥬', buy: 50, sell: 24 },
    sem_puerro:    { n: 'Semilla de puerro', t: 'seed', crop: 'puerro', ic: '🥒', buy: 55, sell: 26 },

    // cosecha
    patata:    { n: 'Patatas', t: 'crop', ic: '🥔', sell: 68, energy: 18 },
    lechuga:   { n: 'Lechugas', t: 'crop', ic: '🥬', sell: 52, energy: 12 },
    cebolla:   { n: 'Cebollas', t: 'crop', ic: '🧅', sell: 60, energy: 14 },
    ajo:       { n: 'Ajos', t: 'crop', ic: '🧄', sell: 58, energy: 10 },
    zanahoria: { n: 'Zanahorias', t: 'crop', ic: '🥕', sell: 58, energy: 14 },
    garbanzo:  { n: 'Garbanzos', t: 'crop', ic: '🫘', sell: 115, energy: 22 },
    alubia:    { n: 'Alubias', t: 'crop', ic: '🫛', sell: 98, energy: 20 },
    tomate:    { n: 'Tomates', t: 'crop', ic: '🍅', sell: 100, energy: 16 },
    pimiento:  { n: 'Pimientos', t: 'crop', ic: '🫑', sell: 104, energy: 16 },
    calabaza:  { n: 'Calabazas', t: 'crop', ic: '🎃', sell: 240, energy: 30 },
    berza:     { n: 'Berzas', t: 'crop', ic: '🥬', sell: 80, energy: 18 },
    puerro:    { n: 'Puerros', t: 'crop', ic: '🥒', sell: 76, energy: 15 },
    trigo:     { n: 'Trigo', t: 'crop', ic: '🌾', sell: 46, energy: 8, granel: true },
    cebada:    { n: 'Cebada', t: 'crop', ic: '🌾', sell: 42, energy: 8, granel: true },
    maiz:      { n: 'Maíz', t: 'crop', ic: '🌽', sell: 58, energy: 12, granel: true },
    alfalfa:   { n: 'Alfalfa', t: 'crop', ic: '🍀', sell: 38, energy: 6, granel: true },

    // productos del ganado
    leche:       { n: 'Leche de vaca', t: 'prod', ic: '🥛', sell: 125, energy: 25 },
    leche_oveja: { n: 'Leche de oveja', t: 'prod', ic: '🥛', sell: 155, energy: 25 },
    huevo:       { n: 'Huevos', t: 'prod', ic: '🥚', sell: 58, energy: 14 },
    lana:        { n: 'Lana', t: 'prod', ic: '🧶', sell: 185, energy: 0 },
    queso:       { n: 'Queso de la casa', t: 'prod', ic: '🧀', sell: 310, energy: 40 },
    manteca:     { n: 'Manteca', t: 'prod', ic: '🧈', sell: 230, energy: 32 },

    // comida de ultramarinos
    pan:      { n: 'Hogaza de pan', t: 'food', ic: '🍞', buy: 58, sell: 28, energy: 30 },
    chorizo:  { n: 'Chorizo', t: 'food', ic: '🌭', buy: 135, sell: 65, energy: 45 },
    cocido:   { n: 'Cocido maragato', t: 'food', ic: '🍲', buy: 310, sell: 150, energy: 100 },
    sopa:     { n: 'Sopa de ajo', t: 'food', ic: '🥣', buy: 105, sell: 50, energy: 50 },
    empanada: { n: 'Empanada', t: 'food', ic: '🥧', buy: 175, sell: 85, energy: 60 },
    cafe:     { n: 'Café de puchero', t: 'food', ic: '☕', buy: 42, sell: 20, energy: 22 },
    vino:     { n: 'Vino del Bierzo', t: 'food', ic: '🍷', buy: 145, sell: 70, energy: 35 },
    tortilla: { n: 'Tortilla de patata', t: 'food', ic: '🍳', buy: 195, sell: 95, energy: 70 },

    // piensos y materiales
    pienso: { n: 'Pienso', t: 'feed', ic: '🌰', buy: 32, sell: 14 },
    heno:   { n: 'Heno', t: 'feed', ic: '🌿', buy: 22, sell: 10 },
    grano:  { n: 'Grano', t: 'feed', ic: '🌾', buy: 28, sell: 12 },
    abono:  { n: 'Abono', t: 'mat', ic: '💩', buy: 65, sell: 28 },
    lena:   { n: 'Leña', t: 'mat', ic: '🪵', buy: 45, sell: 22 },
    piedra: { n: 'Piedra', t: 'mat', ic: '🪨', buy: 36, sell: 18 },
    flor:   { n: 'Flores del prado', t: 'mat', ic: '🌼', sell: 38 },
    gasoil: { n: 'Gasóleo', t: 'mat', ic: '⛽', buy: 90, sell: 0 },

    // especiales
    ramo:   { n: 'Ramo de flores', t: 'esp', ic: '💐', buy: 850, d: 'Para pedir salir a quien te gusta.' },
    anillo: { n: 'Anillo de pedida', t: 'esp', ic: '💍', buy: 4800, d: 'Para pedir matrimonio a tu novia.' }
  };

  /* --------------------------------------------------------------- CULTIVOS */
  // dias: días de crecimiento total. fases: 4 (brote, crecido, espigado, listo)
  var CROPS = {
    patata:    { n: 'Patata', s: [PRIMAVERA, OTONO], dias: 6, rinde: [2, 4], tipo: 'tuberculo', col: 0x4a8a2e, fruto: 0xc9a163 },
    lechuga:   { n: 'Lechuga', s: [PRIMAVERA], dias: 4, rinde: [1, 2], tipo: 'hoja', col: 0x7fc04a, fruto: 0x8fd058 },
    cebolla:   { n: 'Cebolla', s: [PRIMAVERA, VERANO], dias: 5, rinde: [2, 3], tipo: 'bulbo', col: 0x6aa83a, fruto: 0xe0b47a },
    ajo:       { n: 'Ajo', s: [PRIMAVERA], dias: 4, rinde: [2, 3], tipo: 'bulbo', col: 0x6aa83a, fruto: 0xf0ece0 },
    zanahoria: { n: 'Zanahoria', s: [PRIMAVERA, OTONO], dias: 5, rinde: [2, 3], tipo: 'tuberculo', col: 0x4d9a3a, fruto: 0xe08a3a },
    garbanzo:  { n: 'Garbanzo', s: [VERANO], dias: 8, rinde: [3, 5], tipo: 'mata', col: 0x5f9e3f, fruto: 0xd9c48a },
    alubia:    { n: 'Alubia', s: [VERANO], dias: 7, rinde: [2, 4], tipo: 'mata', col: 0x4d8a33, fruto: 0xe8e0cc, rebrota: 3 },
    tomate:    { n: 'Tomate', s: [VERANO], dias: 8, rinde: [2, 4], tipo: 'fruto', col: 0x3f8a2f, fruto: 0xd0342c, rebrota: 3 },
    pimiento:  { n: 'Pimiento', s: [VERANO], dias: 7, rinde: [2, 3], tipo: 'fruto', col: 0x3f8a2f, fruto: 0x3f9e35, rebrota: 3 },
    calabaza:  { n: 'Calabaza', s: [OTONO], dias: 11, rinde: [1, 2], tipo: 'fruto', col: 0x4d8a33, fruto: 0xe08a2a },
    berza:     { n: 'Berza', s: [OTONO, INVIERNO], dias: 7, rinde: [1, 2], tipo: 'hoja', col: 0x4d8a45, fruto: 0x4d8a45 },
    puerro:    { n: 'Puerro', s: [OTONO, INVIERNO], dias: 7, rinde: [2, 3], tipo: 'bulbo', col: 0xa8d060, fruto: 0xdfeec8 },
    // cultivos de campo grande (los del tractor)
    trigo:   { n: 'Trigo', s: [PRIMAVERA, VERANO, OTONO], dias: 7, rinde: [1, 1], tipo: 'cereal', col: 0x8fa85a, fruto: 0xe0c274, campo: true },
    cebada:  { n: 'Cebada', s: [PRIMAVERA, OTONO], dias: 6, rinde: [1, 1], tipo: 'cereal', col: 0x9aa85a, fruto: 0xd9c274, campo: true },
    maiz:    { n: 'Maíz', s: [VERANO], dias: 10, rinde: [1, 1], tipo: 'maiz', col: 0x3f8a2f, fruto: 0xe0b83a, campo: true },
    alfalfa: { n: 'Alfalfa', s: [PRIMAVERA, VERANO, OTONO], dias: 5, rinde: [1, 1], tipo: 'forraje', col: 0x4f9e3a, fruto: 0x6fbf4a, campo: true }
  };

  /* ---------------------------------------------------------------- GANADO */
  var ANIMALS = {
    vaca:    { n: 'Vaca frisona', casa: 'cuadra', precio: 5200, prod: 'leche', tool: 'cubo', come: ['heno', 'pienso', 'alfalfa'], sonido: 'muu', vel: 0.9 },
    oveja:   { n: 'Oveja', casa: 'cuadra', precio: 3400, prod: 'leche_oveja', tool: 'cubo', extra: 'lana', extraTool: 'tijeras', extraCada: 4, come: ['heno', 'pienso', 'alfalfa'], sonido: 'bee', vel: 1.0 },
    cordero: { n: 'Cordero', casa: 'cuadra', precio: 1400, crece: 'oveja', dias: 10, come: ['heno'], sonido: 'bee', vel: 1.4 },
    gallina: { n: 'Gallina', casa: 'gallinero', precio: 1100, prod: 'huevo', come: ['grano', 'pienso', 'trigo'], sonido: 'coc', vel: 0.8 },
    pollo:   { n: 'Pollo', casa: 'gallinero', precio: 450, crece: 'gallina', dias: 6, come: ['grano'], sonido: 'coc', vel: 1.1 },
    burro:   { n: 'Burro', casa: 'cuadra', precio: 3900, come: ['heno', 'pienso'], sonido: 'iaa', vel: 0.9,
               perk: 'Te acompaña y aumenta lo que puedes cargar.' }
  };

  /* ---------------------------------------------------------------- VECINOS */
  var NPCS = [
    { id: 'rosalia', n: 'Rosalía', rol: 'Tendera de ultramarinos', novia: true,
      look: { skin: '#e8b98c', hair: '#6a3a1a', hairStyle: 'largo', shirt: '#b8455e', pants: '#4a3a52', vest: '#efe6d2' },
      gusta: ['flor', 'queso', 'tomate', 'vino'], encanta: ['ramo', 'queso'], casa: 'tienda_comida',
      frases: {
        0: ['¡Buenos días, Arricio! ¿Vienes a por pan?', 'Hoy ha entrado chorizo de la matanza.', 'En Sorríos no falta de nada mientras yo abra.'],
        2: ['Me alegra verte. ¿Cómo van las vacas?', 'Si te falta algo, dímelo y te lo guardo.'],
        4: ['Contigo se me hace corto el día.', 'Mi madre decía que quien cuida su ganado cuida de todo.'],
        6: ['Te he guardado lo mejor del mostrador. No se lo digas a nadie.'],
        8: ['Arricio… ¿tú has pensado alguna vez en formar una familia aquí?'],
        10: ['Contigo hasta el invierno de Ordás parece templado.'] } },
    { id: 'marina', n: 'Marina', rol: 'Veterinaria', novia: true,
      look: { skin: '#c98f5f', hair: '#241a12', hairStyle: 'monyo', shirt: '#3f7a6a', pants: '#37405a', hat: 'panuelo', hatColor: '#c9a95c' },
      gusta: ['leche', 'lana', 'heno', 'flor'], encanta: ['ramo', 'leche_oveja'], casa: 'casa_marina',
      frases: {
        0: ['¿Tus animales están bien? Paso consulta por las mañanas.', 'Una vaca contenta da el doble de leche.'],
        2: ['Si les hablas mientras ordeñas, se dejan mejor. Palabra de veterinaria.'],
        4: ['He visto tu cuadra: se nota que las tratas bien.'],
        6: ['A veces subo al monte sola… no estaría mal la compañía.'],
        8: ['Arricio, contigo el campo tiene otro color.'],
        10: ['Yo no me quedaría en cualquier pueblo. Me quedo por ti.'] } },
    { id: 'aurora', n: 'Aurora', rol: 'Maestra', novia: true,
      look: { skin: '#f0cba8', hair: '#c9a05c', hairStyle: 'largo', shirt: '#6a5aa8', pants: '#3a3550' },
      gusta: ['flor', 'pan', 'lechuga', 'huevo'], encanta: ['ramo', 'tortilla'], casa: 'casa_aurora',
      frases: {
        0: ['Buenos días. Hoy tengo nueve niños en clase, ¡un récord!', 'Si algún día tienes hijos, tráemelos a la escuela.'],
        2: ['Me han contado que tu huerto va muy bien.'],
        4: ['Los domingos leo junto al río. Deberías pasarte.'],
        6: ['Me gusta que aún haya gente que madruga por la tierra.'],
        8: ['Contigo hablar es fácil, y eso es raro.'],
        10: ['Yo vine aquí de paso… y ya ves.'] } },
    { id: 'nieves', n: 'Nieves', rol: 'Molinera', novia: true,
      look: { skin: '#d9a97a', hair: '#8a6a3a', hairStyle: 'monyo', shirt: '#a86a3a', pants: '#4a3a2a', vest: '#e8dcc4' },
      gusta: ['trigo', 'pan', 'flor', 'manteca'], encanta: ['ramo', 'trigo'], casa: 'casa_nieves',
      frases: {
        0: ['El molino sigue moliendo, como en tiempos de mi abuelo.', '¿Traes trigo? Te lo muelo en un rato.'],
        2: ['Con la harina de aquí sale el mejor pan de la comarca.'],
        4: ['Me gusta el ruido del agua: es lo único que no cambia.'],
        6: ['Te veo pasar cada día con el tractor. Me hace gracia.'],
        8: ['Arricio, ¿te quedarías siempre en Sorríos?'],
        10: ['Contigo hasta las piedras del molino suenan mejor.'] } },
    { id: 'bernardo', n: 'Bernardo', rol: 'Almacén de aperos',
      look: { skin: '#c98f5f', hair: '#8a8a82', shirt: '#4a6a8a', pants: '#37405a', vest: '#6a5a3a', beard: '#9a9a92' },
      gusta: ['lena', 'piedra', 'vino'], casa: 'tienda_aperos',
      frases: { 0: ['Azada, pala, rastrillo… y gasóleo para el tractor.', 'Las semillas cambian con la estación, ojo.',
                    'Si me traes leña, te la pago bien.'],
                2: ['Tú sí sabes trabajar. Se ve en las manos.'] } },
    { id: 'segundo', n: 'Segundo', rol: 'Tabernero',
      look: { skin: '#e0a97a', hair: '#3a2a1a', shirt: '#8a3a3a', pants: '#3a3a42', vest: '#d8cdb4', beard: '#3a2a1a' },
      gusta: ['vino', 'chorizo', 'patata'], casa: 'taberna',
      frases: { 0: ['¡Arricio! Un vaso de vino y arreglamos el mundo.', 'Aquí se junta el pueblo cuando cae la noche.'],
                2: ['La casa invita si me traes patatas de las tuyas.'] } },
    { id: 'casimiro', n: 'Don Casimiro', rol: 'Párroco',
      look: { skin: '#e8c9a0', hair: '#d8d8d0', shirt: '#26262c', pants: '#26262c' },
      gusta: ['pan', 'vino', 'flor'], casa: 'iglesia',
      frases: { 0: ['Que Dios reparta suerte y lluvia, Arricio.', 'Cuando tengas anillo y novia, yo os caso en San Roque.',
                    'La campana toca a las seis, ni un minuto más.'],
                2: ['Este pueblo necesita gente joven que se quede.'] } },
    { id: 'herminia', n: 'Herminia', rol: 'La abuela del pueblo',
      look: { skin: '#e0c0a0', hair: '#e8e8e0', hairStyle: 'monyo', shirt: '#4a4a52', pants: '#2a2a30', vest: '#8a8a82' },
      gusta: ['leche', 'huevo', 'sopa', 'flor'], casa: 'casa_herminia',
      frases: { 0: ['Antes en este pueblo había ochenta vacas. Ochenta.',
                    'A las vacas se las ordeñaba a mano, con la frente pegada al costado.',
                    'Come caliente, rapaz, que el invierno de Ordás no perdona.'],
                2: ['Tú me recuerdas a tu abuelo, que en gloria esté.'] } },
    { id: 'tino', n: 'Tino', rol: 'Pastor',
      look: { skin: '#c98f5f', hair: '#7a6a5a', shirt: '#6a6a3a', pants: '#4a4230', hat: 'boina', hatColor: '#26262c', beard: '#8a7a6a' },
      gusta: ['lana', 'heno', 'queso', 'vino'], casa: 'casa_tino',
      frases: { 0: ['Ochenta ovejas subí yo al puerto con catorce años.', 'Si esquilas en verano, la lana sale más limpia.',
                    'Mira el cielo por la tarde y sabrás el tiempo de mañana.'],
                2: ['Buen rebaño llevas. Se nota quién sabe.'] } },
    { id: 'celso', n: 'Celso', rol: 'Alcalde pedáneo',
      look: { skin: '#e0a97a', hair: '#4a3a2a', shirt: '#3a5a7a', pants: '#2a3040', vest: '#6a3a3a' },
      gusta: ['calabaza', 'vino', 'maiz'], casa: 'casa_celso',
      frases: { 0: ['Sorríos de Ordás: 41 vecinos, y subiendo si tú te quedas.', 'Cada estación hacemos fiesta en la plaza.'],
                2: ['Tú levantas este pueblo, Arricio.'] } },
    { id: 'lucio', n: 'Lucio', rol: 'Herrero y mecánico',
      look: { skin: '#a86a44', hair: '#241a12', shirt: '#5a5a62', pants: '#3a3a42', vest: '#6a4a2a', beard: '#241a12' },
      gusta: ['piedra', 'lena', 'chorizo'], casa: 'casa_lucio',
      frases: { 0: ['Si se te avería el tractor, tráemelo.', 'El hierro y la tierra: de eso vive un pueblo.'],
                2: ['Te afilo la hoz gratis, que tú siegas mucho.'] } },
    { id: 'chelo', n: 'Chelo', rol: 'Cartera',
      look: { skin: '#e8b98c', hair: '#3a2a1a', shirt: '#c9a95c', pants: '#3a5a7a' },
      gusta: ['cafe', 'pan', 'flor'], casa: 'casa_chelo',
      frases: { 0: ['Correo de Sorríos. Hoy no traigo nada para ti.', 'Subo y bajo el pueblo cuatro veces al día.'],
                2: ['Si escribes a alguien, yo se lo llevo.'] } }
  ];

  /* --------------------------------------------------------------- TIENDAS */
  var SHOPS = {
    comestibles: {
      n: 'Ultramarinos «La Reguera»', tendero: 'rosalia', horario: [8, 20],
      stock: ['pan', 'cafe', 'sopa', 'chorizo', 'empanada', 'tortilla', 'vino', 'cocido'],
      compra: ['crop', 'prod', 'mat']
    },
    aperos: {
      n: 'Piensos y Aperos «Bernardo»', tendero: 'bernardo', horario: [8, 19],
      stock: ['pienso', 'heno', 'grano', 'abono', 'gasoil', 'azada', 'regadera', 'cubo', 'hoz', 'tijeras', 'hacha', 'pala', 'rastrillo', 'ramo', 'anillo'],
      semillas: true, ganado: true,
      compra: ['crop', 'prod', 'mat', 'feed']
    }
  };

  var RECETAS = [
    { id: 'queso', n: 'Queso de la casa', need: [['leche', 2]], out: ['queso', 1] },
    { id: 'queso_oveja', n: 'Queso de oveja', need: [['leche_oveja', 2]], out: ['queso', 1] },
    { id: 'manteca', n: 'Manteca', need: [['leche', 1], ['lena', 1]], out: ['manteca', 1] },
    { id: 'tortilla', n: 'Tortilla de patata', need: [['huevo', 2], ['patata', 2]], out: ['tortilla', 1] },
    { id: 'sopa', n: 'Sopa de ajo', need: [['ajo', 1], ['pan', 1]], out: ['sopa', 1] },
    { id: 'cocido', n: 'Cocido maragato', need: [['garbanzo', 2], ['chorizo', 1], ['berza', 1]], out: ['cocido', 1] },
    { id: 'empanada', n: 'Empanada', need: [['trigo', 2], ['cebolla', 1], ['pimiento', 1]], out: ['empanada', 1] }
  ];

  var AYUDA = [
    'Con el TRACTOR y el arado se labran los campos grandes; luego se siembra con la sembradora y se siega con la cosechadora.',
    'A las vacas y ovejas se las ordeña A MANO: acércate con el cubo y alterna las manos siguiendo el ritmo.',
    'En el huerto de casa se trabaja a mano: azada, semilla y regadera.',
    'Las semillas solo crecen en su estación; Bernardo cambia el género cada estación.',
    'Da de comer al ganado todos los días en el comedero.',
    'Duerme antes de las 2 de la madrugada o caerás rendido.',
    'Regala cosas a los vecinos para hacer amistad. Con un ramo hay noviazgo; con el anillo, boda.',
    'Los hijos crecen y acaban ayudando con el riego y el ganado.',
    'Vende la cosecha en la cooperativa o en las tiendas del pueblo.'
  ];

  S.DATA = {
    ITEMS: ITEMS, CROPS: CROPS, ANIMALS: ANIMALS, NPCS: NPCS, SHOPS: SHOPS,
    RECETAS: RECETAS, AYUDA: AYUDA,
    PRIMAVERA: PRIMAVERA, VERANO: VERANO, OTONO: OTONO, INVIERNO: INVIERNO,
    item: function (id) { return ITEMS[id]; },
    npc: function (id) { for (var i = 0; i < NPCS.length; i++) if (NPCS[i].id === id) return NPCS[i]; return null; },
    semillasDe: function (season, campo) {
      var out = [];
      for (var id in ITEMS) {
        var it = ITEMS[id];
        if (it.t !== 'seed') continue;
        var c = CROPS[it.crop];
        if (!c || c.s.indexOf(season) < 0) continue;
        if (campo != null && !!c.campo !== !!campo) continue;
        out.push(id);
      }
      return out;
    }
  };

})(window);
