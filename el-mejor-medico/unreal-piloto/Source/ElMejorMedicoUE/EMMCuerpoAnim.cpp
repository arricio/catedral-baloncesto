#include "EMMCuerpoAnim.h"
#include "EMMHabla.h"
#include "Animation/AnimNodeBase.h"
#include "BonePose.h"
#include "Components/SkeletalMeshComponent.h"
#include "Dom/JsonObject.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"

const FEMMPostura& FEMMPostura::Sentado()
{
	static FEMMPostura P = []() {
		FEMMPostura R;
		FString Texto;
		TSharedPtr<FJsonObject> O;
		if (!FFileHelper::LoadFileToString(Texto, *(FPaths::ProjectContentDir() / TEXT("Datos/postura.json"))) ||
			!FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Texto), O) || !O.IsValid()) return R;
		const TArray<TSharedPtr<FJsonValue>>* Tec;
		if (O->TryGetArrayField(TEXT("teclado"), Tec) && Tec->Num() >= 3)
		{
			R.Teclado = FVector((*Tec)[0]->AsNumber(), (*Tec)[1]->AsNumber(), (*Tec)[2]->AsNumber());
			if (Tec->Num() >= 4) R.TecladoCierre = (*Tec)[3]->AsNumber();
		}
		const TArray<TSharedPtr<FJsonValue>>* Pel;
		if (O->TryGetArrayField(TEXT("pelvis"), Pel) && Pel->Num() == 3)
			R.Pelvis = FVector((*Pel)[0]->AsNumber(), (*Pel)[1]->AsNumber(), (*Pel)[2]->AsNumber());
		for (const TSharedPtr<FJsonValue>& V : O->GetArrayField(TEXT("giros")))
		{
			const TSharedPtr<FJsonObject> G = V->AsObject();
			const TArray<TSharedPtr<FJsonValue>>& E = G->GetArrayField(TEXT("eje"));
			FString Espacio;
			G->TryGetStringField(TEXT("espacio"), Espacio);
			R.Giros.Add({ FName(G->GetStringField(TEXT("hueso"))), FVector(E[0]->AsNumber(), E[1]->AsNumber(), E[2]->AsNumber()).GetSafeNormal(), (float)G->GetNumberField(TEXT("grados")), Espacio == TEXT("cuerpo") });
		}
		return R;
	}();
	return P;
}

void FEMMCuerpoProxy::PreUpdate(UAnimInstance* Instancia, float Dt)
{
	FAnimInstanceProxy::PreUpdate(Instancia, Dt);
	Tiempo += Dt;
	UEMMCuerpoAnim* A = Cast<UEMMCuerpoAnim>(Instancia);
	AActor* Yo = Instancia->GetOwningActor();
	Fase = A ? A->Fase : 0.f;
	Preocupacion = A ? A->Preocupacion : 0.f;
	Sonrisa = A ? A->Sonrisa : 0.f;
	bool bHabla = false;
	if (const UEMMHabla* H = Yo ? Yo->FindComponentByClass<UEMMHabla>() : nullptr)
	{
		Apertura = H->Apertura; Redondez = H->Redondez; Estiramiento = H->Estiramiento; Cierre = H->Cierre; Mordida = H->Mordida; Parpadeo = H->Parpadeo;
		bHabla = H->bHablando;
	}
	Habla = FMath::FInterpTo(Habla, bHabla ? 1.f : 0.f, Dt, 3.f);
	// con el portátil (nunca mientras habla: entonces mira al paciente)
	Pantalla = FMath::FInterpTo(Pantalla, A && A->bMirarPantalla && !bHabla ? 1.f : 0.f, Dt, 4.f);
	Teclea = FMath::FInterpTo(Teclea, A && A->bTeclear && !bHabla ? 1.f : 0.f, Dt, 5.f);
	Inquietud = A ? A->Inquietud : 1.f;
	// los ojos no están quietos: pequeños saltos de mirada cada 0,6–2,5 s (menos al hablar)
	ProximaSacada -= Dt;
	if (ProximaSacada <= 0.f)
	{
		ProximaSacada = FMath::FRandRange(0.6f, 2.5f);
		OjosDestino = FMath::FRand() < 0.7f ? FVector2D(FMath::FRandRange(-0.12f, 0.12f), FMath::FRandRange(-0.08f, 0.08f))
			: FVector2D(FMath::FRandRange(-0.3f, 0.3f), FMath::FRandRange(-0.25f, 0.05f));   // a veces aparta la vista
	}
	Ojos = FMath::Vector2DInterpTo(Ojos, OjosDestino, Dt, 25.f);
	// mirada: hacia la cabeza del otro, con un límite natural
	if (A && A->Interlocutor.IsValid() && Yo)
	{
		const FVector Dir = Instancia->GetOwningComponent()->GetComponentTransform().InverseTransformVectorNoScale(A->Interlocutor->GetActorLocation() - Yo->GetActorLocation());
		MirarYaw = FMath::Clamp(FMath::RadiansToDegrees(FMath::Atan2(-Dir.X, Dir.Y)), -35.f, 35.f);
	}
}

static void Girar(FPoseContext& Output, FName Hueso, const FQuat& Q)
{
	const FBoneContainer& BC = Output.Pose.GetBoneContainer();
	const int32 Indice = BC.GetPoseBoneIndexForBoneName(Hueso);
	if (Indice == INDEX_NONE) return;
	const FCompactPoseBoneIndex I = BC.MakeCompactPoseIndex(FMeshPoseBoneIndex(Indice));
	if (!I.IsValid()) return;
	FTransform& T = Output.Pose[I];
	T.SetRotation((T.GetRotation() * Q).GetNormalized());
}

// Giro con un eje del cuerpo (X lado, Y delante, Z arriba; +X lleva hacia delante lo que cuelga):
// se pasa al espacio del padre del hueso, con la pose ya modificada hasta aquí
static void GirarCuerpo(FPoseContext& Output, FName Hueso, const FQuat& Q)
{
	const FBoneContainer& BC = Output.Pose.GetBoneContainer();
	const int32 Indice = BC.GetPoseBoneIndexForBoneName(Hueso);
	if (Indice == INDEX_NONE) return;
	const FCompactPoseBoneIndex I = BC.MakeCompactPoseIndex(FMeshPoseBoneIndex(Indice));
	if (!I.IsValid()) return;
	const FCompactPoseBoneIndex Padre = Output.Pose.GetParentBoneIndex(I);
	FQuat Pc = FQuat::Identity;
	if (Padre.IsValid())
	{
		FCSPose<FCompactPose> CS;
		CS.InitPose(Output.Pose);
		Pc = CS.GetComponentSpaceTransform(Padre).GetRotation();
	}
	FTransform& T = Output.Pose[I];
	T.SetRotation((Pc.Inverse() * Q * Pc * T.GetRotation()).GetNormalized());
}

bool FEMMCuerpoProxy::Evaluate(FPoseContext& Output)
{
	Output.ResetToRefPose();
	const FEMMPostura& P = FEMMPostura::Sentado();
	// pruebas de la ropa de pie (-EMMDePie): sin bajar la pelvis ni doblar las piernas
	static const bool bDePie = FParse::Param(FCommandLine::Get(), TEXT("EMMDePie"));
	// pelvis
	if (!bDePie)
	{
		const FBoneContainer& BC = Output.Pose.GetBoneContainer();
		const int32 Indice = BC.GetPoseBoneIndexForBoneName(TEXT("pelvis"));
		if (Indice != INDEX_NONE)
		{
			const FCompactPoseBoneIndex I = BC.MakeCompactPoseIndex(FMeshPoseBoneIndex(Indice));
			if (I.IsValid()) Output.Pose[I].AddToTranslation(P.Pelvis);
		}
	}
	for (const FEMMGiroHueso& G : P.Giros)
	{
		if (bDePie && (G.Hueso.ToString().StartsWith(TEXT("thigh")) || G.Hueso.ToString().StartsWith(TEXT("calf")))) continue;
		const FQuat Q(G.Eje, FMath::DegreesToRadians(G.Grados));
		if (G.bCuerpo) GirarCuerpo(Output, G.Hueso, Q); else Girar(Output, G.Hueso, Q);
	}
	// el médico con el portátil: brazos hacia el teclado y, al teclear, manos y dedos en movimiento
	if (Pantalla > 0.01f || Teclea > 0.01f)
	{
		const float B = FMath::Max(Pantalla * 0.35f, Teclea);
		const FVector PostTeclado = P.Teclado;
		for (const TCHAR* Lado : { TEXT("l"), TEXT("r") })
		{
			const float Ph = Lado[0] == 'l' ? 0.f : 1.7f;
			// el brazo se adelanta y el antebrazo se estira un poco: las manos llegan al teclado, casi horizontales
			GirarCuerpo(Output, FName(FString(TEXT("upperarm_")) + Lado), FQuat(FVector(1, 0, 0), FMath::DegreesToRadians(PostTeclado.X * B)));
			GirarCuerpo(Output, FName(FString(TEXT("upperarm_")) + Lado), FQuat(FVector(0, 0, 1), FMath::DegreesToRadians((Lado[0] == 'l' ? 1.f : -1.f) * P.TecladoCierre * B)));
			GirarCuerpo(Output, FName(FString(TEXT("lowerarm_")) + Lado), FQuat(FVector(1, 0, 0), FMath::DegreesToRadians(PostTeclado.Y * B)));
			// palmas hacia abajo (pronación: giro del antebrazo sobre su propio eje)
			Girar(Output, FName(FString(TEXT("lowerarm_")) + Lado), FQuat(FVector(1, 0, 0), FMath::DegreesToRadians((Lado[0] == 'l' ? 1.f : -1.f) * PostTeclado.Z * B)));
			// golpecitos de tecleo: la muñeca sube y baja a ritmo irregular
			const float Golpe = Teclea * (3.5f * FMath::Sin(Tiempo * 11.f + Ph) + 2.f * FMath::Sin(Tiempo * 17.f + 2.f * Ph));
			GirarCuerpo(Output, FName(FString(TEXT("hand_")) + Lado), FQuat(FVector(1, 0, 0), FMath::DegreesToRadians(-8.f * B + Golpe)));
			for (const TCHAR* Dedo : { TEXT("index"), TEXT("middle"), TEXT("ring") })
				Girar(Output, FName(FString::Printf(TEXT("%s_01_%s"), Dedo, Lado)), FQuat(FVector(0, 0, 1), FMath::DegreesToRadians(Teclea * 9.f * FMath::Max(0.f, FMath::Sin(Tiempo * 13.f + Ph + Dedo[0])))));
		}
	}
	// gestos con las manos al hablar (más en los inquietos): el antebrazo sube y baja un poco
	if (Habla > 0.01f)
	{
		const float G = Habla * Inquietud * FMath::Clamp(Apertura * 2.f, 0.f, 1.f);
		GirarCuerpo(Output, TEXT("lowerarm_r"), FQuat(FVector(1, 0, 0), FMath::DegreesToRadians(G * 9.f * FMath::Sin(Tiempo * 2.6f + Fase))));
		GirarCuerpo(Output, TEXT("lowerarm_l"), FQuat(FVector(1, 0, 0), FMath::DegreesToRadians(G * 5.f * FMath::Sin(Tiempo * 1.9f + 1.f))));
	}
	// respiración y pequeños movimientos de la cabeza (personas vivas, no estatuas)
	const float Respira = FMath::Sin((Tiempo + Fase) * 2.f * PI / 4.2f);
	Girar(Output, TEXT("spine_03"), FQuat(FVector(0, 0, 1), FMath::DegreesToRadians(0.8f * Respira)));
	const float AlOtro = 1.f - Pantalla;   // mirando la pantalla, deja de mirar al otro
	Girar(Output, TEXT("neck_01"), FQuat(FVector(1, 0, 0), FMath::DegreesToRadians(AlOtro * MirarYaw * 0.4f + 1.5f * Inquietud * FMath::Sin((Tiempo + Fase) * 0.7f))));
	Girar(Output, TEXT("head"), FQuat(FVector(1, 0, 0), FMath::DegreesToRadians(AlOtro * MirarYaw * 0.6f)));
	// la cabeza baja hacia la pantalla del portátil (eje del cuerpo: −X inclina hacia delante)
	if (Pantalla > 0.01f)
	{
		GirarCuerpo(Output, TEXT("neck_01"), FQuat(FVector(1, 0, 0), FMath::DegreesToRadians(-7.f * Pantalla)));
		GirarCuerpo(Output, TEXT("head"), FQuat(FVector(1, 0, 0), FMath::DegreesToRadians(-13.f * Pantalla)));
	}
	// los inquietos se recolocan de vez en cuando (balanceo lento del tronco)
	Girar(Output, TEXT("spine_02"), FQuat(FVector(1, 0, 0), FMath::DegreesToRadians((Inquietud - 0.6f) * 1.2f * FMath::Sin((Tiempo + 3.f * Fase) * 0.45f))));
	// al hablar, la cabeza acompaña con pequeños asentimientos y ladeos
	const float Asiente = Habla * (2.2f * FMath::Sin(Tiempo * 4.1f) + 1.2f * FMath::Sin(Tiempo * 2.3f + 1.f)) * FMath::Clamp(Apertura * 1.5f + 0.3f, 0.f, 1.f);
	Girar(Output, TEXT("head"), FQuat(FVector(0, 0, 1), FMath::DegreesToRadians(Asiente)));
	Girar(Output, TEXT("head"), FQuat(FVector(0, 1, 0), FMath::DegreesToRadians(Habla * 1.5f * FMath::Sin(Tiempo * 1.3f + Fase))));
	// controles faciales (los recoge la cara del MetaHuman)
	FBlendedCurve& C = Output.Curve;
	C.Set(TEXT("CTRL_expressions_jawOpen"), FMath::Clamp(Apertura * 0.7f, 0.f, 1.f));
	for (const TCHAR* N : { TEXT("CTRL_expressions_mouthFunnelUL"), TEXT("CTRL_expressions_mouthFunnelUR"), TEXT("CTRL_expressions_mouthFunnelDL"), TEXT("CTRL_expressions_mouthFunnelDR") })
		C.Set(N, Redondez * 0.45f);
	for (const TCHAR* N : { TEXT("CTRL_expressions_mouthLipsPurseUL"), TEXT("CTRL_expressions_mouthLipsPurseUR"), TEXT("CTRL_expressions_mouthLipsPurseDL"), TEXT("CTRL_expressions_mouthLipsPurseDR") })
		C.Set(N, Redondez * 0.25f);
	C.Set(TEXT("CTRL_expressions_mouthStretchL"), Estiramiento * 0.35f);
	C.Set(TEXT("CTRL_expressions_mouthStretchR"), Estiramiento * 0.35f);
	for (const TCHAR* N : { TEXT("CTRL_expressions_mouthLipsTogetherUL"), TEXT("CTRL_expressions_mouthLipsTogetherUR"), TEXT("CTRL_expressions_mouthLipsTogetherDL"), TEXT("CTRL_expressions_mouthLipsTogetherDR") })
		C.Set(N, Cierre * 0.8f);
	C.Set(TEXT("CTRL_expressions_mouthUpperLipRaiseL"), Apertura * 0.15f);
	C.Set(TEXT("CTRL_expressions_mouthUpperLipRaiseR"), Apertura * 0.15f);
	C.Set(TEXT("CTRL_expressions_mouthLowerLipBiteL"), Mordida * 0.6f);
	C.Set(TEXT("CTRL_expressions_mouthLowerLipBiteR"), Mordida * 0.6f);
	C.Set(TEXT("CTRL_expressions_eyeBlinkL"), Parpadeo);
	C.Set(TEXT("CTRL_expressions_eyeBlinkR"), Parpadeo);
	// mirada (microsacadas)
	const float OjoX = Ojos.X, OjoY = Ojos.Y;
	C.Set(TEXT("CTRL_expressions_eyeLookLeftL"), FMath::Max(OjoX, 0.f));
	C.Set(TEXT("CTRL_expressions_eyeLookLeftR"), FMath::Max(OjoX, 0.f));
	C.Set(TEXT("CTRL_expressions_eyeLookRightL"), FMath::Max(-OjoX, 0.f));
	C.Set(TEXT("CTRL_expressions_eyeLookRightR"), FMath::Max(-OjoX, 0.f));
	C.Set(TEXT("CTRL_expressions_eyeLookUpL"), FMath::Max(OjoY, 0.f));
	C.Set(TEXT("CTRL_expressions_eyeLookUpR"), FMath::Max(OjoY, 0.f));
	C.Set(TEXT("CTRL_expressions_eyeLookDownL"), FMath::Max(-OjoY, 0.f) + 0.35f * Pantalla);
	C.Set(TEXT("CTRL_expressions_eyeLookDownR"), FMath::Max(-OjoY, 0.f) + 0.35f * Pantalla);
	// expresión de fondo, que se mueve un poco al hablar (cejas expresivas)
	const float Cejas = Preocupacion * (0.35f + 0.15f * Habla * FMath::Sin(Tiempo * 1.7f));
	C.Set(TEXT("CTRL_expressions_browRaiseInL"), Cejas);
	C.Set(TEXT("CTRL_expressions_browRaiseInR"), Cejas);
	C.Set(TEXT("CTRL_expressions_browLateralL"), Preocupacion * 0.15f);
	C.Set(TEXT("CTRL_expressions_browLateralR"), Preocupacion * 0.15f);
	C.Set(TEXT("CTRL_expressions_browRaiseOuterL"), Sonrisa * 0.1f + Habla * 0.12f * FMath::Max(FMath::Sin(Tiempo * 2.9f), 0.f));
	C.Set(TEXT("CTRL_expressions_browRaiseOuterR"), Sonrisa * 0.1f + Habla * 0.12f * FMath::Max(FMath::Sin(Tiempo * 2.9f), 0.f));
	C.Set(TEXT("CTRL_expressions_mouthCornerPullL"), Sonrisa * 0.25f);
	C.Set(TEXT("CTRL_expressions_mouthCornerPullR"), Sonrisa * 0.25f);
	C.Set(TEXT("CTRL_expressions_eyeSquintInnerL"), Sonrisa * 0.15f);
	C.Set(TEXT("CTRL_expressions_eyeSquintInnerR"), Sonrisa * 0.15f);
	C.Set(TEXT("CTRL_expressions_mouthCornerDepressL"), Preocupacion * 0.12f);
	C.Set(TEXT("CTRL_expressions_mouthCornerDepressR"), Preocupacion * 0.12f);
	return true;
}
