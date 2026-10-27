// EL MEJOR MÉDICO (Unreal): voz y boca de un personaje (médico o paciente).
// Reproduce el audio sintetizado en la cabeza del personaje y expone, cuadro a cuadro, cuánto abre la boca
// y qué visema toca, además del parpadeo y pequeños gestos, para la animación facial del MetaHuman.
#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "EMMVoz.h"
#include "EMMHabla.generated.h"

class UAudioComponent;

UCLASS(ClassGroup = (ElMejorMedico), meta = (BlueprintSpawnableComponent))
class ELMEJORMEDICOUE_API UEMMHabla : public UActorComponent
{
	GENERATED_BODY()
public:
	UEMMHabla();

	// Nombre que sale en los subtítulos y voz del personaje
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Habla") FString Nombre;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Habla") bool bMujer = false;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Habla") float Tono = 1.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Habla") float Velocidad = 1.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Habla") FString VozPreferida;

	// Valores para la cara (los lee la animación facial)
	UPROPERTY(BlueprintReadOnly, Category = "Habla") float Apertura = 0.f;    // 0..1
	UPROPERTY(BlueprintReadOnly, Category = "Habla") float Redondez = 0.f;    // o, u
	UPROPERTY(BlueprintReadOnly, Category = "Habla") float Estiramiento = 0.f; // e, i
	UPROPERTY(BlueprintReadOnly, Category = "Habla") float Cierre = 0.f;      // m, b, p
	UPROPERTY(BlueprintReadOnly, Category = "Habla") float Mordida = 0.f;     // f, v (labio inferior bajo los dientes)
	UPROPERTY(BlueprintReadOnly, Category = "Habla") float Parpadeo = 0.f;    // 0..1
	UPROPERTY(BlueprintReadOnly, Category = "Habla") bool bHablando = false;

	// Sintetiza y dice la frase; Fin se llama al terminar (o si falla la voz, tras un tiempo de lectura)
	void Decir(const FString& Frase, TFunction<void(const FString& Error)> Fin);
	void Callar();
	FEMMPerfilVoz Perfil() const;
	// Lo que la voz ya ha dicho de la frase actual (para los subtítulos); vacío si está callado
	FString TextoDicho() const;

	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

private:
	TSharedPtr<FEMMAudio> Audio;
	FString Texto;
	bool bSinVoz = false;   // la voz falló: el subtítulo sale entero mientras dura la lectura
	UPROPERTY() TObjectPtr<UAudioComponent> Sonido;
	double Inicio = 0;
	TFunction<void(const FString&)> AlTerminar;
	float ProximoParpadeo = 2.f, TiempoParpadeo = -1.f;
	void Terminar(const FString& Error);
};
