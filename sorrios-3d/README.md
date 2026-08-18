# 🚜 Sorríos de Ordás 3D — Simulador de granja

Simulador de granja **en 3D**, al estilo *Farming Simulator*, jugable en el
navegador del ordenador y del **móvil Android**. Arricio tiene su finca en el
pueblo leonés de **Sorríos de Ordás**: tractor con aperos, campos que se aran,
siembran y cosechan, ganado que se ordeña **a mano**, huerto junto a la casa,
un pueblo con vecinos, y ciclo real de día y noche con las cuatro estaciones.

Está hecho con **three.js** (WebGL2) y **todo el arte se genera por código**:
no hay ni un modelo ni una textura descargados. Terreno, casas, tractor, vacas,
ovejas, gallinas, personas, cielo y meteorología se construyen al arrancar.

---

## ▶️ Cómo jugar

**Ordenador:** abre `index.html` (o sirve la carpeta: `python3 -m http.server`).
Haz clic para capturar el ratón y mirar alrededor.

**Android:**
1. Publica la carpeta (por ejemplo con GitHub Pages) y ábrela en Chrome.
2. Menú de Chrome → **«Añadir a pantalla de inicio» / «Instalar aplicación»**.
3. Se instala como app, a pantalla completa y **funciona sin conexión**.

La calidad gráfica se ajusta sola según el aparato (sombras, densidad de hierba
y distancia de visión), y se puede cambiar a mano en **Menú → Ajustes**.

---

## 🎮 Controles

| Acción | Teclado / ratón | Móvil |
|---|---|---|
| Andar | `W A S D` | joystick izquierdo |
| Correr | `Mayús` | botón ⏩ |
| Mirar | mover el ratón | arrastrar en la mitad derecha |
| Acción, hablar, recoger | `E` | botón **A** |
| Usar la herramienta / regalar | `F` | botón ✋ |
| Subir o bajar del tractor | `T` | botón 🚜 |
| Arrancar o parar el motor | `P` | botón **A** en el tractor |
| Bajar o subir el apero | `H` | — |
| Cambiar de apero | `C` | — |
| Cambiar de objeto en la mano | `Q` / `R` / teclas `1`-`9` | botones ◀ ▶ |
| Cambiar de cámara | `V` | — |
| Menú | `Esc` | botón ☰ |
| Ordeñar | `←` y `→` | botones IZQUIERDA / DERECHA |

---

## 🌾 Qué se puede hacer

### El tractor y los campos
- **Tractor** con cabina, ruedas motrices, faros que se encienden de noche,
  humo del escape, depósito de gasóleo y enganche de tres puntos.
- **Cuatro aperos**: arado de vertedera, sembradora, segadora-cosechadora y
  remolque. Se cambian con `C` y se bajan con `H`.
- **Tres campos grandes** (más de 400 parcelas): se **aran**, se **siembran**
  con la semilla que lleves en la mano y se **cosechan** cuando maduran.
  Los campos son de **secano**, como en León: crecen con la lluvia.
- Cultivos de campo: trigo, cebada, maíz y alfalfa.

### La granja
- **Huerto junto a la casa** que se trabaja a mano: azada, semilla y regadera.
  Patata, lechuga, cebolla, ajo, zanahoria, garbanzo, alubia, tomate, pimiento,
  calabaza, berza y puerro, cada uno en su estación.
- **Ganado en 3D con anatomía real**: vacas frisonas (con su ubre y sus pezones),
  ovejas con vellón, corderos, gallinas, pollos y un burro. Pastan, andan,
  mueven las orejas y el rabo, y hay que darles de comer todos los días.
- **Ordeño a mano, como antiguamente**: te acercas con el cubo y vas alternando
  la mano izquierda y la derecha siguiendo el compás. Si te precipitas o pierdes
  el ritmo, la res se pone nerviosa. Se ordeñan vacas **y ovejas**.
- **Esquileo** de las ovejas, recogida de huevos, leña y piedra.
- Nave, silo, cobertizo del tractor, gallinero, pozo, comedero y balas de forraje.

### El pueblo
- Plaza con farolas, iglesia con campanario, taberna, escuela, molino,
  cooperativa con silos y una docena de casas de piedra con tejado de teja.
- **Dos tiendas**: *Ultramarinos «La Reguera»* (comida para Arricio) y
  *Piensos y Aperos «Bernardo»* (piensos, semillas de temporada, herramienta,
  gasóleo y **ganado**).
- **Cooperativa** donde vender toda la cosecha de una vez.
- **12 vecinos** con rutina propia: abren su tienda, bajan a la taberna al
  anochecer y vuelven a casa. Cada uno con sus gustos.
- **Noviazgo, boda e hijos**: con 8 ♥ y un ramo de flores hay noviazgo; con
  10 ♥ y el anillo, don Casimiro os casa. Tu mujer se viene a la finca y con el
  tiempo nacen los hijos, que crecen (bebé → niño → mozo) y **ayudan**: riegan
  el huerto y dan de comer al ganado.

### El cielo
- **Sol con posición astronómica real** para la latitud de León (42,6° N):
  en verano amanece hacia las 5 y anochece pasadas las 19; en invierno el día
  dura poco más de nueve horas y el sol no sube de 30°.
- **Cuatro estaciones** de 28 días que cambian la hierba, los árboles y la luz.
- **Meteorología**: sol, nublado, lluvia, tormenta con relámpagos y truenos, y
  nieve. Cambia el cielo, la niebla, la luz y el sonido.
- De noche se encienden las farolas del pueblo, los faros del tractor y el
  farol de Arricio.

---

## 🗂️ Cómo está hecho

```
sorrios-3d/
├── index.html          Lienzo 3D, HUD en HTML y mandos táctiles
├── styles.css          Interfaz estilo simulador
├── vendor/three.min.js three.js r160 (incluido para poder jugar sin conexión)
└── src/
    ├── util.js       Matemáticas, ruido, aleatorio con semilla, guardado
    ├── textures.js   Todas las texturas pintadas por código, con mapas de
    │                 normales calculados con Sobel (piedra, teja, madera,
    │                 piel de vaca frisona, lana, plumas, neumático…)
    ├── data.js       Contenido: productos, cultivos, ganado, vecinos, tiendas
    ├── sky.js        Reloj, estaciones, posición real del sol, cúpula de cielo
    │                 con shader, luna, estrellas, nubes, lluvia y nieve
    ├── terrain.js    Terreno con relieve, mezcla de texturas para caminos,
    │                 río y manto de hierba instanciada con viento
    ├── models.js     Casas, nave, silo, iglesia, tiendas, vallas y arbolado
    ├── actors.js     Rig de personas y de animales, con marcha articulada
    ├── vehicles.js   Tractor y aperos
    ├── farm.js       Parcelas, labores, cultivos en 3D, ganado y ordeño
    ├── npcs.js       Vecinos, rutinas, amistad, pareja e hijos
    ├── audio.js      Motor, animales, lluvia y avisos sintetizados
    ├── input.js      Teclado, ratón con bloqueo de puntero y táctil
    ├── ui.js         HUD, menús, tiendas, diálogos y minijuego de ordeño
    ├── game.js       Montaje del valle, jugador, cámara y partida
    └── main.js       Arranque y bucle principal
```

La partida se guarda sola al dormir y al salir del juego (`localStorage`).

## 🔧 Detalles técnicos

- **three.js r160**, WebGL2, sombras PCF suaves, tonemapping ACES y espacio
  de color sRGB.
- **Mapa de entorno generado del propio cielo** (PMREM), que se refresca con la
  hora: sin él los metales (silo, chapa, tractor) se verían negros.
- **Hierba instanciada** con desplazamiento y viento resueltos en el vértice, y
  la altura del suelo leída de una textura de datos: sigue al jugador sin coste
  de CPU.
- **Terreno con dos texturas mezcladas** por atributo de vértice para los
  caminos y las eras.
- Ganado y vecinos se simulan con menos frecuencia cuando están lejos.
