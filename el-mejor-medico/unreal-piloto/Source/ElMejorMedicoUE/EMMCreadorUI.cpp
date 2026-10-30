#include "EMMCreadorUI.h"
#include "EMMAspecto.h"
#include "EMMConsultaModo.h"
#include "Blueprint/WidgetTree.h"
#include "Components/Border.h"
#include "Components/Button.h"
#include "Components/ButtonSlot.h"
#include "Components/CanvasPanel.h"
#include "Components/CanvasPanelSlot.h"
#include "Components/EditableTextBox.h"
#include "Components/HorizontalBox.h"
#include "Components/HorizontalBoxSlot.h"
#include "Components/ScrollBox.h"
#include "Components/TextBlock.h"
#include "Components/VerticalBox.h"
#include "Components/VerticalBoxSlot.h"
#include "Styling/CoreStyle.h"

void EMMEstiloPapel(FEditableTextBoxStyle& S, float Tam);   // EMMRecetaUI.cpp

namespace
{
	const FLinearColor Panel(0.015f, 0.025f, 0.04f, 0.97f);
	const FLinearColor Claro(0.75f, 0.85f, 1.f);
	const FLinearColor Gris(0.10f, 0.14f, 0.2f);
	FSlateFontInfo Fuente(float Tam, bool bNegrita = false) { return FCoreStyle::GetDefaultFontStyle(bNegrita ? "Bold" : "Regular", Tam); }
	UTextBlock* Texto(UWidgetTree* T, const FString& S, float Tam, const FLinearColor& Color = FLinearColor::White, bool bNegrita = false)
	{
		UTextBlock* B = T->ConstructWidget<UTextBlock>();
		B->SetText(FText::FromString(S));
		B->SetFont(Fuente(Tam, bNegrita));
		B->SetColorAndOpacity(FSlateColor(Color));
		B->SetAutoWrapText(true);
		return B;
	}
	UBorder* Caja(UWidgetTree* T, const FLinearColor& Fondo, float Relleno)
	{
		UBorder* B = T->ConstructWidget<UBorder>();
		B->SetBrushColor(Fondo);
		B->SetPadding(FMargin(Relleno));
		return B;
	}
	int32 Ciclo(int32 V, int32 Paso, int32 N) { return N <= 0 ? 0 : ((V + Paso) % N + N) % N; }
	// valor de una lista de grooms: «» el suyo, «-» ninguno, o la ruta del groom
	FString CicloGroom(const FString& Valor, int32 Paso, const TArray<EMMAspecto::FGroom>& L)
	{
		TArray<FString> Opciones = { FString(), TEXT("-") };
		for (const EMMAspecto::FGroom& G : L) Opciones.Add(G.Groom);
		const int32 I = FMath::Max(0, Opciones.IndexOfByKey(Valor));
		return Opciones[Ciclo(I, Paso, Opciones.Num())];
	}
}

TSharedRef<SWidget> UEMMCreadorUI::RebuildWidget()
{
	if (!WidgetTree->RootWidget) Construir();
	return Super::RebuildWidget();
}

UButton* UEMMCreadorUI::Boton(const FString& S, const FLinearColor& Color, float Tam)
{
	UButton* B = WidgetTree->ConstructWidget<UButton>();
	B->SetBackgroundColor(Color);
	UTextBlock* E = Texto(WidgetTree, S, Tam, FLinearColor::White, true);
	E->SetJustification(ETextJustify::Center);
	if (UButtonSlot* R = Cast<UButtonSlot>(B->AddChild(E))) R->SetPadding(FMargin(12.f, 8.f));
	return B;
}

UTextBlock* UEMMCreadorUI::Selector(UVerticalBox* Columna, const FString& Etiqueta, UButton*& Menos, UButton*& Mas)
{
	// fila: etiqueta · ◀ valor ▶ (botones grandes, para el dedo en el móvil)
	UHorizontalBox* F = WidgetTree->ConstructWidget<UHorizontalBox>();
	UTextBlock* E = Texto(WidgetTree, Etiqueta, 15.f, Claro, true);
	E->SetAutoWrapText(false);
	if (UHorizontalBoxSlot* S = F->AddChildToHorizontalBox(E)) { FSlateChildSize T(ESlateSizeRule::Fill); T.Value = 0.32f; S->SetSize(T); S->SetVerticalAlignment(VAlign_Center); }
	Menos = Boton(TEXT("◀"), Gris, 16.f);
	if (UHorizontalBoxSlot* S = F->AddChildToHorizontalBox(Menos)) S->SetPadding(FMargin(0, 0, 6, 0));
	UBorder* Fondo = Caja(WidgetTree, FLinearColor(0.04f, 0.06f, 0.09f, 1.f), 8.f);
	UTextBlock* V = Texto(WidgetTree, TEXT(""), 15.f);
	V->SetJustification(ETextJustify::Center);
	Fondo->SetContent(V);
	if (UHorizontalBoxSlot* S = F->AddChildToHorizontalBox(Fondo)) { FSlateChildSize T(ESlateSizeRule::Fill); T.Value = 0.68f; S->SetSize(T); S->SetVerticalAlignment(VAlign_Fill); }
	Mas = Boton(TEXT("▶"), Gris, 16.f);
	if (UHorizontalBoxSlot* S = F->AddChildToHorizontalBox(Mas)) S->SetPadding(FMargin(6, 0, 0, 0));
	if (UVerticalBoxSlot* S = Columna->AddChildToVerticalBox(F)) S->SetPadding(FMargin(0, 5, 0, 0));
	return V;
}

void UEMMCreadorUI::Construir()
{
	UCanvasPanel* Lienzo = WidgetTree->ConstructWidget<UCanvasPanel>();
	WidgetTree->RootWidget = Lienzo;
	UBorder* Fondo = Caja(WidgetTree, FLinearColor(0.f, 0.f, 0.f, 0.6f), 26.f);
	if (UCanvasPanelSlot* S = Lienzo->AddChildToCanvas(Fondo)) { S->SetAnchors(FAnchors(0, 0, 1, 1)); S->SetOffsets(FMargin(0)); }
	UBorder* Ventana = Caja(WidgetTree, Panel, 18.f);
	Fondo->SetContent(Ventana);
	UVerticalBox* V = WidgetTree->ConstructWidget<UVerticalBox>();
	Ventana->SetContent(V);
	V->AddChildToVerticalBox(Texto(WidgetTree, TEXT("CREADOR DE PERSONAJES"), 24.f, FLinearColor::White, true));
	V->AddChildToVerticalBox(Texto(WidgetTree, TEXT("Elige al médico o a un paciente y cambia su nombre, sexo, edad, cara, piel, pelo, peinado, barba, bigote y ojos. Se guarda en la partida y se ve en la consulta."), 13.f, Claro));
	UHorizontalBox* Columnas = WidgetTree->ConstructWidget<UHorizontalBox>();
	if (UVerticalBoxSlot* R = V->AddChildToVerticalBox(Columnas)) { R->SetSize(FSlateChildSize(ESlateSizeRule::Fill)); R->SetPadding(FMargin(0, 10, 0, 0)); }

	// ── a quién se edita ──
	Lista = WidgetTree->ConstructWidget<UScrollBox>();
	if (UHorizontalBoxSlot* R = Columnas->AddChildToHorizontalBox(Lista)) { FSlateChildSize T(ESlateSizeRule::Fill); T.Value = 0.34f; R->SetSize(T); R->SetPadding(FMargin(0, 0, 16, 0)); }

	// ── su aspecto ──
	UScrollBox* DerDesliza = WidgetTree->ConstructWidget<UScrollBox>();
	UVerticalBox* Der = WidgetTree->ConstructWidget<UVerticalBox>();
	DerDesliza->AddChild(Der);
	if (UHorizontalBoxSlot* R = Columnas->AddChildToHorizontalBox(DerDesliza)) { FSlateChildSize T(ESlateSizeRule::Fill); T.Value = 0.66f; R->SetSize(T); }
	Titulo = Texto(WidgetTree, TEXT(""), 18.f, FLinearColor::White, true);
	Der->AddChildToVerticalBox(Titulo);
	UHorizontalBox* Nombres = WidgetTree->ConstructWidget<UHorizontalBox>();
	CajaNombre = WidgetTree->ConstructWidget<UEditableTextBox>();
	CajaNombre->SetHintText(FText::FromString(TEXT("Nombre")));
	CajaApellidos = WidgetTree->ConstructWidget<UEditableTextBox>();
	CajaApellidos->SetHintText(FText::FromString(TEXT("Apellidos")));
	for (UEditableTextBox* E : { CajaNombre.Get(), CajaApellidos.Get() })
	{
		EMMEstiloPapel(E->WidgetStyle, 17.f);
		if (UHorizontalBoxSlot* S = Nombres->AddChildToHorizontalBox(E)) { FSlateChildSize T(ESlateSizeRule::Fill); T.Value = E == CajaNombre ? 0.4f : 0.6f; S->SetSize(T); S->SetPadding(FMargin(0, 0, 8, 0)); }
	}
	if (UVerticalBoxSlot* R = Der->AddChildToVerticalBox(Nombres)) R->SetPadding(FMargin(0, 8, 0, 4));
	UButton* M; UButton* P;
	TSexo = Selector(Der, TEXT("Sexo"), M, P); M->OnClicked.AddDynamic(this, &UEMMCreadorUI::AlSexoMenos); P->OnClicked.AddDynamic(this, &UEMMCreadorUI::AlSexoMas);
	TEdad = Selector(Der, TEXT("Edad"), M, P); M->OnClicked.AddDynamic(this, &UEMMCreadorUI::AlEdadMenos); P->OnClicked.AddDynamic(this, &UEMMCreadorUI::AlEdadMas);
	TCara = Selector(Der, TEXT("Cara y rasgos"), M, P); M->OnClicked.AddDynamic(this, &UEMMCreadorUI::AlCaraMenos); P->OnClicked.AddDynamic(this, &UEMMCreadorUI::AlCaraMas);
	TPiel = Selector(Der, TEXT("Color de piel"), M, P); M->OnClicked.AddDynamic(this, &UEMMCreadorUI::AlPielMenos); P->OnClicked.AddDynamic(this, &UEMMCreadorUI::AlPielMas);
	TPelo = Selector(Der, TEXT("Color de pelo"), M, P); M->OnClicked.AddDynamic(this, &UEMMCreadorUI::AlPeloMenos); P->OnClicked.AddDynamic(this, &UEMMCreadorUI::AlPeloMas);
	TPeinado = Selector(Der, TEXT("Peinado"), M, P); M->OnClicked.AddDynamic(this, &UEMMCreadorUI::AlPeinadoMenos); P->OnClicked.AddDynamic(this, &UEMMCreadorUI::AlPeinadoMas);
	TBarba = Selector(Der, TEXT("Barba"), M, P); M->OnClicked.AddDynamic(this, &UEMMCreadorUI::AlBarbaMenos); P->OnClicked.AddDynamic(this, &UEMMCreadorUI::AlBarbaMas);
	TBigote = Selector(Der, TEXT("Bigote"), M, P); M->OnClicked.AddDynamic(this, &UEMMCreadorUI::AlBigoteMenos); P->OnClicked.AddDynamic(this, &UEMMCreadorUI::AlBigoteMas);
	TOjos = Selector(Der, TEXT("Ojos"), M, P); M->OnClicked.AddDynamic(this, &UEMMCreadorUI::AlOjosMenos); P->OnClicked.AddDynamic(this, &UEMMCreadorUI::AlOjosMas);
	TUniforme = Selector(Der, TEXT("Uniforme"), M, P); M->OnClicked.AddDynamic(this, &UEMMCreadorUI::AlUniformeMenos); P->OnClicked.AddDynamic(this, &UEMMCreadorUI::AlUniformeMas);
	UTextBlock* Nota = Texto(WidgetTree, TEXT("La cara (forma de la cabeza, nariz, ojos, boca y mandíbula) se elige entre los modelos del juego: MetaHuman Creator, que esculpe caras nuevas, sólo funciona en el editor de Unreal. Con un cambio de sexo o de edad, la persona vendrá en su próxima visita con un problema de salud propio de su edad."), 12.f, FLinearColor(0.65f, 0.7f, 0.8f));
	if (UVerticalBoxSlot* R = Der->AddChildToVerticalBox(Nota)) R->SetPadding(FMargin(0, 8, 0, 0));
	Estado = Texto(WidgetTree, TEXT(""), 14.f, FLinearColor(0.6f, 1.f, 0.6f), true);
	if (UVerticalBoxSlot* R = Der->AddChildToVerticalBox(Estado)) R->SetPadding(FMargin(0, 6, 0, 0));

	UHorizontalBox* Pie = WidgetTree->ConstructWidget<UHorizontalBox>();
	UButton* BGuardar = Boton(TEXT("GUARDAR Y APLICAR"), FLinearColor(0.12f, 0.33f, 0.62f), 16.f);
	UButton* BDeshacer = Boton(TEXT("DESHACER CAMBIOS"), Gris, 15.f);
	UButton* BCerrar = Boton(TEXT("CERRAR"), Gris, 15.f);
	BGuardar->OnClicked.AddDynamic(this, &UEMMCreadorUI::AlGuardar);
	BDeshacer->OnClicked.AddDynamic(this, &UEMMCreadorUI::AlDeshacer);
	BCerrar->OnClicked.AddDynamic(this, &UEMMCreadorUI::AlCerrar);
	for (UButton* B : { BGuardar, BDeshacer, BCerrar })
		if (UHorizontalBoxSlot* R = Pie->AddChildToHorizontalBox(B)) { R->SetSize(FSlateChildSize(ESlateSizeRule::Fill)); R->SetPadding(FMargin(0, 0, 8, 0)); }
	if (UVerticalBoxSlot* R = V->AddChildToVerticalBox(Pie)) R->SetPadding(FMargin(0, 12, 0, 0));
	SetVisibility(ESlateVisibility::Collapsed);
}

void UEMMCreadorUI::Abrir()
{
	SetVisibility(ESlateVisibility::Visible);
	RellenarLista();
	Cargar(Indice);
	Estado->SetText(FText::GetEmpty());
}
void UEMMCreadorUI::Cerrar() { SetVisibility(ESlateVisibility::Collapsed); }
bool UEMMCreadorUI::EstaAbierta() const { return GetVisibility() == ESlateVisibility::Visible; }

FReply UEMMCreadorUI::NativeOnPreviewKeyDown(const FGeometry& Geometria, const FKeyEvent& Tecla)
{
	if (Tecla.GetKey() == EKeys::Gamepad_FaceButton_Right || Tecla.GetKey() == EKeys::Escape) { Cerrar(); return FReply::Handled(); }
	return Super::NativeOnPreviewKeyDown(Geometria, Tecla);
}

void UEMMCreadorUI::RellenarLista()
{
	if (!Modo.IsValid()) return;
	Lista->ClearChildren();
	BotonesLista.Reset();
	const FEMMHistorial& H = FEMMHistorial::Get();
	for (int32 i = -1; i < H.Plantilla.Num(); ++i)
	{
		const FString T = i < 0 ? TEXT("MÉDICO · ") + Modo->NombreMedico() : FString::Printf(TEXT("%s · %s (%s)"), *H.Plantilla[i].Id, *Modo->NombreCompletoDe(i), *Modo->TextoEdadDe(i));
		UButton* B = Boton(T, i == Indice ? FLinearColor(0.12f, 0.33f, 0.62f) : Gris, 13.f);
		B->SetToolTipText(FText::AsNumber(i));
		B->OnPressed.AddDynamic(this, &UEMMCreadorUI::AlLista);   // al pulsar: con el dedo no hay «ratón encima»
		Lista->AddChild(B);
		BotonesLista.Add(B);
	}
}

void UEMMCreadorUI::AlLista()
{
	for (UButton* B : BotonesLista)
		if (B && B->IsPressed()) { const int32 I = FCString::Atoi(*B->GetToolTipText().ToString()); Cargar(I); RellenarLista(); return; }
}

void UEMMCreadorUI::Elegir(int32 I) { Cargar(I); RellenarLista(); }

void UEMMCreadorUI::Cargar(int32 I)
{
	if (!Modo.IsValid()) return;
	const FEMMHistorial& H = FEMMHistorial::Get();
	Indice = (I >= 0 && H.Plantilla.IsValidIndex(I)) ? I : -1;
	Aspecto = Indice < 0 ? H.Medico : H.Plantilla[Indice].Aspecto;
	Cara = Modo->CaraDe(Indice);
	Edad = Modo->EdadDe(Indice);
	const TArray<AEMMConsultaModo::FEMMCara> Caras = Modo->Caras();
	const AEMMConsultaModo::FEMMCara* C = Caras.FindByPredicate([&](const AEMMConsultaModo::FEMMCara& X) { return X.Nombre == Cara; });
	bMujer = C ? C->Sexo == TEXT("m") : false;
	FString Nom, Ape;
	Modo->NombreDe(Indice, Nom, Ape);
	CajaNombre->SetText(FText::FromString(Nom));
	CajaApellidos->SetText(FText::FromString(Ape));
	Refrescar();
}

TArray<int32> UEMMCreadorUI::CarasValidas() const
{
	TArray<int32> R;
	if (!Modo.IsValid()) return R;
	const TArray<AEMMConsultaModo::FEMMCara> Caras = Modo->Caras();
	for (int32 i = 0; i < Caras.Num(); ++i)
	{
		const AEMMConsultaModo::FEMMCara& C = Caras[i];
		// el médico: caras de adulto; un paciente: cualquiera menos la del médico del nivel
		if (C.Sexo == (bMujer ? TEXT("m") : TEXT("h")) && (Indice < 0 ? !C.bNino : !C.bMedico)
			&& Edad >= FMath::FloorToInt(C.EdadMin) && Edad <= FMath::CeilToInt(C.EdadMax)) R.Add(i);
	}
	return R;
}

void UEMMCreadorUI::Refrescar()
{
	if (!Modo.IsValid()) return;
	const TArray<AEMMConsultaModo::FEMMCara> Caras = Modo->Caras();
	// la cara tiene que ser de su sexo y su edad: si no lo es, la primera que lo sea
	const TArray<int32> Validas = CarasValidas();
	const int32 Actual = Caras.IndexOfByPredicate([&](const AEMMConsultaModo::FEMMCara& X) { return X.Nombre == Cara; });
	if (!Validas.Contains(Actual) && Validas.Num()) Cara = Caras[Validas[0]].Nombre;
	const AEMMConsultaModo::FEMMCara* C = Caras.FindByPredicate([&](const AEMMConsultaModo::FEMMCara& X) { return X.Nombre == Cara; });
	const bool bNino = C && C->bNino;
	Titulo->SetText(FText::FromString(Indice < 0 ? FString(TEXT("El médico")) : FString::Printf(TEXT("Paciente %s"), *FEMMHistorial::Get().Plantilla[Indice].Id)));
	TSexo->SetText(FText::FromString(bMujer ? TEXT("Mujer") : TEXT("Hombre")));
	TEdad->SetText(FText::FromString(Edad == 0 ? FString(TEXT("Menos de 1 año")) : Edad == 1 ? FString(TEXT("1 año")) : FString::Printf(TEXT("%d años"), Edad)));
	TCara->SetText(FText::FromString(C ? FString::Printf(TEXT("%s (%d de %d)"), *C->Etiqueta, Validas.IndexOfByKey(Caras.IndexOfByPredicate([&](const AEMMConsultaModo::FEMMCara& X) { return X.Nombre == Cara; })) + 1, Validas.Num()) : FString(TEXT("Ninguna para esa edad"))));
	TPiel->SetText(FText::FromString(EMMAspecto::NombresPiel()[FMath::Clamp(Aspecto.Piel, 0, EMMAspecto::NombresPiel().Num() - 1)]));
	TPelo->SetText(FText::FromString(EMMAspecto::NombresPelo()[FMath::Clamp(Aspecto.Pelo, 0, EMMAspecto::NombresPelo().Num() - 1)]));
	TOjos->SetText(FText::FromString(EMMAspecto::NombresOjos()[FMath::Clamp(Aspecto.Ojos, 0, EMMAspecto::NombresOjos().Num() - 1)]));
	const FString SoloAdultos = TEXT("— (los niños llevan el suyo)");
	TPeinado->SetText(FText::FromString(bNino ? SoloAdultos : EMMAspecto::NombreDe(Aspecto.Peinado, EMMAspecto::Peinados(), TEXT("El suyo"), TEXT("Rapado (sin pelo)"))));
	TBarba->SetText(FText::FromString(bNino ? SoloAdultos : EMMAspecto::NombreDe(Aspecto.Barba, EMMAspecto::Barbas(), TEXT("La suya"), TEXT("Afeitado (sin barba)"))));
	TBigote->SetText(FText::FromString(bNino ? SoloAdultos : EMMAspecto::NombreDe(Aspecto.Bigote, EMMAspecto::Bigotes(), TEXT("El suyo"), TEXT("Sin bigote"))));
	const TArray<FString> Uniformes = AEMMConsultaModo::NombresUniformes();
	TUniforme->SetText(FText::FromString(Indice >= 0 ? FString(TEXT("— (sólo el médico)")) : TEXT("Pijama sanitario ") + Uniformes[FMath::Clamp(Aspecto.Uniforme, 0, Uniformes.Num() - 1)].ToLower()));
}

void UEMMCreadorUI::Cambiar(const FString& Que, int32 Paso)
{
	if (Que == TEXT("sexo")) bMujer = !bMujer;
	else if (Que == TEXT("edad")) Edad = FMath::Clamp(Edad + Paso, Indice < 0 ? 25 : 0, 99);
	else if (Que == TEXT("cara"))
	{
		const TArray<AEMMConsultaModo::FEMMCara> Caras = Modo.IsValid() ? Modo->Caras() : TArray<AEMMConsultaModo::FEMMCara>();
		const TArray<int32> Validas = CarasValidas();
		if (Validas.Num())
		{
			const int32 Pos = FMath::Max(0, Validas.IndexOfByKey(Caras.IndexOfByPredicate([&](const AEMMConsultaModo::FEMMCara& X) { return X.Nombre == Cara; })));
			Cara = Caras[Validas[Ciclo(Pos, Paso, Validas.Num())]].Nombre;
		}
	}
	else if (Que == TEXT("piel")) Aspecto.Piel = Ciclo(Aspecto.Piel, Paso, EMMAspecto::NombresPiel().Num());
	else if (Que == TEXT("pelo")) Aspecto.Pelo = Ciclo(Aspecto.Pelo, Paso, EMMAspecto::NombresPelo().Num());
	else if (Que == TEXT("ojos")) Aspecto.Ojos = Ciclo(Aspecto.Ojos, Paso, EMMAspecto::NombresOjos().Num());
	else if (Que == TEXT("peinado")) Aspecto.Peinado = CicloGroom(Aspecto.Peinado, Paso, EMMAspecto::Peinados());
	else if (Que == TEXT("barba")) Aspecto.Barba = CicloGroom(Aspecto.Barba, Paso, EMMAspecto::Barbas());
	else if (Que == TEXT("bigote")) Aspecto.Bigote = CicloGroom(Aspecto.Bigote, Paso, EMMAspecto::Bigotes());
	else if (Que == TEXT("uniforme") && Indice < 0) Aspecto.Uniforme = Ciclo(Aspecto.Uniforme, Paso, AEMMConsultaModo::NombresUniformes().Num());
	Estado->SetText(FText::GetEmpty());
	Refrescar();
}

void UEMMCreadorUI::PonerNombre(const FString& N, const FString& A)
{
	CajaNombre->SetText(FText::FromString(N));
	CajaApellidos->SetText(FText::FromString(A));
}

FString UEMMCreadorUI::Guardar()
{
	if (!Modo.IsValid()) return FString();
	Aspecto.Nombre = CajaNombre->GetText().ToString().TrimStartAndEnd();
	Aspecto.Apellidos = CajaApellidos->GetText().ToString().TrimStartAndEnd();
	Aspecto.Edad = Edad;
	const FString R = Modo->AplicarCreador(Indice, Cara, Aspecto);
	Estado->SetText(FText::FromString(R));
	RellenarLista();
	return R;
}

FString UEMMCreadorUI::Resumen() const
{
	return FString::Printf(TEXT("%s %s · %s · %s · cara %s · piel %s · pelo %s · peinado %s · barba %s · bigote %s · ojos %s"),
		*CajaNombre->GetText().ToString(), *CajaApellidos->GetText().ToString(), *TSexo->GetText().ToString(), *TEdad->GetText().ToString(), *TCara->GetText().ToString(),
		*TPiel->GetText().ToString(), *TPelo->GetText().ToString(), *TPeinado->GetText().ToString(), *TBarba->GetText().ToString(), *TBigote->GetText().ToString(), *TOjos->GetText().ToString());
}

void UEMMCreadorUI::AlSexoMenos() { Cambiar(TEXT("sexo"), -1); }
void UEMMCreadorUI::AlSexoMas() { Cambiar(TEXT("sexo"), 1); }
void UEMMCreadorUI::AlEdadMenos() { Cambiar(TEXT("edad"), -1); }
void UEMMCreadorUI::AlEdadMas() { Cambiar(TEXT("edad"), 1); }
void UEMMCreadorUI::AlCaraMenos() { Cambiar(TEXT("cara"), -1); }
void UEMMCreadorUI::AlCaraMas() { Cambiar(TEXT("cara"), 1); }
void UEMMCreadorUI::AlPielMenos() { Cambiar(TEXT("piel"), -1); }
void UEMMCreadorUI::AlPielMas() { Cambiar(TEXT("piel"), 1); }
void UEMMCreadorUI::AlPeloMenos() { Cambiar(TEXT("pelo"), -1); }
void UEMMCreadorUI::AlPeloMas() { Cambiar(TEXT("pelo"), 1); }
void UEMMCreadorUI::AlPeinadoMenos() { Cambiar(TEXT("peinado"), -1); }
void UEMMCreadorUI::AlPeinadoMas() { Cambiar(TEXT("peinado"), 1); }
void UEMMCreadorUI::AlBarbaMenos() { Cambiar(TEXT("barba"), -1); }
void UEMMCreadorUI::AlBarbaMas() { Cambiar(TEXT("barba"), 1); }
void UEMMCreadorUI::AlBigoteMenos() { Cambiar(TEXT("bigote"), -1); }
void UEMMCreadorUI::AlBigoteMas() { Cambiar(TEXT("bigote"), 1); }
void UEMMCreadorUI::AlOjosMenos() { Cambiar(TEXT("ojos"), -1); }
void UEMMCreadorUI::AlOjosMas() { Cambiar(TEXT("ojos"), 1); }
void UEMMCreadorUI::AlUniformeMenos() { Cambiar(TEXT("uniforme"), -1); }
void UEMMCreadorUI::AlUniformeMas() { Cambiar(TEXT("uniforme"), 1); }
void UEMMCreadorUI::AlGuardar() { Guardar(); }
void UEMMCreadorUI::AlDeshacer() { Cargar(Indice); Estado->SetText(FText::FromString(TEXT("Cambios deshechos: vuelve lo guardado."))); }
void UEMMCreadorUI::AlCerrar() { Cerrar(); }
