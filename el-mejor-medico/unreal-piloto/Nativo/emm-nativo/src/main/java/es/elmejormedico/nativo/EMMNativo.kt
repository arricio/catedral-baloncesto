package es.elmejormedico.nativo

// EL MEJOR MÉDICO (Unreal, Android): IA generativa dentro del móvil (LiteRT-LM + Gemma 4 E2B) y voces del sistema.
// Lo llama el C++ del juego por JNI (EMMIA.cpp, EMMVoz.cpp). Mismo modelo y misma descarga que la aplicación
// Three.js (IALocalPlugin.kt): gemma-4-E2B-it.litertlm, 2 588 147 712 bytes, con comprobación SHA-256.

import android.content.Context
import android.os.Bundle
import android.os.StatFs
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
