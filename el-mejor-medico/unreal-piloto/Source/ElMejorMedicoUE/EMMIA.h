// EL MEJOR MÉDICO (Unreal): respuestas del paciente con IA generativa.
// En el portátil: Ollama (gratuito, sin Internet). En el móvil: Gemma 4 E2B con LiteRT-LM dentro de la aplicación.
// Si no hay IA, la respuesta predefinida del juego, y se avisa (nunca se sustituye en silencio).
#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "EMMPaciente.h"
#include "EMMIA.generated.h"

UENUM()
enum class EEMMModoIA : uint8 { Predefinida, Ollama, Movil };

struct FEMMRespuesta
{
	FString Texto;
	FString Origen;   // "ia" o "predefinida"
	FString Error;    // por qué no ha habido IA (se muestra al jugador)
	double Segundos = 0;
};

UCLASS()
class ELMEJORMEDICOUE_API UEMMIASubsystem : public UGameInstanceSubsystem
{
	GENERATED_BODY()
public:
	EEMMModoIA Modo = EEMMModoIA::Predefinida;
	FString Modelo;
	FString Url = TEXT("http://127.0.0.1:11434");
	bool bCargando = false;

	// Busca la IA disponible (Ollama en el PC, el modelo del móvil en Android). Aviso: texto para el jugador.
	void Detectar(TFunction<void(const FString& Aviso, bool bBien)> Hecho);
	// Respuesta del paciente a lo último que ha dicho el médico
	void Responder(const FEMMPaciente& P, const TArray<FEMMLinea>& Historial, const FString& Pregunta, const FString& Referencia, TFunction<void(const FEMMRespuesta&)> Hecho);
	FString Descripcion() const;

	// Igual que js/ia.js (públicas para las pruebas)
	static FString LimpiarRespuesta(const FString& T);
	static bool EsEco(const FString& Respuesta, const FString& Pregunta);
	static FString CorregirGenero(const FString& T, bool bMujer);
	static TArray<TPair<FString, FString>> ConstruirMensajes(const FEMMPaciente& P, const TArray<FEMMLinea>& Historial, const FString& Pregunta, const FString& Referencia);

#if PLATFORM_ANDROID
	// Modelo del móvil: estado y descarga (Gemma 4 E2B, 2,59 GB, una sola vez)
	FString EstadoMovilJson();
	void DescargarModelo();
	FString ProgresoDescargaJson();
#endif

private:
	void Llamar(TArray<TPair<FString, FString>> Mensajes, TFunction<void(bool bOk, const FString& Texto, const FString& Error)> Hecho);
	void PedirOllama(const FString& Ruta, const FString& Cuerpo, float Espera, TFunction<void(bool, const FString&)> Hecho);
};
