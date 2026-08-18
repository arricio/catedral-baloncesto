# 🐂 Sorríos de Ordás 3D — Simulador de granja de antes

Simulador de granja **en 3D**, jugable en el navegador del ordenador y en el
**móvil Android**. **Nazario** tiene su casa, su cuadra y su huerta en el pueblo
leonés de **Sorríos de Ordás**, y trabaja la tierra **como se hacía antes**:
**sin un solo tractor**. Se unce la yunta —dos vacas, o el burro **Carolo**—, se
engancha el arado de madera, se siega con la guadaña, se acarrea en el carro del
país y se ordeña a mano en el caldero.

Está hecho con **three.js** (WebGL2) y **todo el arte se genera por código**: no
hay ni un modelo ni una textura descargados. Terreno, casas, ganado, personas,
aperos, cielo y meteorología se construyen al arrancar el juego.

---

## ▶️ Cómo jugar

**Ordenador:** abre `index.html` (o sirve la carpeta: `python3 -m http.server`).
Haz clic para capturar el ratón y mirar alrededor.

**Android:**
1. Publica la carpeta (por ejemplo con GitHub Pages) y ábrela en Chrome.
2. Menú de Chrome → **«Añadir a pantalla de inicio» / «Instalar aplicación»**.
3. Se instala como app, a pantalla completa y **funciona sin conexión**.

La calidad gráfica se ajusta sola según el aparato (sombras, oclusión ambiental,
densidad de hierba y distancia de visión) y se puede cambiar a mano en
**Menú → Ajustes**.

---

## 🎮 Controles

| Acción | Teclado / ratón | Móvil |
|---|---|---|
| Andar | `W A S D` | joystick izquierdo |
| Correr | `Mayús` | botón ⏩ |
| Mirar | mover el ratón | arrastrar en la mitad derecha |
| Acción, hablar, recoger | `E` | botón **A** |
| Usar la herramienta / regalar | `F` | botón ✋ |
| Uncir la yunta / ponerse al arado | `T` | botón 🐂 |
| Clavar o levantar el apero | `H` | — |
| Cambiar de apero (arado, grada, carro) | `C` | — |
| Cambiar de objeto en la mano | `Q` / `R` / teclas `1`-`9` | botones ◀ ▶ |
| Cambiar de cámara | `V` | — |
| Menú | `Esc` | botón ☰ |
| Ordeñar | `←` y `→` | botones IZQUIERDA / DERECHA |

---

## 🌾 Qué se puede hacer

### La yunta y los campos — aquí no hay máquinas
- **Yunta de dos vacas** al yugo, o el **burro Carolo** él solo. Se uncen con la
  **aguijada** en la mano, y el ganadero va andando detrás, agarrado a la
  mancera.
- **Tres aperos de madera**: **arado**, **grada** de sembrar y **carro del
  país**. El arado solo abre surco cuando va **clavado**; la grada tapa la
  simiente; el carro acarrea hasta 40 cargas de hierba o de grano.
- Las bestias se **cansan**: cuanto más rato tiran con el arado clavado, más
  despacio van. Hay que darles descanso.
- **Tres campos grandes** (más de 400 parcelas) que se aran, se siembran y se
  siegan. Son de **secano**, como en León: crecen con la lluvia.
- Cultivos de campo: trigo, centeno, cebada y alfalfa.
- **La hierba del prado se siega con la guadaña** (o con la hoz en los ribazos)
  y se carga en el carro con la horca.

### La casa y la huerta
- **Huerta junto a la casa, cavada a mano** con la **azada** o el **azadón**;
  después se siembra y se riega con la regadera, que se llena en el pozo.
  Patata, lechuga, cebolla, ajo, zanahoria, garbanzo, alubia, tomate, pimiento,
  calabaza, berza y puerro, cada uno en su estación.
- **Ganado en 3D con anatomía**: vacas frisonas con su ubre, ovejas con vellón,
  corderos, gallinas, pollos y el burro Carolo. Pastan, andan, mueven las orejas
  y el rabo, y hay que echarles de comer todos los días.
- **Ordeño a mano con el caldero**: te acercas a la vaca o a la oveja y vas
  alternando la mano izquierda y la derecha siguiendo el compás. Si te
  precipitas o pierdes el ritmo, la res se pone nerviosa.
- **Esquileo** de las ovejas con las tijeras, recogida de huevos, leña con el
  hacha y piedra con la pala.
- **Cocina de casa**: queso de vaca y de oveja, manteca, tortilla, sopa de ajo,
  empanada y cocido maragato.
- La granja tiene cuadra, **tenada**, gallinero, **panera** sobre pegollos,
  cobertizo de aperos, pozo, comedero y almiares de hierba. **No hay silos.**

### El pueblo
- Plaza con farolas, **ermita** (aquí no hay iglesia), taberna, escuela, molino,
  la **panera del concejo** y una docena de casas de piedra con teja del país.
- **Dos tiendas**:
  - *Ultramarinos «La Reguera»*, de **Noemi**: la comida de Nazario.
  - *Aperos y Piensos de **Jeremías***: piensos, abono, semillas de la estación,
    la herramienta de siempre (azada, azadón, guadaña, hoz, caldero, horca,
    rastrillo, regadera, tijeras, hacha, pala y aguijada), el ramo, el anillo
    y **ganado**.
- **La panera del concejo**, donde se vende toda la cosecha de una vez.
- **Diez vecinos** con su rutina: **Noemi**, **Nieves** la molinera, **Julita**
  la maestra, **Mari Nieves** la vaquera, **Arricio** —el dueño de la taberna—,
  **Jeremías**, **Alfonso** el pastor, **Josep** el hortelano, **Tornillos** el
  manitas y **Mario**, el alcalde pedáneo y cartero. Abren su negocio, bajan a
  la taberna al anochecer y vuelven a casa. Cada uno con sus gustos.
- **Noviazgo, boda e hijos**: con 8 ♥ y un ramo hay noviazgo; con 10 ♥ y el
  anillo, boda en la ermita. Tu mujer se viene a la casa y con el tiempo nacen
  los hijos, que crecen (bebé → niño → mozo) y **ayudan de verdad**: riegan la
  huerta y echan de comer al ganado.

### El cielo
- **Sol con posición astronómica real** para la latitud de León (42,6° N): en
  verano amanece hacia las 5 y anochece pasadas las 19; en invierno el día dura
  poco más de nueve horas y el sol no sube de 30°.
- **Cuatro estaciones** de 28 días que cambian la hierba, el arbolado y la luz.
- **Meteorología**: sol, nublado, lluvia, tormenta con relámpagos y truenos, y
  nieve. Cambian el cielo, la niebla, la luz y el sonido.
- De noche se encienden las farolas del pueblo y el farol de Nazario.

### Nazario
Gafas cuadradas de pasta marrón de las de antes, **boina negra** siempre calada
y la ropa remendada. Su burro se llama **Carolo**.

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
    │                 normales calculados con Sobel y mapas de rugosidad
    │                 (piedra, teja, cal, madera, hoja, piel de frisona,
    │                 lana, plumas…)
    ├── data.js       Aperos antiguos, cultivos, ganado, vecinos y tiendas
    ├── sky.js        Reloj, estaciones, posición real del sol, cúpula de cielo
    │                 con shader, luna, estrellas, nubes, lluvia y nieve
    ├── terrain.js    Terreno con relieve, mezcla de texturas para caminos,
    │                 río y manto de hierba instanciada con viento
    ├── models.js     Casas, cuadra, tenada, panera, ermita, tiendas, vallas,
    │                 arbolado y los aperos de madera (yugo, arado, grada, carro)
    ├── actors.js     Rig de personas y de animales, con marcha articulada
    ├── yunta.js      Uncir el ganado, tiro, fatiga y aperos enganchados
    ├── farm.js       Parcelas, labores, cultivos en 3D, ganado y ordeño
    ├── npcs.js       Vecinos, rutinas, amistad, pareja e hijos
    ├── post.js       Oclusión ambiental, resplandor, curva ACES y grano
    ├── audio.js      Animales, lluvia, campana y avisos sintetizados
    ├── input.js      Teclado, ratón con bloqueo de puntero y táctil
    ├── ui.js         HUD, menús, tiendas, diálogos y minijuego de ordeño
    ├── game.js       Montaje del valle, jugador, cámara y partida
    └── main.js       Arranque y bucle principal
```

La partida se guarda sola al dormir y al salir del juego (`localStorage`).

## 🔧 Detalles técnicos

- **three.js r160**, WebGL2, sombras PCF suaves y espacio de color sRGB.
- **Cadena de posprocesado propia** (`post.js`), porque la compilación UMD de
  three.js no trae `EffectComposer`: búfer en coma flotante, **oclusión
  ambiental** deducida de la profundidad, desenfoque separable, **resplandor**
  de las luces, curva de tono **ACES**, ajuste de color, viñeteado, grano de
  película y realce de nitidez.
- **Mapa de entorno generado del propio cielo** (PMREM), que se refresca con la
  hora: sin él, los metales se verían negros.
- **Hierba instanciada** con el viento y la altura del suelo resueltos en el
  vértice, leyendo el relieve de una textura de datos: el manto sigue al
  jugador sin coste de CPU.
- **Terreno con dos texturas mezcladas** por atributo de vértice para los
  caminos y las eras, y una **segunda frecuencia normalizada** encima para que
  no se vea el patrón de baldosa a lo lejos.
- Ganado y vecinos se simulan con menos frecuencia cuando están lejos.

### Hasta dónde llega

El fotorrealismo se busca con lo que se puede tener sin descargar nada: PBR con
mapas de normales y rugosidad, oclusión ambiental, iluminación solar física,
posprocesado de cine y geometría con relieve. Aun así, un juego cuyo arte se
pinta por código en el arranque no da el nivel de detalle de un motor con
escaneados fotogramétricos de decenas de gigas; lo que sí da es que **todo
funcione sin conexión, en el móvil y sin un solo fichero binario**.
