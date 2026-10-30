#include "EMMHabla.h"
#include "EMMConsultaUI.h"
#include "Misc/CommandLine.h"
#include "Components/AudioComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Engine/World.h"
#include "TimerManager.h"
#include "Kismet/GameplayStatics.h"
#include "Sound/SoundWaveProcedural.h"

UEMMHabla::UEMMHabla()
{
	PrimaryComponentTick.bCanEverTick = true;
}

FEMMPerfilVoz UEMMHabla::Perfil() const
{
	FEMMPerfilVoz P;
	P.bMujer = bMujer; P.Tono = Tono; P.Vel = Velocidad; P.Preferida = VozPreferida; P.Piper = VozPiper;
	return P;
}

FString UEMMHabla::TextoDicho() const
{
	if (bSinVoz) return Texto;
	if (!Audio.IsValid() || Texto.IsEmpty()) return FString();
	const float T = float(FPlatformTime::Seconds() - Inicio);
	int32 Hasta = 0;
	if (Audio->Palabras.Num())
	{
		// hasta el final de la palabra que está sonando
		for (const auto& P : Audio->Palabras) { if (P.Key <= T + 0.05f) Hasta = FMath::Max(Hasta, P.Value); else break; }
	}
	else if (Audio->Duracion > 0.f)
	{
		// sin marcas de palabras (Android): proporcional al tiempo, cortando en el siguiente espacio
		Hasta = FMath::Clamp(int32(Texto.Len() * T / Audio->Duracion) + 1, 0, Texto.Len());
		while (Hasta < Texto.Len() && !FChar::IsWhitespace(Texto[Hasta])) ++Hasta;
	}
	if (T >= Audio->Duracion) Hasta = Texto.Len();
	// incluye la puntuación pegada a la palabra
	while (Hasta < Texto.Len() && FChar::IsPunct(Texto[Hasta])) ++Hasta;
	return Texto.Left(Hasta).TrimEnd();
}

// Volumen igualado: cada voz sale con la misma sonoridad media (RMS), venga de Piper, de Windows o del móvil, para
// que nadie se oiga más bajo; un limitador suave impide que los picos saturen. La voz de cada persona (tono,
// velocidad, timbre) no cambia: sólo el nivel.
void UEMMHabla::Igualar(TArray<uint8>& PCM)
{
	int16* S = reinterpret_cast<int16*>(PCM.GetData());
	const int32 N = PCM.Num() / 2;
	if (N < 64) return;
	// RMS de lo que suena (sin los silencios, que bajarían la media)
	double Suma = 0; int32 Cuenta = 0;
	for (int32 i = 0; i < N; ++i) { const double X = S[i] / 32768.0; if (FMath::Abs(X) > 0.01) { Suma += X * X; ++Cuenta; } }
	if (!Cuenta) return;
	const double Rms = FMath::Sqrt(Suma / Cuenta);
	const double Objetivo = 0.17;   // unos −15 dBFS: claro en los altavoces de un móvil y de un portátil
	const float Ganancia = float(FMath::Clamp(Objetivo / FMath::Max(Rms, 1e-4), 0.5, 5.0));
	for (int32 i = 0; i < N; ++i)
	{
		float X = S[i] / 32768.f * Ganancia;
		// limitador suave: por encima de 0,8 se comprime hacia 0,98 (sin recortes que distorsionen)
		const float A = FMath::Abs(X);
		if (A > 0.8f) X = FMath::Sign(X) * (0.8f + 0.18f * FMath::Tanh((A - 0.8f) / 0.18f));
		S[i] = int16(FMath::Clamp(X, -1.f, 1.f) * 32767.f);
	}
}

float UEMMHabla::VolumenDe(bool bDelMedico)
{
	return FMath::Clamp(UEMMConsultaUI::LeerNumero(bDelMedico ? TEXT("VolumenMedico") : TEXT("VolumenPacientes"), 1.f), 0.f, 2.f);
}

void UEMMHabla::Decir(const FString& Frase, TFunction<void(const FString&)> Fin)
{
	Callar();
	Texto = Frase;
	AlTerminar = MoveTemp(Fin);
	TWeakObjectPtr<UEMMHabla> Yo(this);
	const int32 F = ++Ficha;
	EMMVoz::Sintetizar(Frase, Perfil(), [Yo, Frase, F](TSharedPtr<FEMMAudio> A) {
		if (!Yo.IsValid() || Yo->Ficha != F) return;
		if (!A.IsValid() || !A->Error.IsEmpty() || !A->PCM.Num())
		{
			// sin voz: los subtítulos se quedan el tiempo de leerlos, y se avisa
			Yo->bSinVoz = true;
			const float Lectura = FMath::Clamp(Frase.Len() / 15.f, 2.f, 10.f);
			const FString Error = A.IsValid() ? A->Error : TEXT("sin voz");
			FTimerHandle T;
			Yo->GetWorld()->GetTimerManager().SetTimer(T, FTimerDelegate::CreateWeakLambda(Yo.Get(), [Yo, Error, F]() { if (Yo->Ficha == F) Yo->Terminar(Error); }), Lectura, false);
			return;
		}
		Igualar(A->PCM);
		USoundWaveProcedural* Onda = NewObject<USoundWaveProcedural>(Yo.Get());
		Onda->SetSampleRate(A->Frecuencia);
		Onda->NumChannels = 1;
		Onda->Duration = A->Duracion;
		Onda->SoundGroup = SOUNDGROUP_Voice;
		Onda->bLooping = false;
		Onda->QueueAudio(A->PCM.GetData(), A->PCM.Num());
		// la voz sale de la cabeza del personaje
		USceneComponent* Donde = Yo->GetOwner()->GetRootComponent();
		FName Hueso = NAME_None;
		TArray<USkeletalMeshComponent*> Mallas;
		Yo->GetOwner()->GetComponents(Mallas);
		for (USkeletalMeshComponent* M : Mallas) if (M->DoesSocketExist(TEXT("head"))) { Donde = M; Hueso = TEXT("head"); break; }
		// volumen de CONFIGURACIÓN: el del médico o el de pacientes y acompañantes
		Yo->Sonido = UGameplayStatics::SpawnSoundAttached(Onda, Donde, Hueso, FVector::ZeroVector, EAttachLocation::SnapToTarget, true, VolumenDe(Yo->GetOwner()->ActorHasTag(TEXT("Medico"))));
		Yo->Audio = A;
		Yo->Inicio = FPlatformTime::Seconds();
		Yo->bHablando = true;
	});
}

void UEMMHabla::Callar()
{
	if (Sonido) { Sonido->Stop(); Sonido = nullptr; }
	Audio.Reset();
	bHablando = false;
	bSinVoz = false;
}

void UEMMHabla::Detener()
{
	++Ficha;
	Terminar(FString());
}

void UEMMHabla::Terminar(const FString& Error)
{
	Callar();
	Texto.Reset();
	Apertura = Redondez = Estiramiento = Cierre = Mordida = 0.f;
	if (AlTerminar) { auto F = MoveTemp(AlTerminar); AlTerminar = nullptr; F(Error); }
}

void UEMMHabla::TickComponent(float Dt, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(Dt, TickType, ThisTickFunction);
	float Ap = 0.f, Re = 0.f, Es = 0.f, Ci = 0.f, Mo = 0.f;
	if (Audio.IsValid())
	{
		const double T = FPlatformTime::Seconds() - Inicio;
		if (T >= Audio->Duracion + 0.15) { Terminar(FString()); return; }
		const int32 C = FMath::Clamp(int32(T * 60.0), 0, Audio->Apertura.Num() - 1);
		if (Audio->Apertura.Num())
		{
			Ap = Audio->Apertura[C];
			// visemas de SAPI (0 silencio … 21 p, b, m): cuánto baja la mandíbula y qué forma toman los labios
			static const float Mandibula[22] = { 0.f, 1.f, 1.f, .8f, .7f, .5f, .35f, .35f, .6f, .9f, .7f, .9f, .6f, .4f, .45f, .2f, .3f, .3f, .15f, .35f, .45f, 0.f };
			const uint8 V = C < Audio->Visema.Num() ? Audio->Visema[C] : 255;
			if (V < 22)
			{
				Ap *= 0.3f + 0.7f * Mandibula[V];
				switch (V)
				{
				case 7: Re = 1.f; break;                       // u
				case 8: Re = 0.8f; break;                      // o
				case 3: case 10: Re = 0.5f; break;
				case 16: Re = 0.5f; break;                     // ch
				case 13: Re = 0.35f; break;                    // r
				case 6: Es = 0.8f; break;                      // i
				case 4: case 15: Es = 0.5f; break;             // e, s
				case 11: case 1: Es = 0.3f; break;
				case 21: Ci = 1.f; Ap = 0.f; break;            // p, b, m
				case 18: Mo = 1.f; Ap *= 0.5f; break;          // f, v
				default: break;
				}
			}
		}
	}
	// prueba: -EMMBocaAbierta fuerza la boca abierta (para comprobar que los controles llegan a la cara)
	static const bool bBocaAbierta = FParse::Param(FCommandLine::Get(), TEXT("EMMBocaAbierta"));
	if (bBocaAbierta) { Ap = 1.f; Re = 0.f; }
	// suavizado, para que la boca no tiemble
	const float K = FMath::Clamp(Dt * 18.f, 0.f, 1.f);
	Apertura = FMath::Lerp(Apertura, Ap, K);
	Redondez = FMath::Lerp(Redondez, Re, K);
	Estiramiento = FMath::Lerp(Estiramiento, Es, K);
	Cierre = FMath::Lerp(Cierre, Ci, K);
	Mordida = FMath::Lerp(Mordida, Mo, K);
	// parpadeo natural cada 2–6 s
	ProximoParpadeo -= Dt;
	if (ProximoParpadeo <= 0.f) { TiempoParpadeo = 0.f; ProximoParpadeo = FMath::FRandRange(2.f, 6.f); }
	if (TiempoParpadeo >= 0.f)
	{
		TiempoParpadeo += Dt;
		Parpadeo = FMath::Sin(FMath::Clamp(TiempoParpadeo / 0.18f, 0.f, 1.f) * PI);
		if (TiempoParpadeo > 0.18f) { TiempoParpadeo = -1.f; Parpadeo = 0.f; }
	}
	// niños y bebés (mallas de MPFB, sin rig facial): la boca es su forma «Boca»
	if (AActor* Yo = GetOwner(); Yo && Yo->ActorHasTag(TEXT("Nino")))
		if (USkeletalMeshComponent* M = Yo->FindComponentByClass<USkeletalMeshComponent>()) M->SetMorphTarget(TEXT("Boca"), FMath::Clamp(Apertura * 0.6f, 0.f, 0.6f));   // más abierta deja ver el hueco de la boca
}
