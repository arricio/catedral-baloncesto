// EL MEJOR MÉDICO (Unreal): el programa del portátil del médico, una historia clínica electrónica (ficticia) con los
// datos reales de la partida: paciente, consulta en curso (lo que el médico escribe y lo hablado), historial, pruebas y
// resultados, recetas y agenda. La misma pantalla se dibuja en el portátil de la consulta (componente 3D) y, ampliada,
// a pantalla completa para consultarla y manejarla con ratón, dedo o mando.
#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "EMMPantallaUI.generated.h"

class AEMMConsultaModo;
class UTextBlock;
class UVerticalBox;
class UHorizontalBox;
class UButton;
class UBorder;

UENUM()
enum class EEMMPestana : uint8 { Paciente, Consulta, Historial, Pruebas, Recetas, Agenda, Num };

UCLASS()
class ELMEJORMEDICOUE_API UEMMPantallaUI : public UUserWidget
{
	GENERATED_BODY()
public:
	TWeakObjectPtr<AEMMConsultaModo> Modo;
	bool bAmpliada = false;            // a pantalla completa (se puede tocar) o en el portátil 3D (sólo se mira)

	void PonerPestana(EEMMPestana P) { if (Pestana != P) { Pestana = P; Firma.Reset(); } }
	EEMMPestana PestanaActual() const { return Pestana; }
	void Refrescar(bool bForzar = false);
	static FString NombrePestana(EEMMPestana P);

protected:
	virtual TSharedRef<SWidget> RebuildWidget() override;
	virtual void NativeTick(const FGeometry& Geometria, float Dt) override;

private:
	void Construir();
	struct FTarjeta { FString Titulo, Texto; FLinearColor Color; bool bAncha = false; };
	TArray<FTarjeta> Contenido() const;
	EEMMPestana Pestana = EEMMPestana::Paciente;
	FString Firma;                      // si no cambia nada, no se reconstruye (rendimiento)
	float Reloj = 0.f;

	UPROPERTY() TObjectPtr<UTextBlock> Cabecera;
	UPROPERTY() TObjectPtr<UTextBlock> CabeceraDerecha;
	UPROPERTY() TObjectPtr<UTextBlock> TituloPestana;
	UPROPERTY() TObjectPtr<UVerticalBox> Menu;
	UPROPERTY() TObjectPtr<UVerticalBox> ColIzq;
	UPROPERTY() TObjectPtr<UVerticalBox> ColDer;
	UPROPERTY() TObjectPtr<UButton> BotonCerrar;

	UFUNCTION() void AlMenu();
	UFUNCTION() void AlCerrar();
};
