#include "EMMConsultaModo.h"
#include "EMMConsultaUI.h"
#include "EMMHabla.h"
#include "EMMIA.h"
#include "EMMVoz.h"
#include "EMMCuerpoAnim.h"
#include "EMMDictado.h"
#include "EMMRecetaUI.h"
#include "EMMAgendaUI.h"
#include "Components/WidgetComponent.h"
#include "Misc/PackageName.h"
#include "Framework/Application/SlateApplication.h"
#include "Misc/CommandLine.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "UnrealClient.h"
#include "ShaderCompiler.h"
#include "Blueprint/UserWidget.h"
#include "Dom/JsonObject.h"
#include "Engine/GameInstance.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "Camera/CameraActor.h"
#include "Camera/CameraComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Engine/SkeletalMesh.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "GameFramework/PlayerController.h"
#include "Kismet/GameplayStatics.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "TimerManager.h"

// Tiñe la ropa del MetaHuman (camiseta y pantalón de la prenda básica) con los colores pedidos
static void Vestir(AActor* A, const FLinearColor& Arriba, const FLinearColor& Abajo)
{
	if (!A) return;
	TArray<USkeletalMeshComponent*> Mallas;
	A->GetComponents(Mallas);
	int32 Tenidas = 0;
	TArray<FString> Vistas;
	for (USkeletalMeshComponent* M : Mallas)
	{
		Vistas.Add(FString::Printf(TEXT("%s=%s"), *M->GetName(), M->GetSkeletalMeshAsset() ? *M->GetSkeletalMeshAsset()->GetName() : TEXT("-")));
		if (!M->GetSkeletalMeshAsset() || !M->GetSkeletalMeshAsset()->GetName().Contains(TEXT("Outfits"))) continue;
		++Tenidas;
		const TArray<FName> Ranuras = M->GetMaterialSlotNames();
		for (int32 i = 0; i < M->GetNumMaterials(); ++i)
		{
			const FString Ranura = Ranuras.IsValidIndex(i) ? Ranuras[i].ToString() : FString();
			const bool bArriba = Ranura.Contains(TEXT("Shirt"));
			if (!bArriba && !Ranura.Contains(TEXT("Short"))) continue;
			UMaterialInstanceDynamic* D = M->CreateDynamicMaterialInstance(i);
			if (!D) continue;
			for (const TCHAR* P : { TEXT("C_color"), TEXT("diffuse_color_1"), TEXT("diffuse_color_2"), TEXT("B_diffuse_color_1") })
				D->SetVectorParameterValue(P, bArriba ? Arriba : Abajo);
		}
	}
	UE_LOG(LogTemp, Display, TEXT("[EMM] Vestir %s: %d prendas teñidas (%s)"), *A->GetName(), Tenidas, *FString::Join(Vistas, TEXT(", ")));
}

// Ropa del paciente según la edad (y una variación fija por caso, para que no vistan todos igual)
static void ColoresPaciente(const FEMMPaciente& P, FLinearColor& Arriba, FLinearColor& Abajo)
{
	const uint32 H = GetTypeHash(P.Id);
	auto Elige = [H](std::initializer_list<FLinearColor> L, uint32 Sal) { return *(L.begin() + (H / Sal) % L.size()); };
	if (P.Edad < 13.f)      { Arriba = Elige({ FLinearColor(0.75f, 0.12f, 0.1f), FLinearColor(0.95f, 0.7f, 0.1f), FLinearColor(0.15f, 0.45f, 0.8f), FLinearColor(0.2f, 0.6f, 0.3f) }, 1); Abajo = FLinearColor(0.08f, 0.12f, 0.25f); }
	else if (P.Edad < 30.f) { Arriba = Elige({ FLinearColor(0.05f, 0.05f, 0.06f), FLinearColor(0.35f, 0.38f, 0.22f), FLinearColor(0.55f, 0.1f, 0.15f), FLinearColor(0.6f, 0.6f, 0.62f) }, 1); Abajo = FLinearColor(0.06f, 0.09f, 0.18f); }
	else if (P.Edad < 65.f) { Arriba = Elige({ FLinearColor(0.08f, 0.12f, 0.25f), FLinearColor(0.45f, 0.42f, 0.38f), FLinearColor(0.3f, 0.06f, 0.1f), FLinearColor(0.15f, 0.25f, 0.2f) }, 1); Abajo = Elige({ FLinearColor(0.05f, 0.05f, 0.06f), FLinearColor(0.25f, 0.22f, 0.18f) }, 7); }
	else                    { Arriba = Elige({ FLinearColor(0.35f, 0.25f, 0.18f), FLinearColor(0.55f, 0.5f, 0.42f), FLinearColor(0.35f, 0.08f, 0.12f), FLinearColor(0.25f, 0.3f, 0.35f) }, 1); Abajo = FLinearColor(0.18f, 0.16f, 0.14f); }
}

AEMMConsultaModo::AEMMConsultaModo()
{
	// La consulta empieza con el turno del médico
	DefaultPawnClass = nullptr;   // la cámara es fija: la consulta se ve desde la mesa del médico
}

UEMMIASubsystem* AEMMConsultaModo::IA() const { return GetGameInstance()->GetSubsystem<UEMMIASubsystem>(); }

void AEMMConsultaModo::BeginPlay()
{
	Super::BeginPlay();
	UE_LOG(LogTemp, Display, TEXT("[EMM] Consulta: empieza la partida (subtítulos %s, día %d del calendario)"), UEMMConsultaUI::SubtitulosActivados() ? TEXT("ON") : TEXT("OFF"), FEMMHistorial::Get().Dia);
	APlayerController* PC = GetWorld()->GetFirstPlayerController();

	// personajes y cámara del nivel
	AActor* Camara = nullptr; AActor* ActorMedico = nullptr; AActor* ActorPaciente = nullptr; AActor* MarcaPantalla = nullptr;
	for (TActorIterator<AActor> It(GetWorld()); It; ++It)
	{
		if (It->ActorHasTag(TEXT("PantallaPortatil"))) MarcaPantalla = *It;
		if (It->ActorHasTag(TEXT("CamaraConsulta"))) Camara = *It;
		if (It->ActorHasTag(TEXT("Medico"))) ActorMedico = *It;
		if (It->ActorHasTag(TEXT("Paciente"))) ActorPaciente = *It;
	}
	// MetaHumans: animación propia del cuerpo (sentados, respiración, mirada, boca) y uno frente al otro
	if (ActorMedico && ActorPaciente)
	{
		AsientoPaciente = ActorPaciente->GetActorTransform();
		PrepararMetaHuman(ActorMedico, ActorPaciente, false);
		PrepararMetaHuman(ActorPaciente, ActorMedico, true);
	}
	// encuadre calculado: de lado, a la altura de las cabezas (sentados), viendo de frente a médico y paciente.
	// Los números están en Content/Datos/escena.json para ajustarlos sin recompilar.
	if (ActorMedico && ActorPaciente)
	{
		double Atras = 40, Lateral = 130, Alto = 150, Mezcla = 0.55, AltoMira = 112, Fov = 55;
		{
			FString J; TSharedPtr<FJsonObject> O, C;
			if (FFileHelper::LoadFileToString(J, *(FPaths::ProjectContentDir() / TEXT("Datos/escena.json"))) &&
				FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(J), O) && O.IsValid() && O->HasTypedField<EJson::Object>(TEXT("camara")))
			{
				C = O->GetObjectField(TEXT("camara"));
				C->TryGetNumberField(TEXT("atras"), Atras); C->TryGetNumberField(TEXT("lado"), Lateral); C->TryGetNumberField(TEXT("alto"), Alto);
				C->TryGetNumberField(TEXT("mezcla"), Mezcla); C->TryGetNumberField(TEXT("alto_mira"), AltoMira); C->TryGetNumberField(TEXT("fov"), Fov);
			}
		}
		const FVector M = ActorMedico->GetActorLocation(), Pp = ActorPaciente->GetActorLocation();
		// plano de dos desde el lado de la ventana: el médico de perfil a la izquierda, el paciente de tres cuartos
		const FVector Dir = (Pp - M).GetSafeNormal2D();
		FVector Lado = FVector::CrossProduct(Dir, FVector::UpVector);
		if (Lado.Y < 0) Lado = -Lado;   // del lado de la ventana (+Y): la luz de día ilumina las caras
		const FVector Centro = FMath::Lerp(M, Pp, float(Mezcla)) + FVector(0, 0, AltoMira - Pp.Z);
		const FVector Pos = M - Dir * Atras + Lado * Lateral + FVector(0, 0, Alto - M.Z);
		ACameraActor* Cam = GetWorld()->SpawnActor<ACameraActor>(Pos, (Centro - Pos).Rotation());
		Cam->GetCameraComponent()->SetFieldOfView(float(Fov));
		Cam->GetCameraComponent()->bConstrainAspectRatio = false;
		Camara = Cam;
	}
	// sin personaje del jugador: la vista es la cámara fija de la consulta (que Unreal no la cambie solo)
	if (PC) PC->bAutoManageActiveCameraTarget = false;
	if (PC && Camara) PC->SetViewTargetWithBlend(Camara, 0.f);
	// sin personaje, Unreal crea después un «espectador» y se lleva la vista: se vuelve a poner la cámara
	if (PC && Camara)
	{
		TWeakObjectPtr<APlayerController> WPC(PC); TWeakObjectPtr<AActor> WCam(Camara);
		FTimerHandle T;
		GetWorldTimerManager().SetTimer(T, FTimerDelegate::CreateWeakLambda(this, [WPC, WCam]() { if (WPC.IsValid() && WCam.IsValid()) WPC->SetViewTargetWithBlend(WCam.Get(), 0.f); }), 0.3f, false);
	}
	auto Habla = [this](AActor* A) -> UEMMHabla* {
		if (!A) A = GetWorld()->SpawnActor<AActor>();
		UEMMHabla* H = A->FindComponentByClass<UEMMHabla>();
		if (!H) { H = NewObject<UEMMHabla>(A, TEXT("Habla")); H->RegisterComponent(); }
		return H;
	};
	Medico = Habla(ActorMedico);
	HablaPaciente = Habla(ActorPaciente);
	Medico->Nombre = TEXT("Dr. Prieto");
	// voz del médico: adulta normal (en cada visita se cambia si coincide con la del paciente)
	const FEMMPerfilVoz VM = EMMVoz::PerfilPara(ActorMedico && ActorMedico->ActorHasTag(TEXT("Mujer")), 40.f);
	Medico->bMujer = VM.bMujer; Medico->Tono = VM.Tono; Medico->Velocidad = VM.Vel; Medico->VozPreferida = VM.Preferida;

	MHMedico = ActorMedico;
	MHPaciente = ActorPaciente;
	// ropa: pijama sanitario azul verdoso para el médico (el paciente se viste en cada visita)
	Vestir(ActorMedico, FLinearColor(0.06f, 0.26f, 0.32f), FLinearColor(0.05f, 0.22f, 0.28f));

	// casos del juego: sólo los que tienen un personaje de su sexo y edad (personajes.json). Los de bebés y niños
	// pequeños (que explica el acompañante) esperan a tener sus modelos y el acompañante en la consulta.
	FString Error;
	EMMDatos::CargarPacientes(Casos, Error);
	CargarPersonajes(ActorPaciente);
	Casos.RemoveAll([this](const FEMMPaciente& P) { return P.bHablaAcomp || P.bBebe || !PersonajePara(P); });
	UE_LOG(LogTemp, Display, TEXT("[EMM] %d personajes de paciente; %d casos con personaje"), Personajes.Num(), Casos.Num());

	UI = CreateWidget<UEMMConsultaUI>(PC, UEMMConsultaUI::StaticClass());
	UI->Modo = this;
	UI->AddToViewport();
	UIRecetas = CreateWidget<UEMMRecetaUI>(PC, UEMMRecetaUI::StaticClass());
	UIRecetas->Modo = this;
	UIRecetas->AddToViewport(10);
	UIAgenda = CreateWidget<UEMMAgendaUI>(PC, UEMMAgendaUI::StaticClass());
	UIAgenda->Modo = this;
	UIAgenda->AddToViewport(10);
	// el portátil: su programa en la pantalla 3D y, ampliado, a pantalla completa
	UIPortatil = CreateWidget<UEMMPantallaUI>(PC, UEMMPantallaUI::StaticClass());
	UIPortatil->Modo = this;
	UIPortatil->bAmpliada = true;
	UIPortatil->AddToViewport(10);
	UIPortatil->SetVisibility(ESlateVisibility::Collapsed);
	if (MarcaPantalla) CrearPantalla(MarcaPantalla);
	GetWorldTimerManager().SetTimer(TemporizadorMedico, this, &AEMMConsultaModo::ActualizarMedico, 0.1f, true);

	// ficha clínica y calendario: si hoy hay una revisión, vuelve ese paciente; si no, uno nuevo
	FEMMHistorial& H = FEMMHistorial::Get();
	H.Cargar(FParse::Param(FCommandLine::Get(), TEXT("EMMPrueba")));
	const FEMMFicha* Pendiente = H.RevisionPendiente();
	const FEMMPaciente* Caso = Pendiente ? Casos.FindByPredicate([&](const FEMMPaciente& P) { return P.Id == Pendiente->CasoId; }) : nullptr;
	if (Caso) IniciarVisita(*Caso);
	else if (Casos.Num()) IniciarVisita(Casos[FMath::RandRange(0, Casos.Num() - 1)]);
	if (PC)
	{
		PC->bShowMouseCursor = true;
		FInputModeGameAndUI Modo;
		Modo.SetHideCursorDuringCapture(false);
		PC->SetInputMode(Modo);
	}
	if (!Error.IsEmpty()) UI->Aviso(Error, false);
	Actualizar();

	TWeakObjectPtr<AEMMConsultaModo> Yo(this);
	IA()->Detectar([Yo](const FString& Aviso, bool bBien) {
		if (!Yo.IsValid()) return;
		if (Aviso == TEXT("NO_INSTALADO"))
			Yo->UI->PonerDescarga(TEXT("Para que los pacientes contesten con inteligencia artificial sin Internet y sin el portátil, el juego necesita el modelo Gemma 4 E2B (2,59 GB, gratuito, licencia Apache 2.0). Se descarga una sola vez (mejor con wifi) y se guarda en el móvil. Mientras tanto, las respuestas serán las predefinidas del juego."), true);
		else Yo->UI->Aviso(Aviso, bBien);
		Yo->Actualizar();
	});
	Actualizar();
	if (FParse::Param(FCommandLine::Get(), TEXT("EMMPrueba")))
	{
		RegistroPrueba.Add(FString::Printf(TEXT("Paciente: %s %s, %s, %s"), *Paciente.Nombre, *Paciente.Apellidos, *Paciente.TextoEdad, *Paciente.Enfermedad));
		InicioPaso = FPlatformTime::Seconds();
		GetWorldTimerManager().SetTimer(TemporizadorPrueba, this, &AEMMConsultaModo::PasoDePrueba, 0.25f, true);
	}
}

// ───────────────────────── Personajes ─────────────────────────
void AEMMConsultaModo::PrepararMetaHuman(AActor* Yo, AActor* Otro, bool bPaciente)
{
	if (!Yo || !Otro) return;
	// el MetaHuman mira hacia +Y de su malla: se gira 90° menos que la dirección hacia el otro
	Yo->SetActorRotation(FRotator(0, (Otro->GetActorLocation() - Yo->GetActorLocation()).Rotation().Yaw - 90.f, 0));
	TArray<USkeletalMeshComponent*> Mallas;
	Yo->GetComponents(Mallas);
	for (USkeletalMeshComponent* M : Mallas)
		if (M->GetName().Contains(TEXT("Body")))
		{
			M->SetAnimInstanceClass(UEMMCuerpoAnim::StaticClass());
			if (UEMMCuerpoAnim* A = Cast<UEMMCuerpoAnim>(M->GetAnimInstance()))
			{
				A->Interlocutor = Otro; A->Fase = bPaciente ? 1.7f : 0.f;
				// el paciente llega preocupado; el médico, atento y amable
				if (bPaciente) A->Preocupacion = 0.6f; else A->Sonrisa = 0.45f;
			}
		}
}

void AEMMConsultaModo::CargarPersonajes(AActor* PacienteDelNivel)
{
	// Content/Datos/personajes.json: { "pacientes": [ { "nombre", "clase", "sexo": "h"|"m", "edad": [min, max] } ] }
	FString J; TSharedPtr<FJsonObject> O;
	if (FFileHelper::LoadFileToString(J, *(FPaths::ProjectContentDir() / TEXT("Datos/personajes.json"))) &&
		FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(J), O) && O.IsValid())
		for (const TSharedPtr<FJsonValue>& V : O->GetArrayField(TEXT("pacientes")))
		{
			const TSharedPtr<FJsonObject> P = V->AsObject();
			FEMMPersonaje X;
			X.Nombre = P->GetStringField(TEXT("nombre")); X.Clase = P->GetStringField(TEXT("clase")); X.Sexo = P->GetStringField(TEXT("sexo"));
			const TArray<TSharedPtr<FJsonValue>>& E = P->GetArrayField(TEXT("edad"));
			X.EdadMin = E[0]->AsNumber(); X.EdadMax = E[1]->AsNumber();
			// sólo los que están construidos (el paquete existe); se comprueba sin cargarlos
			const FString Paquete = FPackageName::ObjectPathToPackageName(X.Clase);
			if (FPackageName::DoesPackageExist(Paquete)) Personajes.Add(X);
			else UE_LOG(LogTemp, Display, TEXT("[EMM] Personaje %s sin construir (%s)"), *X.Nombre, *Paquete);
		}
	// sin archivo: el paciente que esté en el nivel, como adulto joven de su sexo
	if (!Personajes.Num() && PacienteDelNivel)
		Personajes.Add({ TEXT("Paciente del nivel"), PacienteDelNivel->GetClass()->GetPathName(), PacienteDelNivel->ActorHasTag(TEXT("Mujer")) ? TEXT("m") : TEXT("h"), 18.f, 64.f });
	if (PacienteDelNivel) PersonajeActual = PacienteDelNivel->GetClass()->GetPathName();
}

const AEMMConsultaModo::FEMMPersonaje* AEMMConsultaModo::PersonajePara(const FEMMPaciente& Caso) const
{
	// los de su sexo y edad; entre varios, siempre el mismo para el mismo caso (vuelve con la misma cara)
	TArray<const FEMMPersonaje*> Validos;
	for (const FEMMPersonaje& X : Personajes)
		if (X.Sexo == Caso.Sexo && Caso.Edad >= X.EdadMin && Caso.Edad <= X.EdadMax) Validos.Add(&X);
	return Validos.Num() ? Validos[GetTypeHash(Caso.Id) % uint32(Validos.Num())] : nullptr;
}

void AEMMConsultaModo::PonerPersonaje(const FEMMPaciente& Caso)
{
	const FEMMPersonaje* X = PersonajePara(Caso);
	if (!X || X->Clase == PersonajeActual || !MHMedico.IsValid()) return;
	UClass* Clase = LoadClass<AActor>(nullptr, *X->Clase);
	if (!Clase) { UE_LOG(LogTemp, Warning, TEXT("[EMM] No se carga el personaje %s (%s)"), *X->Nombre, *X->Clase); return; }
	AActor* Nuevo = GetWorld()->SpawnActor<AActor>(Clase, AsientoPaciente);
	if (!Nuevo) return;
	Nuevo->Tags = { TEXT("Paciente"), Caso.EsMujer() ? TEXT("Mujer") : TEXT("Hombre") };
	if (MHPaciente.IsValid()) MHPaciente->Destroy();
	MHPaciente = Nuevo;
	PersonajeActual = X->Clase;
	PrepararMetaHuman(Nuevo, MHMedico.Get(), true);
	// el médico mira al nuevo paciente
	TArray<USkeletalMeshComponent*> Mallas;
	MHMedico->GetComponents(Mallas);
	for (USkeletalMeshComponent* M : Mallas) if (UEMMCuerpoAnim* A = Cast<UEMMCuerpoAnim>(M->GetAnimInstance())) A->Interlocutor = Nuevo;
	// su voz y su boca
	HablaPaciente = NewObject<UEMMHabla>(Nuevo, TEXT("Habla"));
	HablaPaciente->RegisterComponent();
	UE_LOG(LogTemp, Display, TEXT("[EMM] Paciente: personaje %s"), *X->Nombre);
}

// ───────────────────────── Visitas, recetas y seguimiento ─────────────────────────
void AEMMConsultaModo::IniciarVisita(const FEMMPaciente& Caso)
{
	FEMMHistorial& H = FEMMHistorial::Get();
	PonerPersonaje(Caso);
	Paciente = Caso;
	FEMMFicha& F = H.FichaDe(Paciente);
	Visita = FEMMVisita();
	Visita.Dia = H.Dia;
	Visita.bRevision = F.Visitas.Num() > 0;
	Charla.Reset();
	bTurnoPaciente = bOcupado = bTerminada = false;
	FraseEvolucion.Reset();
	float Preocupacion = 0.6f;
	FEMMEvolucion E;
	if (Visita.bRevision)
	{
		// vuelve: su evolución depende de la enfermedad, la edad, lo recetado y si lo ha cumplido
		E = EMMEvolucion::Calcular(Paciente, F, H.Dia);
		Visita.Evolucion = E.Resumen;
		FraseEvolucion = E.FrasePaciente;
		Preocupacion = E.Preocupacion;
		F.ProximaRevision = -1;   // la cita ya se está atendiendo
	}
	MemoriaPaciente = EMMEvolucion::Memoria(F, Visita.bRevision ? &E : nullptr, H.Dia);
	H.Guardar();

	// voz según edad y sexo; si coincide con la del médico, el médico cambia un poco la suya
	HablaPaciente->Nombre = Paciente.Nombre.IsEmpty() ? TEXT("Paciente") : Paciente.Nombre;
	const FEMMPerfilVoz VP = EMMVoz::PerfilPara(Paciente.EsMujer(), Paciente.Edad, GetTypeHash(Paciente.Id) | 1u);
	HablaPaciente->bMujer = VP.bMujer; HablaPaciente->Tono = VP.Tono; HablaPaciente->Velocidad = VP.Vel; HablaPaciente->VozPreferida = VP.Preferida;
	const bool bMedicaMujer = MHMedico.IsValid() && MHMedico->ActorHasTag(TEXT("Mujer"));
	const FEMMPerfilVoz VM = EMMVoz::PerfilPara(bMedicaMujer, 40.f);
	Medico->VozPreferida = VM.Preferida; Medico->Tono = VM.Tono;
	if (bMedicaMujer == VP.bMujer && VM.Preferida == VP.Preferida)
	{
		if (bMedicaMujer) Medico->VozPreferida = TEXT("Helena");
		else Medico->Tono = 1.05f;
	}
	// el carácter se nota en el cuerpo y en la forma de hablar: los nerviosos se mueven más y hablan más deprisa
	const FString Pers = EMMDatos::Normaliza(Paciente.Personalidad);
	auto Tiene = [&Pers](std::initializer_list<const TCHAR*> L) { for (const TCHAR* X : L) if (Pers.Contains(X)) return true; return false; };
	float Inquietud = 1.f;
	if (Tiene({ TEXT("nervios"), TEXT("inquiet"), TEXT("ansios"), TEXT("impacien"), TEXT("agobi"), TEXT("asustad") })) { Inquietud = 1.7f; HablaPaciente->Velocidad *= 1.1f; }
	else if (Tiene({ TEXT("hablador"), TEXT("bromista"), TEXT("charlat"), TEXT("extrovert"), TEXT("simpatic") })) { Inquietud = 1.3f; HablaPaciente->Velocidad *= 1.05f; }
	else if (Tiene({ TEXT("tranquil"), TEXT("seren"), TEXT("calmad"), TEXT("timid"), TEXT("reservad"), TEXT("callad"), TEXT("parco") })) { Inquietud = 0.6f; HablaPaciente->Velocidad *= 0.95f; }
	if (Paciente.Grav >= 3) Inquietud *= 0.7f;   // los que están muy malos se mueven poco
	// ropa según la edad y gesto según cómo llega
	FLinearColor Arriba, Abajo;
	ColoresPaciente(Paciente, Arriba, Abajo);
	Vestir(MHPaciente.Get(), Arriba, Abajo);
	if (MHPaciente.IsValid())
	{
		TArray<USkeletalMeshComponent*> Mallas;
		MHPaciente->GetComponents(Mallas);
		for (USkeletalMeshComponent* M : Mallas)
			if (UEMMCuerpoAnim* A = Cast<UEMMCuerpoAnim>(M->GetAnimInstance()))
			{
				A->Preocupacion = Preocupacion; A->Sonrisa = Preocupacion < 0.2f ? 0.35f : 0.f;
				A->Inquietud = Inquietud;
			}
	}
	if (UI)
	{
		UI->PonerFecha(FString::Printf(TEXT("%s · %s · %s %s"), *FEMMHistorial::Fecha(H.Dia), Visita.bRevision ? TEXT("REVISIÓN") : TEXT("Primera consulta"), *Paciente.Nombre, *Paciente.Apellidos));
		UI->LimpiarTexto();
	}
	if (UIRecetas) UIRecetas->Refrescar();
	Actualizar();
}

FEMMPaciente AEMMConsultaModo::PacienteParaIA() const
{
	// las instrucciones del caso + lo que recuerda de otras consultas + lo que se le ha recetado hoy
	FEMMPaciente P = Paciente;
	TArray<FString> Extra;
	if (!MemoriaPaciente.IsEmpty()) Extra.Add(MemoriaPaciente);
	const FEMMFicha* F = FEMMHistorial::Get().Buscar(Paciente.Id);
	TArray<FString> Hoy;
	for (const FString& Id : Visita.Recetas)
		if (const FEMMReceta* R = F ? F->Recetas.FindByPredicate([&](const FEMMReceta& X) { return X.Id == Id; }) : nullptr)
			if (R->Estado == EEMMEstadoReceta::Entregada)
				Hoy.Add(FString::Printf(TEXT("- %s, %s, %s, durante %s. %s"), *R->Medicamento, *R->Dosis, *R->Frecuencia, *R->Duracion, *R->Instrucciones));
	if (Hoy.Num())
	{
		Extra.Add(TEXT("En esta consulta el médico te ha entregado estas recetas (puedes preguntar dudas sobre ellas):"));
		Extra.Append(Hoy);
	}
	if (Extra.Num())
	{
		TArray<FString> Lineas;
		P.Sistema.ParseIntoArray(Lineas, TEXT("\n"), false);
		const FString Ultima = Lineas.Num() ? Lineas.Pop() : FString();
		Lineas.Append(Extra);
		Lineas.Add(Ultima);
		P.Sistema = FString::Join(Lineas, TEXT("\n"));
	}
	return P;
}

void AEMMConsultaModo::Avisar(const FString& Texto, bool bBien) { if (UI) UI->Aviso(Texto, bBien); }

FString AEMMConsultaModo::TextoMedico() const { return UI ? UI->TextoEscrito() : FString(); }

void AEMMConsultaModo::CrearPantalla(AActor* Marcador)
{
	// el marcador (crear_consulta.py) está en la cara de la pantalla: X hacia el médico, Z hacia arriba;
	// su escala guarda el tamaño (Y ancho, Z alto, en metros)
	const FVector Tam = Marcador->GetActorScale3D() * 100.f;
	const float Ancho = 1280.f, Alto = FMath::RoundToFloat(Ancho * Tam.Z / FMath::Max(1.f, Tam.Y));
	UIPantalla = CreateWidget<UEMMPantallaUI>(GetWorld(), UEMMPantallaUI::StaticClass());
	UIPantalla->Modo = this;
	// el marcador es un TargetPoint, que Unreal oculta en el juego: la pantalla va en un actor propio
	AActor* Soporte = GetWorld()->SpawnActor<AActor>(AActor::StaticClass(), Marcador->GetActorTransform());
	Pantalla3D = NewObject<UWidgetComponent>(Soporte, TEXT("PantallaPortatil"));
	Soporte->SetRootComponent(Pantalla3D);
	Pantalla3D->SetUsingAbsoluteScale(true);
	Pantalla3D->RegisterComponent();
	Pantalla3D->SetWorldLocationAndRotation(Marcador->GetActorLocation(), Marcador->GetActorRotation());
	Pantalla3D->SetWorldScale3D(FVector(1.f, Tam.Y / Ancho, Tam.Y / Ancho));
	Pantalla3D->SetWidgetSpace(EWidgetSpace::World);
	Pantalla3D->SetDrawSize(FVector2D(Ancho, Alto));
	Pantalla3D->SetPivot(FVector2D(0.5f, 0.5f));
	Pantalla3D->SetBlendMode(EWidgetBlendMode::Opaque);
	Pantalla3D->SetTwoSided(false);
	// pantalla retroiluminada (material propio con brillo; el de Unreal se ve negro con la exposición de la consulta)
	if (UMaterialInterface* M = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/Materiales/M_PantallaPortatil.M_PantallaPortatil"))) Pantalla3D->SetMaterial(0, M);
	Pantalla3D->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	Pantalla3D->SetWidget(UIPantalla);
	Pantalla3D->SetTickWhenOffscreen(false);
	UE_LOG(LogTemp, Display, TEXT("[EMM] Pantalla del portátil: %.1f × %.1f cm, %.0f × %.0f px"), Tam.Y, Tam.Z, Ancho, Alto);
}

void AEMMConsultaModo::AbrirPortatil()
{
	if (!UIPortatil) return;
	if (UIRecetas) UIRecetas->Cerrar();
	if (UIAgenda) UIAgenda->Cerrar();
	const bool bAbrir = UIPortatil->GetVisibility() == ESlateVisibility::Collapsed;
	UIPortatil->SetVisibility(bAbrir ? ESlateVisibility::Visible : ESlateVisibility::Collapsed);
	if (bAbrir)
	{
		// se abre por lo que muestra el portátil en ese momento
		if (UIPantalla) UIPortatil->PonerPestana(UIPantalla->PestanaActual());
		UIPortatil->Refrescar(true);
	}
}

void AEMMConsultaModo::CerrarVentanas()
{
	if (UIRecetas) UIRecetas->Cerrar();
	if (UIAgenda) UIAgenda->Cerrar();
	if (UIPortatil) UIPortatil->SetVisibility(ESlateVisibility::Collapsed);
	if (UI) UI->EnfocarPrincipal();
}

void AEMMConsultaModo::PestanaPortatil(EEMMPestana P)
{
	if (UIPantalla) { UIPantalla->PonerPestana(P); UIPantalla->Refrescar(); }
}

void AEMMConsultaModo::ActualizarMedico()
{
	const double Ahora = FPlatformTime::Seconds();
	const FString T = TextoMedico();
	if (T != UltimoTextoMedico) { UltimoTextoMedico = T; UltimaTecla = Ahora; }
	const bool bPortatil = UIPortatil && UIPortatil->GetVisibility() == ESlateVisibility::Visible;
	const bool bRecetando = UIRecetas && UIRecetas->EstaAbierta();
	const bool bAgenda = UIAgenda && UIAgenda->EstaAbierta();
	const bool bTeclea = Ahora - UltimaTecla < 1.5 || bRecetando;
	// lo que enseña el portátil 3D: lo mismo que la vista ampliada o lo que se está haciendo
	if (UIPantalla && !bPortatil)
	{
		const EEMMPestana P = bRecetando ? EEMMPestana::Recetas : bAgenda ? EEMMPestana::Agenda : (bTeclea || Charla.Num()) ? EEMMPestana::Consulta : EEMMPestana::Paciente;
		UIPantalla->PonerPestana(P);
	}
	else if (UIPantalla && bPortatil) UIPantalla->PonerPestana(UIPortatil->PestanaActual());
	if (MHMedico.IsValid())
	{
		TArray<USkeletalMeshComponent*> Mallas;
		MHMedico->GetComponents(Mallas);
		for (USkeletalMeshComponent* M : Mallas)
			if (UEMMCuerpoAnim* A = Cast<UEMMCuerpoAnim>(M->GetAnimInstance()))
			{
				A->bMirarPantalla = bTeclea || bPortatil || bAgenda;
				A->bTeclear = bTeclea;
			}
	}
}

void AEMMConsultaModo::AbrirRecetas()
{
	if (UIAgenda) UIAgenda->Cerrar();
	if (UIPortatil) UIPortatil->SetVisibility(ESlateVisibility::Collapsed);
	if (UIRecetas) { if (UIRecetas->EstaAbierta()) UIRecetas->Cerrar(); else UIRecetas->Abrir(); }
}

void AEMMConsultaModo::AbrirAgenda()
{
	if (UIRecetas) UIRecetas->Cerrar();
	if (UIPortatil) UIPortatil->SetVisibility(ESlateVisibility::Collapsed);
	if (UIAgenda) { if (UIAgenda->EstaAbierta()) UIAgenda->Cerrar(); else UIAgenda->Abrir(); }
}

FString AEMMConsultaModo::NuevaReceta()
{
	if (bTerminada) { Avisar(TEXT("La consulta ya está terminada: no se pueden hacer más recetas."), false); return FString(); }
	FEMMHistorial& H = FEMMHistorial::Get();
	FEMMFicha& F = H.FichaDe(Paciente);
	FEMMReceta& R = F.Recetas.AddDefaulted_GetRef();
	R.Id = H.NuevoIdReceta();
	R.Dia = H.Dia;
	Visita.Recetas.Add(R.Id);
	const FString Id = R.Id;
	H.Guardar();
	return Id;
}

void AEMMConsultaModo::GuardarReceta(const FString& Id, const FString& Med, const FString& Dosis, const FString& Frec, const FString& Dur, const FString& Instr)
{
	FEMMFicha* F = Ficha();
	FEMMReceta* R = F ? F->Receta(Id) : nullptr;
	if (!R) return;
	if (R->Estado == EEMMEstadoReceta::Entregada || R->Estado == EEMMEstadoReceta::Anulada) { Avisar(TEXT("Esta receta ya está entregada o anulada: no se puede modificar. Haz una nueva."), false); return; }
	if (Med.TrimStartAndEnd().IsEmpty()) { Avisar(TEXT("Escribe o dicta primero el medicamento o tratamiento."), false); return; }
	const bool bModificada = R->Estado == EEMMEstadoReceta::Guardada;
	R->Medicamento = Med.TrimStartAndEnd(); R->Dosis = Dosis.TrimStartAndEnd(); R->Frecuencia = Frec.TrimStartAndEnd();
	R->Duracion = Dur.TrimStartAndEnd(); R->Instrucciones = Instr.TrimStartAndEnd();
	R->Etiquetas = EMMDatos::EtiquetasDe(R->Medicamento + TEXT(" ") + R->Instrucciones);
	R->Riesgos = EMMEvolucion::Riesgos(Paciente, *R);
	R->Estado = EEMMEstadoReceta::Guardada;
	FEMMHistorial::Get().Guardar();
	if (R->Riesgos.Num()) Avisar(FString::Printf(TEXT("Receta %s %s. La simulación detecta riesgos: %s"), *R->Id, bModificada ? TEXT("modificada") : TEXT("guardada"), *R->Riesgos[0]), false);
	else Avisar(FString::Printf(TEXT("Receta %s %s en la ficha."), *R->Id, bModificada ? TEXT("modificada y guardada") : TEXT("guardada")), true);
}

void AEMMConsultaModo::AnularReceta(const FString& Id)
{
	FEMMFicha* F = Ficha();
	FEMMReceta* R = F ? F->Receta(Id) : nullptr;
	if (!R || R->Estado == EEMMEstadoReceta::Anulada) return;
	R->Estado = EEMMEstadoReceta::Anulada;
	FEMMHistorial::Get().Guardar();
	Avisar(FString::Printf(TEXT("Receta %s anulada (queda en la ficha como anulada)."), *R->Id), true);
}

void AEMMConsultaModo::EntregarReceta(const FString& Id)
{
	FEMMFicha* F = Ficha();
	FEMMReceta* R = F ? F->Receta(Id) : nullptr;
	if (!R) return;
	if (R->Estado != EEMMEstadoReceta::Guardada) { Avisar(TEXT("Guarda la receta antes de entregarla."), false); return; }
	R->Estado = EEMMEstadoReceta::Entregada;
	FEMMHistorial::Get().Guardar();
	if (R->Riesgos.Num()) Avisar(FString::Printf(TEXT("Receta %s entregada a %s. AVISO DE LA SIMULACIÓN: %s"), *R->Id, *Paciente.Nombre, *R->Riesgos[0]), false);
	else Avisar(FString::Printf(TEXT("Receta %s entregada a %s."), *R->Id, *Paciente.Nombre), true);
}

int32 AEMMConsultaModo::DiasTratamiento() const
{
	int32 Max = 0;
	if (const FEMMFicha* F = FEMMHistorial::Get().Buscar(Paciente.Id))
		for (const FString& Id : Visita.Recetas)
			if (const FEMMReceta* R = F->Recetas.FindByPredicate([&](const FEMMReceta& X) { return X.Id == Id; }))
				if (R->Estado == EEMMEstadoReceta::Entregada) Max = FMath::Max(Max, R->DiasDuracion());
	return Max > 0 ? Max : 7;
}

void AEMMConsultaModo::TerminarConsulta(const FString& Diagnostico, const FString& Pruebas, int32 DiasRevision)
{
	if (bTerminada) return;
	if (bOcupado) { Avisar(TEXT("Espera a que termine de hablar."), false); return; }
	if (DiasRevision == 0) { Avisar(TEXT("Elige cuándo vuelve el paciente (o «Sin revisión»)."), false); return; }
	FEMMHistorial& H = FEMMHistorial::Get();
	FEMMFicha& F = H.FichaDe(Paciente);
	// las recetas que se quedaron sin guardar no cuentan
	for (const FString& Id : Visita.Recetas) if (FEMMReceta* R = F.Receta(Id); R && R->Estado == EEMMEstadoReceta::Borrador) R->Estado = EEMMEstadoReceta::Anulada;
	Visita.Diagnostico = Diagnostico.TrimStartAndEnd();
	Visita.Pruebas = Pruebas.TrimStartAndEnd();
	Visita.Charla = Charla;
	F.Visitas.Add(Visita);
	F.ProximaRevision = DiasRevision > 0 ? H.Dia + DiasRevision : DiasRevision == -2 ? H.Dia + DiasTratamiento() : -1;
	bTerminada = true;
	H.Guardar();
	if (EMMDictado::Escuchando()) EMMDictado::Parar();
	Avisar(F.ProximaRevision > 0 ? FString::Printf(TEXT("Consulta guardada en la ficha. Revisión: %s."), *FEMMHistorial::Fecha(F.ProximaRevision)) : FString(TEXT("Consulta guardada en la ficha, sin revisión.")), true);
	Actualizar();
}

void AEMMConsultaModo::AvanzarTiempo()
{
	FEMMHistorial& H = FEMMHistorial::Get();
	const int32 Cita = H.ProximaCita();
	if (!bTerminada) { Avisar(TEXT("Termina antes la consulta en la AGENDA."), false); return; }
	if (Cita <= 0) { Avisar(TEXT("No hay citas programadas."), false); return; }
	// ¿alguien empeora antes de su cita? Entonces pide cita y viene antes (revisión anticipada)
	int32 DiaAnticipado = -1;
	FEMMFicha* Anticipada = nullptr;
	for (FEMMFicha& X : H.Fichas)
	{
		if (X.ProximaRevision <= H.Dia || !X.UltimaVisita()) continue;
		const FEMMPaciente* C = Casos.FindByPredicate([&](const FEMMPaciente& P) { return P.Id == X.CasoId; });
		if (!C) continue;
		for (int32 D = FMath::Max(H.Dia + 1, X.UltimaVisita()->Dia + 2); D < X.ProximaRevision && (DiaAnticipado < 0 || D < DiaAnticipado); ++D)
		{
			const FEMMEvolucion E = EMMEvolucion::Calcular(*C, X, D);
			if (E.Estado == TEXT("peor") || E.Estado == TEXT("complicacion")) { DiaAnticipado = D; Anticipada = &X; break; }
		}
	}
	const bool bAnticipada = Anticipada && DiaAnticipado < Cita;
	const int32 Destino = bAnticipada ? DiaAnticipado : Cita;
	if (bAnticipada) Anticipada->ProximaRevision = DiaAnticipado;
	const int32 Pasan = FMath::Max(0, Destino - H.Dia);
	H.Dia = FMath::Max(H.Dia, Destino);
	const FEMMFicha* F = bAnticipada ? Anticipada : H.RevisionPendiente();
	const FEMMPaciente* Caso = F ? Casos.FindByPredicate([&](const FEMMPaciente& P) { return P.Id == F->CasoId; }) : nullptr;
	if (!Caso) { H.Guardar(); Avisar(TEXT("No se encuentra el caso de la cita."), false); return; }
	IniciarVisita(*Caso);
	if (bAnticipada)
	{
		Visita.bAnticipada = true;
		MemoriaPaciente = TEXT("Has pedido cita ANTES de la fecha de revisión porque te encuentras peor; empieza contándolo.\n") + MemoriaPaciente;
	}
	if (UIAgenda) UIAgenda->Cerrar();
	Avisar(bAnticipada
		? FString::Printf(TEXT("Han pasado %d días. %s ha pedido cita antes de tiempo: se encuentra peor (%s)."), Pasan, *Paciente.Nombre, *FEMMHistorial::Fecha(H.Dia))
		: FString::Printf(TEXT("Han pasado %d días. Hoy es %s y vuelve %s a revisión."), Pasan, *FEMMHistorial::Fecha(H.Dia), *Paciente.Nombre), !bAnticipada);
}

void AEMMConsultaModo::PacienteNuevo()
{
	FEMMHistorial& H = FEMMHistorial::Get();
	H.Dia += 1;
	// alguien que aún no tenga ficha; si ya los ha visto a todos, cualquiera sin cita pendiente
	TArray<const FEMMPaciente*> Libres;
	for (const FEMMPaciente& P : Casos) if (!H.Buscar(P.Id)) Libres.Add(&P);
	if (!Libres.Num()) for (const FEMMPaciente& P : Casos) if (const FEMMFicha* F = H.Buscar(P.Id); F && F->ProximaRevision <= 0 && P.Id != Paciente.Id) Libres.Add(&P);
	if (const FEMMFicha* F = H.RevisionPendiente())
		if (const FEMMPaciente* Caso = Casos.FindByPredicate([&](const FEMMPaciente& P) { return P.Id == F->CasoId; })) { Libres = { Caso }; }
	if (!Libres.Num()) { H.Dia -= 1; Avisar(TEXT("No hay más pacientes disponibles hoy."), false); return; }
	IniciarVisita(*Libres[FMath::RandRange(0, Libres.Num() - 1)]);
	Avisar(FString::Printf(TEXT("%s. Entra %s %s."), *FEMMHistorial::Fecha(H.Dia), *Paciente.Nombre, *Paciente.Apellidos), true);
}

void AEMMConsultaModo::Foto(const FString& Nombre)
{
	FScreenshotRequest::RequestScreenshot(FPaths::ProjectSavedDir() / TEXT("Capturas") / (Nombre + TEXT(".png")), true, false);
	RegistroPrueba.Add(FString::Printf(TEXT("[foto] %s"), *Nombre));
}

void AEMMConsultaModo::PasoDePrueba()
{
	// guion: espera a la IA, dos preguntas del médico con su respuesta, fotos mientras habla el paciente
	static const TCHAR* Preguntas[] = { TEXT("Buenos días. ¿Qué le trae por aquí?"), TEXT("¿Ha tenido fiebre?"), TEXT("¿Desde cuándo le pasa?") };
	const double T = FPlatformTime::Seconds() - InicioPaso;
	auto Siguiente = [this]() { ++PasoPrueba; InicioPaso = FPlatformTime::Seconds(); };
	const int32 Ronda = (PasoPrueba - 2) / 3, Fase = (PasoPrueba - 2) % 3;
	// rendimiento en juego: durante las conversaciones (no las cargas de personajes ni las vistas de revisión)
	if ((PasoPrueba >= 2 && PasoPrueba <= 10) || (PasoPrueba >= 16 && PasoPrueba <= 21)) Fotogramas.Add(float(FApp::GetDeltaTime()));
	// con el editor, los sombreadores se compilan al jugar: hasta que terminan, se ven materiales provisionales
	bool bCompilando = false;
#if WITH_EDITOR
	bCompilando = GShaderCompilingManager && GShaderCompilingManager->IsCompiling();
#endif
	if (PasoPrueba == 0)
	{
		if (T > 12 && !IA()->bCargando && (!bCompilando || T > 600))
		{
			RegistroPrueba.Add(IA()->Descripcion());
			bSubtitulosAntes = UEMMConsultaUI::SubtitulosActivados();
			RegistroPrueba.Add(FString::Printf(TEXT("Subtítulos guardados al empezar: %s"), bSubtitulosAntes ? TEXT("ON") : TEXT("OFF")));
			Foto(TEXT("prueba_consulta"));
			// micrófono: se arranca el dictado y se para durante las vistas de revisión (comprueba reconocedor y micrófono)
			TWeakObjectPtr<AEMMConsultaModo> Yo(this);
			const bool bEmpieza = EMMDictado::Empezar([](const FString&) {}, [Yo](const FString& Texto, const FString& Error) {
				if (Yo.IsValid()) Yo->RegistroPrueba.Add(FString::Printf(TEXT("Dictado: %s (texto: «%s»)"), Error.IsEmpty() ? TEXT("funciona") : *Error, *Texto));
			});
			RegistroPrueba.Add(FString::Printf(TEXT("Dictado: %s"), bEmpieza ? TEXT("escuchando") : TEXT("no ha arrancado")));
			Siguiente();
		}
	}
	else if (PasoPrueba == 1)
	{
		// vistas de revisión del montaje (cámaras con la etiqueta «Revision»), 2 s cada una, y vuelta a la del juego
		APlayerController* PC = GetWorld()->GetFirstPlayerController();
		TArray<AActor*> Revision;
		for (TActorIterator<AActor> It(GetWorld()); It; ++It) if (It->ActorHasTag(TEXT("Revision"))) Revision.Add(*It);
		Revision.Sort([](const AActor& A, const AActor& B) { return A.GetName() < B.GetName(); });
		static AActor* Juego = nullptr;
		// en las vistas de revisión el médico está escribiendo (para comprobar los brazos en el teclado)
		UI->PonerTexto(FString::ChrN(1 + int32(T * 5.0) % 30, TEXT('a')));
		const int32 Cual = int32(T / 2.0);
		if (PC && !Juego) Juego = PC->GetViewTarget();
		if (PC && Revision.IsValidIndex(Cual))
		{
			if (PC->GetViewTarget() != Revision[Cual]) PC->SetViewTargetWithBlend(Revision[Cual], 0.f);
			else
			{
				// nombre de la vista: la segunda etiqueta de la cámara (p. ej. «cenital»)
				const FString Nombre = TEXT("prueba_") + (Revision[Cual]->Tags.Num() > 1 ? Revision[Cual]->Tags[1].ToString() : Revision[Cual]->GetName());
				if (FMath::Fmod(T, 2.0) > 1.2 && !RegistroPrueba.Last().EndsWith(Nombre)) Foto(Nombre);
			}
		}
		else
		{
			if (PC && Juego) PC->SetViewTargetWithBlend(Juego, 0.f);
			UI->LimpiarTexto();
			EMMDictado::Parar();
			Siguiente();
			// prueba corta (-EMMSoloMontaje): sólo las fotos del montaje
			if (FParse::Param(FCommandLine::Get(), TEXT("EMMSoloMontaje"))) PasoPrueba = 11 + 17;   // directo al desfile de personajes
		}
	}
	else if (Ronda < 3)
	{
		// primera pregunta: se escribe en la caja como el jugador (el médico mira el portátil y teclea) y luego se envía
		if (Ronda == 0 && Fase == 0 && !bOcupado && !bTurnoPaciente && T < 2.2)
		{
			if (UI->TextoEscrito().IsEmpty()) UI->PonerTexto(Preguntas[0]);
			if (T > 1.3 && !RegistroPrueba.Last().Contains(TEXT("tecleando"))) Foto(TEXT("prueba_medico_tecleando"));
		}
		else if (Fase == 0 && !bOcupado && !bTurnoPaciente && !EMMDictado::Escuchando())
		{
			// segunda pregunta: como si el jugador activara los subtítulos en CONFIGURACIÓN
			if (Ronda == 1) UEMMConsultaUI::GuardarSubtitulos(true);
			RegistroPrueba.Add(FString::Printf(TEXT("MÉDICO: %s"), Preguntas[Ronda])); HablarMedico(Preguntas[Ronda]); Siguiente();
		}
		else if (Fase == 1 && !bOcupado && bTurnoPaciente) { ResponderPaciente(); Siguiente(); }
		else if (Fase == 2)
		{
			const bool bHabla = HablaPaciente->bHablando;
			if (bHabla && !RegistroPrueba.Last().StartsWith(TEXT("[foto]")) && Ronda == 0) Foto(TEXT("prueba_paciente_hablando"));
			// subtítulo a mitad de frase: debe llevar sólo lo que la voz ya ha dicho
			if (bHabla && Ronda == 1 && !bFotoSubtitulos)
			{
				const FString Dicho = HablaPaciente->TextoDicho();
				if (Dicho.Len() > 12)
				{
					bFotoSubtitulos = true;
					RegistroPrueba.Add(FString::Printf(TEXT("Subtítulo a mitad de frase: «%s»"), *Dicho));
					Foto(TEXT("prueba_subtitulos"));
				}
			}
			if (!bOcupado && !bTurnoPaciente)
			{
				const FEMMLinea& L = Charla.Last();
				RegistroPrueba.Add(FString::Printf(TEXT("PACIENTE [%s] (%.1f s): %s"), *L.Origen, T, *L.Texto));
				Siguiente();
			}
		}
		if (T > 180) { RegistroPrueba.Add(TEXT("ERROR: tiempo agotado")); PasoPrueba = 100; }
	}
	else if (PasoPrueba < 60)
	{
		// recetas, ficha, calendario y regreso del paciente, con los mismos botones que usa el jugador
		const int32 K = PasoPrueba - 11;
		FEMMFicha* F = Ficha();
		auto Estado = [F](const FString& Id) { const FEMMReceta* R = F ? F->Receta(Id) : nullptr; return R ? FEMMReceta::TextoEstado(R->Estado) : FString(TEXT("?")); };
		if (K == 0)
		{
			UIRecetas->Abrir();
			struct FR { const TCHAR *M, *D, *Fr, *Du, *I; };
			const FR Lista[] = {
				{ TEXT("Amoxicilina 500 mg cápsulas"), TEXT("1 cápsula"), TEXT("cada 8 horas"), TEXT("7 días"), TEXT("Tomar con un vaso de agua. Completar el tratamiento aunque se encuentre mejor.") },
				{ TEXT("Paracetamol 1 g comprimidos"), TEXT("1 comprimido"), TEXT("cada 6 horas si hay dolor o fiebre"), TEXT("5 días"), TEXT("No tomar más de 4 comprimidos al día.") },
				{ TEXT("Vino tinto"), TEXT("1 litro"), TEXT("al día"), TEXT("14 días"), TEXT("Beber un litro de vino al día.") },
				{ TEXT("Ibuprofeno 600 mg"), TEXT("1 comprimido"), TEXT("cada 8 horas"), TEXT("3 días"), TEXT("Con comida.") },
			};
			TArray<FString> Ids;
			for (const FR& X : Lista)
			{
				UIRecetas->PulsarNueva();
				Ids.Add(UIRecetas->Elegida());
				UIRecetas->Escribir(X.M, X.D, X.Fr, X.Du, X.I);
				UIRecetas->PulsarGuardar();
			}
			// modificar la segunda (paracetamol) antes de entregarla
			UIRecetas->Refrescar(Ids[1]);
			UIRecetas->Escribir(TEXT("Paracetamol 1 g comprimidos"), TEXT("1 comprimido"), TEXT("cada 8 horas si hay dolor o fiebre"), TEXT("5 días"), TEXT("No tomar más de 3 comprimidos al día."));
			UIRecetas->PulsarGuardar();
			for (int32 i : { 0, 1, 2 }) { UIRecetas->Refrescar(Ids[i]); UIRecetas->PulsarEntregar(); }
			UIRecetas->Refrescar(Ids[3]); UIRecetas->PulsarAnular();
			for (const FString& Id : Ids)
				if (const FEMMReceta* R = F ? F->Receta(Id) : nullptr)
					RegistroPrueba.Add(FString::Printf(TEXT("Receta %s: %s · %s %s %s · %s · etiquetas [%s]%s"), *R->Id, *R->Medicamento, *R->Dosis, *R->Frecuencia, *R->Duracion, *Estado(Id),
						*FString::Join(R->Etiquetas, TEXT(",")), R->Riesgos.Num() ? *(TEXT(" · RIESGOS: ") + FString::Join(R->Riesgos, TEXT(" | "))) : TEXT("")));
			UIRecetas->Refrescar(Ids[2]);   // la del vino, con su aviso
			Siguiente();
		}
		else if (K == 1 && T > 1.5) { Foto(TEXT("prueba_receta")); Siguiente(); }
		else if (K == 2 && T > 1.0)
		{
			UIRecetas->Cerrar();
			UIAgenda->Abrir();
			UIAgenda->Escribir(Paciente.Enfermedad, TEXT("Analítica de sangre, orina y electrocardiograma"));
			PonerPruebasVisita(TEXT("Analítica de sangre, orina y electrocardiograma"));
			UIAgenda->ElegirRevision(-2);   // al acabar el tratamiento
			UIAgenda->PulsarTerminar();
			// lo guardado en disco: se vuelve a leer el archivo
			FString J; TSharedPtr<FJsonObject> O;
			if (FFileHelper::LoadFileToString(J, *FEMMHistorial::Get().Ruta()) && FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(J), O) && O.IsValid())
			{
				const TSharedPtr<FJsonObject> Fi = O->GetArrayField(TEXT("fichas"))[0]->AsObject();
				RegistroPrueba.Add(FString::Printf(TEXT("Ficha guardada en %s: %d recetas, %d visita(s), revisión el día %d (%s)"), *FPaths::GetCleanFilename(FEMMHistorial::Get().Ruta()),
					Fi->GetArrayField(TEXT("recetas")).Num(), Fi->GetArrayField(TEXT("visitas")).Num(), int32(Fi->GetNumberField(TEXT("proximaRevision"))), *FEMMHistorial::Fecha(int32(Fi->GetNumberField(TEXT("proximaRevision"))))));
			}
			else RegistroPrueba.Add(TEXT("ERROR: no se ha guardado la ficha"));
			Siguiente();
		}
		else if (K == 3 && T > 1.5) { Foto(TEXT("prueba_agenda")); Siguiente(); }
		else if (K == 4 && T > 1.0)
		{
			UIAgenda->PulsarAvanzar();
			RegistroPrueba.Add(FString::Printf(TEXT("AVANZAR TIEMPO: hoy es %s; vuelve %s (%s). Evolución: %s"), *FEMMHistorial::Fecha(FEMMHistorial::Get().Dia), *Paciente.Nombre, Visita.bRevision ? TEXT("revisión") : TEXT("NO es revisión"), *Visita.Evolucion));
			Siguiente();
		}
		else if (K >= 5 && K <= 10)
		{
			// dos preguntas en la revisión: ¿recuerda el tratamiento y nota sus efectos?
			static const TCHAR* Rev[] = { TEXT("Buenos días. ¿Cómo se encuentra desde la última consulta? ¿Se ha tomado lo que le receté?"), TEXT("¿Qué tal le ha sentado el vino que le receté?") };
			const int32 R = (K - 5) / 3, Fa = (K - 5) % 3;
			if (Fa == 0 && !bOcupado && !bTurnoPaciente && T > 1.0) { RegistroPrueba.Add(FString::Printf(TEXT("MÉDICO: %s"), Rev[R])); HablarMedico(Rev[R]); Siguiente(); }
			else if (Fa == 1 && !bOcupado && bTurnoPaciente) { ResponderPaciente(); Siguiente(); }
			else if (Fa == 2)
			{
				if (R == 0 && HablaPaciente->bHablando && !RegistroPrueba.Last().StartsWith(TEXT("[foto]"))) Foto(TEXT("prueba_revision"));
				if (!bOcupado && !bTurnoPaciente)
				{
					const FEMMLinea& L = Charla.Last();
					RegistroPrueba.Add(FString::Printf(TEXT("PACIENTE [%s]: %s"), *L.Origen, *L.Texto));
					Siguiente();
				}
			}
			if (T > 180) { RegistroPrueba.Add(TEXT("ERROR: tiempo agotado en la revisión")); PasoPrueba = 100; }
		}
		// el portátil ampliado: resultados de las pruebas pedidas en la primera visita e historial
		else if (K == 11) { AbrirPortatil(); UIPortatil->PonerPestana(EEMMPestana::Pruebas); UIPortatil->Refrescar(true); Siguiente(); }
		else if (K == 12 && T > 1.2) { Foto(TEXT("prueba_portatil_pruebas")); Siguiente(); }
		else if (K == 13 && T > 0.6) { UIPortatil->PonerPestana(EEMMPestana::Historial); UIPortatil->Refrescar(true); Siguiente(); }
		else if (K == 14 && T > 1.2) { Foto(TEXT("prueba_portatil_historial")); Siguiente(); }
		else if (K == 15 && T > 0.6) { AbrirPortatil(); Siguiente(); }
		else if (K == 16 && T > 1.0) { Foto(TEXT("prueba_pantalla_portatil_juego")); Siguiente(); }
		// desfile: cada personaje de paciente en la silla, con su ropa, su foto y una frase con su voz
		else if (K > 16)
		{
			const int32 I = (K - 17) / 2;
			if (!Personajes.IsValidIndex(I))
			{
				// mando Xbox simulado: LB abre el portátil y B lo cierra (con el foco en la interfaz, como al jugar)
				if (T > 1.0)
				{
					auto Pulsar = [](const FKey& K) {
						FSlateApplication::Get().ProcessKeyDownEvent(FKeyEvent(K, FModifierKeysState(), 0, false, 0, 0));
						FSlateApplication::Get().ProcessKeyUpEvent(FKeyEvent(K, FModifierKeysState(), 0, false, 0, 0));
					};
					UI->EnfocarPrincipal();
					Pulsar(EKeys::Gamepad_LeftShoulder);
					const bool bAbre = UIPortatil->GetVisibility() == ESlateVisibility::Visible;
					Pulsar(EKeys::Gamepad_FaceButton_Right);
					const bool bCierra = UIPortatil->GetVisibility() == ESlateVisibility::Collapsed;
					RegistroPrueba.Add(FString::Printf(TEXT("Mando: LB abre el portátil = %s; B lo cierra = %s"), bAbre ? TEXT("sí") : TEXT("NO"), bCierra ? TEXT("sí") : TEXT("NO")));
					PasoPrueba = 100;
				}
			}
			else if ((K - 17) % 2 == 0 && T > 0.5)
			{
				const FEMMPersonaje& X = Personajes[I];
				FEMMPaciente Falso = Paciente;
				Falso.Id = FString::Printf(TEXT("desfile_%d"), I);
				Falso.Sexo = X.Sexo; Falso.Edad = (X.EdadMin + FMath::Min(X.EdadMax, 90.f)) / 2.f;
				PonerPersonaje(Falso);
				FLinearColor Arriba, Abajo;
				ColoresPaciente(Falso, Arriba, Abajo);
				Vestir(MHPaciente.Get(), Arriba, Abajo);
				const FEMMPerfilVoz VP = EMMVoz::PerfilPara(Falso.EsMujer(), Falso.Edad, GetTypeHash(X.Nombre) | 1u);
				HablaPaciente->bMujer = VP.bMujer; HablaPaciente->Tono = VP.Tono; HablaPaciente->Velocidad = VP.Vel; HablaPaciente->VozPreferida = VP.Preferida;
				HablaPaciente->Nombre = X.Nombre;
				RegistroPrueba.Add(FString::Printf(TEXT("PERSONAJE %s (%s, %.0f años): voz %s, tono %.2f, velocidad %.2f"), *X.Nombre, Falso.EsMujer() ? TEXT("mujer") : TEXT("hombre"), Falso.Edad, *VP.Preferida, VP.Tono, VP.Vel));
				TWeakObjectPtr<AEMMConsultaModo> Yo(this);
				HablaPaciente->Decir(Falso.Edad >= 65 ? TEXT("Buenos días, doctor. Ay, qué mal he dormido esta noche.") : Falso.Edad < 20 ? TEXT("Hola. Es que me duele bastante, la verdad.") : TEXT("Buenos días, doctor. Vengo porque no me encuentro bien."), [](const FString&) {});
				Siguiente();
			}
			else if ((K - 17) % 2 == 1 && T > 1.6) { Foto(FString::Printf(TEXT("prueba_personaje_%s"), *Personajes[I].Nombre)); Siguiente(); }
		}
	}
	else
	{
		GetWorldTimerManager().ClearTimer(TemporizadorPrueba);
		UEMMConsultaUI::GuardarSubtitulos(bSubtitulosAntes);   // se deja la elección del jugador como estaba
		if (Fotogramas.Num())
		{
			Fotogramas.Sort();
			float Suma = 0; for (float D : Fotogramas) Suma += D;
			const float Media = Suma / Fotogramas.Num(), Peor = Fotogramas[FMath::Min(Fotogramas.Num() - 1, int32(Fotogramas.Num() * 0.95f))];
			RegistroPrueba.Add(FString::Printf(TEXT("Rendimiento: %.0f fps de media, %.0f fps en el 5 %% peor (%d muestras; %s)"), 1.f / Media, 1.f / Peor, Fotogramas.Num(), *FPlatformMisc::GetPrimaryGPUBrand()));
		}
		RegistroPrueba.Add(FString::Printf(TEXT("Voces: %s"), *FString::Join(EMMVoz::VocesDisponibles(), TEXT(" | "))));
		FFileHelper::SaveStringArrayToFile(RegistroPrueba, *(FPaths::ProjectSavedDir() / TEXT("Prueba.txt")), FFileHelper::EEncodingOptions::ForceUTF8);
		FTimerHandle Fin;
		GetWorldTimerManager().SetTimer(Fin, FTimerDelegate::CreateLambda([]() { FPlatformMisc::RequestExit(false, TEXT("EMMPrueba")); }), 2.f, false);
	}
}

void AEMMConsultaModo::Dictar()
{
	if (EMMDictado::Escuchando()) { EMMDictado::Parar(); return; }
	if (bOcupado || bTurnoPaciente || bTerminada) return;
	// lo dictado se añade a lo que ya hubiera escrito
	const FString Previo = UI->TextoEscrito();
	auto Unir = [Previo](const FString& T) { return Previo.IsEmpty() ? T : Previo + TEXT(" ") + T; };
	TWeakObjectPtr<AEMMConsultaModo> Yo(this);
	const bool bEmpieza = EMMDictado::Empezar(
		[Yo, Unir](const FString& T) { if (Yo.IsValid()) Yo->UI->PonerTexto(Unir(T)); },
		[Yo, Unir](const FString& T, const FString& Error) {
			if (!Yo.IsValid()) return;
			Yo->UI->PonerDictado(false);
			if (!T.IsEmpty()) Yo->UI->PonerTexto(Unir(T));
			if (!Error.IsEmpty()) Yo->UI->Aviso(FString::Printf(TEXT("Micrófono: %s. Puedes escribir la pregunta."), *Error), false);
		});
	if (bEmpieza)
	{
		UI->PonerDictado(true);
		UI->Aviso(TEXT("Escuchando… Habla y pulsa PARAR al acabar. Revisa el texto y pulsa ENVIAR · HABLAR MÉDICO."), true);
	}
}

void AEMMConsultaModo::Actualizar()
{
	if (!UI) return;
	FString Estado;
	if (bTerminada) Estado = TEXT("Consulta terminada y guardada. En AGENDA · FICHA puedes avanzar el tiempo o recibir a otro paciente.");
	else if (bOcupado) Estado = bTurnoPaciente ? TEXT("El paciente está hablando…") : TEXT("Está hablando el médico…");
	else if (bTurnoPaciente) Estado = TEXT("Turno del paciente: pulsa RESPONDER PACIENTE.");
	else Estado = TEXT("Turno del médico: escribe lo que quieres decir y pulsa ENVIAR · HABLAR MÉDICO.");
	UI->PonerEstado(Estado, bTurnoPaciente);
	UI->PonerIA(IA()->Descripcion());
	UI->PonerBotones(!bTerminada && !bOcupado && !bTurnoPaciente, !bTerminada && !bOcupado && bTurnoPaciente);
}

void AEMMConsultaModo::Decir(UEMMHabla* Quien, const FString& Nombre, const FString& Texto, bool bEsMedico, TFunction<void()> Despues)
{
	UI->PonerSubtitulo(Nombre, Quien, bEsMedico);
	TWeakObjectPtr<AEMMConsultaModo> Yo(this);
	Quien->Decir(Texto, [Yo, Despues](const FString& Error) {
		if (!Yo.IsValid()) return;
		if (!Error.IsEmpty()) Yo->UI->Aviso(FString::Printf(TEXT("Voz no disponible (%s): sólo subtítulos."), *Error), false);
		Yo->UI->QuitarSubtitulo();
		Despues();
	});
}

void AEMMConsultaModo::HablarMedico(const FString& Texto)
{
	if (bOcupado || bTurnoPaciente || bTerminada) return;
	if (EMMDictado::Escuchando()) EMMDictado::Parar();
	if (Texto.IsEmpty()) { UI->Aviso(TEXT("Escribe o dicta primero lo que quieres decir."), false); return; }
	// el médico dice exactamente lo escrito
	Charla.Add({ true, Texto, FString() });
	UI->LimpiarTexto();
	bOcupado = true;
	Actualizar();
	TWeakObjectPtr<AEMMConsultaModo> Yo(this);
	Decir(Medico, Medico->Nombre, Texto, true, [Yo]() {
		if (!Yo.IsValid()) return;
		Yo->bOcupado = false; Yo->bTurnoPaciente = true;
		Yo->Actualizar();
		Yo->UI->EnfocarPrincipal();
	});
}

FString AEMMConsultaModo::Referencia(const FString& Pregunta) const
{
	// como el juego web: la primera intención manda; algunas más se añaden (fiebre, desde cuándo…)
	const TArray<FString> Ints = EMMDatos::Intenciones(Pregunta);
	FString Id = Ints.Num() ? Ints[0] : TEXT("general");
	if (Id == TEXT("saludo")) Id = TEXT("motivo");
	if (Id == TEXT("acomp") || Id == TEXT("secreto") || Id == TEXT("presionar")) Id = TEXT("general");
	// en una revisión, lo que importa es cómo ha ido desde la última consulta
	if (Visita.bRevision && !FraseEvolucion.IsEmpty() && TArray<FString>({ TEXT("motivo"), TEXT("general"), TEXT("dolor"), TEXT("fiebre"), TEXT("extra"), TEXT("inicio") }).Contains(Id))
	{
		const bool bPrimera = !Charla.ContainsByPredicate([](const FEMMLinea& L) { return !L.bMedico; });
		return (bPrimera ? FString(TEXT("Buenos días, doctor. ")) : FString()) + FraseEvolucion;
	}
	FString R = Paciente.Respuesta(Id);
	int32 Anadidos = 0;
	for (int32 i = 1; i < Ints.Num() && Anadidos < 2; ++i)
		if (TArray<FString>({ TEXT("inicio"), TEXT("dolor"), TEXT("fiebre"), TEXT("habitos"), TEXT("alergia"), TEXT("antecedentes") }).Contains(Ints[i]) && Ints[i] != Id)
		{ R += TEXT(" ") + Paciente.Respuesta(Ints[i]); ++Anadidos; }
	// saludo en la primera respuesta, si el médico ha saludado
	const bool bPrimera = !Charla.ContainsByPredicate([](const FEMMLinea& L) { return !L.bMedico; });
	const FString N = EMMDatos::Normaliza(Pregunta);
	if (bPrimera && Id == TEXT("motivo") && (N.Contains(TEXT("buen")) || N.Contains(TEXT("hola"))))
		R = Paciente.Respuesta(TEXT("saludo")) + TEXT(" ") + R;
	return R;
}

void AEMMConsultaModo::ResponderPaciente()
{
	if (bOcupado || !bTurnoPaciente || !Charla.Num()) return;
	bOcupado = true;
	UI->PonerEstado(IA()->Modo == EEMMModoIA::Predefinida ? TEXT("El paciente va a responder…") : TEXT("El paciente está pensando qué responder (IA)…"), true);
	UI->PonerBotones(false, false);
	const FString Pregunta = Charla.Last().Texto;
	TArray<FEMMLinea> Antes = Charla; Antes.Pop();
	TWeakObjectPtr<AEMMConsultaModo> Yo(this);
	IA()->Responder(PacienteParaIA(), Antes, Pregunta, Referencia(Pregunta), [Yo](const FEMMRespuesta& R) {
		if (!Yo.IsValid()) return;
		Yo->Charla.Add({ false, R.Texto, R.Origen });
		if (R.Origen != TEXT("ia") && Yo->IA()->Modo != EEMMModoIA::Predefinida)
			Yo->UI->Aviso(FString::Printf(TEXT("IA no disponible (%s). Se usa la respuesta predefinida."), *R.Error), false);
		Yo->Actualizar();
		Yo->Decir(Yo->HablaPaciente, Yo->HablaPaciente->Nombre, R.Texto, false, [Yo]() {
			if (!Yo.IsValid()) return;
			Yo->bOcupado = false; Yo->bTurnoPaciente = false;
			Yo->Actualizar();
			Yo->UI->EnfocarPrincipal();
		});
	});
}

void AEMMConsultaModo::DescargarModelo()
{
#if PLATFORM_ANDROID
	IA()->DescargarModelo();
	GetWorldTimerManager().SetTimer(TemporizadorDescarga, this, &AEMMConsultaModo::RevisarDescarga, 0.5f, true);
#endif
}

void AEMMConsultaModo::RevisarDescarga()
{
#if PLATFORM_ANDROID
	TSharedPtr<FJsonObject> O;
	if (!FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(IA()->ProgresoDescargaJson()), O) || !O.IsValid()) return;
	const FString Estado = O->GetStringField(TEXT("estado"));
	const double Bytes = O->GetNumberField(TEXT("bytes")), Total = FMath::Max(1.0, O->GetNumberField(TEXT("total")));
	if (Estado == TEXT("descargando")) UI->PonerDescarga(FString::Printf(TEXT("Descargando: %.2f GB de %.2f GB (%d %%)."), Bytes / 1e9, Total / 1e9, int32(100 * Bytes / Total)), true);
	else if (Estado == TEXT("comprobando")) UI->PonerDescarga(TEXT("Comprobando que el archivo está completo y es el correcto…"), true);
	else if (Estado == TEXT("error")) { GetWorldTimerManager().ClearTimer(TemporizadorDescarga); UI->PonerDescarga(FString::Printf(TEXT("No se ha podido descargar: %s. Puedes reintentarlo."), *O->GetStringField(TEXT("error"))), true); }
	else if (Estado == TEXT("listo"))
	{
		GetWorldTimerManager().ClearTimer(TemporizadorDescarga);
		UI->PonerDescarga(FString(), false);
		UI->Aviso(TEXT("Modelo de IA instalado en el móvil. Cargándolo…"), true);
		TWeakObjectPtr<AEMMConsultaModo> Yo(this);
		IA()->Detectar([Yo](const FString& Aviso, bool bBien) { if (Yo.IsValid()) { Yo->UI->Aviso(Aviso, bBien); Yo->Actualizar(); } });
		Actualizar();
	}
#endif
}
