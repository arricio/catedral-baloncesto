#include "EMMAspecto.h"
#include "AssetRegistry/AssetRegistryModule.h"
#include "Components/SkeletalMeshComponent.h"
#include "GroomAsset.h"
#include "GroomBindingAsset.h"
#include "GroomComponent.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Modules/ModuleManager.h"

namespace
{
	// multiplicadores del color de la piel horneada de cada MetaHuman (relativos a su tono original)
	struct FTono { const TCHAR* Nombre; FLinearColor Color; };
	const FTono Pieles[] = {
		{ TEXT("La suya"), FLinearColor::White },
		{ TEXT("Mucho más clara"), FLinearColor(1.35f, 1.3f, 1.25f) },
		{ TEXT("Más clara"), FLinearColor(1.15f, 1.12f, 1.1f) },
		{ TEXT("Más morena"), FLinearColor(0.8f, 0.72f, 0.64f) },
		{ TEXT("Mucho más morena"), FLinearColor(0.6f, 0.5f, 0.42f) },
		{ TEXT("Oscura"), FLinearColor(0.38f, 0.3f, 0.25f) },
	};
	// pelo: melanina y rojizo del material de pelo de MetaHuman (y color para los niños)
	struct FPelo { const TCHAR* Nombre; float Melanina, Rojizo; FLinearColor Color; };
	const FPelo Pelos[] = {
		{ TEXT("El suyo"), -1.f, -1.f, FLinearColor::White },
		{ TEXT("Negro"), 1.f, 0.05f, FLinearColor(0.03f, 0.025f, 0.02f) },
		{ TEXT("Castaño oscuro"), 0.75f, 0.2f, FLinearColor(0.12f, 0.07f, 0.04f) },
		{ TEXT("Castaño"), 0.55f, 0.25f, FLinearColor(0.25f, 0.15f, 0.08f) },
		{ TEXT("Castaño claro"), 0.38f, 0.25f, FLinearColor(0.42f, 0.29f, 0.17f) },
		{ TEXT("Rubio"), 0.2f, 0.2f, FLinearColor(0.75f, 0.6f, 0.36f) },
		{ TEXT("Pelirrojo"), 0.35f, 0.95f, FLinearColor(0.55f, 0.2f, 0.07f) },
		{ TEXT("Canoso"), 0.08f, 0.02f, FLinearColor(0.55f, 0.53f, 0.5f) },
		{ TEXT("Blanco"), 0.f, 0.f, FLinearColor(0.85f, 0.85f, 0.83f) },
	};
	// ojos: multiplicador del iris horneado
	const FTono OjosT[] = {
		{ TEXT("Los suyos"), FLinearColor::White },
		{ TEXT("Más oscuros"), FLinearColor(0.45f, 0.38f, 0.32f) },
		{ TEXT("Más claros"), FLinearColor(1.5f, 1.45f, 1.4f) },
		{ TEXT("Verdosos"), FLinearColor(0.75f, 1.35f, 0.8f) },
		{ TEXT("Azulados"), FLinearColor(0.65f, 0.95f, 1.6f) },
		{ TEXT("Grisáceos"), FLinearColor(0.9f, 0.95f, 1.05f) },
	};

	// «Hair_S_UpdoBuns» → «corto · UpdoBuns» (las partes conocidas, en español)
	FString Legible(FString N)
	{
		for (const TCHAR* P : { TEXT("Hair_"), TEXT("Beard_"), TEXT("Goatee_"), TEXT("Mustache_") }) N.RemoveFromStart(P);
		static const TPair<const TCHAR*, const TCHAR*> Trad[] = {
			{ TEXT("S_"), TEXT("corto · ") }, { TEXT("M_"), TEXT("medio · ") }, { TEXT("L_"), TEXT("largo · ") }, { TEXT("XL_"), TEXT("muy largo · ") },
			{ TEXT("Updo"), TEXT("recogido ") }, { TEXT("Buns"), TEXT("moños ") }, { TEXT("Bun"), TEXT("moño ") }, { TEXT("Layered"), TEXT("a capas ") },
			{ TEXT("Ponytail"), TEXT("coleta ") }, { TEXT("Braid"), TEXT("trenza ") }, { TEXT("Wavy"), TEXT("ondulado ") }, { TEXT("Curly"), TEXT("rizado ") },
			{ TEXT("Straight"), TEXT("liso ") }, { TEXT("Messy"), TEXT("despeinado ") }, { TEXT("Fade"), TEXT("degradado ") }, { TEXT("Crop"), TEXT("rapado ") },
			{ TEXT("Afro"), TEXT("afro ") }, { TEXT("Full"), TEXT("poblado ") }, { TEXT("Stubble"), TEXT("de tres días ") }, { TEXT("Thin"), TEXT("fino ") },
			{ TEXT("Dense"), TEXT("denso ") }, { TEXT("Side"), TEXT("de lado ") }, { TEXT("Part"), TEXT("raya ") }, { TEXT("Bangs"), TEXT("flequillo ") },
			{ TEXT("Fringe"), TEXT("flequillo ") }, { TEXT("Bob"), TEXT("melena corta ") }, { TEXT("Pixie"), TEXT("pixie ") }, { TEXT("Mohawk"), TEXT("cresta ") },
			{ TEXT("Dreads"), TEXT("rastas ") }, { TEXT("Locs"), TEXT("rastas ") }, { TEXT("Cornrows"), TEXT("trenzas pegadas ") }, { TEXT("Twist"), TEXT("retorcido ") },
			{ TEXT("Slick"), TEXT("engominado ") }, { TEXT("Back"), TEXT("hacia atrás ") }, { TEXT("Soulpatch"), TEXT("perilla ") }, { TEXT("Strip"), TEXT("fina ") },
			{ TEXT("Gunslinger"), TEXT("de herradura ") }, { TEXT("Chevron"), TEXT("chevron ") }, { TEXT("Pencil"), TEXT("lápiz ") }, { TEXT("Walrus"), TEXT("morsa ") },
		};
		for (const auto& T : Trad) N.ReplaceInline(T.Key, T.Value, ESearchCase::CaseSensitive);
		N.ReplaceInline(TEXT("_"), TEXT(" "));
		return N.TrimStartAndEnd();
	}

	// grooms de un tipo en los MetaHumans montados: el primero de cada nombre, con el anclaje de su personaje
	TArray<EMMAspecto::FGroom> Buscar(std::initializer_list<const TCHAR*> Prefijos)
	{
		TArray<EMMAspecto::FGroom> R;
#if PLATFORM_ANDROID || PLATFORM_IOS
		// en móvil el anclaje no adapta el groom de otro personaje a esta cara (comprobado en el Xiaomi: el pelo
		// flota donde estaba la cabeza original): sólo el suyo o ninguno. Lo elegido en el PC se ignora aquí.
#else
		IAssetRegistry& AR = FModuleManager::LoadModuleChecked<FAssetRegistryModule>(TEXT("AssetRegistry")).Get();
		TArray<FAssetData> Grooms;
		AR.GetAssetsByClass(UGroomAsset::StaticClass()->GetClassPathName(), Grooms);
		Grooms.Sort([](const FAssetData& A, const FAssetData& B) { return A.AssetName.LexicalLess(B.AssetName); });
		TSet<FName> Vistos;
		for (const FAssetData& G : Grooms)
		{
			const FString N = G.AssetName.ToString();
			bool bTipo = false;
			for (const TCHAR* P : Prefijos) bTipo |= N.StartsWith(P);
			if (!bTipo || !G.PackagePath.ToString().StartsWith(TEXT("/Game/MetaHumans/")) || Vistos.Contains(G.AssetName)) continue;
			const FString Anclaje = G.PackagePath.ToString() / (N + TEXT("_Binding"));
			if (!AR.GetAssetByObjectPath(FSoftObjectPath(Anclaje + TEXT(".") + N + TEXT("_Binding"))).IsValid()) continue;
			Vistos.Add(G.AssetName);
			R.Add({ Legible(N), G.GetSoftObjectPath().ToString(), Anclaje + TEXT(".") + N + TEXT("_Binding") });
		}
#endif
		return R;
	}

	void PonerGroom(UGroomComponent* G, const FString& Valor)
	{
		if (!G || Valor.IsEmpty()) return;   // el suyo
		if (Valor == TEXT("-")) { G->SetVisibility(false); return; }
		for (const auto* Lista : { &EMMAspecto::Peinados(), &EMMAspecto::Barbas(), &EMMAspecto::Bigotes() })
			for (const EMMAspecto::FGroom& X : *Lista)
				if (X.Groom == Valor)
				{
					UGroomAsset* A = LoadObject<UGroomAsset>(nullptr, *X.Groom);
					UGroomBindingAsset* B = LoadObject<UGroomBindingAsset>(nullptr, *X.Anclaje);
					if (A) { G->SetGroomAsset(A, B); G->SetVisibility(true); }
					return;
				}
	}

	void ColorPelo(UGroomComponent* G, int32 Pelo)
	{
		if (!G || Pelo <= 0 || Pelo >= UE_ARRAY_COUNT(Pelos)) return;
		for (int32 i = 0; i < G->GetNumMaterials(); ++i)
			if (UMaterialInstanceDynamic* D = G->CreateDynamicMaterialInstance(i))
			{
				D->SetScalarParameterValue(TEXT("hairMelanin"), Pelos[Pelo].Melanina);
				D->SetScalarParameterValue(TEXT("hairRedness"), Pelos[Pelo].Rojizo);
			}
	}
}

const TArray<FString>& EMMAspecto::NombresPiel() { static TArray<FString> L = [] { TArray<FString> R; for (const FTono& T : Pieles) R.Add(T.Nombre); return R; }(); return L; }
const TArray<FString>& EMMAspecto::NombresPelo() { static TArray<FString> L = [] { TArray<FString> R; for (const FPelo& T : Pelos) R.Add(T.Nombre); return R; }(); return L; }
const TArray<FString>& EMMAspecto::NombresOjos() { static TArray<FString> L = [] { TArray<FString> R; for (const FTono& T : OjosT) R.Add(T.Nombre); return R; }(); return L; }
const TArray<EMMAspecto::FGroom>& EMMAspecto::Peinados() { static TArray<FGroom> L = Buscar({ TEXT("Hair_") }); return L; }
const TArray<EMMAspecto::FGroom>& EMMAspecto::Barbas() { static TArray<FGroom> L = Buscar({ TEXT("Beard_"), TEXT("Goatee_") }); return L; }
const TArray<EMMAspecto::FGroom>& EMMAspecto::Bigotes() { static TArray<FGroom> L = Buscar({ TEXT("Mustache_") }); return L; }

FString EMMAspecto::NombreDe(const FString& Valor, const TArray<FGroom>& Lista, const TCHAR* Suyo, const TCHAR* Ninguno)
{
	if (Valor.IsEmpty()) return Suyo;
	if (Valor == TEXT("-")) return Ninguno;
	const FGroom* G = Lista.FindByPredicate([&](const FGroom& X) { return X.Groom == Valor; });
	return G ? G->Nombre : FString(Suyo);
}

void EMMAspecto::Aplicar(AActor* Actor, const FEMMAspecto& A)
{
	if (!Actor) return;
	const bool bNino = Actor->ActorHasTag(TEXT("Nino"));
	const int32 Piel = FMath::Clamp(A.Piel, 0, int32(UE_ARRAY_COUNT(Pieles)) - 1), Ojos = FMath::Clamp(A.Ojos, 0, int32(UE_ARRAY_COUNT(OjosT)) - 1);
	TArray<USkeletalMeshComponent*> Mallas;
	Actor->GetComponents(Mallas);
	for (USkeletalMeshComponent* M : Mallas)
	{
		const TArray<FName> Ranuras = M->GetMaterialSlotNames();
		for (int32 i = 0; i < M->GetNumMaterials(); ++i)
		{
			const UMaterialInterface* Mat = M->GetMaterial(i);
			const FString N = (Mat ? Mat->GetName() : FString()) + TEXT(" ") + (Ranuras.IsValidIndex(i) ? Ranuras[i].ToString() : FString());
			if (bNino)
			{
				// niños: la ranura 0 es la piel; el pelo y los ojos, por su nombre (materiales de importar_ninos.py)
				const bool bPelo = N.Contains(TEXT("short")) || N.Contains(TEXT("bob")) || N.Contains(TEXT("ponytail")) || N.Contains(TEXT("long")) || N.Contains(TEXT("braid")) || N.Contains(TEXT("afro"));
				const bool bOjo = N.Contains(TEXT("low-poly"));
				FLinearColor Tinte = FLinearColor::White; float Fuerza = 0.f;
				if (i == 0 && Piel) { Tinte = Pieles[Piel].Color; Fuerza = 0.f; }
				else if (bPelo && A.Pelo > 0 && A.Pelo < UE_ARRAY_COUNT(Pelos)) { Tinte = Pelos[A.Pelo].Color; Fuerza = 0.85f; }
				else if (bOjo && Ojos) { Tinte = OjosT[Ojos].Color; Fuerza = 0.f; }
				else continue;
				if (UMaterialInstanceDynamic* D = M->CreateDynamicMaterialInstance(i))
				{
					D->SetVectorParameterValue(TEXT("Tinte"), Tinte);
					D->SetScalarParameterValue(TEXT("TinteFuerza"), Fuerza);
				}
				continue;
			}
			// MetaHumans: piel del cuerpo y de la cara, y el iris de los ojos
			const bool bPiel = (M->GetName().Contains(TEXT("Body")) && i == 0) || N.Contains(TEXT("Face_Skin")) || N.Contains(TEXT("Head")) || N.Contains(TEXT("Skin_Baked"));
			const bool bIris = N.Contains(TEXT("MI_EyeL")) || N.Contains(TEXT("MI_EyeR")) || N.Contains(TEXT("Eye_Left")) || N.Contains(TEXT("Eye_Right"));
			if (bPiel && Piel)
			{
				if (UMaterialInstanceDynamic* D = M->CreateDynamicMaterialInstance(i)) D->SetVectorParameterValue(TEXT("Basecolor Global Multiply Post-Bake"), Pieles[Piel].Color);
			}
			else if (bIris && Ojos)
			{
				if (UMaterialInstanceDynamic* D = M->CreateDynamicMaterialInstance(i)) D->SetVectorParameterValue(TEXT("Iris Color Multiply"), OjosT[Ojos].Color);
			}
		}
	}
	if (bNino) return;
	// peinado, barba, bigote y color del pelo (también cejas, barba y bigote)
	TArray<UGroomComponent*> Grooms;
	Actor->GetComponents(Grooms);
	for (UGroomComponent* G : Grooms)
	{
		const FString N = G->GetName();
		if (N == TEXT("Hair")) PonerGroom(G, A.Peinado);
		else if (N == TEXT("Beard")) PonerGroom(G, A.Barba);
		else if (N == TEXT("Mustache")) PonerGroom(G, A.Bigote);
		if (N == TEXT("Hair") || N == TEXT("Beard") || N == TEXT("Mustache") || N == TEXT("Eyebrows")) ColorPelo(G, A.Pelo);
	}
}
