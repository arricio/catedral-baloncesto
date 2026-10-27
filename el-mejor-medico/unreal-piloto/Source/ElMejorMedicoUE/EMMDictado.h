// EL MEJOR MÉDICO (Unreal): dictado por micrófono, sin Internet.
// Windows: reconocedor de voz de SAPI en español de España (viene con Windows). El texto se va escribiendo en el
// cuadro para revisarlo; el médico no habla hasta que el jugador pulsa ENVIAR · HABLAR MÉDICO.
#pragma once

#include "CoreMinimal.h"

namespace EMMDictado
{
	// AlTexto recibe (en el hilo del juego) todo lo dictado hasta ahora; AlTerminar, el texto final o un error
	bool Empezar(TFunction<void(const FString& Texto)> AlTexto, TFunction<void(const FString& Texto, const FString& Error)> AlTerminar);
	void Parar();
	bool Escuchando();
}
