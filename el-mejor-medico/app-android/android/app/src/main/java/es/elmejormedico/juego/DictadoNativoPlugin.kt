package es.elmejormedico.juego

// Dictado por micrófono con el reconocedor de Android, en español de España.
// Se usa el reconocedor DEL PROPIO DISPOSITIVO (sin Internet) cuando el móvil lo tiene; si no, se pide
// que prefiera el modo sin conexión. La grabación nunca se guarda: sólo se convierte en texto.

import android.Manifest
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

@CapacitorPlugin(name = "DictadoNativo", permissions = [Permission(alias = "microfono", strings = [Manifest.permission.RECORD_AUDIO])])
class DictadoNativoPlugin : Plugin() {
    private var rec: SpeechRecognizer? = null
    private var enDispositivo = false
    private val principal = Handler(Looper.getMainLooper())

    private fun sinConexionDisponible() = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && SpeechRecognizer.isOnDeviceRecognitionAvailable(context)

    @PluginMethod
    fun estado(call: PluginCall) {
        call.resolve(JSObject()
            .put("disponible", SpeechRecognizer.isRecognitionAvailable(context) || sinConexionDisponible())
            .put("sinConexion", sinConexionDisponible())
            .put("permiso", getPermissionState("microfono") == PermissionState.GRANTED))
    }

    @PluginMethod
    fun iniciar(call: PluginCall) {
        if (getPermissionState("microfono") != PermissionState.GRANTED) { requestPermissionForAlias("microfono", call, "trasPermiso"); return }
        empezar(call)
    }

    @PermissionCallback
    private fun trasPermiso(call: PluginCall) {
        if (getPermissionState("microfono") == PermissionState.GRANTED) empezar(call) else call.reject("No hay permiso para usar el micrófono.")
    }

    private fun empezar(call: PluginCall) {
        principal.post {
            rec?.destroy()
            enDispositivo = sinConexionDisponible()
            val r = if (enDispositivo) SpeechRecognizer.createOnDeviceSpeechRecognizer(context) else SpeechRecognizer.createSpeechRecognizer(context)
            rec = r
            val texto = StringBuilder()
            r.setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(p: Bundle?) { notifyListeners("escuchando", JSObject().put("sinConexion", enDispositivo)) }
                override fun onBeginningOfSpeech() {}
                override fun onRmsChanged(v: Float) {}
                override fun onBufferReceived(b: ByteArray?) {}
                override fun onEndOfSpeech() {}
                override fun onEvent(t: Int, p: Bundle?) {}
                override fun onPartialResults(p: Bundle?) {
                    val s = p?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull() ?: return
                    notifyListeners("parcial", JSObject().put("texto", s))
                }
                override fun onResults(p: Bundle?) {
                    texto.append(p?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull() ?: "")
                    call.resolve(JSObject().put("texto", texto.toString()).put("sinConexion", enDispositivo))
                    r.destroy(); if (rec === r) rec = null
                }
                override fun onError(codigo: Int) {
                    val m = when (codigo) {
                        SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "No se ha oído nada."
                        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "No hay permiso para usar el micrófono."
                        SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT, SpeechRecognizer.ERROR_SERVER ->
                            "El reconocimiento de voz necesita Internet: descarga el español sin conexión en Ajustes › Google › Voz."
                        SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED, SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE ->
                            "Falta el idioma español (España) para el reconocimiento sin conexión."
                        else -> "Error del micrófono ($codigo)."
                    }
                    call.reject(m)
                    r.destroy(); if (rec === r) rec = null
                }
            })
            val i = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, "es-ES")
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
                // deja hablar con pausas antes de cortar
                putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 2500L)
                putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 2000L)
            }
            try { r.startListening(i) } catch (e: Exception) { call.reject("No se ha podido usar el micrófono: ${e.message}") }
        }
    }

    @PluginMethod
    fun parar(call: PluginCall) { principal.post { rec?.stopListening() }; call.resolve() }

    // Android 13 o superior: pide al sistema que descargue el español para reconocer sin Internet
    @PluginMethod
    fun descargarIdioma(call: PluginCall) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || !sinConexionDisponible()) { call.reject("Este móvil no permite descargar el idioma desde el juego."); return }
        principal.post {
            try {
                val r = SpeechRecognizer.createOnDeviceSpeechRecognizer(context)
                r.triggerModelDownload(Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).putExtra(RecognizerIntent.EXTRA_LANGUAGE, "es-ES"))
                principal.postDelayed({ r.destroy() }, 3000)
                call.resolve()
            } catch (e: Exception) { call.reject(e.message) }
        }
    }

    override fun handleOnDestroy() { principal.post { rec?.destroy(); rec = null }; super.handleOnDestroy() }
}
