package es.elmejormedico.nativo

// EL MEJOR MÉDICO (Unreal, Android): IA generativa dentro del móvil (LiteRT-LM + Gemma 4 E2B), voces y dictado.
// Lo llama el C++ del juego por JNI (EMMIA.cpp, EMMVoz.cpp). Mismo modelo y misma descarga que la aplicación
// Three.js (IALocalPlugin.kt): gemma-4-E2B-it.litertlm, 2 588 147 712 bytes, con comprobación SHA-256.

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.StatFs
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Contents
import com.google.ai.edge.litertlm.ConversationConfig
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import com.google.ai.edge.litertlm.Message
import com.google.ai.edge.litertlm.SamplerConfig
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.Locale
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

object EMMNativo {
    private const val ARCHIVO = "gemma-4-E2B-it.litertlm"
    private const val TAMANO = 2588147712L
    private const val SHA256 = "181938105e0eefd105961417e8da75903eacda102c4fce9ce90f50b97139a63c"
    private const val URL_MODELO = "https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it.litertlm"

    private var motor: Engine? = null
    private var aceleracion = ""
    private val cerrojo = Any()   // el modelo no admite dos respuestas a la vez

    // descarga: estado que el juego consulta cada medio segundo
    @Volatile private var descEstado = "nada"
    @Volatile private var descBytes = 0L
    @Volatile private var descError = ""

    private fun carpeta(ctx: Context) = File(ctx.filesDir, "modelos").apply { mkdirs() }
    private fun modelo(ctx: Context) = File(carpeta(ctx), ARCHIVO)
    private fun instalado(ctx: Context) = modelo(ctx).let { it.exists() && it.length() == TAMANO }

    @JvmStatic
    fun estado(ctx: Context): String = JSONObject()
        .put("instalado", instalado(ctx)).put("total", TAMANO).put("cargado", motor != null)
        .put("aceleracion", aceleracion).put("libre", StatFs(ctx.filesDir.path).availableBytes).toString()

    @JvmStatic
    fun progreso(ctx: Context): String = JSONObject()
        .put("estado", if (instalado(ctx) && descEstado != "comprobando") "listo" else descEstado)
        .put("bytes", descBytes).put("total", TAMANO).put("error", descError).toString()

    // Descarga reanudable en segundo plano (sigue donde se quedó si se corta)
    @JvmStatic
    fun descargar(ctx: Context): String {
        if (instalado(ctx)) { descEstado = "listo"; return "listo" }
        if (descEstado == "descargando" || descEstado == "comprobando") return descEstado
        descEstado = "descargando"; descError = ""
        Thread {
            val parte = File(carpeta(ctx), "$ARCHIVO.parte")
            try {
                var hecho = if (parte.exists()) parte.length() else 0L
                var url = URL(URL_MODELO)
                var con: HttpURLConnection
                var saltos = 0
                while (true) {
                    con = url.openConnection() as HttpURLConnection
                    con.instanceFollowRedirects = false
                    con.connectTimeout = 20000; con.readTimeout = 30000
                    if (hecho > 0) con.setRequestProperty("Range", "bytes=$hecho-")
                    val c = con.responseCode
                    if (c in 300..399 && saltos++ < 6) { url = URL(url, con.getHeaderField("Location")); con.disconnect(); continue }
                    if (c == 200) hecho = 0L else if (c != 206) throw Exception("el servidor respondió $c")
                    break
                }
                con.inputStream.use { ent ->
                    FileOutputStream(parte, hecho > 0).use { sal ->
                        val buf = ByteArray(1 shl 20)
                        while (true) { val n = ent.read(buf); if (n < 0) break; sal.write(buf, 0, n); hecho += n; descBytes = hecho }
                    }
                }
                if (parte.length() != TAMANO) throw Exception("el archivo no está completo (${parte.length()} de $TAMANO bytes)")
                descEstado = "comprobando"
                val md = MessageDigest.getInstance("SHA-256")
                parte.inputStream().use { e -> val b = ByteArray(1 shl 20); while (true) { val n = e.read(b); if (n < 0) break; md.update(b, 0, n) } }
                if (md.digest().joinToString("") { "%02x".format(it) } != SHA256) { parte.delete(); throw Exception("el archivo está dañado (huella SHA-256 distinta)") }
                if (!parte.renameTo(modelo(ctx))) throw Exception("no se pudo guardar el modelo")
                descEstado = "listo"
            } catch (e: Exception) { descError = e.message ?: e.toString(); descEstado = "error" }
        }.start()
        return descEstado
    }

    // Carga el modelo en la GPU; si la GPU no lo admite, en el procesador
    @JvmStatic
    fun cargar(ctx: Context, preferida: String): String = synchronized(cerrojo) {
        if (motor != null) return JSONObject().put("ok", true).put("aceleracion", aceleracion).put("ms", 0).toString()
        if (!instalado(ctx)) return JSONObject().put("ok", false).put("error", "el modelo no está instalado").toString()
        var ultimo: Throwable? = null
        for (a in if (preferida == "cpu") listOf("cpu") else listOf("gpu", "cpu")) {
            try {
                val t0 = System.currentTimeMillis()
                val e = Engine(EngineConfig(modelPath = modelo(ctx).path, backend = if (a == "gpu") Backend.GPU() else Backend.CPU(), cacheDir = ctx.cacheDir.path))
                e.initialize()
                motor = e; aceleracion = a
                return JSONObject().put("ok", true).put("aceleracion", a).put("ms", System.currentTimeMillis() - t0).toString()
            } catch (t: Throwable) { ultimo = t }
        }
        JSONObject().put("ok", false).put("error", ultimo?.message ?: "error desconocido").toString()
    }

    // mensajes: [{role: system|user|assistant, content}] (el mismo formato que Ollama)
    @JvmStatic
    fun generar(mensajesJson: String, temperatura: Float, maximo: Int): String = synchronized(cerrojo) {
        val e = motor ?: return JSONObject().put("ok", false).put("error", "la IA no está cargada").toString()
        try {
            val lista = JSONArray(mensajesJson)
            var sistema = ""
            val previos = mutableListOf<Message>()
            for (i in 0 until lista.length()) {
                val m = lista.getJSONObject(i)
                val texto = m.optString("content")
                when (m.optString("role")) {
                    "system" -> sistema += (if (sistema.isEmpty()) "" else "\n") + texto
                    "assistant" -> previos.add(Message.model(texto))
                    else -> previos.add(Message.user(texto))
                }
            }
            // el último mensaje del médico se envía; los anteriores son el historial
            var ultimo = ""
            if (previos.isNotEmpty()) { previos.removeAt(previos.size - 1); ultimo = lista.getJSONObject(lista.length() - 1).optString("content") }
            val cfg = ConversationConfig(
                systemInstruction = Contents.of(sistema),
                initialMessages = previos,
                samplerConfig = SamplerConfig(topK = 40, topP = 0.95, temperature = temperatura.toDouble()),
                maxOutputToken = maximo,
            )
            val texto = e.createConversation(cfg).use { c -> c.sendMessage(ultimo).toString() }
            JSONObject().put("ok", true).put("texto", texto).put("aceleracion", aceleracion).toString()
        } catch (t: Throwable) {
            JSONObject().put("ok", false).put("error", t.message ?: t.toString()).toString()
        }
    }

    // ───────────────────────── Voces neuronales Piper (ONNX Runtime) ─────────────────────────
    // El C++ (EMMPiper.cpp) pasa el modelo .onnx y los ids de los fonemas; aquí sólo se ejecuta la red.
    // 3 hilos como máximo: el resto del procesador queda para el juego.
    private val sesiones = HashMap<String, OrtSession>()

    @JvmStatic
    fun piperCargar(clave: String, modelo: ByteArray): Boolean = synchronized(sesiones) {
        if (sesiones.containsKey(clave)) return true
        try {
            val opciones = OrtSession.SessionOptions().apply { setIntraOpNumThreads(3) }
            sesiones[clave] = OrtEnvironment.getEnvironment().createSession(modelo, opciones)
            true
        } catch (t: Throwable) { false }
    }

    // ids: fonemas (^ _ … $); escalas: ruido, duración y ruido de duración; devuelve las muestras (o null)
    @JvmStatic
    fun piper(clave: String, ids: LongArray, escalas: FloatArray, hablante: Long): FloatArray? {
        val s = synchronized(sesiones) { sesiones[clave] } ?: return null
        synchronized(s) {
            val env = OrtEnvironment.getEnvironment()
            val entradas = HashMap<String, OnnxTensor>()
            try {
                entradas["input"] = OnnxTensor.createTensor(env, arrayOf(ids))
                entradas["input_lengths"] = OnnxTensor.createTensor(env, longArrayOf(ids.size.toLong()))
                entradas["scales"] = OnnxTensor.createTensor(env, escalas)
                if (s.inputNames.contains("sid")) entradas["sid"] = OnnxTensor.createTensor(env, longArrayOf(hablante))
                s.run(entradas).use { r -> return aplanar(r.get(0).value) }
            } catch (t: Throwable) {
                return null
            } finally {
                entradas.values.forEach { it.close() }
            }
        }
    }

    // la salida de Piper es [1][1][n] (o [1][n]): se aplana a n muestras
    private fun aplanar(v: Any?): FloatArray? = when (v) {
        is FloatArray -> v
        is Array<*> -> {
            val partes = v.map { aplanar(it) ?: FloatArray(0) }
            val total = FloatArray(partes.sumOf { it.size })
            var i = 0
            for (p in partes) { p.copyInto(total, i); i += p.size }
            total
        }
        else -> null
    }

    // ───────────────────────── Dictado (SpeechRecognizer del móvil, es-ES) ─────────────────────────
    // El C++ (EMMDictado.cpp) llama a dictadoEmpezar, consulta dictadoEstado cada 200 ms y termina con dictadoParar.
    // El reconocedor se para solo tras un silencio: se vuelve a lanzar hasta que el jugador pulsa PARAR.
    // Para que nada se escriba dos veces: cada escucha tiene su número (se ignoran los avisos atrasados de otra),
    // se cierra una sola vez (resultado o error, el primero que llegue) y al unir frases se quita lo repetido.
    private var reco: SpeechRecognizer? = null
    @Volatile private var dicEscuchando = false
    @Volatile private var dicParar = false
    @Volatile private var dicError = ""
    @Volatile private var dicFijo = ""      // frases ya reconocidas
    @Volatile private var dicParcial = ""   // la frase que se está diciendo
    private var dicSesion = 0               // número de la escucha en curso (sólo en el hilo principal)
    private val principal by lazy { Handler(Looper.getMainLooper()) }

    private fun palabras(s: String) = s.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }
    private fun clave(p: String) = p.lowercase(Locale.ROOT).trim { !it.isLetterOrDigit() }

    // Une lo ya escrito con lo nuevo sin repetir: si lo nuevo ya está al final de lo anterior, no se añade;
    // si empieza por el final de lo anterior (o por todo, en reconocedores que lo reenvían acumulado),
    // ese trozo no se repite. Se compara sin mayúsculas ni signos.
    internal fun unir(a: String, b: String): String {
        val pa = palabras(a); val pb = palabras(b)
        if (pa.isEmpty()) return pb.joinToString(" ")
        if (pb.isEmpty()) return pa.joinToString(" ")
        val ka = pa.map(::clave); val kb = pb.map(::clave)
        if (ka.size >= kb.size && ka.subList(ka.size - kb.size, ka.size) == kb) return pa.joinToString(" ")
        for (n in minOf(ka.size, kb.size) downTo 1) {
            if (ka.subList(ka.size - n, ka.size) == kb.subList(0, n)) return (pa + pb.drop(n)).joinToString(" ")
        }
        return (pa + pb).joinToString(" ")
    }

    @JvmStatic
    fun dictadoEstado(): String = JSONObject().put("escuchando", dicEscuchando)
        .put("texto", unir(dicFijo, dicParcial)).put("error", dicError).toString()

    @JvmStatic
    fun dictadoEmpezar(act: Activity): String {
        if (dicEscuchando) return "ok"
        if (!SpeechRecognizer.isRecognitionAvailable(act)) return "error: el móvil no tiene reconocimiento de voz"
        dicEscuchando = true; dicParar = false; dicError = ""; dicFijo = ""; dicParcial = ""
        Thread {
            // la primera vez Android pregunta si se permite el micrófono; se espera la respuesta (hasta 30 s)
            if (act.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                principal.post { act.requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), 4711) }
                val fin = System.currentTimeMillis() + 30000
                while (act.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                    if (dicParar || System.currentTimeMillis() > fin) { dicError = "no hay permiso para usar el micrófono"; dicEscuchando = false; return@Thread }
                    Thread.sleep(250)
                }
            }
            principal.post { escuchar(act) }
        }.start()
        return "ok"
    }

    @JvmStatic
    fun dictadoParar() {
        dicParar = true
        principal.post { reco?.stopListening() }
    }

    private fun escuchar(act: Activity) {
        if (dicParar) { terminarDictado(); return }
        val r = reco ?: SpeechRecognizer.createSpeechRecognizer(act).also { reco = it }
        val sesion = ++dicSesion
        var cerrada = false
        // un aviso cuenta sólo si es de esta escucha y ésta no ha terminado todavía
        fun valido() = sesion == dicSesion && !cerrada
        r.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(p: Bundle?) {}
            override fun onBeginningOfSpeech() {}
            override fun onRmsChanged(v: Float) {}
            override fun onBufferReceived(b: ByteArray?) {}
            override fun onEndOfSpeech() {}
            override fun onEvent(t: Int, p: Bundle?) {}
            override fun onPartialResults(p: Bundle?) {
                if (!valido()) return
                p?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()?.let { dicParcial = it }
            }
            override fun onResults(p: Bundle?) {
                if (!valido()) return
                cerrada = true
                val final = p?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()
                dicFijo = unir(dicFijo, if (final.isNullOrBlank()) dicParcial else final)
                dicParcial = ""
                seguir(act)
            }
            override fun onError(codigo: Int) {
                if (!valido()) return
                cerrada = true
                // lo que se estaba diciendo, si no llegó el resultado definitivo
                dicFijo = unir(dicFijo, dicParcial); dicParcial = ""
                // silencio o nada entendido: se sigue escuchando; lo demás se avisa
                when (codigo) {
                    SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> seguir(act)
                    SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> { dicError = "no hay permiso para usar el micrófono"; terminarDictado() }
                    SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> { dicError = "el reconocimiento de voz necesita Internet o el paquete de español sin conexión"; terminarDictado() }
                    SpeechRecognizer.ERROR_AUDIO -> { dicError = "no se puede grabar con el micrófono"; terminarDictado() }
                    else -> if (dicParar) terminarDictado() else { dicError = "el reconocimiento de voz ha fallado ($codigo)"; terminarDictado() }
                }
            }
        })
        val pedir = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "es-ES")
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 2500L)
        }
        try { r.startListening(pedir) } catch (t: Throwable) { dicError = t.message ?: "no se ha podido iniciar el dictado"; terminarDictado() }
    }

    private fun seguir(act: Activity) { if (dicParar) terminarDictado() else escuchar(act) }

    private fun terminarDictado() {
        dicSesion++   // cualquier aviso que llegue después ya no cuenta
        reco?.destroy(); reco = null
        dicEscuchando = false
    }

    // ───────────────────────── Voces (TextToSpeech a archivo WAV) ─────────────────────────
    private var tts: TextToSpeech? = null
    private var ttsListo = false

    private fun motorVoz(ctx: Context): TextToSpeech? {
        if (tts != null && ttsListo) return tts
        val listo = CountDownLatch(1)
        tts = TextToSpeech(ctx.applicationContext) { estado -> ttsListo = estado == TextToSpeech.SUCCESS; listo.countDown() }
        listo.await(10, TimeUnit.SECONDS)
        return if (ttsListo) tts else null
    }

    // Sintetiza la frase a un WAV; devuelve el nombre de la voz usada o «error: …»
    @JvmStatic
    fun sintetizar(ctx: Context, texto: String, mujer: Boolean, tono: Float, vel: Float, ruta: String): String {
        val t = motorVoz(ctx) ?: return "error: no hay motor de voz"
        synchronized(this) {
            // sólo voces de España instaladas en el móvil (sin Internet); mujer/hombre por el nombre de la voz de Google
            val es = (t.voices ?: emptySet()).filter { it.locale.language == "es" && it.locale.country == "ES" && !it.isNetworkConnectionRequired && !it.features.contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED) }
            val fem = Regex("eea|eec|female|mujer", RegexOption.IGNORE_CASE)
            val voz = es.firstOrNull { fem.containsMatchIn(it.name) == mujer } ?: es.firstOrNull()
            if (voz != null) t.voice = voz else t.language = Locale("es", "ES")
            t.setPitch(tono); t.setSpeechRate(vel)
            val fin = CountDownLatch(1)
            var error: String? = null
            t.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(id: String?) {}
                override fun onDone(id: String?) { fin.countDown() }
                @Deprecated("API antigua") override fun onError(id: String?) { error = "la voz ha fallado"; fin.countDown() }
                override fun onError(id: String?, codigo: Int) { error = "la voz ha fallado ($codigo)"; fin.countDown() }
            })
            val archivo = File(ruta)
            archivo.parentFile?.mkdirs()
            if (t.synthesizeToFile(texto, Bundle(), archivo, "emm") != TextToSpeech.SUCCESS) return "error: no se ha podido sintetizar"
            if (!fin.await(30, TimeUnit.SECONDS)) return "error: la voz tarda demasiado"
            return error?.let { "error: $it" } ?: (voz?.name ?: "es-ES")
        }
    }
}
