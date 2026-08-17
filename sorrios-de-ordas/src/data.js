/* ============================================================================
   SORRÍOS DE ORDÁS — data.js
   Definición de contenido: objetos, cultivos, animales, vecinos del pueblo,
   tiendas y diálogos. Todo el "contenido" vive aquí para poder ampliarlo sin
   tocar la lógica del juego.
   ========================================================================== */
(function (global) {
  'use strict';
  var G = global.SORRIOS;

  var PRIMAVERA = 0, VERANO = 1, OTONO = 2, INVIERNO = 3;
  var SEASON_NAMES = ['Primavera', 'Verano', 'Otoño', 'Invierno'];
  var DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  /* =============================================================== ITEMS == */
  // type: tool | seed | crop | product | food | feed | material | special
  var ITEMS = {
    /* --- herramientas --- */
    azada:     { name: 'Azada',        type: 'tool', desc: 'Para labrar la tierra del huerto.', energy: 3, icon: { type: 'tool', kind: 'azada' } },
    regadera:  { name: 'Regadera',     type: 'tool', desc: 'Riega lo sembrado. Se llena en el pozo o el río.', energy: 2, icon: { type: 'tool', kind: 'regadera' } },
    cubo:      { name: 'Cubo de ordeñar', type: 'tool', desc: 'Para ordeñar vacas y ovejas a mano.', energy: 4, icon: { type: 'tool', kind: 'cubo' } },
    hoz:       { name: 'Hoz',          type: 'tool', desc: 'Siega hierba y maleza.', energy: 2, icon: { type: 'tool', kind: 'hoz' } },
    hacha:     { name: 'Hacha',        type: 'tool', desc: 'Corta leña de los árboles.', energy: 4, icon: { type: 'tool', kind: 'hacha' } },
    pala:      { name: 'Pala',         type: 'tool', desc: 'Cava y quita piedras del terreno.', energy: 4, icon: { type: 'tool', kind: 'pala' } },
    rastrillo: { name: 'Rastrillo',    type: 'tool', desc: 'Limpia el huerto y recoge la hierba seca.', energy: 2, icon: { type: 'tool', kind: 'rastrillo' } },
    tijeras:   { name: 'Tijeras de esquilar', type: 'tool', desc: 'Esquila la lana de las ovejas.', energy: 4, icon: { type: 'tool', kind: 'tijeras' } },

    /* --- semillas --- */
    sem_patata:    { name: 'Semilla de patata',    type: 'seed', crop: 'patata',    buy: 60,  sell: 30, icon: { type: 'seed', color: '#c9a95c' } },
    sem_lechuga:   { name: 'Semilla de lechuga',   type: 'seed', crop: 'lechuga',   buy: 40,  sell: 20, icon: { type: 'seed', color: '#7fc04a' } },
    sem_cebolla:   { name: 'Semilla de cebolla',   type: 'seed', crop: 'cebolla',   buy: 50,  sell: 25, icon: { type: 'seed', color: '#d9b47a' } },
    sem_ajo:       { name: 'Diente de ajo',        type: 'seed', crop: 'ajo',       buy: 45,  sell: 22, icon: { type: 'seed', color: '#f0ece0' } },
    sem_zanahoria: { name: 'Semilla de zanahoria', type: 'seed', crop: 'zanahoria', buy: 45,  sell: 22, icon: { type: 'seed', color: '#e08a3a' } },
    sem_garbanzo:  { name: 'Semilla de garbanzo',  type: 'seed', crop: 'garbanzo',  buy: 90,  sell: 45, icon: { type: 'seed', color: '#d9c48a' } },
    sem_alubia:    { name: 'Semilla de alubia',    type: 'seed', crop: 'alubia',    buy: 80,  sell: 40, icon: { type: 'seed', color: '#f2ece0' } },
    sem_tomate:    { name: 'Semilla de tomate',    type: 'seed', crop: 'tomate',    buy: 85,  sell: 42, icon: { type: 'seed', color: '#d0342c' } },
    sem_pimiento:  { name: 'Semilla de pimiento',  type: 'seed', crop: 'pimiento',  buy: 85,  sell: 42, icon: { type: 'seed', color: '#4aa03a' } },
    sem_calabaza:  { name: 'Semilla de calabaza',  type: 'seed', crop: 'calabaza',  buy: 160, sell: 80, icon: { type: 'seed', color: '#e08a2a' } },
    sem_trigo:     { name: 'Semilla de trigo',     type: 'seed', crop: 'trigo',     buy: 35,  sell: 17, icon: { type: 'seed', color: '#e0c274' } },
    sem_berza:     { name: 'Semilla de berza',     type: 'seed', crop: 'berza',     buy: 55,  sell: 27, icon: { type: 'seed', color: '#5f9e3f' } },
    sem_puerro:    { name: 'Semilla de puerro',    type: 'seed', crop: 'puerro',    buy: 60,  sell: 30, icon: { type: 'seed', color: '#a8d060' } },

    /* --- cosecha --- */
    patata:    { name: 'Patata',    type: 'crop', sell: 70,  energy: 18, icon: { type: 'round', color: '#c9a163', rx: 6, ry: 5 } },
    lechuga:   { name: 'Lechuga',   type: 'crop', sell: 55,  energy: 12, icon: { type: 'leafy', color: '#7fc04a' } },
    cebolla:   { name: 'Cebolla',   type: 'crop', sell: 65,  energy: 14, icon: { type: 'round', color: '#e0b47a', stem: true } },
    ajo:       { name: 'Ajo',       type: 'crop', sell: 60,  energy: 10, icon: { type: 'round', color: '#f0ece0', stem: true, rx: 5, ry: 5 } },
    zanahoria: { name: 'Zanahoria', type: 'crop', sell: 60,  energy: 14, icon: { type: 'round', color: '#e08a3a', leaf: true, rx: 4, ry: 6 } },
    garbanzo:  { name: 'Garbanzos', type: 'crop', sell: 120, energy: 22, icon: { type: 'pod', color: '#d9c48a' } },
    alubia:    { name: 'Alubias',   type: 'crop', sell: 100, energy: 20, icon: { type: 'pod', color: '#e8e0cc' } },
    tomate:    { name: 'Tomate',    type: 'crop', sell: 105, energy: 16, icon: { type: 'round', color: '#d0342c', stem: true } },
    pimiento:  { name: 'Pimiento',  type: 'crop', sell: 110, energy: 16, icon: { type: 'round', color: '#3f9e35', stem: true, rx: 5, ry: 6 } },
    calabaza:  { name: 'Calabaza',  type: 'crop', sell: 260, energy: 30, icon: { type: 'round', color: '#e08a2a', stem: true, rx: 7, ry: 6 } },
    trigo:     { name: 'Trigo',     type: 'crop', sell: 50,  energy: 8,  icon: { type: 'sack', color: '#e0c274', letter: 'T' } },
    berza:     { name: 'Berza',     type: 'crop', sell: 85,  energy: 18, icon: { type: 'leafy', color: '#4d8a45' } },
    puerro:    { name: 'Puerro',    type: 'crop', sell: 80,  energy: 15, icon: { type: 'round', color: '#a8d060', rx: 3, ry: 7, leaf: true } },

    /* --- productos de los animales --- */
    leche:       { name: 'Leche de vaca',  type: 'product', sell: 130, energy: 25, icon: { type: 'bottle', color: '#f6f2e8' } },
    leche_oveja: { name: 'Leche de oveja', type: 'product', sell: 160, energy: 25, icon: { type: 'bottle', color: '#f0ece0', glass: '#dfe8ee' } },
    huevo:       { name: 'Huevo',          type: 'product', sell: 60,  energy: 14, icon: { type: 'egg' } },
    lana:        { name: 'Lana',           type: 'product', sell: 190, icon: { type: 'wool' } },
    queso:       { name: 'Queso de la casa', type: 'product', sell: 320, energy: 40, icon: { type: 'cheese' } },
    manteca:     { name: 'Manteca',        type: 'product', sell: 240, energy: 32, icon: { type: 'round', color: '#f2e6b0', rx: 6, ry: 4 } },

    /* --- comida de la tienda de ultramarinos --- */
    pan:       { name: 'Hogaza de pan',   type: 'food', buy: 60,  sell: 30, energy: 30, icon: { type: 'bread' } },
    chorizo:   { name: 'Chorizo',         type: 'food', buy: 140, sell: 70, energy: 45, icon: { type: 'meat' } },
    cocido:    { name: 'Cocido maragato', type: 'food', buy: 320, sell: 160, energy: 100, icon: { type: 'round', color: '#c0703a', rx: 7, ry: 5 } },
    sopa:      { name: 'Sopa de ajo',     type: 'food', buy: 110, sell: 55, energy: 50, icon: { type: 'round', color: '#d9a05c', rx: 7, ry: 5 } },
    empanada:  { name: 'Empanada',        type: 'food', buy: 180, sell: 90, energy: 60, icon: { type: 'round', color: '#d9a95c', rx: 7, ry: 5 } },
    cafe:      { name: 'Café de puchero', type: 'food', buy: 45,  sell: 22, energy: 22, icon: { type: 'bottle', color: '#4a3020', glass: '#e8e0d0' } },
    vino:      { name: 'Vino del Bierzo', type: 'food', buy: 150, sell: 75, energy: 35, icon: { type: 'bottle', color: '#6a1a30' } },
    tortilla:  { name: 'Tortilla de patata', type: 'food', buy: 200, sell: 100, energy: 70, icon: { type: 'round', color: '#e0c05a', rx: 7, ry: 4 } },

    /* --- piensos y materiales --- */
    pienso:  { name: 'Pienso',      type: 'feed', buy: 35, sell: 15, icon: { type: 'sack', color: '#b08a52', letter: 'P' } },
    heno:    { name: 'Heno',        type: 'feed', buy: 25, sell: 10, icon: { type: 'sack', color: '#d9b45c', letter: 'H' } },
    grano:   { name: 'Grano',       type: 'feed', buy: 30, sell: 12, icon: { type: 'sack', color: '#e0c274', letter: 'G' } },
    abono:   { name: 'Abono',       type: 'material', buy: 70, sell: 30, icon: { type: 'sack', color: '#5a4a32', letter: 'A' } },
    lena:    { name: 'Leña',        type: 'material', sell: 25, buy: 50, icon: { type: 'wood' } },
    piedra:  { name: 'Piedra',      type: 'material', sell: 20, buy: 40, icon: { type: 'stone' } },
    flor:    { name: 'Flor silvestre', type: 'material', sell: 40, icon: { type: 'bouquet' } },

    /* --- especiales --- */
    ramo:   { name: 'Ramo de flores', type: 'special', buy: 900, desc: 'Se lo das a quien te gusta para pedirle noviazgo.', icon: { type: 'bouquet' } },
    anillo: { name: 'Anillo de pedida', type: 'special', buy: 5000, desc: 'Para pedir matrimonio a tu novia.', icon: { type: 'ring' } },
    trofeo: { name: 'Medalla del pueblo', type: 'special', sell: 0, icon: { type: 'star', color: '#f2d96a' } }
  };

  /* =============================================================== CROPS == */
  // stages: días entre fases (5 fases visuales). regrow: días para rebrotar.
  var CROPS = {
    patata:    { name: 'Patata',    seasons: [PRIMAVERA, OTONO],     stages: [1, 1, 2, 2], yield: [1, 3], type: 'root',  leaf: '#4d8a33', fruit: '#c9a163' },
    lechuga:   { name: 'Lechuga',   seasons: [PRIMAVERA],            stages: [1, 1, 1, 1], yield: [1, 1], type: 'leafy', leaf: '#7fc04a', fruit: '#7fc04a' },
    cebolla:   { name: 'Cebolla',   seasons: [PRIMAVERA, VERANO],    stages: [1, 1, 1, 2], yield: [1, 2], type: 'bulb',  leaf: '#6aa83a', fruit: '#e0b47a' },
    ajo:       { name: 'Ajo',       seasons: [PRIMAVERA],            stages: [1, 1, 1, 1], yield: [1, 2], type: 'bulb',  leaf: '#6aa83a', fruit: '#f0ece0' },
    zanahoria: { name: 'Zanahoria', seasons: [PRIMAVERA, OTONO],     stages: [1, 1, 1, 2], yield: [1, 2], type: 'root',  leaf: '#4d9a3a', fruit: '#e08a3a' },
    garbanzo:  { name: 'Garbanzo',  seasons: [VERANO],               stages: [2, 2, 2, 2], yield: [2, 4], type: 'pod',   leaf: '#5f9e3f', fruit: '#d9c48a' },
    alubia:    { name: 'Alubia',    seasons: [VERANO],               stages: [2, 2, 2, 1], yield: [1, 3], type: 'pod',   leaf: '#4d8a33', fruit: '#e8e0cc', regrow: 3 },
    tomate:    { name: 'Tomate',    seasons: [VERANO],               stages: [2, 2, 2, 2], yield: [1, 3], type: 'fruit', leaf: '#3f8a2f', fruit: '#d0342c', regrow: 3 },
    pimiento:  { name: 'Pimiento',  seasons: [VERANO],               stages: [2, 2, 2, 1], yield: [1, 2], type: 'fruit', leaf: '#3f8a2f', fruit: '#3f9e35', regrow: 3 },
    calabaza:  { name: 'Calabaza',  seasons: [OTONO],                stages: [3, 3, 3, 2], yield: [1, 2], type: 'fruit', leaf: '#4d8a33', fruit: '#e08a2a' },
    trigo:     { name: 'Trigo',     seasons: [VERANO, OTONO],        stages: [1, 1, 1, 2], yield: [2, 4], type: 'grain', leaf: '#9aa85a', fruit: '#e0c274' },
    berza:     { name: 'Berza',     seasons: [OTONO, INVIERNO],      stages: [1, 2, 2, 2], yield: [1, 2], type: 'leafy', leaf: '#4d8a45', fruit: '#4d8a45' },
    puerro:    { name: 'Puerro',    seasons: [OTONO, INVIERNO],      stages: [1, 2, 2, 2], yield: [1, 2], type: 'bulb',  leaf: '#a8d060', fruit: '#dfeec8' }
  };

  /* ============================================================= ANIMALES = */
  var ANIMALS = {
    cow: {
      name: 'Vaca', kind: 'cow', house: 'cuadra', price: 5500,
      product: 'leche', productTool: 'cubo', productEvery: 1, matureDays: 0,
      feed: ['heno', 'pienso'], sound: 'moo', speed: 8, w: 30, h: 14
    },
    sheep: {
      name: 'Oveja', kind: 'sheep', house: 'cuadra', price: 3800,
      product: 'leche_oveja', productTool: 'cubo', productEvery: 1,
      extra: 'lana', extraTool: 'tijeras', extraEvery: 4,
      feed: ['heno', 'pienso'], sound: 'baa', speed: 10, w: 22, h: 12, growsInto: null
    },
    lamb: {
      name: 'Cordero', kind: 'lamb', house: 'cuadra', price: 1500,
      matureDays: 10, growsInto: 'sheep', feed: ['heno'], sound: 'baa', speed: 14, w: 15, h: 9
    },
    chicken: {
      name: 'Gallina', kind: 'chicken', house: 'gallinero', price: 1200,
      product: 'huevo', productTool: null, productEvery: 1,
      feed: ['grano', 'pienso'], sound: 'cluck', speed: 12, w: 12, h: 9
    },
    chick: {
      name: 'Pollo', kind: 'chick', house: 'gallinero', price: 500,
      matureDays: 6, growsInto: 'chicken', feed: ['grano'], sound: 'cluck', speed: 16, w: 8, h: 6
    },
    donkey: {
      name: 'Burro', kind: 'donkey', house: 'cuadra', price: 4200,
      feed: ['heno', 'pienso'], sound: 'bray', speed: 9, w: 26, h: 14,
      perk: 'Lleva la carga: aumenta tu mochila y no te cansas tanto al andar.'
    }
  };

  /* ================================================================ NPCS == */
  // look → opciones del rig de personajes de art.js
  var NPCS = [
    {
      id: 'rosalia', name: 'Rosalía', role: 'Tendera de ultramarinos', romance: true, age: 29,
      look: { skin: '#e8b98c', hair: '#6a3a1a', hairStyle: 'long', shirt: '#c04a6a', pants: '#5a3a52', apron: '#efe6d2', boots: '#4a3218' },
      likes: ['flor', 'ramo', 'queso', 'tomate', 'vino'], loves: ['ramo', 'queso'],
      home: 'shop_food',
      lines: {
        0: ['¡Buenos días, Arricio! ¿Vienes a por pan?', 'Hoy ha entrado chorizo de la matanza.', 'En Sorríos nunca falta de nada… mientras yo abra la tienda.'],
        2: ['Me alegra verte, Arricio. ¿Cómo van las vacas?', 'Si te falta algo, dímelo y te lo guardo.'],
        4: ['Me gusta hablar contigo. Los días se hacen más cortos.', 'Mi madre siempre decía que un hombre que cuida su ganado cuida bien de todo.'],
        6: ['Te he guardado lo mejor del mostrador… no se lo digas a nadie.', '¿Sabes? Pienso en ti más de lo que debería.'],
        8: ['Arricio… ¿tú alguna vez has pensado en formar una familia aquí?'],
        10: ['Contigo hasta el invierno de Ordás parece templado.']
      }
    },
    {
      id: 'marina', name: 'Marina', role: 'Veterinaria y pastora', romance: true, age: 31,
      look: { skin: '#c98f5f', hair: '#241a12', hairStyle: 'bun', shirt: '#3f7a6a', pants: '#3a3f52', boots: '#3a2a18', hat: 'panuelo', hatColor: '#c9a95c' },
      likes: ['leche', 'lana', 'heno', 'flor'], loves: ['leche_oveja', 'ramo'],
      home: 'casa_marina',
      lines: {
        0: ['¿Tus animales están bien? Yo paso consulta por las mañanas.', 'Una vaca contenta da el doble de leche. Recuérdalo.'],
        2: ['Si les hablas mientras las ordeñas, se dejan mejor. Palabra de veterinaria.'],
        4: ['He visto tu cuadra. Se nota que las tratas bien.'],
        6: ['A veces subo al monte sola… no estaría mal tener compañía.'],
        8: ['Arricio, contigo el campo tiene otro color.'],
        10: ['Que sepas que yo no me quedaría en cualquier pueblo. Me quedo por ti.']
      }
    },
    {
      id: 'aurora', name: 'Aurora', role: 'Maestra de la escuela', romance: true, age: 27,
      look: { skin: '#f0cba8', hair: '#c9a05c', hairStyle: 'long', shirt: '#6a5aa8', pants: '#3a3550', boots: '#4a3a2a' },
      likes: ['flor', 'pan', 'lechuga', 'huevo'], loves: ['ramo', 'tortilla'],
      home: 'casa_aurora',
      lines: {
        0: ['Buenos días. Hoy tengo nueve niños en clase, ¡todo un récord!', 'Si algún día tienes hijos, tráemelos a la escuela.'],
        2: ['Me han contado que tu huerto va muy bien.'],
        4: ['Los domingos leo junto al río. Deberías pasarte.'],
        6: ['Me gusta que en este pueblo aún haya gente que madruga por la tierra.'],
        8: ['Arricio, contigo hablar es fácil. Y eso es raro.'],
        10: ['Yo vine aquí de paso… y ya ves.']
      }
    },
    {
      id: 'nieves', name: 'Nieves', role: 'Molinera', romance: true, age: 30,
      look: { skin: '#d9a97a', hair: '#8a6a3a', hairStyle: 'bun', shirt: '#a86a3a', pants: '#4a3a2a', apron: '#e8dcc4', boots: '#3a2a18' },
      likes: ['trigo', 'pan', 'flor', 'manteca'], loves: ['ramo', 'trigo'],
      home: 'casa_nieves',
      lines: {
        0: ['El molino sigue moliendo, como en tiempos de mi abuelo.', '¿Traes trigo? Te lo muelo en un rato.'],
        2: ['Con la harina de aquí sale el mejor pan de la comarca.'],
        4: ['Me gusta el ruido del agua. Es lo único que no cambia.'],
        6: ['Te veo pasar todos los días con el burro. Me hace gracia.'],
        8: ['Arricio, ¿te quedarías siempre en Sorríos?'],
        10: ['Contigo hasta las piedras del molino suenan mejor.']
      }
    },
    {
      id: 'bernardo', name: 'Bernardo', role: 'Dueño del almacén de aperos', age: 58,
      look: { skin: '#c98f5f', hair: '#8a8a82', hairStyle: 'bald', shirt: '#4a6a8a', pants: '#3a3f52', vest: '#6a5a3a', boots: '#3a2a18', beard: '#9a9a92' },
      likes: ['lena', 'piedra', 'vino'],
      home: 'shop_farm',
      lines: {
        0: ['Azada, pala, rastrillo… lo que necesite el hombre de campo.', 'Las semillas cambian con la estación, ojo con eso.',
            'Si me traes leña, te la pago bien.'],
        2: ['Tú sí sabes trabajar. Se ve en las manos.'],
        4: ['Cuando quieras, te aparto la mejor herramienta del almacén.']
      }
    },
    {
      id: 'segundo', name: 'Segundo', role: 'Tabernero', age: 52,
      look: { skin: '#e0a97a', hair: '#3a2a1a', hairStyle: 'short', shirt: '#8a3a3a', pants: '#3a3a42', apron: '#d8cdb4', boots: '#3a2a18', beard: '#3a2a1a' },
      likes: ['vino', 'chorizo', 'patata'],
      home: 'tavern',
      lines: {
        0: ['¡Arricio! Un vaso de vino y arreglamos el mundo.', 'Aquí se junta todo el pueblo cuando cae la noche.'],
        2: ['La casa invita si me traes patatas de las tuyas.'],
        4: ['Eres de los pocos que aún madrugan de verdad.']
      }
    },
    {
      id: 'casimiro', name: 'Don Casimiro', role: 'Párroco', age: 67,
      look: { skin: '#e8c9a0', hair: '#d8d8d0', hairStyle: 'bald', shirt: '#2a2a30', pants: '#2a2a30', boots: '#241a12' },
      likes: ['pan', 'vino', 'flor'],
      home: 'church',
      lines: {
        0: ['Que Dios reparta suerte y lluvia, Arricio.', 'Cuando tengas anillo y novia, yo os caso en la iglesia.',
            'La campana toca a las seis. Ni un minuto más.'],
        2: ['Este pueblo necesita gente joven que se quede.'],
        4: ['Reza poco y trabaja mucho, hijo. Ya rezo yo por ti.']
      }
    },
    {
      id: 'herminia', name: 'Herminia', role: 'La abuela del pueblo', age: 82,
      look: { skin: '#e0c0a0', hair: '#e8e8e0', hairStyle: 'bun', shirt: '#4a4a52', pants: '#2a2a30', apron: '#8a8a82', boots: '#241a12' },
      likes: ['leche', 'huevo', 'sopa', 'flor'],
      home: 'casa_herminia',
      lines: {
        0: ['Antes, en este pueblo, había ochenta vacas. Ochenta.', 'A las vacas se las ordeñaba a mano, con la frente pegada al costado.',
            'Come caliente, rapaz, que el invierno de Ordás no perdona.'],
        2: ['Tú me recuerdas a tu abuelo, que en gloria esté.'],
        4: ['Ven cuando quieras. Siempre tengo puchero al fuego.']
      }
    },
    {
      id: 'tino', name: 'Tino', role: 'Pastor', age: 61,
      look: { skin: '#c98f5f', hair: '#7a6a5a', hairStyle: 'short', shirt: '#6a6a3a', pants: '#4a4230', boots: '#3a2a18', hat: 'boina', hatColor: '#2a2a30', beard: '#8a7a6a' },
      likes: ['lana', 'heno', 'queso', 'vino'],
      home: 'casa_tino',
      lines: {
        0: ['Ochenta ovejas subí yo al puerto con catorce años.', 'Si esquilas en verano, la lana sale más limpia.',
            'Mira el cielo por la tarde: te dirá el tiempo de mañana.'],
        2: ['Buen rebaño llevas. Se nota quién sabe.'],
        4: ['Si te hace falta mano con las ovejas, aquí estoy.']
      }
    },
    {
      id: 'celso', name: 'Celso', role: 'Alcalde pedáneo', age: 55,
      look: { skin: '#e0a97a', hair: '#4a3a2a', hairStyle: 'short', shirt: '#3a5a7a', pants: '#2a3040', vest: '#6a3a3a', boots: '#3a2a18' },
      likes: ['calabaza', 'vino', 'trofeo'],
      home: 'casa_celso',
      lines: {
        0: ['Sorríos de Ordás: 41 vecinos y subiendo, si tú te quedas.', 'Cada estación hacemos fiesta en la plaza.',
            'Si sacas buena cosecha, te doy medalla del pueblo.'],
        2: ['Tú levantas este pueblo, Arricio.'],
        4: ['Cuando te cases, la plaza se llena. Palabra de alcalde.']
      }
    },
    {
      id: 'lucio', name: 'Lucio', role: 'Herrero', age: 44,
      look: { skin: '#a86a44', hair: '#241a12', hairStyle: 'short', shirt: '#5a5a62', pants: '#3a3a42', apron: '#6a4a2a', boots: '#241a12', beard: '#241a12' },
      likes: ['piedra', 'lena', 'chorizo'],
      home: 'casa_lucio',
      lines: {
        0: ['Si se te rompe la azada, tráemela.', 'El hierro y la tierra: de eso vive un pueblo.'],
        2: ['Te afilo la hoz gratis, que tú siegas mucho.']
      }
    },
    {
      id: 'chelo', name: 'Chelo', role: 'Cartera', age: 36,
      look: { skin: '#e8b98c', hair: '#3a2a1a', hairStyle: 'short', shirt: '#c9a95c', pants: '#3a5a7a', boots: '#3a2a18' },
      likes: ['cafe', 'pan', 'flor'],
      home: 'casa_chelo',
      lines: {
        0: ['Correo de Sorríos. Hoy no traigo nada para ti.', 'Subo y bajo el pueblo cuatro veces al día. Buena gimnasia.'],
        2: ['Si escribes a alguien, yo se lo llevo.']
      }
    }
  ];

  /* =============================================================== SHOPS == */
  var SHOPS = {
    comestibles: {
      name: 'Ultramarinos «La Reguera»',
      keeper: 'rosalia',
      desc: 'Comida para el hombre de la casa.',
      open: [8, 19],
      stock: ['pan', 'cafe', 'sopa', 'chorizo', 'empanada', 'tortilla', 'vino', 'cocido'],
      buysFrom: ['crop', 'product', 'material']
    },
    aperos: {
      name: 'Piensos y Aperos «Bernardo»',
      keeper: 'bernardo',
      desc: 'Piensos, semillas y herramienta de labranza.',
      open: [8, 18],
      stock: ['pienso', 'heno', 'grano', 'abono', 'azada', 'regadera', 'cubo', 'hoz', 'hacha', 'pala', 'rastrillo', 'tijeras', 'ramo', 'anillo'],
      seedsBySeason: true,
      livestock: true,
      buysFrom: ['crop', 'product', 'material', 'feed']
    }
  };

  /* ========================================================== DIÁLOGOS ==== */
  var SMALLTALK = {
    weather: {
      sol:    ['Buen día hace hoy, ¿eh?', 'Con este sol, el huerto crece solo.'],
      lluvia: ['Menuda agua cae. Buena para el campo.', 'Con la que está cayendo, hoy no riega nadie.'],
      nieve:  ['Nieve en Ordás… esto ya es invierno de verdad.', 'Abrígate, rapaz, que hiela.'],
      nublado:['Está el cielo pesado, va a llover.', 'Ni frío ni calor, día de trabajar.'],
      tormenta:['¡Qué tronada! Métete bajo techo.', 'Los truenos asustan al ganado.']
    },
    season: [
      ['Ya huele a primavera.', 'Este año viene bien de agua.'],
      ['Aprieta el calor en el valle.', 'A ver si sacamos buena cosecha.'],
      ['Se acorta el día, ya es otoño.', 'Hay que hacer la matanza pronto.'],
      ['Frío de Ordás, del que pela.', 'A ver si pasa pronto el invierno.']
    ]
  };

  var TIPS = [
    'Con la AZADA labras el huerto; luego siembras y riegas cada día.',
    'A las vacas y ovejas se las ordeña A MANO: acércate con el CUBO y sigue el ritmo.',
    'Las semillas solo crecen en su estación. Bernardo cambia el género cada estación.',
    'Da de comer al ganado todos los días en el comedero de la cuadra.',
    'Duerme antes de las 2 de la mañana o te desmayarás de cansancio.',
    'Regala cosas a los vecinos para hacer amistad. Cada uno tiene sus gustos.',
    'Con un RAMO DE FLORES puedes pedir noviazgo; con el ANILLO, matrimonio.',
    'Los hijos crecen y te echan una mano con los animales y el riego.',
    'El burro te deja llevar más cosas en la mochila.',
    'Vende tus productos en el mostrador de las tiendas.'
  ];

  G.DATA = {
    SEASON_NAMES: SEASON_NAMES,
    DAY_NAMES: DAY_NAMES,
    PRIMAVERA: PRIMAVERA, VERANO: VERANO, OTONO: OTONO, INVIERNO: INVIERNO,
    ITEMS: ITEMS, CROPS: CROPS, ANIMALS: ANIMALS, NPCS: NPCS, SHOPS: SHOPS,
    SMALLTALK: SMALLTALK, TIPS: TIPS,

    item: function (id) { return ITEMS[id]; },
    npc: function (id) { for (var i = 0; i < NPCS.length; i++) if (NPCS[i].id === id) return NPCS[i]; return null; },
    seedsForSeason: function (season) {
      var out = [];
      for (var id in ITEMS) {
        var it = ITEMS[id];
        if (it.type !== 'seed') continue;
        var cr = CROPS[it.crop];
        if (cr && cr.seasons.indexOf(season) >= 0) out.push(id);
      }
      return out;
    },
    cropDays: function (cropId) {
      var c = CROPS[cropId], n = 0;
      for (var i = 0; i < c.stages.length; i++) n += c.stages[i];
      return n;
    },
    // Fase visual (0..4) según días regados acumulados.
    cropStage: function (cropId, grow) {
      var c = CROPS[cropId], acc = 0;
      for (var i = 0; i < c.stages.length; i++) {
        acc += c.stages[i];
        if (grow < acc) return i;
      }
      return 4;
    }
  };

})(window);
