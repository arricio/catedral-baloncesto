// EL MEJOR MÉDICO (Unreal): recetas, ficha clínica persistente de cada paciente, calendario del juego y evolución
// tras el tratamiento. Todo se guarda en Saved/Historial/historial.json (en el PC y en el móvil), sin Internet.
// La evolución la deciden reglas médicas (las del juego web: qué necesita cada enfermedad, qué le conviene y qué
// debe evitar); la IA sólo la cuenta con naturalidad cuando el paciente vuelve.
#pragma once

#include "CoreMinimal.h"
#include "EMMPaciente.h"

enum class EEMMEstadoReceta : uint8 { Borrador, Guardada, Entregada, Anulada };

struct FEMMReceta
{
	FString Id;                 // «R-000012»
	int32 Dia = 1;              // día del juego en que se hizo
	FString Medicamento, Dosis, Frecuencia, Duracion, Instrucciones;
	EEMMEstadoReceta Estado = EEMMEstadoReceta::Borrador;
	TArray<FString> Etiquetas;  // naturaleza de lo recetado (antibiotico, alcohol…)
	TArray<FString> Riesgos;    // avisos médicos de la simulación (alergia, alcohol, dosis…)

	int32 DiasDuracion() const;  // «7 días», «2 semanas», «1 mes»… (0 si no se entiende)
	static FString TextoEstado(EEMMEstadoReceta E);
};

struct FEMMVisita
{
	int32 Dia = 1;
	bool bRevision = false;
	bool bAnticipada = false;   // el paciente pidió cita antes de tiempo porque empeoraba
	FString Diagnostico, Pruebas;
	FString Evolucion;          // en las revisiones: cómo llegó (resumen médico)
	TArray<FEMMLinea> Charla;
	TArray<FString> Recetas;    // Id de las recetas hechas en esta visita
};

struct FEMMFicha
{
	FString CasoId, Nombre, Apellidos, Sexo, Enfermedad, TextoEdad, NumeroHistoria;
	TArray<FEMMVisita> Visitas;
	TArray<FEMMReceta> Recetas;
	int32 ProximaRevision = -1; // día del juego; -1 sin cita

	FEMMReceta* Receta(const FString& Id);
	const FEMMVisita* UltimaVisita() const { return Visitas.Num() ? &Visitas.Last() : nullptr; }
};

struct FEMMEvolucion
{
	FString Estado;             // recuperado, mejor, igual, peor, complicacion
	FString Resumen;            // para la ficha del médico
	FString FrasePaciente;      // referencia de lo que contará el paciente
	TArray<FString> Riesgos;
	float Cumplimiento = 1.f;   // 0..1 (si se tomó el tratamiento como se le dijo)
	float Preocupacion = 0.5f;  // expresión de la cara al volver
	int32 Dias = 0;
};

class FEMMHistorial
{
public:
	int32 Dia = 1;              // día del juego (1 = lunes 4 de enero de 2027)
	int32 SiguienteReceta = 1;
	TArray<FEMMFicha> Fichas;

	static FEMMHistorial& Get();
	// bPrueba: la prueba automática usa su propio archivo y empieza de cero (no toca la partida del jugador)
	void Cargar(bool bPrueba);
	bool Guardar() const;
	FString Ruta() const { return RutaArchivo; }

	FEMMFicha& FichaDe(const FEMMPaciente& P);
	FEMMFicha* Buscar(const FString& CasoId);
	FEMMFicha* RevisionPendiente();         // la cita más antigua con fecha de hoy o anterior
	int32 ProximaCita() const;              // primer día con cita (o -1)
	FString NuevoIdReceta() { return FString::Printf(TEXT("R-%06d"), SiguienteReceta++); }

	static FString Fecha(int32 DiaJuego);   // «lunes, 4 de enero de 2027»
private:
	FString RutaArchivo;
};

namespace EMMEvolucion
{
	// Riesgos de una receta para este paciente (alergias, alcohol, tabaco, lo que su enfermedad debe evitar, dosis)
	TArray<FString> Riesgos(const FEMMPaciente& P, const FEMMReceta& R);
	// Cómo está el paciente cuando vuelve, según su enfermedad, edad, antecedentes, lo recetado y el cumplimiento
	FEMMEvolucion Calcular(const FEMMPaciente& P, const FEMMFicha& F, int32 Hoy);
	// Lo que el paciente recuerda de las consultas anteriores (para las instrucciones de la IA)
	FString Memoria(const FEMMFicha& F, const FEMMEvolucion* E, int32 Hoy);
}
