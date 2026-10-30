package es.elmejormedico.nativo

import org.junit.Assert.assertEquals
import org.junit.Test

// El dictado no debe escribir nada dos veces al unir las frases que devuelve el reconocedor de Android
class DictadoTest {
    private fun unir(a: String, b: String) = EMMNativo.unir(a, b)

    @Test fun frasesSeguidas() = assertEquals("me duele la cabeza desde ayer", unir("me duele la cabeza", "desde ayer"))
    @Test fun vacios() {
        assertEquals("hola", unir("", "hola"))
        assertEquals("hola", unir("hola", ""))
    }
    @Test fun resultadoAcumulado() = assertEquals("me duele la cabeza desde ayer", unir("me duele la cabeza", "me duele la cabeza desde ayer"))
    @Test fun mismoResultadoDosVeces() = assertEquals("¿desde cuándo le duele?", unir("¿desde cuándo le duele?", "desde cuándo le duele"))
    @Test fun solapamiento() = assertEquals("tiene fiebre desde el lunes por la noche", unir("tiene fiebre desde el lunes", "el lunes por la noche"))
    @Test fun mayusculasYPuntos() = assertEquals("Buenos días. ¿Qué le pasa?", unir("Buenos días.", "buenos días ¿Qué le pasa?"))
    @Test fun espacios() = assertEquals("hola qué tal", unir("  hola ", " qué  tal "))
}
