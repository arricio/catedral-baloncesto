// EL MEJOR MÉDICO (Unreal): voces neuronales Piper (es-ES) dentro del juego, sin programas externos.
// El texto pasa a fonemas con EMMFonetica y el modelo ONNX de la voz se ejecuta con NNE (ONNX Runtime de Unreal).
// Las voces se describen en Content/Datos/voces.json (id, modelo importado, hablante, sexo): añadir voces no exige
// recompilar. Licencias de las voces en Fuentes/Piper/LICENCIAS.txt (las CC BY se citan en los créditos).
#pragma once

#include "CoreMinimal.h"
#include "EMMVoz.h"

namespace EMMPiper
{
	struct FVozPiper { FString Id, Modelo, Sexo; int32 Hablante = 0; };
	// voces disponibles (las de voces.json cuyo modelo existe y carga en esta plataforma)
	const TArray<FVozPiper>& Voces();
	bool Disponible();
	// Sintetiza en el hilo que la llama (es lenta: llamarla en segundo plano). Rellena PCM, visemas y palabras.
	bool Sintetizar(const FString& Texto, const FEMMPerfilVoz& Perfil, FEMMAudio& A);
}
