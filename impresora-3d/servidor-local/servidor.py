"""
IMPRESORA 3D · Servidor local (Modo B)
=====================================

Servidor gratuito para tu PC con tarjeta NVIDIA. Convierte imágenes en modelos 3D
con TRELLIS (o TRELLIS.2) y textos en imágenes con FLUX.1-schnell (o SDXL-Turbo).

- Cola de trabajos guardada en disco (SQLite): si el móvil se bloquea o se cierra
  la app, el trabajo sigue y el resultado queda guardado 48 horas.
- Protegido con una contraseña compartida (cabecera «Authorization: Bearer ...»).
- Envía notificaciones Web Push al móvil cuando el modelo está listo.
- Pensado para exponerse con Cloudflare Tunnel (ver iniciar.sh).

Modo de prueba (sin GPU ni modelos, devuelve un cubo de colores):
    IMPRESORA_PRUEBA=1 python servidor.py
"""

from __future__ import annotations

import base64
import io
import json
import os
import sqlite3
import struct
import sys
import threading
import time
import traceback
import uuid
from contextlib import closing
from pathlib import Path
from typing import Any, Callable

from fastapi import FastAPI, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

VERSION = "1.0.0"
RAIZ = Path(__file__).resolve().parent
DATOS = Path(os.environ.get("IMPRESORA_DATOS", RAIZ / "datos"))
DATOS.mkdir(parents=True, exist_ok=True)
PRUEBA = os.environ.get("IMPRESORA_PRUEBA") == "1"
HORAS_CONSERVAR = 48
MAX_BYTES_IMAGEN = 15 * 1024 * 1024


# ──────────────────────────────────────────────────────────────
#  Configuración (config.json, creada por el instalador)
# ──────────────────────────────────────────────────────────────

def cargar_config() -> dict[str, Any]:
    ruta = Path(os.environ.get("IMPRESORA_CONFIG", RAIZ / "config.json"))
    config = {
        "clave": "",
        "modelo_3d": "trellis",  # "trellis" (≥16 GB) o "trellis2" (≥24 GB)
        "texto_imagen": "flux-schnell",  # "flux-schnell" o "sdxl-turbo"
        "descargar_a_cpu": True,  # FLUX con descarga a RAM si la VRAM no llega
        "url_app": "https://arricio.github.io/impresora-3d/",
        "puerto": 8188,
    }
    if ruta.exists():
        config.update(json.loads(ruta.read_text(encoding="utf-8-sig")))
    if os.environ.get("IMPRESORA_CLAVE"):
        config["clave"] = os.environ["IMPRESORA_CLAVE"]
    if not config["clave"]:
        sys.exit("❌ Falta la contraseña. Ejecuta el instalador o define IMPRESORA_CLAVE.")
    return config


CONFIG = cargar_config()


# ──────────────────────────────────────────────────────────────
#  Base de datos de trabajos
# ──────────────────────────────────────────────────────────────

BD = DATOS / "trabajos.sqlite"
_cerrojo_bd = threading.Lock()


def bd() -> sqlite3.Connection:
    con = sqlite3.connect(BD, timeout=30)
    con.row_factory = sqlite3.Row
    return con


with closing(bd()) as con:
    con.execute(
        """create table if not exists trabajos (
            id text primary key, tipo text, estado text, etapa text, progreso real,
            creado real, inicio real, fin real, error text,
            entrada text, resultado text, parametros text, push text)"""
    )
    # Si el servidor se apagó a mitad de un trabajo, vuelve a la cola.
    con.execute("update trabajos set estado='cola', progreso=0 where estado='procesando'")
    con.commit()


def actualizar(id_: str, **campos: Any) -> None:
    claves = ", ".join(f"{k}=?" for k in campos)
    with _cerrojo_bd, closing(bd()) as con:
        con.execute(f"update trabajos set {claves} where id=?", (*campos.values(), id_))
        con.commit()


def obtener(id_: str) -> sqlite3.Row | None:
    with closing(bd()) as con:
        return con.execute("select * from trabajos where id=?", (id_,)).fetchone()


def duracion_media(tipo: str) -> float:
    with closing(bd()) as con:
        fila = con.execute(
            "select avg(fin-inicio) from (select fin, inicio from trabajos where tipo=? and estado='listo' order by fin desc limit 10)",
            (tipo,),
        ).fetchone()
    return float(fila[0]) if fila and fila[0] else (25.0 if tipo == "texto-imagen" else 120.0)


def limpiar_antiguos() -> None:
    limite = time.time() - HORAS_CONSERVAR * 3600
    with _cerrojo_bd, closing(bd()) as con:
        for fila in con.execute("select id, entrada, resultado from trabajos where creado < ?", (limite,)).fetchall():
            for ruta in (fila["entrada"], fila["resultado"]):
                if ruta:
                    Path(ruta).unlink(missing_ok=True)
        con.execute("delete from trabajos where creado < ?", (limite,))
        con.commit()


# ──────────────────────────────────────────────────────────────
#  Notificaciones Web Push (claves VAPID generadas una sola vez)
# ──────────────────────────────────────────────────────────────

RUTA_VAPID = DATOS / "vapid_privada.pem"
CLAVE_PUBLICA_PUSH = ""

try:
    from py_vapid import Vapid01
    from cryptography.hazmat.primitives import serialization

    vapid = Vapid01.from_file(str(RUTA_VAPID)) if RUTA_VAPID.exists() else None
    if vapid is None:
        vapid = Vapid01()
        vapid.generate_keys()
        vapid.save_key(str(RUTA_VAPID))
    crudo = vapid.public_key.public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
    CLAVE_PUBLICA_PUSH = base64.urlsafe_b64encode(crudo).decode().rstrip("=")
except Exception as e:  # pragma: no cover - las notificaciones son opcionales
    print(f"⚠️  Notificaciones push desactivadas: {e}")


def enviar_push(suscripcion: str | None, titulo: str, cuerpo: str, url: str) -> None:
    if not suscripcion or not CLAVE_PUBLICA_PUSH:
        return
    try:
        from pywebpush import webpush

        webpush(
            subscription_info=json.loads(suscripcion),
            data=json.dumps({"titulo": titulo, "cuerpo": cuerpo, "url": url}),
            vapid_private_key=str(RUTA_VAPID),
            vapid_claims={"sub": "mailto:impresora3d@example.com"},
            ttl=86400,
        )
    except Exception as e:
        print(f"⚠️  No se pudo enviar la notificación: {e}")


# ──────────────────────────────────────────────────────────────
#  Modelos de IA (se cargan al primer uso y se turnan en la GPU)
# ──────────────────────────────────────────────────────────────

Progreso = Callable[[str, float], None]


class GestorModelos:
    """Mantiene en la GPU un solo modelo grande cada vez (16 GB no dan para dos)."""

    def __init__(self) -> None:
        self.cargados: dict[str, Any] = {}

    def _liberar_excepto(self, nombre: str) -> None:
        for otro in [k for k in self.cargados if k != nombre]:
            del self.cargados[otro]
        try:
            import gc

            import torch

            gc.collect()
            torch.cuda.empty_cache()
        except Exception:
            pass

    def obtener(self, nombre: str, cargar: Callable[[], Any]) -> Any:
        if nombre not in self.cargados:
            self._liberar_excepto(nombre)
            print(f"⏳ Cargando {nombre}… (la primera vez se descarga, puede tardar)")
            self.cargados[nombre] = cargar()
            print(f"✅ {nombre} listo")
        return self.cargados[nombre]


GESTOR = GestorModelos()


def info_gpu() -> tuple[str, float]:
    if PRUEBA:
        return "Modo prueba (sin GPU)", 0.0
    try:
        import torch

        p = torch.cuda.get_device_properties(0)
        return p.name, round(p.total_memory / 1024**3, 1)
    except Exception:
        return "Sin GPU NVIDIA", 0.0


GPU, VRAM = info_gpu()


def instalar_progreso_tqdm(prefijo: str, al_progresar: Progreso, tramos: list[tuple[str, float, float]]) -> None:
    """Sustituye tqdm en los módulos de TRELLIS para saber por qué paso va la IA."""
    contador = {"i": 0}

    import tqdm as tqdm_mod

    original = tqdm_mod.tqdm

    class TqdmProgreso(original):  # type: ignore[misc, valid-type]
        def __init__(self, *a: Any, **k: Any) -> None:
            k["disable"] = True
            super().__init__(*a, **k)
            self._tramo = tramos[min(contador["i"], len(tramos) - 1)]
            contador["i"] += 1

        def update(self, n: float = 1) -> bool | None:
            r = super().update(n)
            if self.total:
                etapa, desde, hasta = self._tramo
                al_progresar(etapa, desde + (hasta - desde) * min(1.0, self.n / self.total))
            return r

    for nombre, modulo in list(sys.modules.items()):
        if nombre.startswith(prefijo) and getattr(modulo, "tqdm", None) is original:
            modulo.tqdm = TqdmProgreso  # type: ignore[attr-defined]


def imagen_a_3d(entrada: Path, salida: Path, detalle: str, al_progresar: Progreso) -> None:
    import random

    from PIL import Image

    imagen = Image.open(entrada)
    semilla = random.randint(0, 2**31 - 1)
    rapido = detalle == "rapido"

    if CONFIG["modelo_3d"] == "trellis2":
        os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")
        import o_voxel
        from trellis2.pipelines import Trellis2ImageTo3DPipeline

        def cargar() -> Any:
            p = Trellis2ImageTo3DPipeline.from_pretrained("microsoft/TRELLIS.2-4B")
            p.cuda()
            return p

        pipeline = GESTOR.obtener("TRELLIS.2", cargar)
        instalar_progreso_tqdm("trellis2", al_progresar, [("forma", 15, 35), ("forma", 35, 60), ("texturas", 60, 80), ("texturas", 80, 90)])
        al_progresar("analizando", 10)
        malla = pipeline.run(imagen, seed=semilla, pipeline_type="512" if rapido else "1024_cascade")[0]
        malla.simplify(16777216)
        al_progresar("texturas", 90)
        glb = o_voxel.postprocess.to_glb(
            vertices=malla.vertices,
            faces=malla.faces,
            attr_volume=malla.attrs,
            coords=malla.coords,
            attr_layout=malla.layout,
            voxel_size=malla.voxel_size,
            aabb=[[-0.5, -0.5, -0.5], [0.5, 0.5, 0.5]],
            decimation_target=150_000 if rapido else 400_000,
            texture_size=1024 if rapido else 2048,
            remesh=True,
            remesh_band=1,
            remesh_project=0,
            verbose=False,
        )
        glb.export(str(salida), extension_webp=True)
        return

    # TRELLIS (versión 1): funciona con 16 GB de VRAM.
    os.environ.setdefault("ATTN_BACKEND", "xformers")
    os.environ.setdefault("SPCONV_ALGO", "native")
    from trellis.pipelines import TrellisImageTo3DPipeline
    from trellis.utils import postprocessing_utils

    def cargar_v1() -> Any:
        p = TrellisImageTo3DPipeline.from_pretrained("microsoft/TRELLIS-image-large")
        p.cuda()
        return p

    pipeline = GESTOR.obtener("TRELLIS", cargar_v1)
    instalar_progreso_tqdm("trellis", al_progresar, [("forma", 15, 45), ("forma", 45, 72), ("texturas", 75, 95)])
    al_progresar("analizando", 8)
    salidas = pipeline.run(
        imagen,
        seed=semilla,
        formats=["gaussian", "mesh"],
        sparse_structure_sampler_params={"steps": 12, "cfg_strength": 7.5},
        slat_sampler_params={"steps": 12, "cfg_strength": 3.0},
    )
    al_progresar("texturas", 75)
    glb = postprocessing_utils.to_glb(
        salidas["gaussian"][0],
        salidas["mesh"][0],
        simplify=0.96 if rapido else 0.94,
        texture_size=1024 if rapido else 2048,
        verbose=False,
    )
    glb.export(str(salida))


def texto_a_imagen(prompt: str, salida: Path, al_progresar: Progreso) -> None:
    import torch

    def callback(pipe: Any, paso: int, t: Any, kw: dict) -> dict:
        total = getattr(pipe, "num_timesteps", 4) or 4
        al_progresar("imagen", 10 + 85 * (paso + 1) / total)
        return kw

    if CONFIG["texto_imagen"] == "sdxl-turbo":
        from diffusers import AutoPipelineForText2Image

        def cargar() -> Any:
            p = AutoPipelineForText2Image.from_pretrained("stabilityai/sdxl-turbo", torch_dtype=torch.float16, variant="fp16")
            return p.to("cuda")

        pipe = GESTOR.obtener("SDXL-Turbo", cargar)
        img = pipe(prompt=prompt, num_inference_steps=2, guidance_scale=0.0, width=768, height=768, callback_on_step_end=callback).images[0]
    else:
        from diffusers import FluxPipeline

        def cargar_flux() -> Any:
            p = FluxPipeline.from_pretrained("black-forest-labs/FLUX.1-schnell", torch_dtype=torch.bfloat16)
            # Con menos de 24 GB, las partes del modelo se turnan entre RAM y GPU.
            if VRAM < 23 and CONFIG.get("descargar_a_cpu", True):
                p.enable_model_cpu_offload()
            else:
                p.to("cuda")
            return p

        pipe = GESTOR.obtener("FLUX.1-schnell", cargar_flux)
        img = pipe(prompt=prompt, num_inference_steps=4, guidance_scale=0.0, width=1024, height=1024, max_sequence_length=256, callback_on_step_end=callback).images[0]
    img.save(salida, format="PNG")


# ── Modo prueba: un cubo de colores en GLB, sin dependencias ──

def glb_de_prueba(salida: Path) -> None:
    pos: list[float] = []
    col: list[float] = []
    caras = [((1, 0, 0), (0.9, 0.1, 0.1)), ((-1, 0, 0), (0.1, 0.8, 0.9)), ((0, 1, 0), (1, 0.8, 0.1)),
             ((0, -1, 0), (0.2, 0.2, 0.2)), ((0, 0, 1), (0.9, 0.2, 0.8)), ((0, 0, -1), (0.2, 0.9, 0.3))]
    for (nx, ny, nz), c in caras:
        # Dos vectores perpendiculares a la normal
        u = (ny, nz, nx) if nx == 0 else (0, 1, 0)
        v = (ny * u[2] - nz * u[1], nz * u[0] - nx * u[2], nx * u[1] - ny * u[0])
        esquinas = [(-1, -1), (1, -1), (1, 1), (-1, -1), (1, 1), (-1, 1)]
        for a, b in esquinas:
            pos += [0.5 * (nx + a * u[0] + b * v[0]), 0.5 * (ny + a * u[1] + b * v[1]) + 0.5, 0.5 * (nz + a * u[2] + b * v[2])]
            col += [*c, 1.0]
    datos_pos = struct.pack(f"<{len(pos)}f", *pos)
    datos_col = struct.pack(f"<{len(col)}f", *col)
    binario = datos_pos + datos_col
    n = len(pos) // 3
    gltf = {
        "asset": {"version": "2.0", "generator": "IMPRESORA 3D (prueba)"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0}],
        "meshes": [{"primitives": [{"attributes": {"POSITION": 0, "COLOR_0": 1}, "material": 0}]}],
        "materials": [{"pbrMetallicRoughness": {"baseColorFactor": [1, 1, 1, 1], "roughnessFactor": 0.5}, "doubleSided": True}],
        "buffers": [{"byteLength": len(binario)}],
        "bufferViews": [{"buffer": 0, "byteOffset": 0, "byteLength": len(datos_pos)}, {"buffer": 0, "byteOffset": len(datos_pos), "byteLength": len(datos_col)}],
        "accessors": [
            {"bufferView": 0, "componentType": 5126, "count": n, "type": "VEC3", "min": [-0.5, 0, -0.5], "max": [0.5, 1, 0.5]},
            {"bufferView": 1, "componentType": 5126, "count": n, "type": "VEC4"},
        ],
    }
    js = json.dumps(gltf).encode()
    js += b" " * ((4 - len(js) % 4) % 4)
    binario += b"\0" * ((4 - len(binario) % 4) % 4)
    total = 12 + 8 + len(js) + 8 + len(binario)
    salida.write_bytes(
        struct.pack("<III", 0x46546C67, 2, total) + struct.pack("<II", len(js), 0x4E4F534A) + js + struct.pack("<II", len(binario), 0x004E4942) + binario
    )


def png_de_prueba(salida: Path) -> None:
    import zlib

    ancho = alto = 256
    filas = b"".join(b"\0" + bytes([255, 60 + y // 2, 60, 255] * ancho) for y in range(alto))
    def trozo(tipo: bytes, d: bytes) -> bytes:
        return struct.pack(">I", len(d)) + tipo + d + struct.pack(">I", zlib.crc32(tipo + d) & 0xFFFFFFFF)
    salida.write_bytes(b"\x89PNG\r\n\x1a\n" + trozo(b"IHDR", struct.pack(">IIBBBBB", ancho, alto, 8, 6, 0, 0, 0)) + trozo(b"IDAT", zlib.compress(filas)) + trozo(b"IEND", b""))


# ──────────────────────────────────────────────────────────────
#  Trabajador: procesa la cola de uno en uno
# ──────────────────────────────────────────────────────────────

_despertar = threading.Event()


def trabajador() -> None:
    while True:
        with closing(bd()) as con:
            fila = con.execute("select * from trabajos where estado='cola' order by creado limit 1").fetchone()
        if not fila:
            _despertar.wait(timeout=30)
            _despertar.clear()
            limpiar_antiguos()
            continue
        id_ = fila["id"]
        params = json.loads(fila["parametros"] or "{}")
        actualizar(id_, estado="procesando", inicio=time.time(), etapa="analizando", progreso=3)

        def al_progresar(etapa: str, pct: float, id_: str = id_) -> None:
            actualizar(id_, etapa=etapa, progreso=round(float(pct), 1))

        try:
            if fila["tipo"] == "texto-imagen":
                salida = DATOS / f"{id_}.png"
                al_progresar("imagen", 5)
                if PRUEBA:
                    for p in range(5, 100, 15):
                        al_progresar("imagen", p)
                        time.sleep(0.2)
                    png_de_prueba(salida)
                else:
                    texto_a_imagen(params.get("prompt", ""), salida, al_progresar)
            else:
                salida = DATOS / f"{id_}.glb"
                if PRUEBA:
                    for etapa, p in [("analizando", 10), ("forma", 30), ("forma", 55), ("texturas", 75), ("texturas", 90)]:
                        al_progresar(etapa, p)
                        time.sleep(float(os.environ.get("IMPRESORA_PRUEBA_PAUSA", "0.4")))
                    glb_de_prueba(salida)
                else:
                    imagen_a_3d(Path(fila["entrada"]), salida, params.get("detalle", "detallado"), al_progresar)
            actualizar(id_, estado="listo", etapa="listo", progreso=100, fin=time.time(), resultado=str(salida))
            if fila["tipo"] == "imagen-3d":
                enviar_push(fila["push"], "¡Tu modelo 3D está listo! 🎉", "Abre IMPRESORA 3D para verlo.", "#/imprimir")
            else:
                enviar_push(fila["push"], "Imagen lista ✨", "Revisa la imagen y crea el modelo 3D.", "#/imprimir")
        except Exception as e:
            traceback.print_exc()
            mensaje = "La tarjeta gráfica se quedó sin memoria. Cierra otros programas o usa calidad rápida." if "out of memory" in str(e).lower() else str(e)[:300]
            actualizar(id_, estado="error", error=mensaje, fin=time.time())
            enviar_push(fila["push"], "No se pudo imprimir 😕", mensaje, "#/imprimir")


# ──────────────────────────────────────────────────────────────
#  API HTTP
# ──────────────────────────────────────────────────────────────

app = FastAPI(title="IMPRESORA 3D · Servidor local", version=VERSION, docs_url=None, redoc_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # La seguridad la da la contraseña, no el origen.
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

_fallos: dict[str, list[float]] = {}


def ip_cliente(req: Request) -> str:
    return req.headers.get("cf-connecting-ip") or (req.client.host if req.client else "?")


def comprobar_clave(req: Request, authorization: str | None) -> None:
    """Contraseña obligatoria. Tras 10 fallos en 10 minutos, la IP queda bloqueada un rato."""
    ip = ip_cliente(req)
    ahora = time.time()
    recientes = [t for t in _fallos.get(ip, []) if ahora - t < 600]
    if len(recientes) >= 10:
        raise HTTPException(429, "Demasiados intentos. Espera unos minutos.")
    import hmac

    dada = (authorization or "").removeprefix("Bearer ").strip()
    if not hmac.compare_digest(dada.encode(), str(CONFIG["clave"]).encode()):
        _fallos[ip] = [*recientes, ahora]
        time.sleep(0.5)
        raise HTTPException(401, "Contraseña incorrecta")


@app.get("/api/estado")
def estado() -> dict[str, Any]:
    with closing(bd()) as con:
        cola = con.execute("select count(*) from trabajos where estado in ('cola','procesando')").fetchone()[0]
    return {
        "ok": True,
        "version": VERSION,
        "gpu": GPU,
        "vram_gb": VRAM,
        "modelos": {
            "imagen3d": "Prueba" if PRUEBA else ("TRELLIS.2" if CONFIG["modelo_3d"] == "trellis2" else "TRELLIS"),
            "texto_imagen": "Prueba" if PRUEBA else ("SDXL-Turbo" if CONFIG["texto_imagen"] == "sdxl-turbo" else "FLUX.1-schnell"),
        },
        "cola": cola,
    }


@app.get("/api/comprobar")
def comprobar(req: Request, authorization: str | None = Header(None)) -> dict[str, bool]:
    comprobar_clave(req, authorization)
    return {"ok": True}


@app.get("/api/push/clave")
def push_clave() -> dict[str, str]:
    if not CLAVE_PUBLICA_PUSH:
        raise HTTPException(404, "Notificaciones no disponibles")
    return {"clave_publica": CLAVE_PUBLICA_PUSH}


@app.post("/api/trabajos")
async def crear_trabajo(
    req: Request,
    tipo: str = Form(...),
    prompt: str = Form(""),
    detalle: str = Form("detallado"),
    quitar_fondo: str = Form("true"),
    push: str = Form(""),
    imagen: UploadFile | None = File(None),
    authorization: str | None = Header(None),
) -> dict[str, str]:
    comprobar_clave(req, authorization)
    if tipo not in ("imagen-3d", "texto-imagen"):
        raise HTTPException(400, "Tipo de trabajo desconocido")
    id_ = uuid.uuid4().hex
    entrada = None
    if tipo == "imagen-3d":
        if imagen is None:
            raise HTTPException(400, "Falta la imagen")
        datos = await imagen.read(MAX_BYTES_IMAGEN + 1)
        if len(datos) > MAX_BYTES_IMAGEN:
            raise HTTPException(413, "La imagen es demasiado grande")
        if not (datos.startswith(b"\x89PNG") or datos.startswith(b"\xff\xd8")):
            raise HTTPException(415, "Solo se admiten imágenes PNG o JPG")
        extension = ".png" if datos.startswith(b"\x89PNG") else ".jpg"
        entrada = DATOS / f"{id_}_entrada{extension}"
        entrada.write_bytes(datos)
    elif not prompt.strip():
        raise HTTPException(400, "Falta el texto")
    parametros = json.dumps({"prompt": prompt[:1000], "detalle": detalle, "quitar_fondo": quitar_fondo == "true"})
    with _cerrojo_bd, closing(bd()) as con:
        con.execute(
            "insert into trabajos (id, tipo, estado, etapa, progreso, creado, entrada, parametros, push) values (?,?,?,?,?,?,?,?,?)",
            (id_, tipo, "cola", "cola", 0, time.time(), str(entrada) if entrada else None, parametros, push or None),
        )
        con.commit()
    _despertar.set()
    return {"id": id_}


@app.get("/api/trabajos/{id_}")
def ver_trabajo(id_: str, req: Request, authorization: str | None = Header(None)) -> JSONResponse:
    comprobar_clave(req, authorization)
    fila = obtener(id_)
    if not fila:
        raise HTTPException(404, "No existe ese trabajo")
    respuesta: dict[str, Any] = {"estado": fila["estado"], "etapa": fila["etapa"], "progreso": fila["progreso"], "error": fila["error"]}
    if fila["estado"] == "cola":
        with closing(bd()) as con:
            delante = con.execute(
                "select tipo from trabajos where estado in ('cola','procesando') and creado < ?", (fila["creado"],)
            ).fetchall()
        respuesta["posicion"] = len(delante)
        respuesta["eta"] = sum(duracion_media(d["tipo"]) for d in delante) + duracion_media(fila["tipo"])
    elif fila["estado"] == "procesando":
        respuesta["eta"] = max(5.0, duracion_media(fila["tipo"]) - (time.time() - (fila["inicio"] or time.time())))
    return JSONResponse(respuesta, headers={"Cache-Control": "no-store"})


@app.get("/api/trabajos/{id_}/resultado")
def resultado(id_: str, req: Request, authorization: str | None = Header(None)) -> FileResponse:
    comprobar_clave(req, authorization)
    fila = obtener(id_)
    if not fila or fila["estado"] != "listo" or not fila["resultado"] or not Path(fila["resultado"]).exists():
        raise HTTPException(404, "Resultado no disponible")
    tipo = "model/gltf-binary" if fila["resultado"].endswith(".glb") else "image/png"
    return FileResponse(fila["resultado"], media_type=tipo)


threading.Thread(target=trabajador, daemon=True, name="trabajador").start()

if __name__ == "__main__":
    import uvicorn

    print(f"🖨️  IMPRESORA 3D · servidor {VERSION} · {GPU} {f'({VRAM} GB)' if VRAM else ''}{' · MODO PRUEBA' if PRUEBA else ''}")
    uvicorn.run(app, host=os.environ.get("IMPRESORA_HOST", "127.0.0.1"), port=int(CONFIG.get("puerto", 8188)), log_level="warning")
