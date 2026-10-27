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

bool FEMMCuerpoProxy::Evaluate(FPoseContext& Output)
{
	Output.ResetToRefPose();
	const FEMMPostura& P = FEMMPostura::Sentado();
	// pelvis
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
		const FQuat Q(G.Eje, FMath::DegreesToRadians(G.Grados));
		if (!G.bCuerpo) { Girar(Output, G.Hueso, Q); continue; }
		// eje del cuerpo: se pasa al espacio del padre del hueso (con la pose ya modificada hasta aquí)
		const FBoneContainer& BC = Output.Pose.GetBoneContainer();
		const int32 Indice = BC.GetPoseBoneIndexForBoneName(G.Hueso);
		if (Indice == INDEX_NONE) continue;
		const FCompactPoseBoneIndex I = BC.MakeCompactPoseIndex(FMeshPoseBoneIndex(Indice));
		if (!I.IsValid()) continue;
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
	// respiración y pequeños movimientos de la cabeza (personas vivas, no estatuas)
	const float Respira = FMath::Sin((Tiempo + Fase) * 2.f * PI / 4.2f);
	Girar(Output, TEXT("spine_03"), FQuat(FVector(0, 0, 1), FMath::DegreesToRadians(0.8f * Respira)));
	Girar(Output, TEXT("neck_01"), FQuat(FVector(1, 0, 0), FMath::DegreesToRadians(MirarYaw * 0.4f + 1.5f * FMath::Sin((Tiempo + Fase) * 0.7f))));
	Girar(Output, TEXT("head"), FQuat(FVector(1, 0, 0), FMath::DegreesToRadians(MirarYaw * 0.6f)));
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
	C.Set(TEXT("CTRL_expressions_eyeLookDownL"), FMath::Max(-OjoY, 0.f));
	C.Set(TEXT("CTRL_expressions_eyeLookDownR"), FMath::Max(-OjoY, 0.f));
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
