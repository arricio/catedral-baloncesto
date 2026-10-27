// EL MEJOR MÉDICO (Unreal): la consulta. Busca en el nivel la cámara («CamaraConsulta»), al médico («Medico»)
// y al paciente («Paciente», con «Mujer» u «Hombre»), elige un caso del juego y lleva los turnos de la conversación.
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "EMMPaciente.h"
#include "EMMConsultaModo.generated.h"

class UEMMConsultaUI;
class UEMMHabla;
class UEMMIASubsystem;

UCLASS()
class ELMEJORMEDICOUE_API AEMMConsultaModo : public AGameModeBase
{
	GENERATED_BODY()
public:
	AEMMConsultaModo();

	void HablarMedico(const FString& Texto);
	void ResponderPaciente();
	void DescargarModelo();
	// micrófono: empieza o para el dictado; el texto va a la caja para revisarlo (el médico no habla solo)
	void Dictar();

	// estado (también para las pruebas automáticas)
	const TArray<FEMMLinea>& Conversacion() const { return Charla; }
	const FEMMPaciente& PacienteActual() const { return Paciente; }
	bool EstaOcupado() const { return bOcupado; }

protected:
	virtual void BeginPlay() override;

private:
	UPROPERTY() TObjectPtr<UEMMConsultaUI> UI;
	UPROPERTY() TObjectPtr<UEMMHabla> Medico;
	UPROPERTY() TObjectPtr<UEMMHabla> HablaPaciente;
	FEMMPaciente Paciente;
	TArray<FEMMLinea> Charla;
	bool bTurnoPaciente = false;
	bool bOcupado = false;
	FTimerHandle TemporizadorDescarga;

	// Prueba automática (-EMMPrueba): fotos, conversación real con la IA y registro en Saved/Prueba.txt
	FTimerHandle TemporizadorPrueba;
	int32 PasoPrueba = 0;
	double InicioPaso = 0;
	TArray<FString> RegistroPrueba;
	bool bFotoSubtitulos = false, bSubtitulosAntes = false;
	void PasoDePrueba();
	void Foto(const FString& Nombre);

	UEMMIASubsystem* IA() const;
	void Actualizar();
	FString Referencia(const FString& Pregunta) const;
	void Decir(UEMMHabla* Quien, const FString& Nombre, const FString& Texto, bool bEsMedico, TFunction<void()> Despues);
	void RevisarDescarga();
};
