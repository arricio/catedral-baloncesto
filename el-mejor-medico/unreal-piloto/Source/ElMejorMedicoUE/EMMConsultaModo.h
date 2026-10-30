// EL MEJOR MÉDICO (Unreal): la consulta. Busca en el nivel la cámara («CamaraConsulta»), al médico («Medico»)
// y al paciente («Paciente», con «Mujer» u «Hombre»), elige un caso del juego y lleva los turnos de la conversación.
// También lleva las recetas, la ficha clínica persistente, el calendario y el regreso de los pacientes a revisión.
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "EMMPaciente.h"
#include "EMMHistorial.h"
#include "EMMPantallaUI.h"
#include "EMMConsultaModo.generated.h"

class UEMMConsultaUI;
class UEMMRecetaUI;
class UEMMAgendaUI;
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
	void AbrirRecetas();
	void AbrirAgenda();
	// el portátil del médico: abre o cierra su programa a pantalla completa; la pestaña se ve también en el 3D
	void AbrirPortatil();
	void CerrarVentanas();   // recetas, agenda y portátil (botón B del mando o Escape)
	void PestanaPortatil(EEMMPestana P);
	const FEMMVisita& VisitaActual() const { return Visita; }
	FString TextoMedico() const;
	void PonerPruebasVisita(const FString& Pruebas) { Visita.Pruebas = Pruebas; }
	void Avisar(const FString& Texto, bool bBien);
	// sombras de las luces según la calidad gráfica (el coste mayor del hilo de render)
	void AjustarLuces(int32 Nivel);

	// recetas de esta consulta (una por medicamento o tratamiento)
	TArray<FString> RecetasVisita() const { return Visita.Recetas; }
	FString NuevaReceta();
	void GuardarReceta(const FString& Id, const FString& Medicamento, const FString& Dosis, const FString& Frecuencia, const FString& Duracion, const FString& Instrucciones);
	void AnularReceta(const FString& Id);
	void EntregarReceta(const FString& Id);
	int32 DiasTratamiento() const;   // lo que dura el tratamiento entregado (para la revisión)
	FString NombreMedico() const;   // «Dr. Lorenzo Prieto Alonso» o el del creador de personajes (Dra. si es médica)
	FString ColegiadoMedico() const { return TEXT("24/28-417"); }
	FString FirmaMedico() const;

	// ── creador de personajes ──
	struct FEMMCara { FString Nombre, Etiqueta, Sexo; float EdadMin = 0.f, EdadMax = 200.f; bool bNino = false, bMedico = false; };
	TArray<FEMMCara> Caras() const;                       // los personajes del juego y el médico del nivel («Lorenzo»)
	void AbrirCreador();
	// Indice -1: el médico; si no, la persona de la plantilla. Guarda en el historial y lo pone en la consulta
	FString AplicarCreador(int32 Indice, const FString& Cara, const FEMMAspecto& A);
	FString CaraDe(int32 Indice) const;
	int32 EdadDe(int32 Indice) const;
	void NombreDe(int32 Indice, FString& Nombre, FString& Apellidos) const;
	FString NombreCompletoDe(int32 Indice) const;
	FString TextoEdadDe(int32 Indice) const;

	// ficha clínica, calendario y seguimiento
	FEMMFicha* Ficha() { return FEMMHistorial::Get().Buscar(Paciente.Id); }
	bool EsRevision() const { return Visita.bRevision; }
	bool ConsultaTerminada() const { return bTerminada; }
	FString EvolucionActual() const { return Visita.Evolucion; }
	// dias > 0: revisión en esos días; -2: al acabar el tratamiento; -1: sin revisión
	void TerminarConsulta(const FString& Diagnostico, const FString& Pruebas, int32 DiasRevision, const FString& Destino = TEXT("casa"));
	void AvanzarTiempo();
	void PacienteNuevo();

	// estado (también para las pruebas automáticas)
	const TArray<FEMMLinea>& Conversacion() const { return Charla; }
	const FEMMPaciente& PacienteActual() const { return Paciente; }
	bool EstaOcupado() const { return bOcupado; }

protected:
	virtual void BeginPlay() override;

private:
	UPROPERTY() TObjectPtr<UEMMConsultaUI> UI;
	UPROPERTY() TObjectPtr<UEMMRecetaUI> UIRecetas;
	UPROPERTY() TObjectPtr<UEMMAgendaUI> UIAgenda;
	UPROPERTY() TObjectPtr<class UEMMCreadorUI> UICreador;
	FString ClaseMedicoNivel;                 // el MetaHuman del médico que trae el nivel (Lorenzo)
	void PonerMedico();                       // el médico con la cara y el aspecto del creador de personajes
	const FEMMPersona* PersonaDe(const FString& Id) const;
	UPROPERTY() TObjectPtr<UEMMPantallaUI> UIPortatil;          // a pantalla completa
	UPROPERTY() TObjectPtr<UEMMPantallaUI> UIPantalla;          // la que se dibuja en el portátil 3D
	UPROPERTY() TObjectPtr<class UWidgetComponent> Pantalla3D;
	FTimerHandle TemporizadorMedico;
	FString UltimoTextoMedico;
	double UltimaTecla = -10.0;
	void ActualizarMedico();   // el médico mira la pantalla y teclea cuando escribe o consulta el portátil
	void CrearPantalla(AActor* Marcador);
	UPROPERTY() TObjectPtr<UEMMHabla> Medico;
	UPROPERTY() TObjectPtr<UEMMHabla> HablaPaciente;
	TWeakObjectPtr<AActor> MHMedico, MHPaciente;
	// personajes de paciente disponibles (Content/Datos/personajes.json): cada caso usa uno de su sexo y edad.
	// bNino: niño o bebé (malla de MPFB, Clase es la malla) que viene con un acompañante adulto (MetaHuman)
	struct FEMMPersonaje { FString Nombre, Clase, Sexo; float EdadMin = 0.f, EdadMax = 200.f; bool bNino = false; };
	TArray<FEMMPersonaje> Personajes;
	FTransform AsientoPaciente, AsientoAcompanante;
	FString PersonajeActual, AcompananteActual;
	TWeakObjectPtr<AActor> MHAcompanante;   // madre, padre, abuelo… de un niño o bebé
	bool bHablaAcompanante = false;          // en esta visita contesta el acompañante (bebés y niños pequeños)
	void CargarPersonajes(AActor* PacienteDelNivel);
	const FEMMPersonaje* PersonajePara(const FEMMPaciente& Caso) const;
	const FEMMPersonaje* AcompananteDe(const FEMMPaciente& Caso) const;   // un adulto de su sexo y edad
	static bool AcompananteMujer(const FEMMPaciente& Caso);
	static float EdadAcompanante(const FEMMPaciente& Caso);
	AActor* CrearPersonaje(const FEMMPersonaje& X, const FTransform& Donde);
	void PonerPersonaje(const FEMMPaciente& Caso);       // cambia el MetaHuman de la silla si hace falta
	void PrepararMetaHuman(AActor* Yo, AActor* Otro, bool bPaciente);
	void SentarBebe();                                   // el bebé, en el regazo del acompañante
	// personas de la partida: una por personaje, con su caso inicial (se guarda en el historial)
	void ConstruirPlantilla();
	FEMMPaciente PacienteDe(const FEMMPersona& Persona, const FEMMPaciente& Caso, const FEMMFicha* Ficha) const;
	bool PacienteDeFicha(const FEMMFicha& Ficha, FEMMPaciente& Salida) const;
	bool ElegirPacienteNuevo(FEMMPaciente& Salida);
	TArray<FEMMPaciente> Casos;
	FEMMPaciente Paciente;
	TArray<FEMMLinea> Charla;
	FEMMVisita Visita;            // la consulta en curso (pasa a la ficha al terminarla)
	FString MemoriaPaciente;       // lo que recuerda de las consultas anteriores (para la IA)
	FString FraseEvolucion;        // cómo dice que está al volver (referencia de las respuestas)
	bool bTurnoPaciente = false;
	bool bOcupado = false;
	bool bTerminada = false;
	FTimerHandle TemporizadorDescarga;

	// Prueba automática (-EMMPrueba): fotos, conversación real con la IA y registro en Saved/Prueba.txt
	FTimerHandle TemporizadorPrueba;
	int32 PasoPrueba = 0;
	double InicioPaso = 0;
	TArray<FString> RegistroPrueba;
	bool bFotoSubtitulos = false, bSubtitulosAntes = false;
	TArray<float> Fotogramas;   // duración de los fotogramas (rendimiento), muestreada durante la prueba
	TArray<float> MsJuego, MsRender, MsGPU;   // reparto del fotograma: hilo del juego, hilo de render y GPU
	TArray<float> FotogramasCarga;            // los 3 s siguientes a cambiar de paciente (carga del MetaHuman)
	double UltimoCambio = -100.0, UltimaFoto = -100.0;   // las fotos de la prueba congelan un fotograma: no cuentan
	void MuestraRendimiento();
	void PasoDePrueba();
	void Foto(const FString& Nombre);

	UEMMIASubsystem* IA() const;
	void IniciarVisita(const FEMMPaciente& Caso);
	FEMMPaciente PacienteParaIA() const;
	void Actualizar();
	FString Referencia(const FString& Pregunta) const;
	void Decir(UEMMHabla* Quien, const FString& Nombre, const FString& Texto, bool bEsMedico, TFunction<void()> Despues);
	void RevisarDescarga();
};
