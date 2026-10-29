// EL MEJOR MÉDICO (Unreal): voces en español de España del propio sistema, sin Internet.
// Windows: SAPI con las voces OneCore (Pablo, Laura, Helena). Android: TextToSpeech del móvil (voces es-ES instaladas).
// Cada frase se sintetiza a audio (PCM) para reproducirla en la boca del personaje y mover sus labios.
#pragma once

#include "CoreMinimal.h"

struct FEMMPerfilVoz
{
	bool bMujer = false;
	float Tono = 1.f;   // 1 normal; > 1 más agudo
	float Vel = 1.f;    // 1 normal
	FString Preferida;  // nombre de voz preferido (p. ej. "Pablo"), si existe
};

struct FEMMAudio
{
	TArray<uint8> PCM;            // 16 bits, mono
	int32 Frecuencia = 22050;
	float Duracion = 0.f;
	TArray<float> Apertura;       // apertura de la boca (0..1) a 60 por segundo
	TArray<uint8> Visema;         // tipo de visema SAPI (0..21) a 60 por segundo; 255 si no hay
	TArray<TPair<float, int32>> Palabras;   // (segundo en que empieza, carácter donde acaba) para los subtítulos
	FString Voz;                  // voz usada
	FString Error;
};

namespace EMMVoz
{
	// Se ejecuta en segundo plano; Hecho se llama en el hilo del juego
	void Sintetizar(const FString& Texto, const FEMMPerfilVoz& Perfil, TFunction<void(TSharedPtr<FEMMAudio>)> Hecho);
	TArray<FString> VocesDisponibles();
	// voz según la persona: niño/niña, adolescente, adulto y mayor, hombre o mujer (con las voces es-ES del sistema)
	// Semilla: la misma persona, la misma voz (variación propia de tono y ritmo); 0 sin variación
	FEMMPerfilVoz PerfilPara(bool bMujer, float Edad, uint32 Semilla = 0);
	// Apertura de la boca a partir del propio audio (sirve en todas las plataformas)
	void CalcularApertura(FEMMAudio& A);
}
