#include "EMMConsultaModo.h"
#include "EMMConsultaUI.h"
#include "EMMHabla.h"
#include "EMMIA.h"
#include "EMMVoz.h"
#include "EMMCuerpoAnim.h"
#include "EMMDictado.h"
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
	for (USkeletalMeshComponent* M : Mallas)
	{
		if (!M->GetSkeletalMeshAsset() || !M->GetSkeletalMeshAsset()->GetName().Contains(TEXT("Outfits"))) continue;
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
	UE_LOG(LogTemp, Display, TEXT("[EMM] Consulta: empieza la partida (subtítulos %s)"), UEMMConsultaUI::SubtitulosActivados() ? TEXT("ON") : TEXT("OFF"));
	APlayerController* PC = GetWorld()->GetFirstPlayerController();

	// personajes y cámara del nivel
	AActor* Camara = nullptr; AActor* ActorMedico = nullptr; AActor* ActorPaciente = nullptr;
	for (TActorIterator<AActor> It(GetWorld()); It; ++It)
	{
		if (It->ActorHasTag(TEXT("CamaraConsulta"))) Camara = *It;
		if (It->ActorHasTag(TEXT("Medico"))) ActorMedico = *It;
		if (It->ActorHasTag(TEXT("Paciente"))) ActorPaciente = *It;
	}
	// MetaHumans: animación propia del cuerpo (sentados, respiración, mirada, boca) y uno frente al otro
	if (ActorMedico && ActorPaciente)
	{
		int32 N = 0;
		for (AActor* Yo : { ActorMedico, ActorPaciente })
		{
			AActor* Otro = Yo == ActorMedico ? ActorPaciente : ActorMedico;
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
						A->Interlocutor = Otro; A->Fase = 1.7f * N;
						// el paciente llega preocupado; el médico, atento y amable
						if (Yo == ActorPaciente) A->Preocupacion = 0.6f; else A->Sonrisa = 0.45f;
					}
				}
			++N;
		}
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
	if (Medico->Nombre.IsEmpty()) Medico->Nombre = TEXT("Médico");

	// caso del juego con el sexo del MetaHuman paciente
	TArray<FEMMPaciente> Casos; FString Error;
	EMMDatos::CargarPacientes(Casos, Error);
	const bool bPacienteMujer = ActorPaciente && ActorPaciente->ActorHasTag(TEXT("Mujer"));
	Casos.RemoveAll([&](const FEMMPaciente& P) { return ActorPaciente && P.EsMujer() != bPacienteMujer; });
	if (Casos.Num()) Paciente = Casos[FMath::RandRange(0, Casos.Num() - 1)];
	HablaPaciente->Nombre = Paciente.Nombre.IsEmpty() ? TEXT("Paciente") : Paciente.Nombre;
	// voz según edad y sexo; el médico, voz adulta normal (distinta del paciente aunque sean del mismo sexo)
	const FEMMPerfilVoz VP = EMMVoz::PerfilPara(Paciente.EsMujer(), Paciente.Edad);
	HablaPaciente->bMujer = VP.bMujer; HablaPaciente->Tono = VP.Tono; HablaPaciente->Velocidad = VP.Vel; HablaPaciente->VozPreferida = VP.Preferida;
	const bool bMedicaMujer = ActorMedico && ActorMedico->ActorHasTag(TEXT("Mujer"));
	const FEMMPerfilVoz VM = EMMVoz::PerfilPara(bMedicaMujer, 40.f);
	Medico->bMujer = VM.bMujer; Medico->Tono = VM.Tono; Medico->Velocidad = VM.Vel; Medico->VozPreferida = VM.Preferida;
	if (bMedicaMujer == VP.bMujer && VM.Preferida == VP.Preferida)
	{
		if (bMedicaMujer) Medico->VozPreferida = TEXT("Helena");
		else Medico->Tono = 1.05f;
	}
	// ropa: pijama sanitario azul verdoso para el médico; el paciente, según su edad
	Vestir(ActorMedico, FLinearColor(0.06f, 0.26f, 0.32f), FLinearColor(0.05f, 0.22f, 0.28f));
	{
		FLinearColor Arriba, Abajo;
		ColoresPaciente(Paciente, Arriba, Abajo);
		Vestir(ActorPaciente, Arriba, Abajo);
	}

	UI = CreateWidget<UEMMConsultaUI>(PC, UEMMConsultaUI::StaticClass());
	UI->Modo = this;
	UI->AddToViewport();
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
		else { if (PC && Juego) PC->SetViewTargetWithBlend(Juego, 0.f); EMMDictado::Parar(); Siguiente(); }
	}
	else if (Ronda < 3)
	{
		if (Fase == 0 && !bOcupado && !bTurnoPaciente && !EMMDictado::Escuchando())
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
	else
	{
		GetWorldTimerManager().ClearTimer(TemporizadorPrueba);
		UEMMConsultaUI::GuardarSubtitulos(bSubtitulosAntes);   // se deja la elección del jugador como estaba
		RegistroPrueba.Add(FString::Printf(TEXT("Voces: %s"), *FString::Join(EMMVoz::VocesDisponibles(), TEXT(" | "))));
		FFileHelper::SaveStringArrayToFile(RegistroPrueba, *(FPaths::ProjectSavedDir() / TEXT("Prueba.txt")), FFileHelper::EEncodingOptions::ForceUTF8);
		FTimerHandle Fin;
		GetWorldTimerManager().SetTimer(Fin, FTimerDelegate::CreateLambda([]() { FPlatformMisc::RequestExit(false, TEXT("EMMPrueba")); }), 2.f, false);
	}
}

void AEMMConsultaModo::Dictar()
{
	if (EMMDictado::Escuchando()) { EMMDictado::Parar(); return; }
	if (bOcupado || bTurnoPaciente) return;
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
	if (bOcupado) Estado = bTurnoPaciente ? TEXT("El paciente está hablando…") : TEXT("Está hablando el médico…");
	else if (bTurnoPaciente) Estado = TEXT("Turno del paciente: pulsa RESPONDER PACIENTE.");
	else Estado = TEXT("Turno del médico: escribe lo que quieres decir y pulsa ENVIAR · HABLAR MÉDICO.");
	UI->PonerEstado(Estado, bTurnoPaciente);
	UI->PonerIA(IA()->Descripcion());
	UI->PonerBotones(!bOcupado && !bTurnoPaciente, !bOcupado && bTurnoPaciente);
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
	if (bOcupado || bTurnoPaciente) return;
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
	IA()->Responder(Paciente, Antes, Pregunta, Referencia(Pregunta), [Yo](const FEMMRespuesta& R) {
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
