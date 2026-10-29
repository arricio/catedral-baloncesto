// EL MEJOR MÉDICO (Unreal): paso de texto en español de España a fonemas (AFI, como los que esperan las voces
// Piper es-ES). Hecho a mano con las reglas del español (se lee casi como se escribe), sin espeak-ng (licencia
// GPL): c/z → θ, j/g+e,i → x, ll → ʎ, r/rr, b-d-g entre vocales (β ð ɣ), diptongos, acento según las reglas de
// acentuación, números en letra y signos de puntuación (pausas y entonación).
#pragma once

#include "CoreMinimal.h"

namespace EMMFonetica
{
	// «Buenos días, doctor.» → «bwˈenos ðˈias, doktˈoɾ.»
	FString Fonemas(const FString& Texto);
	// números en letra: 39 → «treinta y nueve»; 37,5 → «treinta y siete coma cinco»
	FString NumerosEnLetra(const FString& Texto);
}
