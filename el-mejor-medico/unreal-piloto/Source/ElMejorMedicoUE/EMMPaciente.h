// EL MEJOR MÉDICO (Unreal): datos del paciente de la consulta, exportados del juego web
// (herramientas/exportar-casos-unreal.mjs) para no duplicar la medicina ni las instrucciones de la IA.
#pragma once

#include "CoreMinimal.h"

struct FEMMVozPerfil
{
	float Tono = 1.f;   // 1 = normal (como en el juego web: niños > 1, hombres < 1)
	float Vel = 1.f;
};

struct FEMMPaciente
{
	FString Id, Enfermedad, Nombre, Apellidos, Sexo, TextoEdad;
	float Edad = 40.f;
	FEMMVozPerfil Voz;
	FString Sistema;                                 // instrucciones para la IA, sin historial
	TMap<FString, TArray<FString>> Respuestas;       // respuestas predefinidas por intención
	// para la evolución tras el tratamiento (datos.js › trat)
	FString EnfId, Alergia;
	TArray<TArray<FString>> TratMed;                 // grupos necesarios (vale cualquiera del grupo)
	TArray<FString> TratBuena, TratEvitar, Antecedentes;
	bool bFumador = false, bBebedor = false;
	// quién viene y quién habla, carácter y gravedad
	FString Personalidad, Acompanante, SistemaAcomp;   // SistemaAcomp: instrucciones de la IA para el acompañante
	bool bHablaAcomp = false, bBebe = false, bCronica = false;
	int32 Grav = 1;
	// exploración y pruebas (las del juego web, coherentes con la enfermedad)
	TMap<FString, float> Constantes;                 // temp, tas, tad, fc, sat, fr
	TMap<FString, float> Sangre;                     // clave de EMMDatos::ReferenciasSangre()
	TMap<FString, FString> Orina;                    // tira de orina
	TMap<FString, FString> Pruebas;                  // rx, ecg, eco, tac → informe
	float Complexion = 1.f, Altura = 1.f;
	bool bGafas = false;

	bool EsMujer() const { return Sexo == TEXT("m"); }
	FString Respuesta(const FString& Intencion) const;
};

// Una línea de la conversación (como pac.charla en el juego web)
struct FEMMLinea
{
	bool bMedico = false;
	FString Texto;
	FString Origen;   // "ia" o "predefinida" (sólo el paciente)
};

namespace EMMDatos
{
	// Lee Content/Datos/casos.json (copiado tal cual en el paquete)
	bool CargarPacientes(TArray<FEMMPaciente>& Salida, FString& Error);
	// Intenciones de la frase del médico (mismas expresiones que js/ia.js › INTENCIONES)
	TArray<FString> Intenciones(const FString& Texto);
	FString Normaliza(const FString& Texto);
	// Naturaleza de lo recetado (como itemLibre/buscarReceta del juego web): etiquetas como «antibiotico», «alcohol»…
	// Nombre recibe el producto reconocido del recetario, si lo hay.
	TArray<FString> EtiquetasDe(const FString& Texto, FString* Nombre = nullptr);
	// Valores de referencia de la analítica (nombre, unidad, rango normal y decimales)
	struct FValorRef { FString Clave, Nombre, Unidad; float Min = 0, Max = 0; int32 Decimales = 0; };
	const TArray<FValorRef>& ReferenciasSangre();
}
