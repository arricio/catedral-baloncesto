package es.elmejormedico.juego

// IA generativa dentro del móvil: LiteRT-LM (Google) con Gemma 4 E2B. Sin Internet y sin el portátil.
// El modelo (≈2,6 GB) se descarga una vez de Hugging Face o se importa desde un archivo, y se guarda
// en la memoria interna de la aplicación (se conserva al actualizar el APK).

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.StatFs
import androidx.activity.result.ActivityResult
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Contents
import com.google.ai.edge.litertlm.ConversationConfig
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import com.google.ai.edge.litertlm.Message
import com.google.ai.edge.litertlm.SamplerConfig
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

@CapacitorPlugin(name = "IALocal")
class IALocalPlugin : Plugin() {
    companion object {
        // El de Android (procesador y GPU). OJO: «-gpu.litertlm» y «-web.litertlm» son para navegadores y
        // LiteRT-LM de Android no los abre («tf_lite_prefill_decode not found in the model»).
        const val ARCHIVO = "gemma-4-E2B-it.litertlm"
        const val TAMANO = 2588147712L
        const val SHA256 = "181938105e0eefd105961417e8da75903eacda102c4fce9ce90f50b97139a63c"
        const val URL_MODELO = "https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it.litertlm"
        val OBSOLETOS = listOf("gemma-4-E2B-it-gpu.litertlm", "gemma-4-E2B-it-gpu.litertlm.parte", "gemma-4-E2B-it-gpu.litertlm.importando")
    }

    // Huella del archivo: sólo se da por bueno si coincide con la publicada en Hugging Face
    private fun comprobarHuella(f: File) {
        notifyListeners("progreso", JSObject().put("bytes", TAMANO).put("total", TAMANO).put("comprobando", true))
        val md = java.security.MessageDigest.getInstance("SHA-256")
        f.inputStream().use { ent -> val buf = ByteArray(1 shl 20); while (true) { val n = ent.read(buf); if (n < 0) break; md.update(buf, 0, n) } }
        val h = md.digest().joinToString("") { "%02x".format(it) }
        if (h != SHA256) { f.delete(); throw Exception("el archivo está dañado o no es el modelo correcto (huella SHA-256 distinta)") }
    }

    // la versión 1.0 descargaba un archivo que Android no puede usar: se borra para liberar 2 GB
    private fun borrarObsoletos() { OBSOLETOS.forEach { File(carpeta(), it).delete() } }

    // un solo hilo: el modelo no admite dos respuestas a la vez
    private val hilo = Executors.newSingleThreadExecutor()
    private val descargas = Executors.newSingleThreadExecutor()
    private var motor: Engine? = null
    private var aceleracion = ""
    private val cancelarDescarga = AtomicBoolean(false)

    private fun carpeta() = File(context.filesDir, "modelos").apply { mkdirs() }
    private fun modelo() = File(carpeta(), ARCHIVO)
    private fun instalado() = modelo().let { it.exists() && it.length() == TAMANO }

    @PluginMethod
    fun estado(call: PluginCall) {
        borrarObsoletos()
        val m = modelo()
        val r = JSObject()
        r.put("instalado", instalado())
        r.put("bytes", if (m.exists()) m.length() else 0L)
        r.put("total", TAMANO)
        r.put("parcial", File(carpeta(), "$ARCHIVO.parte").let { if (it.exists()) it.length() else 0L })
        r.put("cargado", motor != null)
        r.put("aceleracion", aceleracion)
        r.put("modelo", "Gemma 4 E2B")
        r.put("libre", StatFs(context.filesDir.path).availableBytes)
        r.put("memoria", Runtime.getRuntime().maxMemory())
        call.resolve(r)
    }

    // Descarga reanudable: si se corta, sigue donde se quedó
    @PluginMethod
    fun descargar(call: PluginCall) {
        if (instalado()) { call.resolve(JSObject().put("ok", true)); return }
        cancelarDescarga.set(false)
        call.setKeepAlive(true)
        descargas.execute {
            val parte = File(carpeta(), "$ARCHIVO.parte")
            try {
                var hecho = if (parte.exists()) parte.length() else 0L
                var url = URL(call.getString("url") ?: URL_MODELO)
                var con: HttpURLConnection
                // Hugging Face redirige al almacén de archivos
                var saltos = 0
                while (true) {
                    con = url.openConnection() as HttpURLConnection
                    con.instanceFollowRedirects = false
                    con.connectTimeout = 20000; con.readTimeout = 30000
                    if (hecho > 0) con.setRequestProperty("Range", "bytes=$hecho-")
                    val c = con.responseCode
                    if (c in 300..399 && saltos++ < 6) { url = URL(url, con.getHeaderField("Location")); con.disconnect(); continue }
                    if (c == 200) hecho = 0L
                    else if (c != 206) throw Exception("el servidor respondió $c")
                    break
                }
                con.inputStream.use { ent ->
                    FileOutputStream(parte, hecho > 0).use { sal ->
                        val buf = ByteArray(1 shl 20)
                        var ultimo = 0L
                        while (true) {
                            if (cancelarDescarga.get()) throw Exception("cancelada")
                            val n = ent.read(buf); if (n < 0) break
                            sal.write(buf, 0, n); hecho += n
                            val ahora = System.currentTimeMillis()
                            if (ahora - ultimo > 500) { ultimo = ahora; notifyListeners("progreso", JSObject().put("bytes", hecho).put("total", TAMANO)) }
                        }
                    }
                }
                if (parte.length() != TAMANO) throw Exception("el archivo descargado no está completo (${parte.length()} de $TAMANO bytes)")
                comprobarHuella(parte)
                if (!parte.renameTo(modelo())) throw Exception("no se pudo guardar el modelo")
                notifyListeners("progreso", JSObject().put("bytes", TAMANO).put("total", TAMANO))
                call.resolve(JSObject().put("ok", true))
            } catch (e: Exception) {
                call.reject("No se ha podido descargar el modelo: ${e.message}")
            } finally { call.setKeepAlive(false) }
        }
    }

    @PluginMethod
    fun cancelarDescarga(call: PluginCall) { cancelarDescarga.set(true); call.resolve() }

    // El jugador elige el archivo .litertlm (por ejemplo, copiado por USB a Descargas)
    @PluginMethod
    fun importar(call: PluginCall) {
        val i = Intent(Intent.ACTION_OPEN_DOCUMENT).apply { addCategory(Intent.CATEGORY_OPENABLE); type = "*/*" }
        startActivityForResult(call, i, "alImportar")
    }

    @ActivityCallback
    private fun alImportar(call: PluginCall, res: ActivityResult) {
        val uri: Uri? = res.data?.data
        if (res.resultCode != Activity.RESULT_OK || uri == null) { call.reject("No se ha elegido ningún archivo"); return }
        call.setKeepAlive(true)
        descargas.execute {
            try {
                val tmp = File(carpeta(), "$ARCHIVO.importando")
                var hecho = 0L; var ultimo = 0L
                context.contentResolver.openInputStream(uri)!!.use { ent ->
                    FileOutputStream(tmp).use { sal ->
                        val buf = ByteArray(1 shl 20)
                        while (true) {
                            val n = ent.read(buf); if (n < 0) break
                            sal.write(buf, 0, n); hecho += n
                            val ahora = System.currentTimeMillis()
                            if (ahora - ultimo > 500) { ultimo = ahora; notifyListeners("progreso", JSObject().put("bytes", hecho).put("total", TAMANO)) }
                        }
                    }
                }
                if (tmp.length() != TAMANO) { tmp.delete(); throw Exception("ese archivo no es $ARCHIVO (${tmp.length()} bytes)") }
                comprobarHuella(tmp)
                cerrarMotor()
                if (!tmp.renameTo(modelo())) throw Exception("no se pudo guardar el modelo")
                call.resolve(JSObject().put("ok", true))
            } catch (e: Exception) {
                call.reject("No se ha podido importar: ${e.message}")
            } finally { call.setKeepAlive(false) }
        }
    }

    @PluginMethod
    fun borrar(call: PluginCall) {
        hilo.execute {
            cerrarMotor()
            modelo().delete(); File(carpeta(), "$ARCHIVO.parte").delete()
            call.resolve()
        }
    }

    // Carga el modelo en la GPU del móvil; si la GPU no lo admite, en el procesador
    @PluginMethod
    fun cargar(call: PluginCall) {
        hilo.execute {
            if (motor != null) { call.resolve(JSObject().put("aceleracion", aceleracion)); return@execute }
            if (!instalado()) { call.reject("El modelo de IA no está instalado"); return@execute }
            val preferida = call.getString("aceleracion") ?: "gpu"
            val intentos = if (preferida == "cpu") listOf("cpu") else listOf("gpu", "cpu")
            var ultimoError: Throwable? = null
            for (a in intentos) {
                try {
                    val t0 = System.currentTimeMillis()
                    val e = Engine(EngineConfig(
                        modelPath = modelo().path,
                        backend = if (a == "gpu") Backend.GPU() else Backend.CPU(),
                        cacheDir = context.cacheDir.path,
                    ))
                    e.initialize()
                    motor = e; aceleracion = a
                    call.resolve(JSObject().put("aceleracion", a).put("ms", System.currentTimeMillis() - t0))
                    return@execute
                } catch (t: Throwable) { ultimoError = t }
            }
            call.reject("No se ha podido cargar la IA: ${ultimoError?.message}")
        }
    }

    // mensajes: [{role: 'system'|'user'|'assistant', content}] (el mismo formato que Ollama)
    @PluginMethod
    fun generar(call: PluginCall) {
        val lista: JSArray = call.getArray("mensajes") ?: JSArray()
        val temperatura = call.getDouble("temperatura") ?: 0.8
        val maximo = call.getInt("maxTokens") ?: 160
        hilo.execute {
            val e = motor
            if (e == null) { call.reject("La IA no está cargada"); return@execute }
            try {
                val t0 = System.currentTimeMillis()
                var sistema = ""
                val previos = mutableListOf<Message>()
                var ultimo = ""
                for (i in 0 until lista.length()) {
                    val m = lista.getJSONObject(i)
                    val texto = m.optString("content")
                    when (m.optString("role")) {
                        "system" -> sistema += (if (sistema.isEmpty()) "" else "\n") + texto
                        "assistant" -> previos.add(Message.model(texto))
                        else -> previos.add(Message.user(texto))
                    }
                }
                // el último mensaje del jugador se envía; los anteriores son el historial
                if (previos.isNotEmpty()) { previos.removeAt(previos.size - 1); ultimo = lista.getJSONObject(lista.length() - 1).optString("content") }
                val cfg = ConversationConfig(
                    systemInstruction = Contents.of(sistema),
                    initialMessages = previos,
                    samplerConfig = SamplerConfig(topK = 40, topP = 0.95, temperature = temperatura),
                    maxOutputToken = maximo,
                )
                val texto = e.createConversation(cfg).use { c -> c.sendMessage(ultimo).toString() }
                call.resolve(JSObject().put("texto", texto).put("ms", System.currentTimeMillis() - t0).put("aceleracion", aceleracion))
            } catch (t: Throwable) {
                call.reject("La IA del móvil ha fallado: ${t.message}")
            }
        }
    }

    private fun cerrarMotor() { try { motor?.close() } catch (_: Throwable) {}; motor = null; aceleracion = "" }

    override fun handleOnDestroy() { hilo.execute { cerrarMotor() }; super.handleOnDestroy() }
}
