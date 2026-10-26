#include "EMMHabla.h"
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
	P.bMujer = bMujer; P.Tono = Tono; P.Vel = Velocidad; P.Preferida = VozPreferida;
	return P;
}

void UEMMHabla::Decir(const FString& Texto, TFunction<void(const FString&)> Fin)
{
	Callar();
	AlTerminar = MoveTemp(Fin);
	TWeakObjectPtr<UEMMHabla> Yo(this);
	EMMVoz::Sintetizar(Texto, Perfil(), [Yo, Texto](TSharedPtr<FEMMAudio> A) {
		if (!Yo.IsValid()) return;
		if (!A.IsValid() || !A->Error.IsEmpty() || !A->PCM.Num())
		{
			// sin voz: los subtítulos se quedan el tiempo de leerlos, y se avisa
			const float Lectura = FMath::Clamp(Texto.Len() / 15.f, 2.f, 10.f);
			const FString Error = A.IsValid() ? A->Error : TEXT("sin voz");
			FTimerHandle T;
			Yo->GetWorld()->GetTimerManager().SetTimer(T, FTimerDelegate::CreateWeakLambda(Yo.Get(), [Yo, Error]() { Yo->Terminar(Error); }), Lectura, false);
			return;
		}
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
		Yo->Sonido = UGameplayStatics::SpawnSoundAttached(Onda, Donde, Hueso, FVector::ZeroVector, EAttachLocation::SnapToTarget, true);
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
}

void UEMMHabla::Terminar(const FString& Error)
{
	Callar();
	Apertura = Redondez = Estiramiento = Cierre = 0.f;
	if (AlTerminar) { auto F = MoveTemp(AlTerminar); AlTerminar = nullptr; F(Error); }
}

void UEMMHabla::TickComponent(float Dt, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(Dt, TickType, ThisTickFunction);
	float Ap = 0.f, Re = 0.f, Es = 0.f, Ci = 0.f;
	if (Audio.IsValid())
	{
		const double T = FPlatformTime::Seconds() - Inicio;
		if (T >= Audio->Duracion + 0.15) { Terminar(FString()); return; }
		const int32 C = FMath::Clamp(int32(T * 60.0), 0, Audio->Apertura.Num() - 1);
		if (Audio->Apertura.Num())
		{
			Ap = Audio->Apertura[C];
			// visemas de SAPI: 6–8 (o, u), 4–5 y 9–10 (e, i), 21 (m, b, p)
			switch (Audio->Visema[C])
			{
			case 6: case 7: case 8: Re = 0.8f; break;
			case 1: case 4: case 5: case 9: case 10: Es = 0.6f; break;
			case 21: Ci = 1.f; Ap *= 0.2f; break;
			default: break;
			}
		}
	}
	// suavizado, para que la boca no tiemble
	const float K = FMath::Clamp(Dt * 18.f, 0.f, 1.f);
	Apertura = FMath::Lerp(Apertura, Ap, K);
	Redondez = FMath::Lerp(Redondez, Re, K);
	Estiramiento = FMath::Lerp(Estiramiento, Es, K);
	Cierre = FMath::Lerp(Cierre, Ci, K);
	// parpadeo natural cada 2–6 s
	ProximoParpadeo -= Dt;
	if (ProximoParpadeo <= 0.f) { TiempoParpadeo = 0.f; ProximoParpadeo = FMath::FRandRange(2.f, 6.f); }
	if (TiempoParpadeo >= 0.f)
	{
		TiempoParpadeo += Dt;
		Parpadeo = FMath::Sin(FMath::Clamp(TiempoParpadeo / 0.18f, 0.f, 1.f) * PI);
		if (TiempoParpadeo > 0.18f) { TiempoParpadeo = -1.f; Parpadeo = 0.f; }
	}
}
