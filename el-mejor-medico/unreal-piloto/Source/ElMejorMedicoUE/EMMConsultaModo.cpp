#include "EMMConsultaModo.h"
#include "RenderTimer.h"
#include "Engine/RectLight.h"
#include "Engine/UserInterfaceSettings.h"
#include "Components/LODSyncComponent.h"
#include "Engine/StaticMeshActor.h"
#include "Engine/StaticMesh.h"
#include "Animation/SkeletalMeshActor.h"
#include "AnimationRuntime.h"
#include "Components/RectLightComponent.h"
#include "DynamicRHI.h"
#include "RHIStats.h"
#include "EMMConsultaUI.h"
#include "EMMHabla.h"
#include "EMMIA.h"
#include "EMMVoz.h"
#include "EMMCuerpoAnim.h"
#include "EMMDictado.h"
#include "EMMPiper.h"
#include "EMMFonetica.h"
#include "EMMRecetaUI.h"
#include "EMMAgendaUI.h"
#include "EMMCreadorUI.h"
#include "EMMAspecto.h"
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
		if (A->ActorHasTag(TEXT("Nino")))
		{
			// niños (MPFB): su conjunto (camiseta, sudadera, vestido…) recoloreado con el color de este paciente,
			// conservando las costuras y los pliegues de la textura (M_NinoBase: «Tinte» y «TinteFuerza»)
			for (int32 i = 0; i < M->GetNumMaterials(); ++i)
			{
				const UMaterialInterface* Mat = M->GetMaterial(i);
				if (!Mat || !Mat->GetName().Contains(TEXT("suit"))) continue;
				if (UMaterialInstanceDynamic* D = M->CreateDynamicMaterialInstance(i))
				{
					D->SetVectorParameterValue(TEXT("Tinte"), Arriba);
					D->SetScalarParameterValue(TEXT("TinteFuerza"), 0.6f);
					++Tenidas;
				}
			}
			continue;
		}
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

// Colores de los uniformes sanitarios (pijama y zapatos)
static const struct { const TCHAR* Nombre; FLinearColor Tela, Calzado; } Uniformes[] = {
	{ TEXT("Azul quirófano"), FLinearColor(0.06f, 0.26f, 0.32f), FLinearColor(0.85f, 0.85f, 0.85f) },
	{ TEXT("Verde quirófano"), FLinearColor(0.07f, 0.28f, 0.2f), FLinearColor(0.85f, 0.85f, 0.85f) },
	{ TEXT("Azul marino"), FLinearColor(0.025f, 0.04f, 0.12f), FLinearColor(0.04f, 0.04f, 0.045f) },
	{ TEXT("Celeste"), FLinearColor(0.25f, 0.45f, 0.65f), FLinearColor(0.85f, 0.85f, 0.85f) },
	{ TEXT("Granate"), FLinearColor(0.28f, 0.035f, 0.06f), FLinearColor(0.04f, 0.04f, 0.045f) },
	{ TEXT("Gris marengo"), FLinearColor(0.1f, 0.11f, 0.12f), FLinearColor(0.04f, 0.04f, 0.045f) },
};

TArray<FString> AEMMConsultaModo::NombresUniformes()
{
	TArray<FString> R;
	for (const auto& U : Uniformes) R.Add(U.Nombre);
	return R;
}

// Pantalón largo y zapatos de un MetaHuman (/Game/Uniformes/SKM_<MetaHuman>_Uniforme, de
// Herramientas/crear_uniformes.py): una copia de su piel con sus mismos huesos y pesos, así que sigue al cuerpo en
// cualquier postura o animación (sentado, de pie, andando, girando) como la ropa. Los niños (MPFB) no lo llevan.
static void PonerPantalon(AActor* A, const FLinearColor& Pantalon, const FLinearColor& Calzado)
{
	if (!A) return;
	TArray<USkeletalMeshComponent*> Mallas;
	A->GetComponents(Mallas);
	USkeletalMeshComponent* Cuerpo = nullptr;
	for (USkeletalMeshComponent* M : Mallas)
	{
		if (M->GetName() == TEXT("Uniforme")) M->DestroyComponent();
		else if (M->GetName() == TEXT("Body")) Cuerpo = M;
	}
	if (!Cuerpo || !Cuerpo->GetSkeletalMeshAsset()) return;
	// SKM_<MetaHuman>_BodyMesh → SKM_<MetaHuman>_Uniforme
	const FString N = Cuerpo->GetSkeletalMeshAsset()->GetName().Replace(TEXT("_BodyMesh"), TEXT("_Uniforme"));
	USkeletalMesh* Malla = LoadObject<USkeletalMesh>(nullptr, *FString::Printf(TEXT("/Game/Uniformes/%s.%s"), *N, *N));
	if (!Malla) { UE_LOG(LogTemp, Warning, TEXT("[EMM] Uniforme: falta %s"), *N); return; }
	USkeletalMeshComponent* C = NewObject<USkeletalMeshComponent>(A, TEXT("Uniforme"));
	C->SetSkeletalMeshAsset(Malla);
	C->SetupAttachment(Cuerpo);
	C->RegisterComponent();
	C->SetLeaderPoseComponent(Cuerpo);
	if (UMaterialInstanceDynamic* D = UMaterialInstanceDynamic::Create(Malla->GetMaterials().Num() ? Malla->GetMaterials()[0].MaterialInterface : nullptr, C))
	{
		D->SetVectorParameterValue(TEXT("Tinte"), Pantalon);
		D->SetVectorParameterValue(TEXT("Calzado"), Calzado);
		for (int32 i = 0; i < C->GetNumMaterials(); ++i) C->SetMaterial(i, D);
	}
}

// Uniforme sanitario del médico: camiseta y pantalón (corto y largo) del color del pijama, y zapatos
static void Uniformar(AActor* A, int32 Color)
{
	const auto& U = Uniformes[FMath::Abs(Color) % UE_ARRAY_COUNT(Uniformes)];
	Vestir(A, U.Tela, U.Tela);
	PonerPantalon(A, U.Tela, U.Calzado);
	UE_LOG(LogTemp, Display, TEXT("[EMM] Uniforme de %s: %s"), A ? *A->GetName() : TEXT("-"), U.Nombre);
}

// Ropa del paciente según la edad (y una variación fija por caso, para que no vistan todos igual)
static void ColoresPaciente(const FEMMPaciente& P, FLinearColor& Arriba, FLinearColor& Abajo, FLinearColor& Calzado)
{
	const uint32 H = GetTypeHash(P.Id);
	auto Elige = [H](std::initializer_list<FLinearColor> L, uint32 Sal) { return *(L.begin() + (H / Sal) % L.size()); };
	// pantalones de calle: vaquero, negro, beis, gris, marrón
	const FLinearColor Vaquero(0.05f, 0.09f, 0.2f), Negro(0.035f, 0.035f, 0.04f), Beis(0.42f, 0.36f, 0.26f), Gris(0.17f, 0.17f, 0.19f), Marron(0.2f, 0.13f, 0.08f);
	if (P.Edad < 13.f)      { Arriba = Elige({ FLinearColor(0.75f, 0.12f, 0.1f), FLinearColor(0.95f, 0.7f, 0.1f), FLinearColor(0.15f, 0.45f, 0.8f), FLinearColor(0.2f, 0.6f, 0.3f), FLinearColor(0.85f, 0.35f, 0.55f), FLinearColor(0.45f, 0.25f, 0.7f), FLinearColor(0.95f, 0.45f, 0.1f) }, 1); Abajo = Elige({ Vaquero, FLinearColor(0.08f, 0.12f, 0.25f), Gris }, 7); }
	else if (P.Edad < 30.f) { Arriba = Elige({ FLinearColor(0.05f, 0.05f, 0.06f), FLinearColor(0.35f, 0.38f, 0.22f), FLinearColor(0.55f, 0.1f, 0.15f), FLinearColor(0.6f, 0.6f, 0.62f) }, 1); Abajo = Elige({ Vaquero, Negro, Beis, Gris }, 7); }
	else if (P.Edad < 65.f) { Arriba = Elige({ FLinearColor(0.08f, 0.12f, 0.25f), FLinearColor(0.45f, 0.42f, 0.38f), FLinearColor(0.3f, 0.06f, 0.1f), FLinearColor(0.15f, 0.25f, 0.2f) }, 1); Abajo = Elige({ Vaquero, Negro, Beis, Gris, Marron }, 7); }
	else                    { Arriba = Elige({ FLinearColor(0.35f, 0.25f, 0.18f), FLinearColor(0.55f, 0.5f, 0.42f), FLinearColor(0.35f, 0.08f, 0.12f), FLinearColor(0.25f, 0.3f, 0.35f) }, 1); Abajo = Elige({ Gris, Marron, Beis, Negro }, 7); }
	// zapatos o zapatillas: negros, marrones, blancos
	Calzado = Elige({ Negro, FLinearColor(0.12f, 0.07f, 0.04f), FLinearColor(0.8f, 0.8f, 0.8f) }, 11);
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
	UEMMConsultaUI::AplicarCalidad(UEMMConsultaUI::CalidadGrafica());
#if PLATFORM_ANDROID
	// la interfaz está pensada para 1600×900 en un portátil: en el móvil, más grande para leerla y pulsarla con el dedo
	GetMutableDefault<UUserInterfaceSettings>()->ApplicationScale = 1.35f;
#endif
	UE_LOG(LogTemp, Display, TEXT("[EMM] Consulta: empieza la partida (subtítulos %s, día %d del calendario, %d casos)"), UEMMConsultaUI::SubtitulosActivados() ? TEXT("ON") : TEXT("OFF"), FEMMHistorial::Get().Dia, Casos.Num());
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
		// la silla del acompañante: de las dos sillas escolares, la que no es la del paciente; el acompañante se
		// sienta en ella igual que el paciente en la suya
		{
			TArray<AStaticMeshActor*> Sillas;
			for (TActorIterator<AStaticMeshActor> It(GetWorld()); It; ++It)
				if (const UStaticMesh* SM = It->GetStaticMeshComponent()->GetStaticMesh(); SM && SM->GetName().Contains(TEXT("SchoolChair"))) Sillas.Add(*It);
			const FVector P = AsientoPaciente.GetLocation();
			Sillas.Sort([P](const AStaticMeshActor& A, const AStaticMeshActor& B) { return FVector::DistSquared2D(A.GetActorLocation(), P) < FVector::DistSquared2D(B.GetActorLocation(), P); });
			// la del nivel queda junto a la cámara, fuera del plano: se pone al otro lado del paciente, algo más al
			// fondo, donde se ve (escena.json › acompanante: [hacia el lado contrario a la cámara, hacia el fondo], cm)
			double Contrario = 75, Fondo = 25;
			{
				FString J; TSharedPtr<FJsonObject> O;
				const TArray<TSharedPtr<FJsonValue>>* V = nullptr;
				if (FFileHelper::LoadFileToString(J, *(FPaths::ProjectContentDir() / TEXT("Datos/escena.json"))) && FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(J), O) && O.IsValid()
					&& O->TryGetArrayField(TEXT("acompanante"), V) && V->Num() >= 2) { Contrario = (*V)[0]->AsNumber(); Fondo = (*V)[1]->AsNumber(); }
			}
			const FVector Dir = (P - ActorMedico->GetActorLocation()).GetSafeNormal2D();
			FVector Lado = FVector::CrossProduct(Dir, FVector::UpVector);
			if (Lado.Y < 0) Lado = -Lado;   // lado de la ventana, donde está la cámara
			const FVector Desplazamiento = -Lado * Contrario + Dir * Fondo;
			AsientoAcompanante = AsientoPaciente;
			AsientoAcompanante.AddToTranslation(Desplazamiento);
			const AStaticMeshActor* SP = Sillas.Num() ? Sillas[0] : nullptr;
			AStaticMeshActor* const* Otra = Sillas.FindByPredicate([SP](const AStaticMeshActor* S) { return FVector::Dist2D(S->GetActorLocation(), SP->GetActorLocation()) > 30.f; });
			if (SP && Otra)
			{
				(*Otra)->GetStaticMeshComponent()->SetMobility(EComponentMobility::Movable);
				(*Otra)->SetActorLocationAndRotation(SP->GetActorLocation() + Desplazamiento, SP->GetActorRotation());
			}
			UE_LOG(LogTemp, Display, TEXT("[EMM] Silla del acompañante: %s (%d sillas escolares)"), *AsientoAcompanante.GetLocation().ToString(), Sillas.Num());
		}
		PrepararMetaHuman(ActorMedico, ActorPaciente, false);
		PrepararMetaHuman(ActorPaciente, ActorMedico, true);
		MHMedico = ActorMedico;
		AjustarLuces(UEMMConsultaUI::CalidadGrafica());
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
	// ropa: uniforme sanitario para el médico (el paciente se viste en cada visita)
	Uniformar(ActorMedico, FEMMHistorial::Get().Medico.Uniforme);
	// quién controla a cada uno (lo último elegido; las pruebas empiezan siempre con médico YO y paciente IA)
	if (!FParse::Param(FCommandLine::Get(), TEXT("EMMPrueba")))
	{
		bMedicoIA = UEMMConsultaUI::LeerOpcion(TEXT("MedicoIA"), false);
		bPacienteIA = UEMMConsultaUI::LeerOpcion(TEXT("PacienteIA"), true);
	}

	// casos del juego: sólo los que tienen un personaje de su sexo y edad (personajes.json); los de bebés y niños
	// pequeños, que explica el acompañante, necesitan además un adulto para el acompañante
	FString Error;
	EMMDatos::CargarPacientes(Casos, Error);
	CargarPersonajes(ActorPaciente);
	Casos.RemoveAll([this](const FEMMPaciente& P) { return !PersonajePara(P) || ((P.bHablaAcomp || P.bBebe) && !AcompananteDe(P)); });
	int32 Infantiles = 0, Bebes = 0;
	for (const FEMMPaciente& C : Casos) { Infantiles += C.Edad < 14.f; Bebes += C.Edad < 2.5f; }
	UE_LOG(LogTemp, Display, TEXT("[EMM] %d personajes de paciente; %d casos con personaje (%d de niños, %d de bebés)"), Personajes.Num(), Casos.Num(), Infantiles, Bebes);

	UI = CreateWidget<UEMMConsultaUI>(PC, UEMMConsultaUI::StaticClass());
	UI->Modo = this;
	UI->AddToViewport();
	UIRecetas = CreateWidget<UEMMRecetaUI>(PC, UEMMRecetaUI::StaticClass());
	UIRecetas->Modo = this;
	UIRecetas->AddToViewport(10);
	UIAgenda = CreateWidget<UEMMAgendaUI>(PC, UEMMAgendaUI::StaticClass());
	UIAgenda->Modo = this;
	UIAgenda->AddToViewport(10);
	UICreador = CreateWidget<UEMMCreadorUI>(PC, UEMMCreadorUI::StaticClass());
	UICreador->Modo = this;
	UICreador->AddToViewport(11);
	if (ActorMedico) ClaseMedicoNivel = ActorMedico->GetClass()->GetPathName();
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
	ConstruirPlantilla();
	// el médico del creador de personajes (otra cara, su nombre, su aspecto)
	if (!H.PersonajeMedico.IsEmpty() || !H.Medico.Vacio() || H.bMedicaMujer) PonerMedico();
	FEMMPaciente Primero;
	if (const FEMMFicha* Pendiente = H.RevisionPendiente(); Pendiente && PacienteDeFicha(*Pendiente, Primero)) IniciarVisita(Primero);
	else if (ElegirPacienteNuevo(Primero)) IniciarVisita(Primero);
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
void AEMMConsultaModo::AjustarLuces(int32 Nivel)
{
	// Las luces rectangulares proyectan sombra en las 6 direcciones: cada una vuelve a dibujar a los dos MetaHumans
	// seis veces por fotograma. Se conservan las sombras de la luz principal (la ventana) y del panel del techo más
	// cercano a médico y paciente; los demás paneles y la pantalla del portátil usan sombras de contacto (casi
	// gratis, mantienen el contacto de manos, mesa y sillas). En ALTA, todas como en el nivel.
	const FVector Centro = MHMedico.IsValid() ? (MHMedico->GetActorLocation() + AsientoPaciente.GetLocation()) * 0.5 : AsientoPaciente.GetLocation();
	URectLightComponent* Cercano = nullptr;
	TArray<URectLightComponent*> Luces;
	for (TActorIterator<ARectLight> It(GetWorld()); It; ++It)
		if (URectLightComponent* L = Cast<URectLightComponent>(It->GetLightComponent()))
		{
			Luces.Add(L);
			const bool bTecho = FMath::IsNearlyEqual(L->Temperature, 4300.f, 50.f);
			if (bTecho && (!Cercano || FVector::DistSquared2D(L->GetComponentLocation(), Centro) < FVector::DistSquared2D(Cercano->GetComponentLocation(), Centro))) Cercano = L;
		}
	int32 ConSombra = 0;
	for (URectLightComponent* L : Luces)
	{
		const bool bVentana = FMath::IsNearlyEqual(L->Temperature, 6200.f, 50.f);
		const bool bSombra = Nivel >= 2 || bVentana || (Nivel == 1 && L == Cercano);
		L->SetCastShadows(bSombra);
		L->ContactShadowLength = bSombra ? 0.f : 0.03f;
		L->MarkRenderStateDirty();
		ConSombra += bSombra;
	}
	UE_LOG(LogTemp, Display, TEXT("[EMM] Luces: %d de %d con sombra (calidad %d)"), ConSombra, Luces.Num(), Nivel);
}

void AEMMConsultaModo::PrepararMetaHuman(AActor* Yo, AActor* Otro, bool bPaciente)
{
	if (!Yo || !Otro) return;
	// el MetaHuman mira hacia +Y de su malla: se gira 90° menos que la dirección hacia el otro. Un niño (malla de
	// MPFB) mira hacia donde apuntan sus pies en la pose de referencia
	const bool bNino = Yo->ActorHasTag(TEXT("Nino"));
	float Giro = -90.f;
	if (const USkeletalMeshComponent* SM = bNino ? Yo->FindComponentByClass<USkeletalMeshComponent>() : nullptr; SM && SM->GetSkeletalMeshAsset())
	{
		const FReferenceSkeleton& R = SM->GetSkeletalMeshAsset()->GetRefSkeleton();
		const int32 Pie = R.FindBoneIndex(TEXT("foot_l")), Punta = R.FindBoneIndex(TEXT("ball_l"));
		if (Pie != INDEX_NONE && Punta != INDEX_NONE)
		{
			FVector F = FAnimationRuntime::GetComponentSpaceTransformRefPose(R, Punta).GetLocation() - FAnimationRuntime::GetComponentSpaceTransformRefPose(R, Pie).GetLocation();
			F.Z = 0.f;
			if (!F.IsNearlyZero()) Giro = -F.Rotation().Yaw;
		}
	}
	Yo->SetActorRotation(FRotator(0, (Otro->GetActorLocation() - Yo->GetActorLocation()).Rotation().Yaw + Giro, 0));
#if PLATFORM_ANDROID || PLATFORM_IOS
	// en móvil el cuerpo y la cara no tienen LOD0 (MinLOD de Mobile = 1), pero la ropa se elegía para el cuerpo de LOD0
	// y el cuerpo la atravesaba por hombros y pecho: todo el MetaHuman (cuerpo, ropa, cara y pelo) desde el LOD1
	// (el pelo, las cejas, la barba y el bigote siguen con sus tiras del LOD0 de la consulta, no con el «casco»)
	if (ULODSyncComponent* Sync = Yo->FindComponentByClass<ULODSyncComponent>())
	{
		Sync->MinLOD = 1;
		for (TPair<FName, FLODMappingData>& Par : Sync->CustomLODMapping)
			if (!Par.Key.ToString().StartsWith(TEXT("SkeletalMesh")) && Par.Value.Mapping.Num() > 1) Par.Value.Mapping[1] = Par.Value.Mapping[0];
		Sync->RefreshSyncComponents();
	}
#endif
	TArray<USkeletalMeshComponent*> Mallas;
	Yo->GetComponents(Mallas);
	for (USkeletalMeshComponent* M : Mallas)
		if (bNino || M->GetName().Contains(TEXT("Body")))
		{
			if (!bNino) M->SetAnimInstanceClass(UEMMCuerpoAnim::StaticClass());   // el niño ya la tiene (en modo niño)
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
			P->TryGetBoolField(TEXT("nino"), X.bNino);
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

void AEMMConsultaModo::ConstruirPlantilla()
{
	// cada personaje es una persona con su cara: se le asigna un caso de su sexo y edad, intentando no repetir
	// enfermedad. Se guarda en el historial: en la partida siguiente son las mismas personas.
	FEMMHistorial& H = FEMMHistorial::Get();
	TSet<FString> Ocupados, CasosUsados, Enfermedades;
	for (const FEMMPersona& P : H.Plantilla)
	{
		Ocupados.Add(P.Personaje); CasosUsados.Add(P.CasoInicial);
		if (const FEMMPaciente* C = Casos.FindByPredicate([&](const FEMMPaciente& X) { return X.Id == P.CasoInicial; })) Enfermedades.Add(C->EnfId);
	}
	FRandomStream Azar(FParse::Param(FCommandLine::Get(), TEXT("EMMPrueba")) ? 1234 : int32(FDateTime::Now().GetTicks() & 0x7fffffff));
	for (const FEMMPersonaje& X : Personajes)
	{
		if (Ocupados.Contains(X.Nombre)) continue;
		TArray<const FEMMPaciente*> Validos, Nuevos;
		for (const FEMMPaciente& C : Casos)
			if (C.Sexo == X.Sexo && C.Edad >= X.EdadMin && C.Edad <= X.EdadMax && !CasosUsados.Contains(C.Id))
			{
				Validos.Add(&C);
				if (!Enfermedades.Contains(C.EnfId)) Nuevos.Add(&C);
			}
		const TArray<const FEMMPaciente*>& L = Nuevos.Num() ? Nuevos : Validos;
		if (!L.Num()) { UE_LOG(LogTemp, Warning, TEXT("[EMM] Sin caso para el personaje %s"), *X.Nombre); continue; }
		const FEMMPaciente* C = L[Azar.RandRange(0, L.Num() - 1)];
		H.Plantilla.Add({ FString::Printf(TEXT("P%02d"), H.Plantilla.Num() + 1), X.Nombre, C->Id });
		CasosUsados.Add(C->Id); Enfermedades.Add(C->EnfId);
	}
	H.Guardar();
	UE_LOG(LogTemp, Display, TEXT("[EMM] Plantilla: %d personas"), H.Plantilla.Num());
}

FEMMPaciente AEMMConsultaModo::PacienteDe(const FEMMPersona& Persona, const FEMMPaciente& Caso, const FEMMFicha* Ficha) const
{
	FEMMPaciente P = Caso;
	P.Id = Persona.Id;
	P.Caso = Caso.Id;
	// la misma persona con otra enfermedad: conserva su nombre y su edad
	if (Ficha && !Ficha->Nombre.IsEmpty() && (Ficha->Nombre != Caso.Nombre || Ficha->Apellidos != Caso.Apellidos))
	{
		auto Cambiar = [&](FString& S) {
			S.ReplaceInline(*(Caso.Nombre + TEXT(" ") + Caso.Apellidos), *(Ficha->Nombre + TEXT(" ") + Ficha->Apellidos), ESearchCase::CaseSensitive);
			S.ReplaceInline(*Caso.Nombre, *Ficha->Nombre, ESearchCase::CaseSensitive);
			if (!Ficha->TextoEdad.IsEmpty()) S.ReplaceInline(*Caso.TextoEdad, *Ficha->TextoEdad, ESearchCase::CaseSensitive);
		};
		Cambiar(P.Sistema); Cambiar(P.SistemaAcomp);
		for (auto& R : P.Respuestas) for (FString& S : R.Value) Cambiar(S);
		P.Nombre = Ficha->Nombre; P.Apellidos = Ficha->Apellidos;
		if (!Ficha->TextoEdad.IsEmpty())
		{
			// «9 meses» son 0,75 años (los bebés)
			P.TextoEdad = Ficha->TextoEdad;
			const float N = FCString::Atof(*Ficha->TextoEdad);
			P.Edad = Ficha->TextoEdad.Contains(TEXT("mes")) ? FMath::Max(0.05f, N / 12.f) : FMath::Max(1.f, N);
		}
	}
	// lo elegido en el creador de personajes (nombre, apellidos, edad) manda sobre el caso y la ficha
	const FEMMAspecto& A = Persona.Aspecto;
	if (!A.Nombre.IsEmpty() || !A.Apellidos.IsEmpty() || A.Edad > 0)
	{
		const FString Nom = A.Nombre.IsEmpty() ? P.Nombre : A.Nombre, Ape = A.Apellidos.IsEmpty() ? P.Apellidos : A.Apellidos;
		const FString Edad = A.Edad > 0 ? (A.Edad == 1 ? FString(TEXT("1 año")) : FString::Printf(TEXT("%d años"), A.Edad)) : P.TextoEdad;
		auto Cambiar = [&](FString& S) {
			S.ReplaceInline(*(P.Nombre + TEXT(" ") + P.Apellidos), *(Nom + TEXT(" ") + Ape), ESearchCase::CaseSensitive);
			if (!P.Nombre.IsEmpty()) S.ReplaceInline(*P.Nombre, *Nom, ESearchCase::CaseSensitive);
			if (!P.TextoEdad.IsEmpty()) S.ReplaceInline(*P.TextoEdad, *Edad, ESearchCase::CaseSensitive);
		};
		Cambiar(P.Sistema); Cambiar(P.SistemaAcomp);
		for (auto& R : P.Respuestas) for (FString& S : R.Value) Cambiar(S);
		P.Nombre = Nom; P.Apellidos = Ape;
		if (A.Edad > 0) { P.TextoEdad = Edad; P.Edad = float(A.Edad); }
	}
	return P;
}

const FEMMPersona* AEMMConsultaModo::PersonaDe(const FString& Id) const
{
	return FEMMHistorial::Get().Plantilla.FindByPredicate([&](const FEMMPersona& P) { return P.Id == Id; });
}

// ───────────────────────── Creador de personajes ─────────────────────────
FString AEMMConsultaModo::NombreMedico() const
{
	const FEMMHistorial& H = FEMMHistorial::Get();
	return FString::Printf(TEXT("%s %s %s"), H.bMedicaMujer ? TEXT("Dra.") : TEXT("Dr."), H.Medico.Nombre.IsEmpty() ? TEXT("Lorenzo") : *H.Medico.Nombre,
		H.Medico.Apellidos.IsEmpty() ? TEXT("Prieto Alonso") : *H.Medico.Apellidos);
}

FString AEMMConsultaModo::FirmaMedico() const
{
	// «L. Prieto A.»
	const FEMMHistorial& H = FEMMHistorial::Get();
	const FString N = H.Medico.Nombre.IsEmpty() ? TEXT("Lorenzo") : H.Medico.Nombre;
	TArray<FString> Ap;
	(H.Medico.Apellidos.IsEmpty() ? FString(TEXT("Prieto Alonso")) : H.Medico.Apellidos).ParseIntoArrayWS(Ap);
	return FString::Printf(TEXT("%s. %s%s"), *N.Left(1), Ap.Num() ? *Ap[0] : TEXT(""), Ap.Num() > 1 ? *FString::Printf(TEXT(" %s."), *Ap[1].Left(1)) : TEXT(""));
}

TArray<AEMMConsultaModo::FEMMCara> AEMMConsultaModo::Caras() const
{
	static const TMap<FString, FString> Ninos = {
		{ TEXT("Bebe_Nino"), TEXT("Bebé (niño)") }, { TEXT("Bebe_Nina"), TEXT("Bebé (niña)") }, { TEXT("Nino_Pequeno"), TEXT("Niño pequeño") },
		{ TEXT("Nina_Pequena"), TEXT("Niña pequeña") }, { TEXT("Nino_Escolar"), TEXT("Niño escolar") }, { TEXT("Nina_Escolar"), TEXT("Niña escolar") } };
	TArray<FEMMCara> R;
	R.Add({ TEXT("Lorenzo"), TEXT("Lorenzo (el médico del juego)"), TEXT("h"), 30.f, 75.f, false, true });
	for (const FEMMPersonaje& X : Personajes)
	{
		const FString* N = Ninos.Find(X.Nombre);
		R.Add({ X.Nombre, FString::Printf(TEXT("%s, %d–%d años"), N ? **N : *X.Nombre, FMath::FloorToInt(X.EdadMin), FMath::FloorToInt(X.EdadMax)), X.Sexo, X.EdadMin, X.EdadMax, X.bNino, false });
	}
	return R;
}

FString AEMMConsultaModo::CaraDe(int32 I) const
{
	const FEMMHistorial& H = FEMMHistorial::Get();
	if (I < 0) return H.PersonajeMedico.IsEmpty() ? FString(TEXT("Lorenzo")) : H.PersonajeMedico;
	return H.Plantilla.IsValidIndex(I) ? H.Plantilla[I].Personaje : FString();
}

static bool PacienteDePersona(const AEMMConsultaModo* M, const TArray<FEMMPaciente>& Casos, int32 I, FEMMPaciente& Salida, TFunctionRef<FEMMPaciente(const FEMMPersona&, const FEMMPaciente&, const FEMMFicha*)> De)
{
	FEMMHistorial& H = FEMMHistorial::Get();
	if (!H.Plantilla.IsValidIndex(I)) return false;
	const FEMMPersona& Per = H.Plantilla[I];
	const FEMMFicha* F = H.Buscar(Per.Id);
	const FString CasoId = F && !F->CasoActual.IsEmpty() ? F->CasoActual : Per.CasoInicial;
	const FEMMPaciente* C = Casos.FindByPredicate([&](const FEMMPaciente& X) { return X.Id == CasoId; });
	if (!C) C = Casos.FindByPredicate([&](const FEMMPaciente& X) { return X.Id == Per.CasoInicial; });
	if (!C) return false;
	Salida = De(Per, *C, F);
	return true;
}

int32 AEMMConsultaModo::EdadDe(int32 I) const
{
	const FEMMHistorial& H = FEMMHistorial::Get();
	if (I < 0) return H.Medico.Edad > 0 ? H.Medico.Edad : 45;
	if (H.Plantilla.IsValidIndex(I) && H.Plantilla[I].Aspecto.Edad >= 0) return H.Plantilla[I].Aspecto.Edad;
	FEMMPaciente P;
	return PacienteDePersona(this, Casos, I, P, [this](const FEMMPersona& A, const FEMMPaciente& B, const FEMMFicha* C) { return PacienteDe(A, B, C); }) ? FMath::FloorToInt(P.Edad) : 30;
}

void AEMMConsultaModo::NombreDe(int32 I, FString& Nombre, FString& Apellidos) const
{
	const FEMMHistorial& H = FEMMHistorial::Get();
	if (I < 0) { Nombre = H.Medico.Nombre.IsEmpty() ? TEXT("Lorenzo") : H.Medico.Nombre; Apellidos = H.Medico.Apellidos.IsEmpty() ? TEXT("Prieto Alonso") : H.Medico.Apellidos; return; }
	FEMMPaciente P;
	if (PacienteDePersona(this, Casos, I, P, [this](const FEMMPersona& A, const FEMMPaciente& B, const FEMMFicha* C) { return PacienteDe(A, B, C); })) { Nombre = P.Nombre; Apellidos = P.Apellidos; }
}

FString AEMMConsultaModo::NombreCompletoDe(int32 I) const
{
	FString N, A;
	NombreDe(I, N, A);
	return (N + TEXT(" ") + A).TrimStartAndEnd();
}

FString AEMMConsultaModo::TextoEdadDe(int32 I) const
{
	if (I < 0) return FString::Printf(TEXT("%d años"), EdadDe(I));
	FEMMPaciente P;
	return PacienteDePersona(this, Casos, I, P, [this](const FEMMPersona& A, const FEMMPaciente& B, const FEMMFicha* C) { return PacienteDe(A, B, C); }) ? P.TextoEdad : FString();
}

void AEMMConsultaModo::AbrirCreador()
{
	if (!UICreador) return;
	CerrarVentanas();
	UICreador->Abrir();
}

FString AEMMConsultaModo::AplicarCreador(int32 I, const FString& Cara, const FEMMAspecto& A)
{
	FEMMHistorial& H = FEMMHistorial::Get();
	const TArray<FEMMCara> L = Caras();
	const FEMMCara* C = L.FindByPredicate([&](const FEMMCara& X) { return X.Nombre == Cara; });
	if (!C) return TEXT("Elige una cara de su sexo y su edad.");
	if (I < 0)
	{
		// el médico: se vuelve a crear con su cara y su aspecto
		H.Medico = A;
		H.PersonajeMedico = C->bMedico ? FString() : Cara;
		H.bMedicaMujer = C->Sexo == TEXT("m");
		H.Guardar();
		PonerMedico();
		UE_LOG(LogTemp, Display, TEXT("[EMM] Creador: médico %s, cara %s"), *NombreMedico(), *Cara);
		return FString::Printf(TEXT("Guardado: %s."), *NombreMedico());
	}
	if (!H.Plantilla.IsValidIndex(I)) return FString();
	FEMMPersona& Per = H.Plantilla[I];
	Per.Personaje = Cara;
	Per.Aspecto = A;
	// su problema de salud tiene que ser de su sexo y su edad: si no, otro caso (el de edad más cercana)
	FString Aviso;
	const FEMMPaciente* Caso = Casos.FindByPredicate([&](const FEMMPaciente& X) { return X.Id == Per.CasoInicial; });
	const float Edad = A.Edad > 0 ? float(A.Edad) : A.Edad == 0 ? 0.5f : (Caso ? Caso->Edad : 30.f);
	if (!Caso || Caso->Sexo != C->Sexo || Edad < C->EdadMin || Edad > C->EdadMax + 1.f || FMath::Abs(Caso->Edad - Edad) > 12.f)
	{
		const FEMMPaciente* Mejor = nullptr;
		float D = 1e9f;
		for (const FEMMPaciente& X : Casos)
			if (X.Sexo == C->Sexo && X.Edad >= C->EdadMin && X.Edad <= C->EdadMax + 1.f)
			{
				const bool bUsado = H.Plantilla.ContainsByPredicate([&](const FEMMPersona& Y) { return Y.CasoInicial == X.Id && Y.Id != Per.Id; });
				const float Dx = FMath::Abs(X.Edad - Edad) + (bUsado ? 6.f : 0.f);
				if (Dx < D) { D = Dx; Mejor = &X; }
			}
		if (Mejor)
		{
			Per.CasoInicial = Mejor->Id;
			Aviso = FString::Printf(TEXT(" Por su sexo y su edad, en su próxima visita vendrá por: %s."), *Mejor->Enfermedad);
		}
	}
	// si ya tiene ficha: su nombre, su edad y su cara también ahí
	if (FEMMFicha* F = H.Buscar(Per.Id))
	{
		if (!A.Nombre.IsEmpty()) F->Nombre = A.Nombre;
		if (!A.Apellidos.IsEmpty()) F->Apellidos = A.Apellidos;
		if (A.Edad > 0) F->TextoEdad = A.Edad == 1 ? FString(TEXT("1 año")) : FString::Printf(TEXT("%d años"), A.Edad);
		F->Personaje = Cara;
		F->Sexo = C->Sexo;
		if (!Aviso.IsEmpty() && F->ProximaRevision <= 0) F->CasoActual = Per.CasoInicial;
	}
	H.Guardar();
	// si está ahora en la consulta, se ve al momento (si la cara es de su sexo; su problema de hoy no cambia)
	if (Paciente.Id == Per.Id)
	{
		const FEMMPaciente* Hoy = Casos.FindByPredicate([&](const FEMMPaciente& X) { return X.Id == Paciente.Caso; });
		if (Hoy && Hoy->Sexo == C->Sexo)
		{
			const FEMMFicha* F = H.Buscar(Per.Id);
			Paciente = PacienteDe(Per, *Hoy, F);
			PersonajeActual.Reset();
			PonerPersonaje(Paciente);
			if (!bHablaAcompanante && HablaPaciente) HablaPaciente->Nombre = Paciente.Nombre;
			if (UI) UI->PonerFecha(FString::Printf(TEXT("%s · %s · %s %s"), *FEMMHistorial::Fecha(H.Dia), Visita.bRevision ? TEXT("REVISIÓN") : TEXT("Primera consulta"), *Paciente.Nombre, *Paciente.Apellidos));
		}
		else Aviso += TEXT(" La cara nueva se verá en su próxima visita.");
	}
	UE_LOG(LogTemp, Display, TEXT("[EMM] Creador: %s → %s %s, cara %s%s"), *Per.Id, *A.Nombre, *A.Apellidos, *Cara, *Aviso);
	return FString::Printf(TEXT("Guardado: %s.%s"), *NombreCompletoDe(I), *Aviso);
}

void AEMMConsultaModo::PonerMedico()
{
	if (!MHMedico.IsValid()) return;
	const FEMMHistorial& H = FEMMHistorial::Get();
	FString Clase = ClaseMedicoNivel;
	if (const FEMMPersonaje* X = Personajes.FindByPredicate([&](const FEMMPersonaje& Y) { return Y.Nombre == H.PersonajeMedico && !Y.bNino; })) Clase = X->Clase;
	UClass* C = LoadClass<AActor>(nullptr, *Clase);
	if (!C) return;
	// siempre se vuelve a crear: así el aspecto se aplica sobre el original
	AActor* Nuevo = GetWorld()->SpawnActor<AActor>(C, MHMedico->GetActorTransform());
	if (!Nuevo) return;
	Nuevo->Tags = { TEXT("Medico") };
	if (H.bMedicaMujer) Nuevo->Tags.Add(TEXT("Mujer"));
	// su voz y su boca pasan al nuevo
	const FEMMPerfilVoz VM = EMMVoz::PerfilPara(H.bMedicaMujer, 40.f);
	if (IsValid(Medico)) Medico->DestroyComponent();
	Medico = NewObject<UEMMHabla>(Nuevo);
	Medico->RegisterComponent();
	Medico->bMujer = VM.bMujer; Medico->Tono = VM.Tono; Medico->Velocidad = VM.Vel; Medico->VozPreferida = VM.Preferida; Medico->VozPiper = VM.Piper;
	TArray<FString> Ap;
	(H.Medico.Apellidos.IsEmpty() ? FString(TEXT("Prieto Alonso")) : H.Medico.Apellidos).ParseIntoArrayWS(Ap);
	Medico->Nombre = FString::Printf(TEXT("%s %s"), H.bMedicaMujer ? TEXT("Dra.") : TEXT("Dr."), Ap.Num() ? *Ap[0] : TEXT(""));
	MHMedico->Destroy();
	MHMedico = Nuevo;
	if (MHPaciente.IsValid()) PrepararMetaHuman(Nuevo, MHPaciente.Get(), false);
	Uniformar(Nuevo, H.Medico.Uniforme);
	EMMAspecto::Aplicar(Nuevo, H.Medico);
	// el paciente y su acompañante le miran
	for (const TWeakObjectPtr<AActor>& Q : { MHPaciente, MHAcompanante })
		if (Q.IsValid())
		{
			TArray<USkeletalMeshComponent*> Mallas;
			Q->GetComponents(Mallas);
			for (USkeletalMeshComponent* M : Mallas) if (UEMMCuerpoAnim* An = Cast<UEMMCuerpoAnim>(M->GetAnimInstance())) An->Interlocutor = Nuevo;
		}
	GEngine->ForceGarbageCollection(true);
	UE_LOG(LogTemp, Display, TEXT("[EMM] Médico: %s (%s)"), *NombreMedico(), *Clase);
}

bool AEMMConsultaModo::PacienteDeFicha(const FEMMFicha& F, FEMMPaciente& Salida) const
{
	const FEMMHistorial& H = FEMMHistorial::Get();
	const FEMMPersona* Per = H.Plantilla.FindByPredicate([&](const FEMMPersona& P) { return P.Id == F.CasoId; });
	const FString CasoId = !F.CasoActual.IsEmpty() ? F.CasoActual : Per ? Per->CasoInicial : F.CasoId;
	const FEMMPaciente* C = Casos.FindByPredicate([&](const FEMMPaciente& X) { return X.Id == CasoId; });
	if (!C) return false;
	Salida = Per ? PacienteDe(*Per, *C, &F) : *C;   // fichas antiguas (antes de la plantilla): el caso tal cual
	return true;
}

bool AEMMConsultaModo::ElegirPacienteNuevo(FEMMPaciente& Salida)
{
	FEMMHistorial& H = FEMMHistorial::Get();
	// primero, personas que aún no han venido nunca
	TArray<const FEMMPersona*> Sin;
	for (const FEMMPersona& P : H.Plantilla) if (!H.Buscar(P.Id)) Sin.Add(&P);
	if (Sin.Num())
	{
		const FEMMPersona* P = Sin[FMath::RandRange(0, Sin.Num() - 1)];
		if (const FEMMPaciente* C = Casos.FindByPredicate([&](const FEMMPaciente& X) { return X.Id == P->CasoInicial; })) { Salida = PacienteDe(*P, *C, nullptr); return true; }
	}
	// ya los conoce a todos: vuelve alguien sin cita con un problema nuevo (su cara, su nombre y su historial)
	TArray<TPair<const FEMMPersona*, const FEMMFicha*>> Libres;
	for (const FEMMPersona& P : H.Plantilla)
		if (const FEMMFicha* F = H.Buscar(P.Id); F && F->ProximaRevision <= 0 && P.Id != Paciente.Id) Libres.Add({ &P, F });
	if (!Libres.Num()) return false;
	const auto& Elegido = Libres[FMath::RandRange(0, Libres.Num() - 1)];
	const FEMMPersonaje* X = Personajes.FindByPredicate([&](const FEMMPersonaje& Y) { return Y.Nombre == Elegido.Key->Personaje; });
	const FEMMPaciente* Antes = Casos.FindByPredicate([&](const FEMMPaciente& C) { return C.Id == Elegido.Value->CasoActual; });
	const float Edad = FMath::Max(1.f, FCString::Atof(*Elegido.Value->TextoEdad));
	TArray<const FEMMPaciente*> Otros;
	// un niño o un bebé vuelve con un problema de su edad (no con uno de adulto; «9 meses» no son 9 años)
	for (const FEMMPaciente& C : Casos)
		if (X && C.Sexo == X->Sexo && (X->bNino ? (C.Edad >= X->EdadMin && C.Edad <= X->EdadMax) : FMath::Abs(C.Edad - Edad) <= 15.f)
			&& C.Id != Elegido.Value->CasoActual && (!Antes || C.EnfId != Antes->EnfId)) Otros.Add(&C);
	if (!Otros.Num()) return false;
	Salida = PacienteDe(*Elegido.Key, *Otros[FMath::RandRange(0, Otros.Num() - 1)], Elegido.Value);
	return true;
}

const AEMMConsultaModo::FEMMPersonaje* AEMMConsultaModo::PersonajePara(const FEMMPaciente& Caso) const
{
	// una persona de la plantilla: siempre su personaje
	if (const FEMMPersona* Per = FEMMHistorial::Get().Plantilla.FindByPredicate([&](const FEMMPersona& P) { return P.Id == Caso.Id; }))
		if (const FEMMPersonaje* X = Personajes.FindByPredicate([&](const FEMMPersonaje& Y) { return Y.Nombre == Per->Personaje; })) return X;
	// los de su sexo y edad; entre varios, siempre el mismo para el mismo caso (vuelve con la misma cara)
	TArray<const FEMMPersonaje*> Validos;
	for (const FEMMPersonaje& X : Personajes)
		if (X.Sexo == Caso.Sexo && Caso.Edad >= X.EdadMin && Caso.Edad <= X.EdadMax) Validos.Add(&X);
	return Validos.Num() ? Validos[GetTypeHash(Caso.Id) % uint32(Validos.Num())] : nullptr;
}

bool AEMMConsultaModo::AcompananteMujer(const FEMMPaciente& Caso)
{
	const FString A = EMMDatos::Normaliza(Caso.Acompanante);
	for (const TCHAR* M : { TEXT("madre"), TEXT("abuela"), TEXT("tia"), TEXT("hermana"), TEXT("hija"), TEXT("mujer"), TEXT("esposa"), TEXT("novia"), TEXT("nieta"), TEXT("cuidadora") })
		if (A.Contains(M)) return true;
	return false;
}

float AEMMConsultaModo::EdadAcompanante(const FEMMPaciente& Caso)
{
	const FString A = EMMDatos::Normaliza(Caso.Acompanante);
	if (A.Contains(TEXT("abuel"))) return 70.f;
	if (A.Contains(TEXT("hij")) || A.Contains(TEXT("niet"))) return FMath::Clamp(Caso.Edad - 30.f, 25.f, 60.f);
	if (Caso.Edad < 18.f) return FMath::Clamp(Caso.Edad + 30.f, 25.f, 48.f);   // madre o padre de un niño
	return Caso.Edad;                                                          // pareja o hermano: de su edad
}

const AEMMConsultaModo::FEMMPersonaje* AEMMConsultaModo::AcompananteDe(const FEMMPaciente& Caso) const
{
	if (Caso.Acompanante.IsEmpty()) return nullptr;
	const FString Sexo = AcompananteMujer(Caso) ? TEXT("m") : TEXT("h");
	const float Edad = EdadAcompanante(Caso);
	TArray<const FEMMPersonaje*> Validos;
	for (const FEMMPersonaje& X : Personajes)
		if (!X.bNino && X.Sexo == Sexo && Edad >= X.EdadMin && Edad <= X.EdadMax) Validos.Add(&X);
	// siempre el mismo para el mismo niño (su madre es siempre su madre)
	return Validos.Num() ? Validos[(GetTypeHash(Caso.Id) / 7u) % uint32(Validos.Num())] : nullptr;
}

AActor* AEMMConsultaModo::CrearPersonaje(const FEMMPersonaje& X, const FTransform& Donde)
{
	if (!X.bNino)
	{
		UClass* Clase = LoadClass<AActor>(nullptr, *X.Clase);
		if (!Clase) { UE_LOG(LogTemp, Warning, TEXT("[EMM] No se carga el personaje %s (%s)"), *X.Nombre, *X.Clase); return nullptr; }
		return GetWorld()->SpawnActor<AActor>(Clase, Donde);
	}
	// niños y bebés: su malla ya viene sentada (crear_ninos_mpfb.py), sin animación; la boca se mueve con su forma
	// «Boca» (UEMMHabla). Su origen está en el suelo y el asiento a 44 cm; el del bebé, en su asiento (va en el regazo)
	USkeletalMesh* Malla = LoadObject<USkeletalMesh>(nullptr, *X.Clase);
	if (!Malla) { UE_LOG(LogTemp, Warning, TEXT("[EMM] No se carga el niño %s (%s)"), *X.Nombre, *X.Clase); return nullptr; }
	ASkeletalMeshActor* A = GetWorld()->SpawnActor<ASkeletalMeshActor>(ASkeletalMeshActor::StaticClass(), Donde);
	if (!A) return nullptr;
	USkeletalMeshComponent* M = A->GetSkeletalMeshComponent();
	M->SetMobility(EComponentMobility::Movable);
	M->SetSkeletalMeshAsset(Malla);
	A->Tags.Add(TEXT("Nino"));
	return A;
}

void AEMMConsultaModo::SentarBebe()
{
	// el bebé, sentado en el regazo del acompañante y mirando al médico (escena.json › bebe: [adelante, arriba] en cm)
	if (!MHPaciente.IsValid() || !MHAcompanante.IsValid() || !MHMedico.IsValid()) return;
	USkeletalMeshComponent* Cuerpo = nullptr;
	TArray<USkeletalMeshComponent*> Mallas;
	MHAcompanante->GetComponents(Mallas);
	for (USkeletalMeshComponent* M : Mallas) if (M->GetName().Contains(TEXT("Body"))) Cuerpo = M;
	if (!Cuerpo) return;
	double Adelante = 22, Arriba = 6;
	FString J; TSharedPtr<FJsonObject> O;
	const TArray<TSharedPtr<FJsonValue>>* Bebe = nullptr;
	if (FFileHelper::LoadFileToString(J, *(FPaths::ProjectContentDir() / TEXT("Datos/escena.json"))) && FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(J), O) && O.IsValid()
		&& O->TryGetArrayField(TEXT("bebe"), Bebe) && Bebe->Num() >= 2) { Adelante = (*Bebe)[0]->AsNumber(); Arriba = (*Bebe)[1]->AsNumber(); }
	FVector F = MHMedico->GetActorLocation() - MHAcompanante->GetActorLocation(); F.Z = 0.f; F.Normalize();
	// el asiento del bebé (su origen) sobre los muslos del adulto
	MHPaciente->SetActorLocation(Cuerpo->GetBoneLocation(TEXT("pelvis")) + F * Adelante + FVector(0, 0, Arriba));
}

// Ropa de cuerpo entero del paciente y de su acompañante, según su edad y con una variación fija por persona
void AEMMConsultaModo::VestirPersonajes(const FEMMPaciente& Caso)
{
	FLinearColor Arriba, Abajo, Calzado;
	ColoresPaciente(Caso, Arriba, Abajo, Calzado);
	Vestir(MHPaciente.Get(), Arriba, Abajo);
	PonerPantalon(MHPaciente.Get(), Abajo, Calzado);
	if (MHAcompanante.IsValid())
	{
		FEMMPaciente Adulto = Caso;
		Adulto.Id += TEXT("·acomp"); Adulto.Edad = EdadAcompanante(Caso);
		ColoresPaciente(Adulto, Arriba, Abajo, Calzado);
		Vestir(MHAcompanante.Get(), Arriba, Abajo);
		PonerPantalon(MHAcompanante.Get(), Abajo, Calzado);
	}
}

void AEMMConsultaModo::PonerPersonaje(const FEMMPaciente& Caso)
{
	const FEMMPersonaje* X = PersonajePara(Caso);
	if (!X || !MHMedico.IsValid()) return;
	// niños y bebés vienen con un adulto (MetaHuman de su sexo y edad); un adulto, sólo si contesta su acompañante
	const FEMMPersonaje* Ac = (X->bNino || Caso.bHablaAcomp) ? AcompananteDe(Caso) : nullptr;
	const bool bBebe = X->bNino && X->EdadMax <= 3.f;
	bHablaAcompanante = Ac && (Caso.bHablaAcomp || Caso.bBebe || bBebe);
	// la cara, el acompañante y el aspecto del creador de personajes: si cambia algo, se vuelve a crear
	const FEMMPersona* Per = PersonaDe(Caso.Id);
	const FString ClaseAc = Ac ? Ac->Clase : FString();
	const FString Clave = X->Clase + (Per ? FString::Printf(TEXT("|%d|%d|%d|%s|%s|%s"), Per->Aspecto.Piel, Per->Aspecto.Pelo, Per->Aspecto.Ojos, *Per->Aspecto.Peinado, *Per->Aspecto.Barba, *Per->Aspecto.Bigote) : FString());
	if (Clave != PersonajeActual || ClaseAc != AcompananteActual || !MHPaciente.IsValid())
	{
		if (MHPaciente.IsValid()) MHPaciente->Destroy();
		if (MHAcompanante.IsValid()) MHAcompanante->Destroy();
		MHPaciente = nullptr; MHAcompanante = nullptr;
		// el acompañante: con un bebé en brazos, en la silla del paciente; si no, en la de al lado
		if (Ac)
			if (AActor* A = CrearPersonaje(*Ac, bBebe ? AsientoPaciente : AsientoAcompanante))
			{
				A->Tags.Append({ TEXT("Acompanante"), AcompananteMujer(Caso) ? TEXT("Mujer") : TEXT("Hombre") });
				MHAcompanante = A;
				PrepararMetaHuman(A, MHMedico.Get(), true);
			}
		AActor* Nuevo = CrearPersonaje(*X, AsientoPaciente);
		if (!Nuevo) return;
		Nuevo->Tags.Append({ TEXT("Paciente"), Caso.EsMujer() ? TEXT("Mujer") : TEXT("Hombre") });
		MHPaciente = Nuevo;
		PrepararMetaHuman(Nuevo, MHMedico.Get(), true);
		EMMAspecto::Aplicar(Nuevo, Per ? Per->Aspecto : FEMMAspecto());
		if (X->bNino && !bBebe)
		{
			// el niño, bien sentado al fondo del asiento (escena.json › nino_atras, cm)
			double Atras = 8;
			FString J; TSharedPtr<FJsonObject> O;
			if (FFileHelper::LoadFileToString(J, *(FPaths::ProjectContentDir() / TEXT("Datos/escena.json"))) && FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(J), O) && O.IsValid())
				O->TryGetNumberField(TEXT("nino_atras"), Atras);
			FVector F = MHMedico->GetActorLocation() - Nuevo->GetActorLocation(); F.Z = 0.f;
			Nuevo->AddActorWorldOffset(-F.GetSafeNormal() * Atras);
		}
		if (bBebe && MHAcompanante.IsValid())
		{
			// cuando el acompañante ya está sentado (su pose se calcula en el fotograma siguiente)
			FTimerHandle T1, T2;
			GetWorldTimerManager().SetTimer(T1, this, &AEMMConsultaModo::SentarBebe, 0.15f, false);
			GetWorldTimerManager().SetTimer(T2, this, &AEMMConsultaModo::SentarBebe, 0.6f, false);
		}
		// los personajes anteriores (mallas, texturas, pelo) se liberan ya: si no, se acumulan en la memoria de vídeo
		GEngine->ForceGarbageCollection(true);
		UltimoCambio = FPlatformTime::Seconds();
		// entran con un fundido desde negro (tapa el instante de carga)
		if (APlayerController* PC = GetWorld()->GetFirstPlayerController(); PC && PC->PlayerCameraManager) PC->PlayerCameraManager->StartCameraFade(1.f, 0.f, 0.7f, FLinearColor::Black, false, false);
		PersonajeActual = Clave;
		AcompananteActual = ClaseAc;
		if (X->bNino)
		{
			// dónde ha quedado el niño (para ajustar postura_nino.json y escena.json)
			FTimerHandle T;
			TWeakObjectPtr<AEMMConsultaModo> Yo(this);
			GetWorldTimerManager().SetTimer(T, FTimerDelegate::CreateLambda([Yo]() {
				if (!Yo.IsValid() || !Yo->MHPaciente.IsValid()) return;
				const USkeletalMeshComponent* M = Yo->MHPaciente->FindComponentByClass<USkeletalMeshComponent>();
				if (!M) return;
				UE_LOG(LogTemp, Display, TEXT("[EMM] Niño en escena: actor %s, giro %.0f, pelvis %s, cabeza %s, caja %s ± %s, visible %d, acompañante %s"),
					*Yo->MHPaciente->GetActorLocation().ToString(), Yo->MHPaciente->GetActorRotation().Yaw, *M->GetBoneLocation(TEXT("pelvis")).ToString(), *M->GetBoneLocation(TEXT("head")).ToString(),
					*M->Bounds.Origin.ToString(), *M->Bounds.BoxExtent.ToString(), M->IsVisible(), Yo->MHAcompanante.IsValid() ? *Yo->MHAcompanante->GetActorLocation().ToString() : TEXT("-"));
			}), 1.2f, false);
		}
		UE_LOG(LogTemp, Display, TEXT("[EMM] Paciente: personaje %s%s"), *X->Nombre, Ac ? *FString::Printf(TEXT(" con %s (%s)"), *Caso.Acompanante, *Ac->Nombre) : TEXT(""));
	}
	// quién contesta (el acompañante con los bebés y los niños pequeños): su voz y su boca; el médico le mira
	AActor* Quien = bHablaAcompanante && MHAcompanante.IsValid() ? MHAcompanante.Get() : MHPaciente.Get();
	if (!IsValid(HablaPaciente) || HablaPaciente->GetOwner() != Quien)
	{
		if (IsValid(HablaPaciente)) HablaPaciente->DestroyComponent();
		HablaPaciente = NewObject<UEMMHabla>(Quien);
		HablaPaciente->RegisterComponent();
	}
	TArray<USkeletalMeshComponent*> Mallas;
	MHMedico->GetComponents(Mallas);
	for (USkeletalMeshComponent* M : Mallas) if (UEMMCuerpoAnim* A = Cast<UEMMCuerpoAnim>(M->GetAnimInstance())) A->Interlocutor = Quien;
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
	// revisión si vuelve por lo mismo; si viene con otro problema es consulta nueva (pero recuerda su historial)
	const bool bMismoProblema = F.CasoActual.IsEmpty() || F.CasoActual == Paciente.Caso;
	Visita.bRevision = F.Visitas.Num() > 0 && bMismoProblema;
	F.CasoActual = Paciente.Caso;
	F.Enfermedad = Paciente.Enfermedad;
	if (const FEMMPersonaje* X = PersonajePara(Paciente)) F.Personaje = X->Nombre;
	Charla.Reset();
	bTurnoPaciente = bOcupado = bTerminada = bPensando = false;
	++Epoca;
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
	if (F.Visitas.Num() && !Visita.bRevision)
		MemoriaPaciente += TEXT("\nHoy vienes por un problema NUEVO, distinto de lo de las otras veces (lo de antes ya pasó). Si el médico te pregunta, recuerdas lo anterior.");
	H.Guardar();

	// voz según edad y sexo de quien contesta (el acompañante con bebés y niños pequeños); si coincide con la del
	// médico, el médico cambia un poco la suya
	FString NombreHabla = Paciente.Nombre.IsEmpty() ? TEXT("Paciente") : Paciente.Nombre;
	if (bHablaAcompanante)
	{
		// «su madre» → «Madre de Daniel»
		FString Quien = Paciente.Acompanante;
		Quien.RemoveFromStart(TEXT("su "));
		NombreHabla = FText::FromString(Quien.Left(1)).ToUpper().ToString() + Quien.Mid(1) + (Paciente.Nombre.IsEmpty() ? FString() : TEXT(" de ") + Paciente.Nombre);
	}
	HablaPaciente->Nombre = NombreHabla;
	const FEMMPerfilVoz VP = bHablaAcompanante ? EMMVoz::PerfilPara(AcompananteMujer(Paciente), EdadAcompanante(Paciente), GetTypeHash(Paciente.Id + TEXT("·acomp")) | 1u)
		: EMMVoz::PerfilPara(Paciente.EsMujer(), Paciente.Edad, GetTypeHash(Paciente.Id) | 1u);
	HablaPaciente->bMujer = VP.bMujer; HablaPaciente->Tono = VP.Tono; HablaPaciente->Velocidad = VP.Vel; HablaPaciente->VozPreferida = VP.Preferida;
	HablaPaciente->VozPiper = VP.Piper;
	const bool bMedicaMujer = MHMedico.IsValid() && MHMedico->ActorHasTag(TEXT("Mujer"));
	const FEMMPerfilVoz VM = EMMVoz::PerfilPara(bMedicaMujer, 40.f);
	Medico->VozPreferida = VM.Preferida; Medico->Tono = VM.Tono; Medico->VozPiper = VM.Piper;
	if (bMedicaMujer == VP.bMujer && VM.Preferida == VP.Preferida)
	{
		if (bMedicaMujer) Medico->VozPreferida = TEXT("Helena");
		else Medico->Tono = 1.05f;
	}
	// si coinciden en la voz neuronal, el médico usa otra de su sexo
	if (!VM.Piper.IsEmpty() && VM.Piper == VP.Piper)
		for (const EMMPiper::FVozPiper& V : EMMPiper::Voces())
			if (V.Sexo == (bMedicaMujer ? TEXT("m") : TEXT("h")) && V.Id != VP.Piper) { Medico->VozPiper = V.Id; break; }
	// el carácter se nota en el cuerpo y en la forma de hablar: los nerviosos se mueven más y hablan más deprisa
	const FString Pers = EMMDatos::Normaliza(Paciente.Personalidad);
	auto Tiene = [&Pers](std::initializer_list<const TCHAR*> L) { for (const TCHAR* X : L) if (Pers.Contains(X)) return true; return false; };
	float Inquietud = 1.f;
	if (Tiene({ TEXT("nervios"), TEXT("inquiet"), TEXT("ansios"), TEXT("impacien"), TEXT("agobi"), TEXT("asustad") })) { Inquietud = 1.7f; HablaPaciente->Velocidad *= 1.1f; }
	else if (Tiene({ TEXT("hablador"), TEXT("bromista"), TEXT("charlat"), TEXT("extrovert"), TEXT("simpatic") })) { Inquietud = 1.3f; HablaPaciente->Velocidad *= 1.05f; }
	else if (Tiene({ TEXT("tranquil"), TEXT("seren"), TEXT("calmad"), TEXT("timid"), TEXT("reservad"), TEXT("callad"), TEXT("parco") })) { Inquietud = 0.6f; HablaPaciente->Velocidad *= 0.95f; }
	if (Paciente.Grav >= 3) Inquietud *= 0.7f;   // los que están muy malos se mueven poco
	// ropa según la edad y gesto según cómo llega
	VestirPersonajes(Paciente);
	if (MHAcompanante.IsValid())
	{
		// el acompañante, algo preocupado
		TArray<USkeletalMeshComponent*> Mallas;
		MHAcompanante->GetComponents(Mallas);
		for (USkeletalMeshComponent* M : Mallas)
			if (UEMMCuerpoAnim* A = Cast<UEMMCuerpoAnim>(M->GetAnimInstance())) { A->Preocupacion = 0.5f; A->Inquietud = 1.f; }
	}
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
	// las instrucciones del caso + lo que recuerda de otras consultas + lo que se le ha recetado hoy.
	// Con bebés y niños pequeños contesta el acompañante: sus instrucciones son las suyas
	FEMMPaciente P = Paciente;
	if (bHablaAcompanante && !P.SistemaAcomp.IsEmpty()) P.Sistema = P.SistemaAcomp;
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
	if (UICreador) UICreador->Cerrar();
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

void AEMMConsultaModo::TerminarConsulta(const FString& Diagnostico, const FString& Pruebas, int32 DiasRevision, const FString& Destino)
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
	// destino del paciente y su valoración de seguridad (un infarto o una apendicitis no se mandan a casa)
	Visita.Destino = Destino.IsEmpty() ? FString(TEXT("casa")) : Destino;
	int32 NivelSeguridad = 0;
	Visita.Seguridad = EMMEvolucion::ValorarDestino(Paciente, Visita.Destino, NivelSeguridad);
	F.Visitas.Add(Visita);
	F.ProximaRevision = DiasRevision > 0 ? H.Dia + DiasRevision : DiasRevision == -2 ? H.Dia + DiasTratamiento() : -1;
	// si se fue a casa necesitando hospital, vuelve en cuanto empeora aunque no tenga cita
	if (NivelSeguridad == 2 && F.ProximaRevision <= 0) F.ProximaRevision = H.Dia + 3;
	bTerminada = true;
	H.Guardar();
	if (EMMDictado::Escuchando()) EMMDictado::Parar();
	const FString Cita = F.ProximaRevision > 0 ? FString::Printf(TEXT("Revisión: %s."), *FEMMHistorial::Fecha(F.ProximaRevision)) : FString(TEXT("Sin revisión."));
	Avisar(FString::Printf(TEXT("Consulta guardada (%s). %s %s"), *EMMEvolucion::NombreDestino(Visita.Destino), *Visita.Seguridad, *Cita), NivelSeguridad == 0);
	Actualizar();
}

// signos de alarma del triaje para el aviso de entrada (vacío si no hay)
static FString AvisoTriaje(const FEMMPaciente& P)
{
	const TArray<FString> A = EMMEvolucion::SignosAlarma(P);
	return A.Num() ? TEXT(" ALERTA DE TRIAJE: ") + FString::Join(A, TEXT(" · ")) + TEXT(".") : FString();
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
		FEMMPaciente C;
		if (!PacienteDeFicha(X, C)) continue;
		for (int32 D = FMath::Max(H.Dia + 1, X.UltimaVisita()->Dia + 2); D < X.ProximaRevision && (DiaAnticipado < 0 || D < DiaAnticipado); ++D)
		{
			const FEMMEvolucion E = EMMEvolucion::Calcular(C, X, D);
			if (E.Estado == TEXT("peor") || E.Estado == TEXT("complicacion")) { DiaAnticipado = D; Anticipada = &X; break; }
		}
	}
	const bool bAnticipada = Anticipada && DiaAnticipado < Cita;
	const int32 Destino = bAnticipada ? DiaAnticipado : Cita;
	if (bAnticipada) Anticipada->ProximaRevision = DiaAnticipado;
	const int32 Pasan = FMath::Max(0, Destino - H.Dia);
	H.Dia = FMath::Max(H.Dia, Destino);
	const FEMMFicha* F = bAnticipada ? Anticipada : H.RevisionPendiente();
	FEMMPaciente Caso;
	if (!F || !PacienteDeFicha(*F, Caso)) { H.Guardar(); Avisar(TEXT("No se encuentra el caso de la cita."), false); return; }
	IniciarVisita(Caso);
	if (bAnticipada)
	{
		Visita.bAnticipada = true;
		MemoriaPaciente = TEXT("Has pedido cita ANTES de la fecha de revisión porque te encuentras peor; empieza contándolo.\n") + MemoriaPaciente;
	}
	if (UIAgenda) UIAgenda->Cerrar();
	const FString Triaje = AvisoTriaje(Paciente);
	Avisar((bAnticipada
		? FString::Printf(TEXT("Han pasado %d días. %s ha pedido cita antes de tiempo: se encuentra peor (%s)."), Pasan, *Paciente.Nombre, *FEMMHistorial::Fecha(H.Dia))
		: FString::Printf(TEXT("Han pasado %d días. Hoy es %s y vuelve %s a revisión."), Pasan, *FEMMHistorial::Fecha(H.Dia), *Paciente.Nombre)) + Triaje, !bAnticipada && Triaje.IsEmpty());
}

void AEMMConsultaModo::PacienteNuevo()
{
	FEMMHistorial& H = FEMMHistorial::Get();
	H.Dia += 1;
	// si alguien tiene cita hoy, entra él; si no, una persona nueva (o una conocida con un problema nuevo)
	FEMMPaciente Siguiente;
	const FEMMFicha* Cita = H.RevisionPendiente();
	if (!(Cita && PacienteDeFicha(*Cita, Siguiente)) && !ElegirPacienteNuevo(Siguiente)) { H.Dia -= 1; Avisar(TEXT("No hay más pacientes disponibles hoy."), false); return; }
	IniciarVisita(Siguiente);
	const FString Triaje = AvisoTriaje(Paciente);
	Avisar(FString::Printf(TEXT("%s. Entra %s %s."), *FEMMHistorial::Fecha(H.Dia), *Paciente.Nombre, *Paciente.Apellidos) + Triaje, Triaje.IsEmpty());
}

void AEMMConsultaModo::MuestraRendimiento()
{
	if (FPlatformTime::Seconds() - UltimoCambio < 3.0) { FotogramasCarga.Add(float(FApp::GetDeltaTime())); return; }
	if (FPlatformTime::Seconds() - UltimaFoto < 1.0) return;
	Fotogramas.Add(float(FApp::GetDeltaTime()));
	MsJuego.Add(FPlatformTime::ToMilliseconds(GGameThreadTime));
	MsRender.Add(FPlatformTime::ToMilliseconds(GRenderThreadTime));
	MsGPU.Add(FPlatformTime::ToMilliseconds(RHIGetGPUFrameCycles()));
}

void AEMMConsultaModo::Foto(const FString& Nombre)
{
	UltimaFoto = FPlatformTime::Seconds();
	FScreenshotRequest::RequestScreenshot(FPaths::ProjectSavedDir() / TEXT("Capturas") / (Nombre + TEXT(".png")), true, false);
	RegistroPrueba.Add(FString::Printf(TEXT("[foto] %s"), *Nombre));
}

void AEMMConsultaModo::PasoDePrueba()
{
	// guion: espera a la IA, dos preguntas del médico con su respuesta, fotos mientras habla el paciente
	static const TCHAR* Preguntas[] = { TEXT("Buenos días. ¿Qué le trae por aquí?"), TEXT("¿Ha tenido fiebre?"), TEXT("¿Desde cuándo le pasa?") };
	const double T = FPlatformTime::Seconds() - InicioPaso;
	auto Siguiente = [this]() { ++PasoPrueba; InicioPaso = FPlatformTime::Seconds(); };
	// -EMMVoces: la voz de cada persona distinta de los casos (y de médico y médica) con tres frases: se guarda en
	// Saved/Voces/<nombre>_<n>.wav ya igualada, como suena en el juego, con su nivel (RMS y pico) y su ritmo
	if (PasoPrueba >= 600)
	{
		struct FVozPrueba { FString Nombre; bool bMujer; float Edad; uint32 Semilla; };
		static TArray<FVozPrueba> Lista;
		static TSharedPtr<FEMMAudio> Hecho;
		static bool bEsperando = false;
		static const TCHAR* FrasesNino[] = { TEXT("Me duele mucho la garganta y no puedo tragar."), TEXT("Empezó el lunes, cuando volví del colegio."), TEXT("Sí, tengo un poco de fiebre y me pica la cabeza.") };
		static const TCHAR* FrasesAdulto[] = { TEXT("Buenos días, doctor. Vengo porque me duele la garganta."), TEXT("Empezó hace tres días, más o menos."), TEXT("Sí, anoche tuve treinta y ocho de fiebre.") };
		if (PasoPrueba == 600)
		{
			Lista.Reset();
			Lista.Add({ TEXT("Medico"), false, 40.f, 0 });
			Lista.Add({ TEXT("Medica"), true, 40.f, 0 });
			TSet<FString> Vistos;
			for (const FEMMPaciente& C : Casos)
				if (!Vistos.Contains(C.Nombre + C.Apellidos)) { Vistos.Add(C.Nombre + C.Apellidos); Lista.Add({ (C.Nombre + TEXT("_") + C.Apellidos).Replace(TEXT(" "), TEXT("_")), C.EsMujer(), C.Edad, GetTypeHash(C.Id) | 1u }); }
			RegistroPrueba.Add(FString::Printf(TEXT("VOCES: %d personas × 3 frases → Saved/Voces"), Lista.Num()));
			bEsperando = false;
			Siguiente();
			return;
		}
		const int32 K = PasoPrueba - 601, I = K / 3, F = K % 3;
		if (I >= Lista.Num()) { PasoPrueba = 100; return; }
		const FVozPrueba& V = Lista[I];
		const FEMMPerfilVoz Perfil = EMMVoz::PerfilPara(V.bMujer, V.Edad, V.Semilla);
		const FString Frase = V.Edad < 13.f ? FrasesNino[F] : FrasesAdulto[F];
		if (!bEsperando)
		{
			bEsperando = true; Hecho.Reset();
			EMMVoz::Sintetizar(Frase, Perfil, [](TSharedPtr<FEMMAudio> A) { Hecho = A.IsValid() ? A : MakeShared<FEMMAudio>(); });
			return;
		}
		if (!Hecho.IsValid()) return;
		bEsperando = false;
		FEMMAudio& A = *Hecho;
		auto Nivel = [](const TArray<uint8>& P, double& Rms, double& Pico) {
			const int16* S = reinterpret_cast<const int16*>(P.GetData()); const int32 N = P.Num() / 2;
			double Suma = 0; int32 C = 0; Pico = 0;
			for (int32 i = 0; i < N; ++i) { const double X = FMath::Abs(S[i] / 32768.0); Pico = FMath::Max(Pico, X); if (X > 0.01) { Suma += X * X; ++C; } }
			Rms = C ? FMath::Sqrt(Suma / C) : 0;
		};
		double Rms0 = 0, Pico0 = 0, Rms1 = 0, Pico1 = 0;
		Nivel(A.PCM, Rms0, Pico0);
		UEMMHabla::Igualar(A.PCM);
		Nivel(A.PCM, Rms1, Pico1);
		// WAV (mono, 16 bits) a la frecuencia a la que suena en el juego
		TArray<uint8> W;
		auto Pon32 = [&W](uint32 X) { W.Append(reinterpret_cast<uint8*>(&X), 4); };
		auto Pon16 = [&W](uint16 X) { W.Append(reinterpret_cast<uint8*>(&X), 2); };
		W.Append((const uint8*)"RIFF", 4); Pon32(36 + A.PCM.Num()); W.Append((const uint8*)"WAVEfmt ", 8);
		Pon32(16); Pon16(1); Pon16(1); Pon32(A.Frecuencia); Pon32(A.Frecuencia * 2); Pon16(2); Pon16(16);
		W.Append((const uint8*)"data", 4); Pon32(A.PCM.Num()); W.Append(A.PCM);
		FFileHelper::SaveArrayToFile(W, *(FPaths::ProjectSavedDir() / TEXT("Voces") / FString::Printf(TEXT("%s_%d.wav"), *V.Nombre, F + 1)));
		int32 Palabras = 0; { TArray<FString> P; Frase.ParseIntoArrayWS(P); Palabras = P.Num(); }
		RegistroPrueba.Add(FString::Printf(TEXT("  %s (%s, %.0f años) · voz %s · tono %.2f · vel %.2f · %.1f s (%.1f palabras/s) · RMS %.3f→%.3f · pico %.2f→%.2f%s"),
			*V.Nombre, V.bMujer ? TEXT("mujer") : TEXT("hombre"), V.Edad, Perfil.Piper.IsEmpty() ? *Perfil.Preferida : *Perfil.Piper, Perfil.Tono, Perfil.Vel,
			A.Duracion, A.Duracion > 0 ? Palabras / A.Duracion : 0.f, Rms0, Rms1, Pico0, Pico1, A.Error.IsEmpty() ? TEXT("") : *(TEXT(" · ERROR ") + A.Error)));
		Siguiente();
		return;
	}
	// -EMMModos: las cuatro combinaciones MÉDICO YO/IA × PACIENTE YO/IA, por turnos y con los mismos botones que el
	// jugador (lo de YO se escribe en la caja); después de cada una se comprueba que nadie habla solo, y en la cuarta
	// que DETENER corta la espera de la IA sin pasar el turno
	if (PasoPrueba >= 500)
	{
		struct FModoPrueba { bool bMedIA, bPacIA; const TCHAR* Nombre; int32 Rondas; };
		static const FModoPrueba Modos[] = {
			{ false, true, TEXT("MODO 1 · MÉDICO YO / PACIENTE IA"), 2 }, { true, false, TEXT("MODO 2 · MÉDICO IA / PACIENTE YO"), 2 },
			{ false, false, TEXT("MODO 3 · MÉDICO YO / PACIENTE YO"), 2 }, { true, true, TEXT("MODO 4 · MÉDICO IA / PACIENTE IA"), 3 } };
		static const TCHAR* DiceMedico[] = { TEXT("Buenos días, soy el doctor Prieto. ¿Qué le trae por aquí?"), TEXT("¿Desde cuándo le pasa?"), TEXT("¿Ha tenido fiebre?") };
		static const TCHAR* DicePaciente[] = { TEXT("Buenos días, doctor. Llevo unos días con dolor de garganta."), TEXT("Empezó hace tres días, más o menos."), TEXT("Sí, anoche tuve treinta y ocho.") };
		static int32 NumAntes = 0;
		const int32 K = PasoPrueba - 500, M = K / 20, S = K % 20;
		if (M >= int32(UE_ARRAY_COUNT(Modos))) { PasoPrueba = 100; return; }
		const FModoPrueba& Md = Modos[M];
		auto Ultima = [this](const TCHAR* Quien) {
			const FEMMLinea& L = Charla.Last();
			RegistroPrueba.Add(FString::Printf(TEXT("  %s [%s, %.1f s]: %s"), Quien, L.Origen.IsEmpty() ? TEXT("jugador") : *L.Origen, FPlatformTime::Seconds() - InicioPaso, *L.Texto));
		};
		const int32 R = (S - 1) / 4, Fase = (S - 1) % 4;
		if (S == 0)
		{
			if (bOcupado || T < 1.0) return;
			bMedicoIA = Md.bMedIA; bPacienteIA = Md.bPacIA; bTurnoPaciente = false;
			Charla.Reset();
			Actualizar();
			RegistroPrueba.Add(FString::Printf(TEXT("%s (IA: %s)"), Md.Nombre, *IA()->Descripcion()));
			Foto(FString::Printf(TEXT("modos_%d_controles"), M + 1));
			Siguiente();
		}
		else if (R < Md.Rondas)
		{
			if (T > 150.0) { RegistroPrueba.Add(FString::Printf(TEXT("  FALLO: el turno no termina (paso %d)"), S)); PasoPrueba = 500 + (M + 1) * 20; return; }
			if (Fase == 0 && T > 0.5)
			{
				if (!bMedicoIA) UI->PonerTexto(DiceMedico[R]);
				PulsarMedico();
				Siguiente();
			}
			else if (Fase == 1)
			{
				if (R == 0 && T > 1.2 && T < 1.4) Foto(FString::Printf(TEXT("modos_%d_habla_medico"), M + 1));
				if (!bOcupado && bTurnoPaciente) { Ultima(TEXT("MÉDICO")); Siguiente(); }
			}
			else if (Fase == 2 && T > 0.5)
			{
				if (!bPacienteIA) UI->PonerTexto(DicePaciente[R]);
				PulsarPaciente();
				Siguiente();
			}
			else if (Fase == 3)
			{
				if (R == 0 && T > 1.2 && T < 1.4) Foto(FString::Printf(TEXT("modos_%d_habla_paciente"), M + 1));
				if (!bOcupado && !bTurnoPaciente) { Ultima(bHablaAcompanante ? TEXT("ACOMPAÑANTE") : TEXT("PACIENTE")); NumAntes = Charla.Num(); Siguiente(); }
			}
		}
		else if (S == 1 + 4 * Md.Rondas)
		{
			// nadie habla solo: 6 s sin pulsar nada
			if (T < 6.0) return;
			RegistroPrueba.Add(FString::Printf(TEXT("  Sin pulsar nada en 6 s: %s"), Charla.Num() == NumAntes && !bOcupado ? TEXT("nadie habla solo (bien)") : TEXT("FALLO: alguien ha hablado solo")));
			if (!Md.bMedIA || !Md.bPacIA) { PasoPrueba = 500 + (M + 1) * 20; InicioPaso = FPlatformTime::Seconds(); return; }
			// DETENER mientras la IA del médico piensa
			PulsarMedico();
			Siguiente();
		}
		else if (S == 2 + 4 * Md.Rondas)
		{
			if (T < 0.4) return;
			const bool bPensabaAntes = bPensando;
			Detener();
			RegistroPrueba.Add(FString::Printf(TEXT("  DETENER con la IA pensando (%s): %s"), bPensabaAntes ? TEXT("sí pensaba") : TEXT("ya no pensaba"),
				!bOcupado && !bTurnoPaciente && Charla.Num() == NumAntes ? TEXT("se corta y el turno sigue en el médico (bien)") : TEXT("FALLO")));
			Siguiente();
		}
		else if (T > 8.0)
		{
			// lo que la IA iba a decir no llega tarde
			RegistroPrueba.Add(FString::Printf(TEXT("  8 s después de DETENER: %s"), Charla.Num() == NumAntes && !bOcupado ? TEXT("no ha hablado nadie (bien)") : TEXT("FALLO: ha llegado la respuesta cortada")));
			Foto(FString::Printf(TEXT("modos_%d_fin"), M + 1));
			PasoPrueba = 500 + (M + 1) * 20; InicioPaso = FPlatformTime::Seconds();
		}
		return;
	}
	// -EMMCreador: el creador de personajes con el médico (otra cara, nombre, pelo y peinado) y con la paciente de
	// la consulta (nombre, edad, piel, ojos y peinado); fotos de la ventana y de la consulta, y vuelta a lo original
	if (PasoPrueba >= 400)
	{
		const int32 K = PasoPrueba - 400;
		if (T < 1.5) return;
		const int32 IPac = FEMMHistorial::Get().Plantilla.IndexOfByPredicate([&](const FEMMPersona& P) { return P.Id == Paciente.Id; });
		switch (K)
		{
		case 0:
			Foto(TEXT("creador_antes"));
			AbrirCreador();
			UICreador->Elegir(-1);
			RegistroPrueba.Add(TEXT("CREADOR · médico al abrir: ") + UICreador->Resumen());
			break;
		case 1:
			// médica: cara de mujer, otro nombre, pelo rubio y el peinado de otro MetaHuman
			UICreador->PonerNombre(TEXT("Ana"), TEXT("García Ruiz"));
			UICreador->Cambiar(TEXT("sexo"), 1);
			UICreador->Cambiar(TEXT("pelo"), 5);
			UICreador->Cambiar(TEXT("peinado"), 3);
			RegistroPrueba.Add(TEXT("CREADOR · médico elegido: ") + UICreador->Resumen());
			Foto(TEXT("creador_ventana_medico"));
			break;
		case 2:
			RegistroPrueba.Add(TEXT("CREADOR · guardar médico: ") + UICreador->Guardar());
			RegistroPrueba.Add(FString::Printf(TEXT("CREADOR · receta firmada por: %s (%s)"), *NombreMedico(), *FirmaMedico()));
			break;
		case 3:
			UICreador->Elegir(IPac);
			UICreador->PonerNombre(TEXT("Rosa"), TEXT("Martín Vega"));
			UICreador->Cambiar(TEXT("piel"), 3);
			UICreador->Cambiar(TEXT("ojos"), 4);
			UICreador->Cambiar(TEXT("pelo"), 6);
			UICreador->Cambiar(TEXT("peinado"), 5);
			RegistroPrueba.Add(TEXT("CREADOR · paciente elegido: ") + UICreador->Resumen());
			Foto(TEXT("creador_ventana_paciente"));
			break;
		case 4:
			RegistroPrueba.Add(TEXT("CREADOR · guardar paciente: ") + UICreador->Guardar());
			UICreador->Cerrar();
			break;
		case 5:
			if (T < 3.0) return;
			Foto(TEXT("creador_despues"));
			RegistroPrueba.Add(FString::Printf(TEXT("CREADOR · en la consulta: %s y %s %s (%s); peinados %d, barbas %d, bigotes %d"), *NombreMedico(), *Paciente.Nombre, *Paciente.Apellidos,
				*Paciente.TextoEdad, EMMAspecto::Peinados().Num(), EMMAspecto::Barbas().Num(), EMMAspecto::Bigotes().Num()));
			break;
		case 6:
			// vuelta a lo original (la prueba no deja nada cambiado)
			AplicarCreador(-1, TEXT("Lorenzo"), FEMMAspecto());
			if (IPac >= 0) AplicarCreador(IPac, FEMMHistorial::Get().Plantilla[IPac].Personaje, FEMMAspecto());
			break;
		default:
			PasoPrueba = 100;
			return;
		}
		Siguiente();
		return;
	}
	// -EMMTodos: cada persona de la plantilla entra, el médico le pregunta, contesta con la IA (foto mientras habla)
	// y se guarda su ficha con revisión; al final se avanza el tiempo y vuelve quien tenga la primera cita
	if (PasoPrueba >= 200 && PasoPrueba < 400)
	{
		FEMMHistorial& H = FEMMHistorial::Get();
		const int32 K = PasoPrueba - 200, I = K / 4, Fa = K % 4;
		if (Fa >= 1) MuestraRendimiento();   // rendimiento con cada paciente en la silla
		if (H.Plantilla.IsValidIndex(I))
		{
			const FEMMPersona& Per = H.Plantilla[I];
			if (Fa == 0 && T > 0.5)
			{
				if (bOcupado) return;
				// -EMMSoloNinos: sólo los niños y bebés (para ajustar su postura y su sitio sin esperar a todos)
				const FEMMPersonaje* PX = Personajes.FindByPredicate([&](const FEMMPersonaje& Y) { return Y.Nombre == Per.Personaje; });
				if (FParse::Param(FCommandLine::Get(), TEXT("EMMSoloNinos")) && (!PX || !PX->bNino)) { PasoPrueba += 4; return; }
				const FEMMPaciente* C = Casos.FindByPredicate([&](const FEMMPaciente& X) { return X.Id == Per.CasoInicial; });
				if (!C) { RegistroPrueba.Add(TEXT("ERROR: sin caso para ") + Per.Personaje); PasoPrueba += 4; return; }
				IniciarVisita(PacienteDe(Per, *C, nullptr));
				const FEMMPersonaje* X = PersonajePara(Paciente);
				const FEMMPersonaje* Ac = MHAcompanante.IsValid() ? AcompananteDe(Paciente) : nullptr;
				RegistroPrueba.Add(FString::Printf(TEXT("=== %s · personaje %s · %s %s, %s, %s · %s · carácter: %s · voz %s tono %.2f%s"), *Per.Id, X ? *X->Nombre : TEXT("?"), *Paciente.Nombre, *Paciente.Apellidos,
					*Paciente.TextoEdad, Paciente.EsMujer() ? TEXT("mujer") : TEXT("hombre"), *Paciente.Enfermedad, *Paciente.Personalidad, HablaPaciente->VozPiper.IsEmpty() ? *HablaPaciente->VozPreferida : *(TEXT("Piper ") + HablaPaciente->VozPiper), HablaPaciente->Tono,
					Ac ? *FString::Printf(TEXT(" · viene con %s (%s)%s"), *Paciente.Acompanante, *Ac->Nombre, bHablaAcompanante ? *(TEXT(" · contesta: ") + HablaPaciente->Nombre) : TEXT(" · contesta el niño")) : TEXT("")));
				Siguiente();
			}
			else if (Fa == 1 && T > 1.5 && !bOcupado && !bTurnoPaciente) { HablarMedico(TEXT("Buenos días. Cuénteme, ¿qué le pasa?")); Siguiente(); }
			else if (Fa == 2 && !bOcupado && bTurnoPaciente) { ResponderPaciente(); Siguiente(); }
			else if (Fa == 3)
			{
				if (HablaPaciente->bHablando && !RegistroPrueba.Last().StartsWith(TEXT("[foto]"))) Foto(FString::Printf(TEXT("todos_%02d_%s"), I + 1, *Per.Personaje));
				if (!bOcupado && !bTurnoPaciente)
				{
					RegistroPrueba.Add(FString::Printf(TEXT("PACIENTE [%s]: %s"), *Charla.Last().Origen, *Charla.Last().Texto));
					TerminarConsulta(Paciente.Enfermedad, FString(), 7 + I, Paciente.Destino == TEXT("casa") ? TEXT("casa") : TEXT("urgencias"));   // revisiones escalonadas
					if (const FEMMFicha* Fi = Ficha(); Fi && Fi->UltimaVisita())
						RegistroPrueba.Add(FString::Printf(TEXT("DESTINO: %s · %s%s"), *EMMEvolucion::NombreDestino(Fi->UltimaVisita()->Destino), *Fi->UltimaVisita()->Seguridad, *AvisoTriaje(Paciente)));
					Siguiente();
				}
				if (T > 120) { RegistroPrueba.Add(TEXT("ERROR: tiempo agotado")); Siguiente(); }
			}
			return;
		}
		// todos vistos: fichas guardadas y vuelve el primero con cita, recordando su visita
		const int32 J = K - H.Plantilla.Num() * 4;
		if (J == 0)
		{
			int32 ConFicha = 0; for (const FEMMPersona& P : H.Plantilla) if (H.Buscar(P.Id)) ++ConFicha;
			TSet<FString> Caras; for (const FEMMPersona& P : H.Plantilla) Caras.Add(P.Personaje);
			RegistroPrueba.Add(FString::Printf(TEXT("RESUMEN: %d personas en la plantilla, %d caras distintas, %d con ficha guardada"), H.Plantilla.Num(), Caras.Num(), ConFicha));
			// seguridad de urgencias en todos los casos: quien necesita hospital y se va a casa debe dar aviso y
			// empeorar; derivado, debe volver de alta; y quien no lo necesita no debe dar aviso por ir a casa
			{
				int32 Hosp = 0, Fallos = 0, ConAlarma = 0;
				for (const FEMMPaciente& C : Casos)
				{
					if (EMMEvolucion::SignosAlarma(C).Num()) ++ConAlarma;
					int32 NCasa = 0, NDerivar = 0;
					EMMEvolucion::ValorarDestino(C, TEXT("casa"), NCasa);
					EMMEvolucion::ValorarDestino(C, TEXT("urgencias"), NDerivar);
					const bool bNecesita = C.Destino != TEXT("casa");
					FEMMFicha Fx; FEMMVisita Vx; Vx.Dia = 1;
					Vx.Destino = TEXT("casa"); Fx.Visitas = { Vx };
					const FEMMEvolucion EnCasa = EMMEvolucion::Calcular(C, Fx, 4);
					Fx.Visitas[0].Destino = TEXT("urgencias");
					const FEMMEvolucion Derivado = EMMEvolucion::Calcular(C, Fx, 15);
					bool bMal = false;
					if (bNecesita)
					{
						++Hosp;
						bMal = NCasa != 2 || NDerivar != 0 || !(EnCasa.Estado == TEXT("peor") || EnCasa.Estado == TEXT("complicacion")) || Derivado.Estado == TEXT("complicacion") || Derivado.Estado == TEXT("peor");
					}
					else bMal = NCasa != 0 || NDerivar != 1;
					if (bMal && ++Fallos <= 5)
						RegistroPrueba.Add(FString::Printf(TEXT("ERROR SEGURIDAD: %s (%s, %s) casa=%d derivar=%d · en casa: %s · derivado: %s"), *C.Id, *C.Destino, *C.Prioridad, NCasa, NDerivar, *EnCasa.Estado, *Derivado.Estado));
				}
				RegistroPrueba.Add(FString::Printf(TEXT("SEGURIDAD: %d casos, %d necesitan hospital o cirugía, %d con alerta de triaje, %d fallos"), Casos.Num(), Hosp, ConAlarma, Fallos));
			}
			AvanzarTiempo();
			RegistroPrueba.Add(FString::Printf(TEXT("VUELVE %s %s (%s) el %s; revisión=%s"), *Paciente.Nombre, *Paciente.Apellidos, *Paciente.Id, *FEMMHistorial::Fecha(H.Dia), Visita.bRevision ? TEXT("sí") : TEXT("no")));
			Siguiente();
		}
		else if (J == 1 && T > 1.0 && !bOcupado && !bTurnoPaciente) { HablarMedico(TEXT("Hola otra vez. ¿Recuerda qué le pasaba la última vez y cómo sigue?")); Siguiente(); }
		else if (J == 2 && !bOcupado && bTurnoPaciente) { ResponderPaciente(); Siguiente(); }
		else if (J == 3 && !bOcupado && !bTurnoPaciente) { RegistroPrueba.Add(FString::Printf(TEXT("PACIENTE [%s]: %s"), *Charla.Last().Origen, *Charla.Last().Texto)); PasoPrueba = 100; }
		return;
	}
	const int32 Ronda = (PasoPrueba - 2) / 3, Fase = (PasoPrueba - 2) % 3;
	// rendimiento en juego: durante las conversaciones (no las cargas de personajes ni las vistas de revisión)
	if ((PasoPrueba >= 2 && PasoPrueba <= 10) || (PasoPrueba >= 16 && PasoPrueba <= 21)) MuestraRendimiento();
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
			// voces neuronales Piper: una frase con cada una (fonemas, tiempo, tono medio) y su WAV para escucharla
			{
				const FString Frase = TEXT("Buenos días, doctor. Me duele mucho la garganta desde hace tres días y tengo 38,5 de fiebre.");
				RegistroPrueba.Add(TEXT("Fonemas: ") + EMMFonetica::Fonemas(Frase));
				RegistroPrueba.Add(TEXT("Fonemas (abreviaturas y enlaces): ") + EMMFonetica::Fonemas(TEXT("El Dr. García le da ibuprofeno 600 mg/8 h y/o paracetamol; 38,5 °C, ECG normal. Vuelva el 2.º día a las 8:30, con dolor o sin él; un beso, con gripe.")));
				for (const EMMPiper::FVozPiper& V : EMMPiper::Voces())
				{
					FEMMPerfilVoz Pf; Pf.Piper = V.Id;
					FEMMAudio A;
					const double T0 = FPlatformTime::Seconds();
					const bool bOk = EMMPiper::Sintetizar(Frase, Pf, A);
					const double Ms = (FPlatformTime::Seconds() - T0) * 1000.0;
					// tono medio (F0) por autocorrelación en tramos con voz
					TArray<float> F0;
					const int16* M = reinterpret_cast<const int16*>(A.PCM.GetData());
					const int32 N = A.PCM.Num() / 2, Tramo = FMath::Max(1, A.Frecuencia / 25);
					for (int32 Ini = 0; Ini + Tramo * 2 < N; Ini += Tramo)
					{
						double E = 0; for (int32 i = 0; i < Tramo; ++i) E += double(M[Ini + i]) * M[Ini + i];
						if (E / Tramo < 300.0 * 300.0) continue;
						double Mejor = 0; int32 Lag = 0;
						for (int32 L = A.Frecuencia / 400; L < A.Frecuencia / 60; ++L)
						{
							double R = 0; for (int32 i = 0; i < Tramo; ++i) R += double(M[Ini + i]) * M[Ini + i + L];
							if (R / E > Mejor) { Mejor = R / E; Lag = L; }
						}
						if (Mejor > 0.5 && Lag) F0.Add(float(A.Frecuencia) / Lag);
					}
					F0.Sort();
					const float Mediana = F0.Num() ? F0[F0.Num() / 2] : 0.f;
					RegistroPrueba.Add(FString::Printf(TEXT("VOZ PIPER %s (sexo %s): %s · %.0f ms para %.1f s de audio · tono medio %.0f Hz"), *V.Id, *V.Sexo, bOk ? TEXT("bien") : *(TEXT("FALLO ") + A.Error), Ms, A.Duracion, Mediana));
					if (bOk)
					{
						// WAV (PCM 16 bits mono) para escucharla
						TArray<uint8> W;
						auto Num = [&W](uint32 X, int32 B) { for (int32 i = 0; i < B; ++i) W.Add(uint8((X >> (8 * i)) & 0xFF)); };
						W.Append((const uint8*)"RIFF", 4); Num(36 + A.PCM.Num(), 4); W.Append((const uint8*)"WAVEfmt ", 8); Num(16, 4); Num(1, 2); Num(1, 2);
						Num(A.Frecuencia, 4); Num(A.Frecuencia * 2, 4); Num(2, 2); Num(16, 2); W.Append((const uint8*)"data", 4); Num(A.PCM.Num(), 4); W.Append(A.PCM);
						FFileHelper::SaveArrayToFile(W, *(FPaths::ProjectSavedDir() / TEXT("Voces") / (V.Id + TEXT(".wav"))));
					}
				}
			}
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
			if (FParse::Param(FCommandLine::Get(), TEXT("EMMTodos"))) PasoPrueba = 200;            // todos los pacientes de la plantilla
			if (FParse::Param(FCommandLine::Get(), TEXT("EMMCreador"))) PasoPrueba = 400;          // el creador de personajes
			if (FParse::Param(FCommandLine::Get(), TEXT("EMMModos"))) PasoPrueba = 500;            // MÉDICO y PACIENTE: YO / IA
			if (FParse::Param(FCommandLine::Get(), TEXT("EMMVoces"))) PasoPrueba = 600;            // voces y volumen de todos
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
	else if (PasoPrueba < 100)
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
				VestirPersonajes(Falso);
				const FEMMPerfilVoz VP = EMMVoz::PerfilPara(Falso.EsMujer(), Falso.Edad, GetTypeHash(X.Nombre) | 1u);
				HablaPaciente->bMujer = VP.bMujer; HablaPaciente->Tono = VP.Tono; HablaPaciente->Velocidad = VP.Vel; HablaPaciente->VozPreferida = VP.Preferida;
				HablaPaciente->Nombre = X.Nombre;
				RegistroPrueba.Add(FString::Printf(TEXT("PERSONAJE %s (%s, %.0f años): voz %s, tono %.2f, velocidad %.2f"), *X.Nombre, Falso.EsMujer() ? TEXT("mujer") : TEXT("hombre"), Falso.Edad, VP.Piper.IsEmpty() ? *VP.Preferida : *(TEXT("Piper ") + VP.Piper), VP.Tono, VP.Vel));
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
			const float Peor1 = Fotogramas[FMath::Min(Fotogramas.Num() - 1, int32(Fotogramas.Num() * 0.99f))], Mediana = Fotogramas[Fotogramas.Num() / 2];
			int32 Bajos = 0; for (float D : Fotogramas) Bajos += D > 1.f / 30.f;
			float PeorCarga = 0; for (float D : FotogramasCarga) PeorCarga = FMath::Max(PeorCarga, D);
			RegistroPrueba.Add(FString::Printf(TEXT("Rendimiento estable: mediana %.0f fps, 1 %% peor %.0f fps, %.1f %% de fotogramas por debajo de 30 fps · cambios de paciente: %d muestras, fotograma más lento %.0f ms"),
				1.f / Mediana, 1.f / Peor1, 100.f * Bajos / Fotogramas.Num(), FotogramasCarga.Num(), PeorCarga * 1000.f));
			RegistroPrueba.Add(FString::Printf(TEXT("Rendimiento: %.0f fps de media, %.0f fps en el 5 %% peor (%d muestras; %s; calidad %s)"), 1.f / Media, 1.f / Peor, Fotogramas.Num(), *FPlatformMisc::GetPrimaryGPUBrand(), *UEMMConsultaUI::NombreCalidad(UEMMConsultaUI::CalidadGrafica())));
			auto MediaDe = [](const TArray<float>& A) { float S = 0; for (float X : A) S += X; return A.Num() ? S / A.Num() : 0.f; };
			FTextureMemoryStats Mem;
			RHIGetTextureMemoryStats(Mem);
			RegistroPrueba.Add(FString::Printf(TEXT("Reparto del fotograma (ms de media): juego %.1f · render %.1f · GPU %.1f · texturas en GPU %.0f MB (streaming %.0f MB, fijas %.0f MB, límite del grupo %.0f MB) de %.0f MB de vídeo"),
				MediaDe(MsJuego), MediaDe(MsRender), MediaDe(MsGPU), (Mem.StreamingMemorySize + Mem.NonStreamingMemorySize) / 1048576.0, Mem.StreamingMemorySize / 1048576.0, Mem.NonStreamingMemorySize / 1048576.0, Mem.TexturePoolSize / 1048576.0, Mem.DedicatedVideoMemory / 1048576.0));
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
	// se dicta para quien tiene el turno, si lo controla el jugador (YO)
	if (bOcupado || bTerminada || (bTurnoPaciente ? bPacienteIA : bMedicoIA)) return;
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
		UI->Aviso(bTurnoPaciente ? TEXT("Escuchando… Habla y pulsa PARAR al acabar. Revisa el texto y pulsa HABLAR PACIENTE.")
			: TEXT("Escuchando… Habla y pulsa PARAR al acabar. Revisa el texto y pulsa HABLAR MÉDICO."), true);
	}
}

void AEMMConsultaModo::Actualizar()
{
	if (!UI) return;
	// quién tiene el turno, quién habla y qué hay que pulsar (el acompañante contesta por bebés y niños pequeños)
	const FString Quien = bHablaAcompanante ? TEXT("ACOMPAÑANTE") : TEXT("PACIENTE");
	FString Estado;
	if (bTerminada) Estado = TEXT("Consulta terminada y guardada. En AGENDA · FICHA puedes avanzar el tiempo o recibir a otro paciente.");
	else if (bPensando) Estado = bTurnoPaciente ? FString::Printf(TEXT("Turno del %s (IA): está pensando qué responder… (DETENER para cortar)"), *Quien)
		: TEXT("Turno del MÉDICO (IA): está pensando qué decir… (DETENER para cortar)");
	else if (bOcupado) Estado = bTurnoPaciente ? FString::Printf(TEXT("Habla el %s…"), *Quien) : TEXT("Habla el MÉDICO…");
	else if (bTurnoPaciente) Estado = bPacienteIA ? FString::Printf(TEXT("Turno del %s (IA): pulsa RESPONDER PACIENTE para que conteste."), *Quien)
		: FString::Printf(TEXT("Turno del %s (tú): escribe o dicta lo que responde y pulsa HABLAR PACIENTE."), *Quien);
	else Estado = bMedicoIA ? TEXT("Turno del MÉDICO (IA): pulsa HABLAR MÉDICO para que pregunte.")
		: TEXT("Turno del MÉDICO (tú): escribe o dicta lo que dice y pulsa HABLAR MÉDICO.");
	UI->PonerEstado(Estado, bTurnoPaciente);
	UI->PonerIA(IA()->Descripcion());
	UI->PonerControles(bMedicoIA, bPacienteIA, bTurnoPaciente, bOcupado, bTerminada, bHablaAcompanante);
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

void AEMMConsultaModo::PulsarMedico()
{
	if (bMedicoIA) HablarMedicoIA();
	else HablarMedico(UI->TextoEscrito());
}

void AEMMConsultaModo::PulsarPaciente() { ResponderPaciente(); }

void AEMMConsultaModo::CambiarControl(bool bDelMedico)
{
	if (EMMDictado::Escuchando()) EMMDictado::Parar();
	bool& B = bDelMedico ? bMedicoIA : bPacienteIA;
	B = !B;
	UE_LOG(LogTemp, Display, TEXT("[EMM] Control: %s pasa a %s"), bDelMedico ? TEXT("MÉDICO") : TEXT("PACIENTE"), B ? TEXT("IA") : TEXT("YO"));
	if (FParse::Param(FCommandLine::Get(), TEXT("EMMPrueba"))) RegistroPrueba.Add(FString::Printf(TEXT("  (selector %s cambiado a %s durante la prueba)"), bDelMedico ? TEXT("MÉDICO") : TEXT("PACIENTE"), B ? TEXT("IA") : TEXT("YO")));
	// las pruebas automáticas no tocan la elección del jugador
	if (!FParse::Param(FCommandLine::Get(), TEXT("EMMPrueba"))) UEMMConsultaUI::GuardarOpcion(bDelMedico ? TEXT("MedicoIA") : TEXT("PacienteIA"), B);
	UI->Aviso(FString::Printf(TEXT("%s: %s."), bDelMedico ? TEXT("MÉDICO") : TEXT("PACIENTE"), B ? TEXT("lo controla la IA (habla al pulsar su botón)") : TEXT("lo controlas tú (escribe o dicta)")), true);
	Actualizar();
}

void AEMMConsultaModo::CambiarTurno()
{
	if (bOcupado || bTerminada) return;
	if (EMMDictado::Escuchando()) EMMDictado::Parar();
	bTurnoPaciente = !bTurnoPaciente;
	Actualizar();
	UI->EnfocarPrincipal();
}

void AEMMConsultaModo::Detener()
{
	if (EMMDictado::Escuchando()) EMMDictado::Parar();
	if (!bOcupado) return;
	++Epoca;   // la respuesta de la IA que esté en camino ya no se usa
	if (bPensando)
	{
		// esperando a la IA: el turno se queda donde estaba (se puede volver a pulsar o cambiar a YO)
		bPensando = false;
		bOcupado = false;
		Actualizar();
		UI->Aviso(TEXT("Detenido. El turno sigue donde estaba."), true);
		return;
	}
	// hablando: se corta la frase y el turno pasa al otro, como si la hubiera terminado
	if (IsValid(Medico)) Medico->Detener();
	if (IsValid(HablaPaciente)) HablaPaciente->Detener();
}

void AEMMConsultaModo::HablarMedicoIA()
{
	if (bOcupado || bTurnoPaciente || bTerminada) return;
	if (EMMDictado::Escuchando()) EMMDictado::Parar();
	bOcupado = bPensando = true;
	Actualizar();
	FEMMPaciente P = PacienteParaIA();
	P.bHablaAcomp = bHablaAcompanante;
	const bool bMedicaMujer = MHMedico.IsValid() && MHMedico->ActorHasTag(TEXT("Mujer"));
	const int32 E = Epoca;
	TWeakObjectPtr<AEMMConsultaModo> Yo(this);
	IA()->ResponderMedico(P, NombreMedico(), bMedicaMujer, Charla, [Yo, E](const FEMMRespuesta& R) {
		if (!Yo.IsValid() || Yo->Epoca != E) return;
		Yo->bPensando = false;
		Yo->Charla.Add({ true, R.Texto, R.Origen });
		if (R.Origen != TEXT("ia") && Yo->IA()->Modo != EEMMModoIA::Predefinida)
			Yo->UI->Aviso(FString::Printf(TEXT("IA no disponible (%s). El médico hace la pregunta guiada."), *R.Error), false);
		Yo->Actualizar();
		Yo->Decir(Yo->Medico, Yo->Medico->Nombre, R.Texto, true, [Yo]() {
			if (!Yo.IsValid()) return;
			Yo->bOcupado = false; Yo->bTurnoPaciente = true;
			Yo->Actualizar();
			Yo->UI->EnfocarPrincipal();
		});
	});
}

void AEMMConsultaModo::ResponderPaciente()
{
	if (bOcupado || !bTurnoPaciente || bTerminada) return;
	if (EMMDictado::Escuchando()) EMMDictado::Parar();
	TWeakObjectPtr<AEMMConsultaModo> Yo(this);
	if (!bPacienteIA)
	{
		// PACIENTE: YO: el paciente (o su acompañante) dice exactamente lo escrito o dictado, con su voz
		const FString Texto = UI->TextoEscrito();
		if (Texto.IsEmpty()) { UI->Aviso(TEXT("Escribe o dicta primero lo que responde el paciente."), false); return; }
		Charla.Add({ false, Texto, TEXT("jugador") });
		UI->LimpiarTexto();
		bOcupado = true;
		Actualizar();
		Decir(HablaPaciente, HablaPaciente->Nombre, Texto, false, [Yo]() {
			if (!Yo.IsValid()) return;
			Yo->bOcupado = false; Yo->bTurnoPaciente = false;
			Yo->Actualizar();
			Yo->UI->EnfocarPrincipal();
		});
		return;
	}
	bOcupado = bPensando = true;
	Actualizar();
	// lo último del médico (si se ha cambiado el turno sin que hable, el paciente sigue con lo suyo)
	const bool bHayPregunta = Charla.Num() && Charla.Last().bMedico;
	const FString Pregunta = bHayPregunta ? Charla.Last().Texto : FString(TEXT("¿Algo más que quiera contarme?"));
	TArray<FEMMLinea> Antes = Charla; if (bHayPregunta) Antes.Pop();
	const int32 E = Epoca;
	IA()->Responder(PacienteParaIA(), Antes, Pregunta, Referencia(Pregunta), [Yo, E](const FEMMRespuesta& R) {
		if (!Yo.IsValid() || Yo->Epoca != E) return;
		Yo->bPensando = false;
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
