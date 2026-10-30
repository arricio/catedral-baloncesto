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
	FString Destino = TEXT("casa");   // casa, urgencias, ingreso o cirugia (decisión del médico)
	FString Seguridad;          // valoración de la decisión (correcta, innecesaria o peligrosa)
	FString Diagnostico, Pruebas;
	FString Evolucion;          // en las revisiones: cómo llegó (resumen médico)
	TArray<FEMMLinea> Charla;
	TArray<FString> Recetas;    // Id de las recetas hechas en esta visita
};

// Lo que el jugador cambia en el CREADOR DE PERSONAJES (vacío o 0: lo original). La cara, el sexo y la edad
// base los da el personaje elegido; aquí van el nombre, la edad exacta y los tonos.
struct FEMMAspecto
{
	FString Nombre, Apellidos;
	int32 Edad = -1;                      // años (0: menos de un año); -1: la del caso
	int32 Piel = 0, Pelo = 0, Ojos = 0;   // 0: los suyos; 1…: tonos del creador (EMMAspecto)
	// peinado, barba y bigote: vacío el suyo, «-» ninguno, o el groom de otro MetaHuman (ruta del asset)
	FString Peinado, Barba, Bigote;
	int32 Uniforme = 0;                   // médicos: color del uniforme sanitario (0: el azul de siempre)
	bool Vacio() const { return Nombre.IsEmpty() && Apellidos.IsEmpty() && Edad < 0 && !Piel && !Pelo && !Ojos && Peinado.IsEmpty() && Barba.IsEmpty() && Bigote.IsEmpty() && !Uniforme; }
};

// Una persona de la partida: un personaje (su cara) con su identidad fija. Puede venir varias veces y con
// enfermedades distintas; su ficha guarda todo.
struct FEMMPersona
{
	FString Id;          // «P01»…
	FString Personaje;   // nombre en personajes.json
	FString CasoInicial; // caso con el que se presenta la primera vez
	FEMMAspecto Aspecto; // cambios del creador de personajes
};

struct FEMMFicha
{
	FString CasoId;      // la persona (FEMMPersona::Id); en partidas antiguas, el caso
	FString CasoActual;  // caso (enfermedad) de su última visita
	FString Personaje;
	FString Nombre, Apellidos, Sexo, Enfermedad, TextoEdad, NumeroHistoria;
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
	TArray<FEMMPersona> Plantilla;   // las personas de la partida (una por personaje)
	// el médico del jugador (creador de personajes): su cara (vacío: Lorenzo, el del nivel) y su aspecto
	FString PersonajeMedico;
	bool bMedicaMujer = false;
	FEMMAspecto Medico;

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
	// Signos de alarma en las constantes de hoy (triaje de enfermería): vacío si no hay ninguno
	TArray<FString> SignosAlarma(const FEMMPaciente& P);
	// Valoración de seguridad de la decisión del médico (casa, urgencias, ingreso, cirugia).
	// Nivel: 0 correcta, 1 innecesaria (sin daño), 2 peligrosa (necesitaba hospital y se fue a casa)
	FString ValorarDestino(const FEMMPaciente& P, const FString& Destino, int32& Nivel);
	FString NombreDestino(const FString& Destino);
	// Lo que el paciente recuerda de las consultas anteriores (para las instrucciones de la IA)
	FString Memoria(const FEMMFicha& F, const FEMMEvolucion* E, int32 Hoy);
}
