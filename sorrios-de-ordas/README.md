# 🐄 Sorríos de Ordás — La granja de Arricio

Simulador de granja completo y jugable **en el navegador y en el móvil Android**,
ambientado en el pueblo leonés de **Sorríos de Ordás**. Arricio tiene casa,
cuadra, gallinero y huerto; el pueblo tiene plaza, iglesia, taberna, tiendas y
vecinos con los que hablar, hacer amistad, salir, casarse y tener hijos.

Todo el juego son **ficheros de texto**: no hay ni una sola imagen. Los gráficos
(tiles, edificios, personajes, animales, cultivos e iconos) se generan por código
al arrancar, y el sonido se sintetiza con la Web Audio API.

---

## ▶️ Cómo jugar

**En el ordenador:** abre `index.html` en el navegador (o sirve la carpeta con
cualquier servidor: `python3 -m http.server`).

**En el móvil Android:**

1. Publica la carpeta (GitHub Pages, por ejemplo) y ábrela en Chrome.
2. Menú de Chrome → **«Añadir a pantalla de inicio»** / «Instalar aplicación».
3. Se instala como app con su icono, a pantalla completa y **funciona sin
   conexión** (service worker).

También funciona abriendo el `index.html` directamente desde el gestor de
archivos: el juego usa scripts clásicos, sin módulos ES, precisamente para eso.

---

## 🎮 Controles

| Acción | Teclado | Móvil |
|---|---|---|
| Moverse | `WASD` / flechas | joystick izquierdo |
| Acción / hablar / recoger | `A`, `E`, `espacio` | botón **A** |
| Usar herramienta / regalar | `F`, `Shift` | botón **✋** |
| Cambiar de herramienta | `Q` y `R`, `Tab`, `1`–`9` | botones **◀ ▶** |
| Menú (mochila, vecinos, granja, ayuda, ajustes) | `Esc`, `M` | botón **☰** |
| Ordeñar (minijuego) | `←` y `→` | botones **IZQ / DCHA** |

---

## 🌾 Qué se puede hacer

### La granja
- **Huerto** junto a la casa: labrar con la azada, sembrar, regar cada día y
  cosechar. 13 cultivos: patata, lechuga, cebolla, ajo, zanahoria, garbanzo,
  alubia, tomate, pimiento, calabaza, trigo, berza y puerro.
  Cada semilla solo crece **en su estación**; algunas (tomate, alubia, pimiento)
  rebrotan y se cosechan varias veces.
- **Cuadra**: vacas, ovejas, corderos y el burro. **Gallinero**: gallinas y pollos.
  Hay que darles de comer todos los días en el comedero; los animales contentos
  producen más. Los corderos se hacen ovejas y los pollos, gallinas.
- **Ordeño a mano, como antiguamente**: acércate a una vaca o una oveja con el
  **cubo** y sigue el ritmo alternando la mano izquierda y la derecha. Si te
  precipitas o te saltas el compás, la res se pone nerviosa.
- **Esquilar** las ovejas con las tijeras, recoger **huevos** a mano, cortar
  **leña** con el hacha, sacar **piedra** con la pala, segar con la hoz.
- **Cocina** en casa: queso, manteca, tortilla de patata, sopa de ajo,
  empanada y cocido maragato.
- **Caja de recogida** en la granja para vender la producción.

### El pueblo
- **Ultramarinos «La Reguera»** (Rosalía): comida para Arricio — pan, chorizo,
  café de puchero, sopa, empanada, tortilla, vino y cocido. Todo repone fuerzas.
- **Piensos y Aperos «Bernardo»**: pienso, heno, grano, abono, semillas de la
  estación, herramienta (azada, regadera, cubo, hoz, hacha, pala, rastrillo,
  tijeras), el **ramo de flores**, el **anillo de pedida** y **ganado**
  (vacas, ovejas, corderos, gallinas, pollos y un burro).
- **12 vecinos** con horarios propios: se mueven por el pueblo según la hora,
  abren su tienda, bajan a la taberna por la noche y vuelven a casa.
  Cada uno tiene sus gustos: regálale lo que le gusta y subirás corazones.
- **Noviazgo, boda e hijos**: con 8 ♥ y un **ramo de flores** te hacen novio;
  con 10 ♥ y el **anillo**, don Casimiro os casa en San Roque. Tu mujer se viene
  a la granja, te deja el almuerzo hecho y con el tiempo nacen los hijos, que
  crecen (bebé → niño → mozo) y **ayudan de verdad**: riegan el huerto y dan de
  comer al ganado.

### El tiempo y el calendario
- **Ciclo de día y noche** con amanecer, mediodía, atardecer y noche cerrada;
  la luz cambia de color y las farolas y ventanas se encienden.
- **Cuatro estaciones** de 28 días: primavera, verano, otoño e invierno.
  Cambian la hierba, los árboles (flor, verde, hoja seca, ramas peladas) y la
  duración del día.
- **Meteorología**: sol, nublado, lluvia (riega el huerto sola), **tormenta**
  con truenos y relámpagos, y **nieve** en invierno, que cubre el pueblo.
- Duerme antes de las 2 de la madrugada o te desmayarás de cansancio.

---

## 🗂️ Estructura del código

```
sorrios-de-ordas/
├── index.html            Lienzo, controles táctiles y pantalla de carga
├── styles.css            Contenedor, joystick y botones del móvil
├── manifest.webmanifest  Instalación como app en Android
├── sw.js                 Service worker (jugar sin conexión)
├── icons/                Iconos PNG de la aplicación
└── src/
    ├── core.js       Matemáticas, RNG, ruido, entrada (teclado + táctil),
    │                 sintetizador de audio y guardado en localStorage
    ├── art.js        Generación procedural de TODO el pixel art
    ├── data.js       Contenido: objetos, cultivos, animales, vecinos, tiendas
    ├── world.js      El valle (granja + pueblo), interiores y colisiones
    ├── time.js       Reloj, estaciones, meteorología y curva de luz
    ├── entities.js   Arricio, animales, vecinos con horarios e hijos
    ├── systems.js    Labrar/sembrar/regar/cosechar, ordeño, tiendas, relaciones
    ├── render.js     Cámara, orden por profundidad, iluminación y partículas
    ├── ui.js         HUD, menús, tiendas, diálogos y minijuego de ordeño
    ├── game.js       Máquina de estados, viajes entre mapas, guardar/cargar
    └── main.js       Arranque y bucle principal
```

La partida se guarda sola en `localStorage` al dormir y al salir del juego.
Desde **Menú → Ajustes** puedes guardar a mano, apagar el sonido o empezar de cero.

---

## 🔧 Detalles técnicos

- **Canvas 2D** a resolución interna baja con escalado entero, para que el pixel
  art quede nítido en cualquier pantalla (60 FPS medidos en escritorio y móvil).
- **Iluminación** por mapa de luz: color ambiente según la hora y la
  meteorología, multiplicado sobre la escena, con cúpulas aditivas para farolas,
  ventanas, la lumbre de la cocina y los relámpagos.
- **Orden por profundidad** (y-sorting) de edificios, árboles, animales y gente.
- **Mundo generado con semilla**: el valle siempre sale igual, y lo que talas o
  siembras se guarda en la partida.
- Sin dependencias, sin compilación, sin ficheros binarios salvo los iconos.
