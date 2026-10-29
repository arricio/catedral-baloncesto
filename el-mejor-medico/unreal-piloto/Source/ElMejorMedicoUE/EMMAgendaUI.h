// EL MEJOR MÉDICO (Unreal): AGENDA Y FICHA CLÍNICA. Muestra la ficha persistente del paciente (consultas,
// diagnósticos, recetas, pruebas y evolución), el calendario del juego con las citas, y permite terminar la
// consulta, programar la revisión y avanzar el tiempo sin esperar días reales.
#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "EMMAgendaUI.generated.h"

class AEMMConsultaModo;
class UButton;
class UTextBlock;
class UVerticalBox;
class UBorder;
class UEditableTextBox;
class UUniformGridPanel;

UCLASS()
class ELMEJORMEDICOUE_API UEMMAgendaUI : public UUserWidget
{
	GENERATED_BODY()
public:
	TWeakObjectPtr<AEMMConsultaModo> Modo;

	void Abrir();
	void Cerrar();
	bool EstaAbierta() const;
	void Refrescar();
	// para la prueba automática
	void Escribir(const FString& Diagnostico, const FString& Pruebas);
	void ElegirRevision(int32 Dias) { DiasRevision = Dias; Refrescar(); }
	void ElegirDestino(const FString& D) { Destino = D; Refrescar(); }
	void PulsarTerminar() { AlTerminar(); }
	void PulsarAvanzar() { AlAvanzar(); }

protected:
	virtual TSharedRef<SWidget> RebuildWidget() override;
	// B del mando o Escape: cerrar
	virtual FReply NativeOnPreviewKeyDown(const FGeometry& Geometria, const FKeyEvent& Tecla) override;

private:
	void Construir();
	UButton* Boton(const FString& Texto, const FLinearColor& Color, float Tam = 15.f);
	int32 DiasRevision = 0;   // 0: sin elegir; -1: sin revisión; -2: según el tratamiento
	FString Destino = TEXT("casa");   // casa, urgencias, ingreso o cirugia

	UPROPERTY() TObjectPtr<UTextBlock> Hoy;
	UPROPERTY() TObjectPtr<UTextBlock> TextoFicha;
	UPROPERTY() TObjectPtr<UTextBlock> TextoCitas;
	UPROPERTY() TObjectPtr<UTextBlock> TextoRevision;
	UPROPERTY() TObjectPtr<UTextBlock> TextoTriaje;
	UPROPERTY() TObjectPtr<UTextBlock> TextoDestino;
	UPROPERTY() TObjectPtr<UTextBlock> TituloMes;
	UPROPERTY() TObjectPtr<UUniformGridPanel> Mes;
	UPROPERTY() TObjectPtr<UEditableTextBox> Diagnostico;
	UPROPERTY() TObjectPtr<UEditableTextBox> Pruebas;
	UPROPERTY() TObjectPtr<UButton> BotonTerminar;
	UPROPERTY() TObjectPtr<UButton> BotonAvanzar;
	UPROPERTY() TObjectPtr<UButton> BotonNuevo;

	UFUNCTION() void AlIntervalo();
	UFUNCTION() void AlDestino();
	UFUNCTION() void AlTerminar();
	UFUNCTION() void AlAvanzar();
	UFUNCTION() void AlNuevo();
	UFUNCTION() void AlCerrar();
	UFUNCTION() void AlCambiarPruebas(const FText& Texto);
};
