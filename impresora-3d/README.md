# 🖨️ IMPRESORA 3D

**Convierte fotos y descripciones escritas en modelos 3D a todo color. Gratis, desde el móvil.**

Haz una foto a un objeto (o escribe «un tractor rojo con ruedas negras») y la app crea un modelo 3D con colores. Lo guarda en tus carpetas y lo puedes descargar para videojuegos (Unity, Godot, Unreal), Blender, redes sociales (imagen y vídeo) o tu impresora 3D (STL y 3MF a color).

- 💸 **Coste cero.** Solo usa modelos de IA de código abierto y servicios con plan gratuito. Sin tarjetas ni suscripciones.
- 📱 **App instalable (PWA).** Funciona en Android, iPhone, tablet y ordenador, y tu biblioteca se ve sin conexión.
- 🇪🇸 **Interfaz en español.**

---

## Índice

1. [Cómo funciona](#1-cómo-funciona)
2. [Publicar la app gratis (GitHub Pages)](#2-publicar-la-app-gratis-github-pages)
3. [Configurar Hugging Face (inicio de sesión)](#3-configurar-hugging-face)
4. [Sincronización opcional con Supabase](#4-sincronización-opcional-con-supabase)
5. [Instalar el servidor local en Windows 11 (Modo B)](#5-instalar-el-servidor-local-en-windows-11-modo-b)
6. [Cloudflare Tunnel: compartir tu servidor con amigos](#6-cloudflare-tunnel-compartir-tu-servidor)
7. [Instalar la app en Android y en iPhone](#7-instalar-la-app-en-android-y-en-iphone)
8. [El enlace para WhatsApp](#8-el-enlace-para-whatsapp)
9. [Límites de cada opción gratuita](#9-límites-de-cada-opción-gratuita)
10. [Pruebas realizadas](#10-pruebas-realizadas)
11. [Para programadores: estructura del código](#11-para-programadores)
12. [Problemas frecuentes](#12-problemas-frecuentes)
13. [Licencias de los modelos de IA](#13-licencias)

---

## 1. Cómo funciona

```
 📷 Foto ──► (comprimir · quitar fondo) ──────────────────────────► Imagen → 3D ──► 📦 Biblioteca
 ✍️ Texto ─► Texto → imagen ──► 👀 tú la apruebas o la regeneras ──┘                  (GLB, OBJ, STL, 3MF,
                                                                                      PNG y vídeo)
```

La IA puede funcionar de dos maneras (se elige en **Ajustes → Motor 3D**):

| | **Modo A · Nube gratuita** | **Modo B · Mi servidor** |
|---|---|---|
| Dónde se calcula | En los Spaces públicos de Hugging Face | En tu PC con tarjeta NVIDIA |
| Coste | 0 € | 0 € (solo la luz del PC) |
| Límite | Cupo diario de GPU y colas | Sin límites |
| Instalación | Ninguna | Script automático (§5) |
| Si se cierra la app | Se intenta retomar al volver | El trabajo sigue en el PC y el resultado aparece al volver |

En modo **Automático** (el que viene por defecto), la app usa tu servidor si está encendido y, si no, la nube.

**Modelos de IA elegidos** (comprobados en octubre de 2026):

| Tarea | Principal | Reserva |
|---|---|---|
| Imagen → 3D con color | `microsoft/TRELLIS.2` | `trellis-community/TRELLIS` → `stabilityai/stable-fast-3d` |
| Texto → imagen | `black-forest-labs/FLUX.1-schnell` | `evalstate/flux1_schnell` |
| Quitar fondo | En el propio Space (automático) | En el móvil con RMBG-1.4 (opcional, privado) |

Si un Space falla o está saturado, la app pasa sola al siguiente.

---

## 2. Publicar la app gratis (GitHub Pages)

Lo haces una sola vez y tardas unos 10 minutos. No hace falta instalar nada.

1. **Crea una cuenta en GitHub** (gratis): <https://github.com/signup>.
2. **Crea el repositorio:** entra en <https://github.com/new> y rellena:
   - *Repository name*: `impresora-3d`
   - Elige **Public** (GitHub Pages solo es gratis con repositorios públicos).
   - Pulsa **Create repository**.
3. **Sube el código.** Si ya está subido (por ejemplo, porque lo subió Claude), pasa al punto 4. Si no:
   - En la página del repositorio, pulsa **uploading an existing file**.
   - Arrastra todos los archivos de esta carpeta (excepto `node_modules` y `dist`) y pulsa **Commit changes**.
4. **Activa GitHub Pages:** en el repositorio ve a **Settings → Pages**. En *Source*, elige **GitHub Actions**.
5. **Publica:** ve a la pestaña **Actions**, elige «Publicar en GitHub Pages» y pulsa **Run workflow**. A partir de ahora, cada cambio en `main` se publica solo.
6. A los 2–3 minutos, tu app estará en:

   **`https://TU-USUARIO.github.io/impresora-3d/`**

   (en tu caso, `https://arricio.github.io/catedral-baloncesto/impresora-3d/`)

> **Netlify o Vercel en vez de GitHub Pages:** importa el repositorio y configura:
> - Comando de compilación: `npm run build`
> - Carpeta de salida: `dist`
> - Variables: `BASE_PATH=/` y `VITE_SITE_URL=https://tu-sitio.netlify.app/`

### Variables de entorno (opcionales)

Ningún token ni contraseña va en el código. Las variables están documentadas en [`.env.example`](.env.example). En GitHub se ponen en **Settings → Secrets and variables → Actions → pestaña Variables → New repository variable**:

| Variable | Para qué sirve |
|---|---|
| `VITE_HF_CLIENT_ID` | Botón «Iniciar sesión con Hugging Face» (§3) |
| `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` | Sincronizar móvil y ordenador (§4) |
| `VITE_MAX_IMAGE_MB` | Tamaño máximo de imagen (por defecto, 10) |

Después de añadirlas, vuelve a ejecutar el *workflow* (paso 5).

### Probarla en tu ordenador (opcional)

Necesitas tener instalado [Node.js 22](https://nodejs.org).

```bash
npm install
npm run dev            # abre http://localhost:5173
npm run build          # compila la versión final en dist/
```

Si abres la app con `?demo=1` al final de la dirección, se activa un **modo demostración**. Sirve para probar todas las pantallas sin gastar cupo, pero no usa IA.

---

## 3. Configurar Hugging Face

La app funciona sin iniciar sesión, pero entonces comparte un cupo anónimo pequeño. Si cada persona inicia sesión con **su cuenta gratuita**, usa su propio cupo diario.

### 3.1 Crear la aplicación OAuth (una sola vez, la haces tú)

1. Crea una cuenta gratis en <https://huggingface.co/join>.
2. Entra en <https://huggingface.co/settings/applications/new> y rellena:
   - *Application name*: `IMPRESORA 3D`
   - *Homepage URL*: `https://arricio.github.io/catedral-baloncesto/impresora-3d/`
   - *Redirect URLs*: `https://arricio.github.io/catedral-baloncesto/impresora-3d/`
   - *Scopes*: marca `openid`, `profile` e `inference-api`
3. Copia el **Client ID**. Es público, no es secreto. Guárdalo como variable `VITE_HF_CLIENT_ID` (§2) y vuelve a publicar.

### 3.2 Alternativa sin OAuth: token personal

En la app, ve a **Ajustes → Cuenta de Hugging Face → «Pega tu token de acceso»**. El token se crea en <https://huggingface.co/settings/tokens> (tipo **Read**) y se guarda **solo en ese dispositivo**.

---

## 4. Sincronización opcional con Supabase

Por defecto, todo se guarda **en el propio dispositivo**. Si quieres ver tus modelos en el móvil y en el ordenador:

1. Crea una cuenta gratis en <https://supabase.com> y pulsa **New project** (plan *Free*).
2. Ve a **SQL Editor → New query**, pega el contenido de [`supabase/esquema.sql`](supabase/esquema.sql) y pulsa **Run**. Esto crea las tablas, el almacén privado y las reglas de seguridad: cada usuario solo ve lo suyo.
3. Ve a **Authentication → URL Configuration**:
   - *Site URL*: `https://arricio.github.io/catedral-baloncesto/impresora-3d/`
   - *Redirect URLs*: añade la misma dirección.
4. (Opcional) Si quieres entrar con Google, ve a **Authentication → Providers → Google** y sigue sus instrucciones.
5. Ve a **Project Settings → API**. Copia la *Project URL* y la clave *anon public* en las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (§2). La clave *anon* es pública por diseño: la seguridad la dan las reglas del paso 2.

En **Ajustes → Sincronizar** verás el espacio usado frente al límite gratuito de 1 GB.

---

## 5. Instalar el servidor local en Windows 11 (Modo B)

Con esto, tu PC hace de "impresora" sin límites para ti y tus amigos. También es **gratis**: todo es software libre y solo gasta la luz del ordenador.

### Requisitos

| | Mínimo | Recomendado |
|---|---|---|
| Sistema | Windows 11 (o Windows 10 22H2) | Windows 11 |
| Tarjeta gráfica | NVIDIA con **16 GB** de VRAM (RTX 4060 Ti 16 GB, 4070 Ti Super, 4080, 3090…) | **24 GB** (RTX 3090/4090), que permite usar TRELLIS.2 |
| Memoria RAM | 16 GB | 32 GB (para FLUX en tarjetas de 16 GB) |
| Disco libre | 60 GB | 100 GB (SSD) |
| Internet | Para la instalación (descarga ~25 GB) | |

**Qué instala el script según tu equipo:**

| Tu tarjeta | Imagen→3D | Texto→imagen |
|---|---|---|
| 16–22 GB | TRELLIS (MIT) | FLUX.1-schnell si tienes ≥ 32 GB de RAM; si no, SDXL-Turbo |
| ≥ 24 GB | TRELLIS.2 (MIT, más calidad) | FLUX.1-schnell |

> ⚠️ Las RTX 50xx (Blackwell) todavía no están verificadas con TRELLIS en local y pueden necesitar ajustes manuales. Con ellas, de momento, usa el Modo A.

### Pasos

1. **Actualiza el controlador de NVIDIA** desde <https://www.nvidia.com/drivers> y reinicia.
2. **Descarga el código:** en GitHub, pulsa **Code → Download ZIP** y descomprímelo, por ejemplo, en `C:\impresora-3d`.
3. Abre la carpeta `servidor-local` y haz **doble clic en `INSTALAR.bat`**. Windows pedirá permiso de administrador: acepta.
4. El instalador hace todo solo:
   - Comprueba tu tarjeta y elige los modelos.
   - Activa **WSL2** e instala **Ubuntu 22.04**. *Si te pide reiniciar, reinicia y vuelve a hacer doble clic en `INSTALAR.bat`.*
   - Te pide una **contraseña** (mínimo 8 caracteres). Es la que darás a tus amigos.
   - Instala CUDA, Miniconda, TRELLIS, FLUX/SDXL-Turbo y `cloudflared` dentro de Ubuntu. Tarda **30–90 minutos**.
   - Crea en el escritorio el acceso **«IMPRESORA 3D - Servidor»**.
5. **Para encenderlo:** haz doble clic en **«IMPRESORA 3D - Servidor»** del escritorio. La primera vez descarga los modelos (~20 GB, unos minutos más). Deja la ventana abierta mientras quieras usarlo.

**Prueba sin GPU (opcional):** para comprobar que la app conecta con el servidor antes de instalar la IA, abre una terminal y ejecuta:

```bash
IMPRESORA_PRUEBA=1 IMPRESORA_CLAVE=una-clave python3 servidor-local/servidor.py
```

En lugar de modelos de IA, devuelve un cubo de colores.

---

## 6. Cloudflare Tunnel: compartir tu servidor

El script de inicio abre automáticamente un **túnel rápido de Cloudflare** (gratis y sin cuenta). Al encenderse, la ventana muestra algo así:

```
 ✅ Servidor encendido y publicado
    Dirección:  https://palabras-al-azar.trycloudflare.com
    Contraseña: tu-contraseña

 📲 ENLACE DE INVITACIÓN (envíalo por WhatsApp a tus amigos):
    https://arricio.github.io/catedral-baloncesto/impresora-3d/#/conectar?url=...&clave=...
 [código QR]
```

- **Tú y tus amigos:** abrid el **enlace de invitación** (o escanead el QR) desde el móvil y pulsad **Conectar**. La app guarda la dirección y la contraseña.
- **A mano:** en **Ajustes → Mi servidor**, pega la dirección y la contraseña, y pulsa **Guardar y comprobar**.
- **Es seguro:** la conexión va cifrada (https), el servidor exige la contraseña en cada petición y bloquea durante un rato a quien falla 10 veces seguidas. No hay que abrir puertos del router.
- ⚠️ **La dirección del túnel rápido cambia cada vez que enciendes el servidor.** Reenvía el nuevo enlace de invitación.

**¿Quieres una dirección fija?** Necesitas un dominio propio en Cloudflare. El túnel con nombre es gratis, pero el dominio no suele serlo.

1. En el [panel de Cloudflare Zero Trust](https://one.dash.cloudflare.com), ve a **Networks → Tunnels → Create a tunnel**.
2. Apunta un subdominio (por ejemplo `impresora.tudominio.com`) a `http://localhost:8188`.
3. En `/opt/impresora3d/servidor/config.json`, añade `"tunel_token": "…"` y `"tunel_url": "https://impresora.tudominio.com"`.

---

## 7. Instalar la app en Android y en iPhone

La primera vez que abres la app aparece una **pantalla de bienvenida** con los pasos para tu dispositivo.

**Android (Chrome):**
1. Abre la dirección de la app en **Chrome**.
2. Pulsa el botón **«Instalar app»** de la bienvenida, o abre el menú **⋮** y elige **«Instalar aplicación»**.
3. Aparece el icono en la pantalla de inicio. Se abre a pantalla completa y funciona sin conexión.

**iPhone / iPad (Safari):**
1. Abre la dirección de la app en **Safari** (no en Chrome).
2. Pulsa **Compartir** (el cuadrado con la flecha ⬆️).
3. Elige **«Añadir a pantalla de inicio»** y después **«Añadir»**.
4. Para recibir avisos de «modelo listo», abre la app **desde el icono** y activa las notificaciones en Ajustes. Hace falta iOS 16.4 o posterior.

**Descargas en el móvil:**
- **Android:** los archivos van a la carpeta **Descargas**.
- **iPhone:** se abre el menú Compartir. Elige **«Guardar en Archivos»** (modelos 3D) o **«Guardar imagen/vídeo»** (Fotos).
- Las imágenes y vídeos para redes se pueden **compartir directamente** a WhatsApp, Instagram o TikTok.

---

## 8. El enlace para WhatsApp

Tu enlace público es **`https://arricio.github.io/catedral-baloncesto/impresora-3d/`**.

- Al pegarlo en WhatsApp se ve con título, descripción e imagen, gracias a las etiquetas Open Graph y a `public/og-image.png`.
- Dentro de la app, ve a **Ajustes → Compartir e instalar**:
  - **«Compartir app»** abre el menú nativo del móvil.
  - **«WhatsApp»** abre directamente `https://wa.me/?text=…` con un mensaje y el enlace.
- Si cambias la imagen de vista previa, WhatsApp guarda la anterior unos días. Para forzar que la vuelva a leer, comparte el enlace con `?v=2` al final.

---

## 9. Límites de cada opción gratuita

Estas cifras las ponen los servicios y pueden cambiar. Son las de octubre de 2026.

| Servicio | Qué es gratis | Límites que notarás |
|---|---|---|
| **Hugging Face Spaces (Modo A)** | Usar los Spaces públicos con GPU *ZeroGPU* | **Cupo diario de GPU por cuenta:** unos pocos minutos al día. Sin sesión es aún menor y se comparte por conexión. Un modelo usa ~1–2 min de GPU, así que salen **~2–5 modelos al día** por cuenta. El modo «Rápida» gasta menos. El cupo se recarga en 24 h. **Colas:** en horas punta puede haber varios minutos de espera (la app muestra tu posición y el tiempo estimado). Un Space puede estar «dormido» o en mantenimiento, y entonces se usa el de reserva. |
| **Servidor local (Modo B)** | Todo (software libre) | Necesita tarjeta NVIDIA con ≥ 16 GB de VRAM (§5). Procesa **un trabajo cada vez**, con cola. Tarda ~1–3 min por modelo (TRELLIS en una RTX 4090: ~1 min). El PC tiene que estar encendido. |
| **Cloudflare Tunnel (rápido)** | Sin cuenta y sin límite de uso | La dirección cambia en cada arranque. Sin garantía de disponibilidad. Hasta ~200 peticiones simultáneas (de sobra). |
| **GitHub Pages** | Alojamiento de la app | Repositorio público. Sitio de hasta 1 GB y ~100 GB de tráfico al mes (límite orientativo). |
| **Almacenamiento en el dispositivo** | IndexedDB del navegador | Depende del navegador: suele ser cientos de MB o varios GB (la biblioteca muestra el espacio usado y el disponible). En iPhone, si la app **no está instalada** y no la abres en semanas, Safari puede borrar los datos: instálala y haz copias ZIP. |
| **Supabase (opcional)** | Proyecto gratuito | **1 GB de archivos** y 500 MB de base de datos (unos 150–300 modelos). El proyecto **se pausa tras 7 días sin uso**: se reactiva desde su panel. |

---

## 10. Pruebas realizadas

Pruebas automáticas con **Playwright + Chromium** (`npm test`) contra la versión compilada. Se usa el modo demostración para no gastar cupo y un servidor local en *modo prueba*. Se probó en estos tamaños, en vertical y en horizontal:

| Perfil | Pantalla | Representa |
|---|---|---|
| `android-360` | 360 × 740 | Android pequeño |
| `android-pixel7` | 412 × 915 | Android (Pixel 7) |
| `iphone-390` | 390 × 664 | iPhone 14 (agente de usuario de iOS) |
| `iphone-430` | 430 × 740 | iPhone 14 Pro Max |
| `android-horizontal` | 863 × 360 | Android en horizontal |
| `tablet` | 810 × 1080 | iPad |
| `ordenador` | 1440 × 900 | Ordenador de sobremesa / portátil |

**Qué se comprueba:**
- ✅ Pantalla de bienvenida con instrucciones de instalación según el dispositivo.
- ✅ Barra inferior con botones de **≥ 44 px** y **sin scroll horizontal** en todos los anchos.
- ✅ «Hacer foto» usa la cámara trasera (`capture="environment"`). Se rechazan archivos que no son PNG/JPG y los de más de 10 MB, con un mensaje claro.
- ✅ Foto → progreso por estados → impresora animada → modelo en la biblioteca.
- ✅ Texto → imagen intermedia → «Otra imagen» → «Crear 3D» → modelo, con estilo y colores.
- ✅ Descargas **GLB** (cabecera glTF válida), **STL**, **3MF a color** (con `basematerials` y milímetros) y **OBJ + MTL + texturas** (ZIP).
- ✅ Captura PNG 1:1 y **vídeo 9:16** del modelo girando.
- ✅ Carpetas: crear, renombrar, mover modelos, filtrar por tipo, buscar, descargar la carpeta en ZIP y borrar.
- ✅ Copia de seguridad: exportar el ZIP en un "dispositivo" e importarlo en otro vacío.
- ✅ **Sin conexión:** la biblioteca y el visor 3D funcionan, y se avisa de que imprimir necesita internet.
- ✅ Modo B: detecta el servidor encendido, genera el modelo en él, **recupera el resultado tras cerrar la app a mitad**, muestra un mensaje claro si la contraseña es incorrecta, pasa a la nube si el servidor está apagado y configura el servidor desde el enlace de invitación.
- ✅ Tema claro, ahorro de datos, enlace `wa.me`, etiquetas Open Graph y manifiesto instalable.

**Lo que se debe probar a mano en móviles reales** (no se puede automatizar aquí):
- Instalación real en la pantalla de inicio (Chrome Android y Safari iOS).
- Abrir la cámara real y los gestos táctiles con dos dedos sobre el visor.
- Notificaciones con la pantalla bloqueada.
- Guardar en Archivos/Fotos (iPhone) y compartir a WhatsApp, Instagram o TikTok.
- Generación real con los Spaces de Hugging Face y con un PC con GPU NVIDIA.

---

## 11. Para programadores

```
src/
├── motor/            Capa «motor 3D» (misma interfaz para nube, servidor local y demostración)
│   ├── tipos.ts        Contrato Motor, progreso y errores amables
│   ├── nube.ts         Modo A: @gradio/client + adaptadores de cada Space + cadena de reserva
│   ├── local.ts        Modo B: API REST del servidor local (cola persistente)
│   ├── demo.ts         Motor de demostración (?demo=1) para pruebas
│   ├── index.ts        Selección automática y detección del servidor local
│   ├── trabajo.ts      Orquestador: foto/texto → imagen → 3D, retomar al volver, notificaciones
│   └── prompts.ts      Estilos y construcción del prompt (respetando colores)
├── exportar/         GLB · glTF · OBJ+MTL · STL · 3MF a color · PNG · vídeo MP4/WebM · ZIP
├── sync/supabase.ts  Sincronización opcional
├── lib/              Base de datos (Dexie/IndexedDB), ajustes, imagen, red, plataforma, notificaciones…
├── componentes/      Visor3D, ImpresoraAnimada, BarraNavegacion, BarraProgreso, piezas de interfaz
├── pantallas/        Imprimir · Biblioteca · DetalleModelo · Ajustes · Bienvenida · Conectar
└── sw.ts             Service Worker (sin conexión + Web Push)
servidor-local/       Servidor FastAPI + instaladores (Windows/WSL2) + Cloudflare Tunnel
supabase/esquema.sql  Tablas y reglas de seguridad
pruebas/              Pruebas Playwright
```

Comandos: `npm run dev`, `npm run build`, `npm run lint`, `npm test` (antes, `npm run build`), `npm run imagenes` (regenera los iconos y la imagen de WhatsApp) y `npm run servidor:prueba`.

---

## 12. Problemas frecuentes

| Problema | Solución |
|---|---|
| «Has gastado el cupo gratuito de GPU de hoy» | Inicia sesión con Hugging Face, espera unas horas o usa tu servidor local. |
| «Los servidores gratuitos están muy llenos» | Espera un minuto y pulsa **Reintentar**. La app prueba sola los Spaces de reserva. |
| El modelo sale con trozos raros | Usa una foto con **un solo objeto**, centrado, bien iluminado y con fondo liso. |
| En iPhone no llegan notificaciones | Instala la app en la pantalla de inicio y ábrela desde el icono (iOS 16.4+). |
| El instalador dice que falta virtualización | Activa *Intel VT-x* o *AMD-V/SVM* en la BIOS. |
| «La tarjeta gráfica se quedó sin memoria» | Cierra juegos y otros programas, o usa la calidad «Rápida». |
| Mis amigos no conectan con el servidor | La dirección del túnel cambió al reiniciar: reenvía el nuevo enlace de invitación. |
| WhatsApp muestra una vista previa antigua | Comparte el enlace con `?v=2` al final. |

---

## 13. Licencias

- **Código de IMPRESORA 3D:** MIT.
- **TRELLIS / TRELLIS.2** (Microsoft): MIT.
- **FLUX.1-schnell** (Black Forest Labs): Apache 2.0.
- **Stable Fast 3D** y **SDXL-Turbo** (Stability AI): Stability AI Community License (gratis para uso personal y para pequeñas empresas).
- **RMBG-1.4** (BRIA, para quitar el fondo en el móvil): solo uso no comercial.

Los Spaces de Hugging Face los mantienen sus autores. Si alguno deja de funcionar, la app pasa al siguiente y puedes cambiar la lista en `src/motor/nube.ts`.
