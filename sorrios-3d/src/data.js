/* ============================================================================
   SORRÍOS DE ORDÁS 3D — data.js
   Contenido del juego: aperos antiguos, cultivos, ganado, vecinos y tiendas.
   Aquí no hay maquinaria: se labra con las vacas o con el burro, se siega a
   guadaña y se acarrea en carro de bueyes.
   ========================================================================== */
(function (global) {
  'use strict';
  var S = global.SORRIOS3D;

  var PRIMAVERA = 0, VERANO = 1, OTONO = 2, INVIERNO = 3;

  /* ------------------------------------------------------------- PRODUCTOS */
  var ITEMS = {
    /* --- aperos de mano, todos de los de antes --- */
    azada:     { n: 'Azada', t: 'tool', ic: '⛏️', d: 'Para cavar y labrar la tierra de la huerta.' },
    azadon:    { n: 'Azadón', t: 'tool', ic: '⛏️', d: 'Más ancho y pesado que la azada: abre surco de una pasada.' },
    guadana:   { n: 'Guadaña', t: 'tool', ic: '🌾', d: 'Para segar la hierba del prado a golpe de brazo.' },
    hoz:       { n: 'Hoz', t: 'tool', ic: '🌾', d: 'Para segar las mieses y la hierba de los ribazos.' },
    caldero:   { n: 'Caldero de ordeñar', t: 'tool', ic: '🪣', d: 'El caldero donde cae la leche al ordeñar a mano.' },
    horca:     { n: 'Horca de madera', t: 'tool', ic: '🍴', d: 'Para cargar la hierba en el carro.' },
    rastrillo: { n: 'Rastrillo de madera', t: 'tool', ic: '🧹', d: 'Para recoger la hierba seca y limpiar la huerta.' },
    regadera:  { n: 'Regadera de cinc', t: 'tool', ic: '🚿', d: 'Riega la huerta. Se llena en el pozo o en el río.' },
    tijeras:   { n: 'Tijeras de esquilar', t: 'tool', ic: '✂️', d: 'Para esquilar las ovejas en verano.' },
    hacha:     { n: 'Hacha', t: 'tool', ic: '🪓', d: 'Para hacer leña.' },
    pala:      { n: 'Pala', t: 'tool', ic: '🥄', d: 'Para cavar y sacar piedra.' },
    aguijada:  { n: 'Aguijada', t: 'tool', ic: '🦯', d: 'La vara con la que se guía la yunta.' },

    /* --- semillas --- */
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
    sem_berza:     { n: 'Semilla de berza', t: 'seed', crop: 'berza', ic: '🥬', buy: 50, sell: 24 },
    sem_puerro:    { n: 'Semilla de puerro', t: 'seed', crop: 'puerro', ic: '🥒', buy: 55, sell: 26 },
    sem_trigo:     { n: 'Trigo de siembra', t: 'seed', crop: 'trigo', ic: '🌾', buy: 30, sell: 14, campo: true },
    sem_centeno:   { n: 'Centeno de siembra', t: 'seed', crop: 'centeno', ic: '🌾', buy: 26, sell: 12, campo: true },
    sem_cebada:    { n: 'Cebada de siembra', t: 'seed', crop: 'cebada', ic: '🌾', buy: 28, sell: 13, campo: true },
    sem_alfalfa:   { n: 'Alfalfa de siembra', t: 'seed', crop: 'alfalfa', ic: '🍀', buy: 34, sell: 16, campo: true },

    /* --- cosecha --- */
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
    centeno:   { n: 'Centeno', t: 'crop', ic: '🌾', sell: 44, energy: 8, granel: true },
    cebada:    { n: 'Cebada', t: 'crop', ic: '🌾', sell: 42, energy: 8, granel: true },
    alfalfa:   { n: 'Alfalfa', t: 'crop', ic: '🍀', sell: 38, energy: 6, granel: true },
    hierba:    { n: 'Hierba segada', t: 'crop', ic: '🌿', sell: 22, energy: 0, granel: true },

    /* --- productos del ganado --- */
    leche:       { n: 'Leche de vaca', t: 'prod', ic: '🥛', sell: 125, energy: 25 },
    leche_oveja: { n: 'Leche de oveja', t: 'prod', ic: '🥛', sell: 155, energy: 25 },
    huevo:       { n: 'Huevos', t: 'prod', ic: '🥚', sell: 58, energy: 14 },
    lana:        { n: 'Lana', t: 'prod', ic: '🧶', sell: 185, energy: 0 },
    queso:       { n: 'Queso de la casa', t: 'prod', ic: '🧀', sell: 310, energy: 40 },
    manteca:     { n: 'Manteca', t: 'prod', ic: '🧈', sell: 230, energy: 32 },

    /* --- comida de ultramarinos --- */
    pan:      { n: 'Hogaza de pan', t: 'food', ic: '🍞', buy: 58, sell: 28, energy: 30 },
    chorizo:  { n: 'Chorizo de la matanza', t: 'food', ic: '🌭', buy: 135, sell: 65, energy: 45 },
    cocido:   { n: 'Cocido maragato', t: 'food', ic: '🍲', buy: 310, sell: 150, energy: 100 },
    sopa:     { n: 'Sopa de ajo', t: 'food', ic: '🥣', buy: 105, sell: 50, energy: 50 },
    empanada: { n: 'Empanada', t: 'food', ic: '🥧', buy: 175, sell: 85, energy: 60 },
    cafe:     { n: 'Café de puchero', t: 'food', ic: '☕', buy: 42, sell: 20, energy: 22 },
    vino:     { n: 'Vino del país', t: 'food', ic: '🍷', buy: 145, sell: 70, energy: 35 },
    tortilla: { n: 'Tortilla de patata', t: 'food', ic: '🍳', buy: 195, sell: 95, energy: 70 },
    orujo:    { n: 'Orujo', t: 'food', ic: '🥃', buy: 120, sell: 58, energy: 28 },

    /* --- piensos y materiales --- */
    pienso: { n: 'Pienso', t: 'feed', ic: '🌰', buy: 32, sell: 14 },
    heno:   { n: 'Heno', t: 'feed', ic: '🌿', buy: 22, sell: 10 },
    grano:  { n: 'Grano', t: 'feed', ic: '🌾', buy: 28, sell: 12 },
    abono:  { n: 'Cuquera (abono)', t: 'mat', ic: '💩', buy: 65, sell: 28 },
    lena:   { n: 'Leña', t: 'mat', ic: '🪵', buy: 45, sell: 22 },
    piedra: { n: 'Piedra', t: 'mat', ic: '🪨', buy: 36, sell: 18 },
    flor:   { n: 'Flores del prado', t: 'mat', ic: '🌼', sell: 38 },

    /* --- especiales --- */
    ramo:   { n: 'Ramo de flores', t: 'esp', ic: '💐', buy: 850, d: 'Para pedir salir a quien te gusta.' },
    anillo: { n: 'Anillo de pedida', t: 'esp', ic: '💍', buy: 4800, d: 'Para pedir matrimonio a tu novia.' }
  };

  /* --------------------------------------------------------------- CULTIVOS */
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
    trigo:   { n: 'Trigo', s: [PRIMAVERA, VERANO, OTONO], dias: 7, rinde: [1, 1], tipo: 'cereal', col: 0x8fa85a, fruto: 0xe0c274, campo: true },
    centeno: { n: 'Centeno', s: [OTONO, PRIMAVERA], dias: 7, rinde: [1, 1], tipo: 'cereal', col: 0x9aa06a, fruto: 0xd8c088, campo: true },
    cebada:  { n: 'Cebada', s: [PRIMAVERA, OTONO], dias: 6, rinde: [1, 1], tipo: 'cereal', col: 0x9aa85a, fruto: 0xd9c274, campo: true },
    alfalfa: { n: 'Alfalfa', s: [PRIMAVERA, VERANO, OTONO], dias: 5, rinde: [1, 1], tipo: 'forraje', col: 0x4f9e3a, fruto: 0x6fbf4a, campo: true }
  };

  /* ---------------------------------------------------------------- GANADO */
  var ANIMALS = {
    vaca:    { n: 'Vaca', casa: 'cuadra', precio: 5200, prod: 'leche', tool: 'caldero',
               come: ['heno', 'pienso', 'alfalfa', 'hierba'], sonido: 'muu', vel: 0.9, tira: true,
               perk: 'Uncida al yugo, tira del arado y del carro.' },
    oveja:   { n: 'Oveja', casa: 'cuadra', precio: 3400, prod: 'leche_oveja', tool: 'caldero',
               extra: 'lana', extraTool: 'tijeras', extraCada: 4,
               come: ['heno', 'pienso', 'alfalfa', 'hierba'], sonido: 'bee', vel: 1.0 },
    cordero: { n: 'Cordero', casa: 'cuadra', precio: 1400, crece: 'oveja', dias: 10, come: ['heno'], sonido: 'bee', vel: 1.4 },
    gallina: { n: 'Gallina', casa: 'gallinero', precio: 1100, prod: 'huevo', come: ['grano', 'pienso', 'trigo'], sonido: 'coc', vel: 0.8 },
    pollo:   { n: 'Pollo', casa: 'gallinero', precio: 450, crece: 'gallina', dias: 6, come: ['grano'], sonido: 'coc', vel: 1.1 },
    burro:   { n: 'Burro', casa: 'cuadra', precio: 3900, come: ['heno', 'pienso'], sonido: 'iaa', vel: 0.9, tira: true,
               perk: 'Tira del arado él solo y carga con lo que le eches.' }
  };

  /* ---------------------------------------------------------------- VECINOS */
  var NPCS = [
    { id: 'noemi', n: 'Noemi', rol: 'Tendera de ultramarinos', novia: true,
      look: { skin: '#e8b98c', hair: '#6a3a1a', hairStyle: 'largo', shirt: '#b8455e', pants: '#4a3a52', vest: '#efe6d2' },
      gusta: ['flor', 'queso', 'tomate', 'vino'], encanta: ['ramo', 'queso'], casa: 'tienda_comida',
      frases: {
        0: ['Buenos días, Nazario. ¿Vienes a por pan?', 'Hoy ha entrado chorizo de la matanza.',
            'En Sorríos no falta de nada mientras yo abra la tienda.'],
        2: ['Me alegra verte. ¿Cómo van las vacas?', 'Si te falta algo, dímelo y te lo guardo.'],
        4: ['Contigo se me hace corto el día.', 'Mi madre decía que quien cuida su ganado cuida de todo.'],
        6: ['Te he guardado lo mejor del mostrador. No se lo digas a nadie.'],
        8: ['Nazario… ¿tú has pensado alguna vez en formar una familia aquí?'],
        10: ['Contigo hasta el invierno de Ordás parece templado.'] } },

    { id: 'nieves', n: 'Nieves', rol: 'Molinera', novia: true,
      look: { skin: '#d9a97a', hair: '#8a6a3a', hairStyle: 'monyo', shirt: '#a86a3a', pants: '#4a3a2a', vest: '#e8dcc4' },
      gusta: ['trigo', 'centeno', 'pan', 'flor'], encanta: ['ramo', 'trigo'], casa: 'casa_nieves',
      frases: {
        0: ['El molino sigue moliendo, como en tiempos de mi abuelo.', '¿Traes trigo? Te lo muelo en un rato.'],
        2: ['Con la harina de aquí sale el mejor pan de la comarca.'],
        4: ['Me gusta el ruido del agua: es lo único que no cambia.'],
        6: ['Te veo pasar cada día con la yunta. Me hace gracia.'],
        8: ['Nazario, ¿te quedarías siempre en Sorríos?'],
        10: ['Contigo hasta las piedras del molino suenan mejor.'] } },

    { id: 'julita', n: 'Julita', rol: 'Maestra de la escuela', novia: true,
      look: { skin: '#f0cba8', hair: '#c9a05c', hairStyle: 'largo', shirt: '#6a5aa8', pants: '#3a3550' },
      gusta: ['flor', 'pan', 'lechuga', 'huevo'], encanta: ['ramo', 'tortilla'], casa: 'casa_julita',
      frases: {
        0: ['Buenos días. Hoy tengo nueve niños en clase, ¡un récord!', 'Si algún día tienes hijos, tráemelos a la escuela.'],
        2: ['Me han contado que tu huerta va muy bien.'],
        4: ['Los domingos leo junto al río. Deberías pasarte.'],
        6: ['Me gusta que aún haya gente que madruga por la tierra.'],
        8: ['Contigo hablar es fácil, y eso es raro.'],
        10: ['Yo vine aquí de paso… y ya ves.'] } },

    { id: 'marinieves', n: 'Mari Nieves', rol: 'Vaquera y curandera', novia: true,
      look: { skin: '#c98f5f', hair: '#241a12', hairStyle: 'monyo', shirt: '#3f7a6a', pants: '#37405a', hat: 'panuelo', hatColor: '#c9a95c' },
      gusta: ['leche', 'lana', 'heno', 'flor'], encanta: ['ramo', 'leche_oveja'], casa: 'casa_marinieves',
      frases: {
        0: ['¿Están bien tus vacas? Yo les miro la ubre si quieres.', 'Una vaca contenta da el doble de leche.'],
        2: ['Si les hablas mientras ordeñas, se dejan mejor. Palabra.'],
        4: ['He visto tu cuadra: se nota que las tratas bien.'],
        6: ['A veces subo al monte sola… no estaría mal la compañía.'],
        8: ['Nazario, contigo el campo tiene otro color.'],
        10: ['Yo no me quedaría en cualquier pueblo. Me quedo por ti.'] } },

    { id: 'arricio', n: 'Arricio', rol: 'Dueño de la taberna',
      look: { skin: '#e0a97a', hair: '#3a2a1a', shirt: '#8a3a3a', pants: '#3a3a42', vest: '#d8cdb4', beard: '#3a2a1a' },
      gusta: ['vino', 'orujo', 'chorizo', 'patata'], casa: 'taberna',
      frases: { 0: ['¡Nazario! Un vaso de vino y arreglamos el mundo.',
                    'Aquí se junta el pueblo entero cuando cae la noche.',
                    'La taberna es mía desde que me la dejó mi padre.'],
                2: ['La casa invita si me traes patatas de las tuyas.'],
                4: ['Eres de los pocos que aún madrugan de verdad.'] } },

    { id: 'jeremias', n: 'Jeremías', rol: 'Aperos, piensos y ganado',
      look: { skin: '#c98f5f', hair: '#8a8a82', shirt: '#4a6a8a', pants: '#37405a', vest: '#6a5a3a', beard: '#9a9a92' },
      gusta: ['lena', 'piedra', 'vino'], casa: 'tienda_aperos',
      frases: { 0: ['Azada, guadaña, horca… lo que necesite el hombre de campo.',
                    'Las semillas cambian con la estación, ojo con eso.',
                    'Si te hace falta otra vaca para la yunta, aquí la tengo.'],
                2: ['Tú sí sabes trabajar. Se ve en las manos.'] } },

    { id: 'alfonso', n: 'Alfonso', rol: 'Pastor',
      look: { skin: '#c98f5f', hair: '#7a6a5a', shirt: '#6a6a3a', pants: '#4a4230', hat: 'boina', hatColor: '#26262c', beard: '#8a7a6a' },
      gusta: ['lana', 'heno', 'queso', 'vino'], casa: 'casa_alfonso',
      frases: { 0: ['Ochenta ovejas subí yo al puerto con catorce años.',
                    'Si esquilas en verano, la lana sale más limpia.',
                    'Mira el cielo por la tarde y sabrás el tiempo de mañana.'],
                2: ['Buen rebaño llevas. Se nota quién sabe.'] } },

    { id: 'josep', n: 'Josep', rol: 'Hortelano y tratante',
      look: { skin: '#d8a97e', hair: '#2e2018', shirt: '#4a7a4a', pants: '#3a4230', hat: 'paja' },
      gusta: ['tomate', 'pimiento', 'calabaza', 'abono'], casa: 'casa_josep',
      frases: { 0: ['La huerta hay que cavarla con azadón, no hay otra.',
                    'Yo siembro por la luna, y no me ha ido mal.',
                    'Si te sobra cosecha, te la coloco yo en la feria.'],
                2: ['Esos tomates tuyos tienen buena pinta.'] } },

    { id: 'tornillos', n: 'Tornillos', rol: 'El manitas del pueblo',
      look: { skin: '#a86a44', hair: '#241a12', shirt: '#5a5a62', pants: '#3a3a42', vest: '#6a4a2a', beard: '#241a12' },
      gusta: ['piedra', 'lena', 'chorizo'], casa: 'fragua',
      frases: { 0: ['Si se te parte la mancera del arado, tráemela.',
                    'A mí me llaman Tornillos desde chaval, ya ni me acuerdo del porqué.',
                    'Te afilo la guadaña gratis, que tú siegas mucho.'],
                2: ['Con dos hierros y maña se arregla todo.'] } },

    { id: 'mario', n: 'Mario', rol: 'Alcalde pedáneo y cartero',
      look: { skin: '#e0a97a', hair: '#4a3a2a', shirt: '#3a5a7a', pants: '#2a3040', vest: '#6a3a3a' },
      gusta: ['calabaza', 'vino', 'cafe'], casa: 'casa_mario',
      frases: { 0: ['Sorríos de Ordás: 41 vecinos, y subiendo si tú te quedas.',
                    'Cada estación hacemos fiesta en la plaza.',
                    'Correo de Sorríos: hoy no traigo nada para ti.'],
                2: ['Tú levantas este pueblo, Nazario.'] } }
  ];

  /* --------------------------------------------------------------- TIENDAS */
  var SHOPS = {
    comestibles: {
      n: 'Ultramarinos «La Reguera»', tendero: 'noemi', horario: [8, 20],
      stock: ['pan', 'cafe', 'sopa', 'chorizo', 'empanada', 'tortilla', 'vino', 'orujo', 'cocido'],
      compra: ['crop', 'prod', 'mat']
    },
    aperos: {
      n: 'Aperos y Piensos de Jeremías', tendero: 'jeremias', horario: [8, 19],
      stock: ['pienso', 'heno', 'grano', 'abono', 'azada', 'azadon', 'guadana', 'hoz', 'caldero',
              'horca', 'rastrillo', 'regadera', 'tijeras', 'hacha', 'pala', 'aguijada', 'ramo', 'anillo'],
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
    'Aquí no hay máquinas: la tierra se labra con la YUNTA. Unce dos vacas o el burro Carolo al yugo y engancha el arado.',
    'Con la AGUIJADA en la mano, acércate a las vacas o al burro y pulsa la acción para uncir la yunta.',
    'El arado se clava y se levanta; solo labra cuando va clavado.',
    'La hierba del prado se siega con la GUADAÑA, y se acarrea en el CARRO tirado por las vacas.',
    'La huerta de casa se cava a mano con la azada o el azadón, se siembra y se riega con la regadera.',
    'A las vacas y a las ovejas se las ordeña a mano con el CALDERO, alternando las dos manos al compás.',
    'Las semillas solo nacen en su estación; Jeremías cambia el género cada estación.',
    'Da de comer al ganado todos los días en el comedero.',
    'Duerme antes de las dos de la madrugada o caerás rendido.',
    'Regala cosas a los vecinos para hacer amistad. Con un ramo hay noviazgo; con el anillo, boda en la ermita.'
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
