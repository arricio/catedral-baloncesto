#include "EMMCuerpoAnim.h"
#include "EMMHabla.h"
#include "Animation/AnimNodeBase.h"
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
			R.Giros.Add({ FName(G->GetStringField(TEXT("hueso"))), FVector(E[0]->AsNumber(), E[1]->AsNumber(), E[2]->AsNumber()).GetSafeNormal(), (float)G->GetNumberField(TEXT("grados")) });
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
	if (const UEMMHabla* H = Yo ? Yo->FindComponentByClass<UEMMHabla>() : nullptr)
	{
		Apertura = H->Apertura; Redondez = H->Redondez; Estiramiento = H->Estiramiento; Cierre = H->Cierre; Parpadeo = H->Parpadeo;
	}
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
	for (const FEMMGiroHueso& G : P.Giros) Girar(Output, G.Hueso, FQuat(G.Eje, FMath::DegreesToRadians(G.Grados)));
	// respiración y pequeños movimientos de la cabeza (personas vivas, no estatuas)
	const float Respira = FMath::Sin((Tiempo + Fase) * 2.f * PI / 4.2f);
	Girar(Output, TEXT("spine_03"), FQuat(FVector(0, 0, 1), FMath::DegreesToRadians(0.8f * Respira)));
	Girar(Output, TEXT("neck_01"), FQuat(FVector(1, 0, 0), FMath::DegreesToRadians(MirarYaw * 0.4f + 1.5f * FMath::Sin((Tiempo + Fase) * 0.7f))));
	Girar(Output, TEXT("head"), FQuat(FVector(1, 0, 0), FMath::DegreesToRadians(MirarYaw * 0.6f)));
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
	C.Set(TEXT("CTRL_expressions_eyeBlinkL"), Parpadeo);
	C.Set(TEXT("CTRL_expressions_eyeBlinkR"), Parpadeo);
	return true;
}
