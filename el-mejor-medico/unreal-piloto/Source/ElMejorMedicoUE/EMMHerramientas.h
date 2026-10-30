// EL MEJOR MÉDICO (Unreal): herramientas del editor (Herramientas/*.py las llaman; no existen en el juego).
#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "EMMHerramientas.generated.h"

class USkeletalMesh;
class UMaterialInterface;

UCLASS()
class ELMEJORMEDICOUE_API UEMMHerramientas : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()
public:
#if WITH_EDITOR
	// Uniforme sanitario (pantalón largo y zapatos) hecho de una copia del cuerpo de un MetaHuman: las piernas y
	// los pies, un poco hacia fuera, con los mismos huesos y pesos (sigue al cuerpo y no lo atraviesa); el resto lo
	// esconde el material (Tela: M_Uniforme, por el color de los vértices).
	// Malla: la copia (se cambia en su sitio). Holgura: cm del pantalón; Zapato: cm del zapato.
	UFUNCTION(BlueprintCallable, Category = "EMM")
	static FString CrearUniforme(USkeletalMesh* Malla, UMaterialInterface* Tela, float Holgura = 1.2f, float Zapato = 0.7f);
#endif
};
