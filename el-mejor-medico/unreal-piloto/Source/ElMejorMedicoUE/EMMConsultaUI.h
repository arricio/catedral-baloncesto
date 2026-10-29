// EL MEJOR MÉDICO (Unreal): pantalla de la consulta, construida en C++ (sin recursos binarios).
// El jugador es el médico: escribe o dicta libremente (no hay preguntas sugeridas). El médico dice sólo lo escrito
// al pulsar ENVIAR · HABLAR MÉDICO, y el paciente responde sólo al pulsar RESPONDER PACIENTE.
// CONFIGURACIÓN: subtítulos ON/OFF (desactivados por defecto; la elección se guarda).
#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "EMMConsultaUI.generated.h"

class UButton;
class UTextBlock;
class UMultiLineEditableTextBox;
class UBorder;
class AEMMConsultaModo;
class UEMMHabla;

UCLASS()
class ELMEJORMEDICOUE_API UEMMConsultaUI : public UUserWidget
{
	GENERATED_BODY()
public:
	TWeakObjectPtr<AEMMConsultaModo> Modo;

	void PonerEstado(const FString& Texto, bool bTurnoPaciente);
	void PonerIA(const FString& Texto);
	void PonerFecha(const FString& Texto);
	// subtítulo de quien habla: el texto aparece a la vez que la voz (si los subtítulos están activados)
	void PonerSubtitulo(const FString& Quien, UEMMHabla* Habla, bool bMedico);
	void QuitarSubtitulo();
	void Aviso(const FString& Texto, bool bBien);
	void PonerBotones(bool bMedico, bool bPaciente);
	void PonerDescarga(const FString& Texto, bool bVisible);
	void PonerDictado(bool bEscuchando);
	FString TextoEscrito() const;
	void PonerTexto(const FString& Texto);
	void LimpiarTexto();
	void EnfocarPrincipal();

	static bool SubtitulosActivados();
	static void GuardarSubtitulos(bool bActivos);
	// calidad gráfica: 0 rápida, 1 equilibrada (por defecto), 2 alta; «-EMMCalidad=N» la fuerza sin guardarla
	static int32 CalidadGrafica();
	static void GuardarCalidad(int32 Nivel);
	static void AplicarCalidad(int32 Nivel);
	static FString NombreCalidad(int32 Nivel);

protected:
	virtual TSharedRef<SWidget> RebuildWidget() override;
	virtual void NativeTick(const FGeometry& Geometria, float Dt) override;
	// mando Xbox: atajos para todo lo de la consulta (la cruceta y A recorren y pulsan los botones)
	virtual FReply NativeOnPreviewKeyDown(const FGeometry& Geometria, const FKeyEvent& Tecla) override;

private:
	void Construir();
	UButton* CrearBoton(const FString& Texto, const FLinearColor& Color, UTextBlock*& Etiqueta, float Tam = 20.f);

	UPROPERTY() TObjectPtr<UTextBlock> Estado;
	UPROPERTY() TObjectPtr<UTextBlock> EstadoIA;
	UPROPERTY() TObjectPtr<UTextBlock> TextoFecha;
	UPROPERTY() TObjectPtr<UBorder> CajaSubtitulo;
	UPROPERTY() TObjectPtr<UTextBlock> SubQuien;
	UPROPERTY() TObjectPtr<UTextBlock> SubTexto;
	UPROPERTY() TObjectPtr<UMultiLineEditableTextBox> Caja;
	UPROPERTY() TObjectPtr<UButton> BotonMedico;
	UPROPERTY() TObjectPtr<UButton> BotonPaciente;
	UPROPERTY() TObjectPtr<UButton> BotonMicrofono;
	UPROPERTY() TObjectPtr<UTextBlock> EtiquetaMicrofono;
	UPROPERTY() TObjectPtr<UTextBlock> TextoAviso;
	UPROPERTY() TObjectPtr<UBorder> CajaAviso;
	UPROPERTY() TObjectPtr<UBorder> CajaDescarga;
	UPROPERTY() TObjectPtr<UTextBlock> TextoDescarga;
	UPROPERTY() TObjectPtr<UButton> BotonDescargar;
	UPROPERTY() TObjectPtr<UBorder> CajaAjustes;
	UPROPERTY() TObjectPtr<UTextBlock> EtiquetaSubtitulos;
	UPROPERTY() TObjectPtr<UTextBlock> EtiquetaCalidad;
	UPROPERTY() TObjectPtr<UEMMHabla> HablaSubtitulo;
	FTimerHandle TemporizadorAviso;

	UFUNCTION() void AlPulsarMedico();
	UFUNCTION() void AlPulsarPaciente();
	UFUNCTION() void AlPulsarMicrofono();
	UFUNCTION() void AlPulsarDescargar();
	UFUNCTION() void AlPulsarAjustes();
	UFUNCTION() void AlPulsarRecetar();
	UFUNCTION() void AlPulsarAgenda();
	UFUNCTION() void AlPulsarPortatil();
	UFUNCTION() void AlPulsarSubtitulos();
	UFUNCTION() void AlPulsarCalidad();
	UFUNCTION() void AlPulsarCerrarAjustes();
	void RefrescarAjustes();
};
