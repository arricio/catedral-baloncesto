// EL MEJOR MÉDICO (Unreal): pantalla de la consulta, construida en C++ (sin recursos binarios).
// Las mismas reglas que el juego web: el médico dice sólo lo escrito al pulsar ENVIAR · HABLAR MÉDICO,
// y el paciente responde sólo al pulsar RESPONDER PACIENTE. Funciona con el dedo, el ratón y el mando de Xbox.
#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "EMMConsultaUI.generated.h"

class UButton;
class UTextBlock;
class UMultiLineEditableTextBox;
class UVerticalBox;
class UBorder;
class AEMMConsultaModo;

UCLASS()
class ELMEJORMEDICOUE_API UEMMConsultaUI : public UUserWidget
{
	GENERATED_BODY()
public:
	TWeakObjectPtr<AEMMConsultaModo> Modo;

	void PonerEstado(const FString& Texto, bool bTurnoPaciente);
	void PonerIA(const FString& Texto);
	void PonerSubtitulo(const FString& Quien, const FString& Texto, bool bMedico);
	void QuitarSubtitulo();
	void Aviso(const FString& Texto, bool bBien);
	void PonerBotones(bool bMedico, bool bPaciente);
	void PonerSugerencias(const TArray<FString>& Lista);
	void PonerDescarga(const FString& Texto, bool bVisible);
	FString TextoEscrito() const;
	void LimpiarTexto();
	void EnfocarPrincipal();

protected:
	virtual TSharedRef<SWidget> RebuildWidget() override;

private:
	void Construir();
	UButton* CrearBoton(const FString& Texto, const FLinearColor& Color, UTextBlock*& Etiqueta, float Tam = 20.f);

	UPROPERTY() TObjectPtr<UTextBlock> Estado;
	UPROPERTY() TObjectPtr<UTextBlock> EstadoIA;
	UPROPERTY() TObjectPtr<UBorder> CajaSubtitulo;
	UPROPERTY() TObjectPtr<UTextBlock> SubQuien;
	UPROPERTY() TObjectPtr<UTextBlock> SubTexto;
	UPROPERTY() TObjectPtr<UMultiLineEditableTextBox> Caja;
	UPROPERTY() TObjectPtr<UButton> BotonMedico;
	UPROPERTY() TObjectPtr<UButton> BotonPaciente;
	UPROPERTY() TObjectPtr<UVerticalBox> Sugerencias;
	UPROPERTY() TObjectPtr<UTextBlock> TextoAviso;
	UPROPERTY() TObjectPtr<UBorder> CajaAviso;
	UPROPERTY() TObjectPtr<UBorder> CajaDescarga;
	UPROPERTY() TObjectPtr<UTextBlock> TextoDescarga;
	UPROPERTY() TObjectPtr<UButton> BotonDescargar;
	UPROPERTY() TArray<TObjectPtr<UButton>> BotonesSugerencia;
	TArray<FString> TextosSugerencia;
	FTimerHandle TemporizadorAviso;

	UFUNCTION() void AlPulsarMedico();
	UFUNCTION() void AlPulsarPaciente();
	UFUNCTION() void AlPulsarDescargar();
	UFUNCTION() void AlPulsarSugerencia0();
	UFUNCTION() void AlPulsarSugerencia1();
	UFUNCTION() void AlPulsarSugerencia2();
	UFUNCTION() void AlPulsarSugerencia3();
	UFUNCTION() void AlPulsarSugerencia4();
	UFUNCTION() void AlPulsarSugerencia5();
	void UsarSugerencia(int32 i);
};
