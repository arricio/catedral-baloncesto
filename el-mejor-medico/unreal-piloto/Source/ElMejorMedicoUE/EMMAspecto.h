// EL MEJOR MÉDICO (Unreal): aspecto de los personajes que se cambia en el juego (CREADOR DE PERSONAJES).
// MetaHumans: tono de piel y de ojos (multiplicadores de sus materiales), color del pelo (melanina y rojizo de
// sus grooms) y peinado, barba y bigote (en el PC, grooms de otros MetaHumans: todas las caras tienen la misma malla,
// así que el anclaje de uno vale en otro; en el móvil no se adaptan a otra cara, así que allí sólo el suyo o ninguno). Niños y bebés (MPFB): tonos de piel y de pelo con sus materiales propios.
// La forma de la cara no se puede esculpir en el juego: MetaHuman Creator sólo existe en el editor de Unreal.
#pragma once

#include "CoreMinimal.h"
#include "EMMHistorial.h"

namespace EMMAspecto
{
	const TArray<FString>& NombresPiel();   // 0: la suya
	const TArray<FString>& NombresPelo();   // 0: el suyo
	const TArray<FString>& NombresOjos();   // 0: los suyos

	// grooms de los MetaHumans montados (peinados, barbas y bigotes) con su anclaje
	struct FGroom { FString Nombre, Groom, Anclaje; };
	const TArray<FGroom>& Peinados();
	const TArray<FGroom>& Barbas();
	const TArray<FGroom>& Bigotes();
	FString NombreDe(const FString& Valor, const TArray<FGroom>& Lista, const TCHAR* Suyo, const TCHAR* Ninguno);

	// pone el aspecto en el actor (MetaHuman o niño de MPFB); lo vacío deja lo original
	void Aplicar(AActor* Actor, const FEMMAspecto& A);
}
