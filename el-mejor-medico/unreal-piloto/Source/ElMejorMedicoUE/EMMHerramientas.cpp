#include "EMMHerramientas.h"

#if WITH_EDITOR
#include "Engine/SkeletalMesh.h"
#include "MeshDescription.h"
#include "SkeletalMeshAttributes.h"
#include "BoneWeights.h"

FString UEMMHerramientas::CrearUniforme(USkeletalMesh* Malla, UMaterialInterface* Tela, float Holgura, float Zapato)
{
	if (!Malla || !Malla->HasMeshDescription(0)) return TEXT("sin malla");
	const FReferenceSkeleton& R = Malla->GetRefSkeleton();
	// 0: fuera; 1: pantalón (muslo, rodilla, pierna); 2: zapato (pie, empeine, dedos)
	auto TipoHueso = [&](int32 I) -> int32 {
		if (I < 0 || I >= R.GetNum()) return 0;
		const FString N = R.GetBoneName(I).ToString().ToLower();
		if (N.Contains(TEXT("foot")) || N.Contains(TEXT("ball")) || N.Contains(TEXT("toe"))) return 2;
		if (N.Contains(TEXT("thigh")) || N.Contains(TEXT("calf")) || N.Contains(TEXT("knee"))) return 1;
		return 0;
	};
	// no se quita geometría: cada vértice lleva su parte en el color (R: 1 pantalón, 0,5 zapato, 0 nada) y el
	// material (M_Uniforme, enmascarado) dibuja sólo el pantalón y los zapatos, cada uno con su color
	TArray<FString> Hecho;
	for (int32 L = 0; L < Malla->GetLODNum(); ++L)
	{
		if (!Malla->HasMeshDescription(L)) continue;
		FMeshDescription* MD = Malla->GetMeshDescription(L);
		FSkeletalMeshAttributes A(*MD);
		A.Register();
		const FSkinWeightsVertexAttributesRef Pesos = A.GetVertexSkinWeights();
		TVertexAttributesRef<FVector3f> Pos = A.GetVertexPositions();
		const TVertexInstanceAttributesConstRef<FVector3f> Normales = A.GetVertexInstanceNormals();
		TVertexInstanceAttributesRef<FVector4f> Colores = A.GetVertexInstanceColors();
		int32 NPant = 0, NZap = 0;
		TMap<FVertexID, int32> Tipos;
		TMap<FVertexID, FVector3f> Pie, NormalPie;   // el zapato: la piel del pie y su normal
		for (const FVertexID V : MD->Vertices().GetElementIDs())
		{
			// la parte (pantalón o zapato) que más mueve el vértice, si entre las dos pasan de la mitad
			float P[3] = { 0, 0, 0 };
			for (const UE::AnimationCore::FBoneWeight BW : Pesos.Get(V)) P[TipoHueso(BW.GetBoneIndex())] += BW.GetWeight();
			const int32 Tipo = P[1] + P[2] < 0.5f ? 0 : (P[2] > P[1] ? 2 : 1);
			Tipos.Add(V, Tipo);
			FVector3f N = FVector3f::ZeroVector;
			for (const FVertexInstanceID I : MD->GetVertexVertexInstanceIDs(V))
			{
				N += Normales[I];
				Colores[I] = FVector4f(Tipo == 1 ? 1.f : Tipo == 2 ? 0.5f : 0.f, 0, 0, 1);
			}
			// el pantalón, hacia fuera por la normal media; el zapato, después de alisarlo
			N = N.GetSafeNormal();
			if (Tipo == 1) { Pos[V] += N * Holgura; ++NPant; }
			else if (Tipo == 2) { Pie.Add(V, Pos[V]); NormalPie.Add(V, N); ++NZap; }
		}
		// el zapato, alisado (cada punto hacia la media de sus vecinos): se cierra sobre los dedos como un zueco
		for (int32 Pasada = 0; Pasada < 14; ++Pasada)
		{
			TMap<FVertexID, FVector3f> Nueva;
			for (const TPair<FVertexID, int32>& T : Tipos)
			{
				if (T.Value != 2) continue;
				FVector3f Suma = FVector3f::ZeroVector;
				int32 N = 0;
				for (const FVertexID W : MD->GetVertexAdjacentVertices(T.Key))
					if (Tipos.FindRef(W) == 2) { Suma += Pos[W]; ++N; }
				if (N) Nueva.Add(T.Key, Pos[T.Key] * 0.5f + Suma / float(N) * 0.5f);
			}
			for (const TPair<FVertexID, FVector3f>& P : Nueva) Pos[P.Key] = P.Value;
		}
		// y otra vez fuera del pie: lo que el alisado lo metió hacia dentro, más el grosor del zapato (y la suela)
		for (const TPair<FVertexID, FVector3f>& P : Pie)
		{
			const FVector3f N = NormalPie[P.Key];
			const float Dentro = FMath::Max(0.f, FVector3f::DotProduct(P.Value - Pos[P.Key], N));
			Pos[P.Key] += N * (Dentro + Zapato);
			if (N.Z < -0.5f) Pos[P.Key].Z -= 0.6f;
		}
		Malla->CommitMeshDescription(L);
		Hecho.Add(FString::Printf(TEXT("LOD%d: %d vértices de pantalón, %d de zapato"), L, NPant, NZap));
	}
	// el mismo material en todas las ranuras
	for (FSkeletalMaterial& M : Malla->GetMaterials()) M.MaterialInterface = Tela;
	Malla->SetHasVertexColors(true);
	Malla->SetPostProcessAnimBlueprint(nullptr);
	Malla->Build();
	Malla->PostEditChange();
	Malla->MarkPackageDirty();
	return FString::Join(Hecho, TEXT(" · "));
}
#endif
