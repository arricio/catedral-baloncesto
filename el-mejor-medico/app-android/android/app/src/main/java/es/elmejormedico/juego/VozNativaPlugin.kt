package es.elmejormedico.juego

// Voces del sistema Android (el WebView no trae voces web). Sólo español de España y, si se puede,
// voces instaladas en el móvil, que funcionan sin Internet.

import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.speech.tts.Voice
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap

@CapacitorPlugin(name = "VozNativa")
class VozNativaPlugin : Plugin() {
    private var tts: TextToSpeech? = null
    private var listo = false
    private val esperando = mutableListOf<PluginCall>()
    private val pendientes = ConcurrentHashMap<String, PluginCall>()

    override fun load() {
        tts = TextToSpeech(context) { estado ->
            listo = estado == TextToSpeech.SUCCESS
            tts?.language = Locale("es", "ES")
            tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(id: String) {}
                override fun onDone(id: String) { pendientes.remove(id)?.resolve() }
                @Deprecated("") override fun onError(id: String) { pendientes.remove(id)?.resolve() }
                override fun onError(id: String, code: Int) { pendientes.remove(id)?.resolve() }
                override fun onStop(id: String, interrumpida: Boolean) { pendientes.remove(id)?.resolve() }
                // cada palabra que empieza a sonar: sirve para mover la boca del personaje
                override fun onRangeStart(id: String, inicio: Int, fin: Int, frame: Int) {
                    notifyListeners("palabra", JSObject().put("id", id).put("largo", fin - inicio))
                }
            })
            synchronized(esperando) { esperando.forEach { voces(it) }; esperando.clear() }
        }
    }

    @PluginMethod
    fun voces(call: PluginCall) {
        val t = tts
        if (t == null || !listo) { synchronized(esperando) { esperando.add(call) }; return }
        val lista = JSArray()
        val todas: Set<Voice> = try { t.voices ?: emptySet() } catch (e: Exception) { emptySet() }
        for (v in todas.sortedBy { it.name }) {
            val l = v.locale
            if (l.language != "es") continue
            lista.put(JSObject()
                .put("name", v.name)
                .put("lang", l.toLanguageTag())
                .put("red", v.isNetworkConnectionRequired)
                .put("instalada", !(v.features?.contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED) ?: false))
                .put("calidad", v.quality))
        }
        call.resolve(JSObject().put("voces", lista).put("motor", t.defaultEngine ?: ""))
    }

    @PluginMethod
    fun hablar(call: PluginCall) {
        val t = tts
        if (t == null || !listo) { call.reject("La voz del sistema no está lista"); return }
        val texto = call.getString("texto") ?: ""
        val id = call.getString("id") ?: System.nanoTime().toString()
        val nombre = call.getString("voz")
        val voz = nombre?.let { n -> try { t.voices?.firstOrNull { it.name == n } } catch (e: Exception) { null } }
        if (voz != null) t.voice = voz else t.language = Locale("es", "ES")
        t.setPitch((call.getDouble("tono") ?: 1.0).toFloat())
        t.setSpeechRate((call.getDouble("vel") ?: 1.0).toFloat())
        call.setKeepAlive(false)
        pendientes[id] = call
        val r = t.speak(texto, TextToSpeech.QUEUE_FLUSH, Bundle(), id)
        if (r != TextToSpeech.SUCCESS) { pendientes.remove(id); call.reject("No se ha podido hablar") }
    }

    @PluginMethod
    fun parar(call: PluginCall) {
        tts?.stop()
        pendientes.values.forEach { it.resolve() }; pendientes.clear()
        call.resolve()
    }

    override fun handleOnDestroy() { tts?.shutdown(); tts = null; super.handleOnDestroy() }
}
