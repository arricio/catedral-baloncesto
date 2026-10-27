#include "EMMRecetaUI.h"
#include "EMMConsultaModo.h"
#include "EMMDictado.h"
#include "EMMHistorial.h"
#include "Blueprint/WidgetTree.h"
#include "Components/Border.h"
#include "Components/BorderSlot.h"
#include "Components/Button.h"
#include "Components/ButtonSlot.h"
#include "Components/CanvasPanel.h"
#include "Components/CanvasPanelSlot.h"
#include "Components/EditableTextBox.h"
#include "Components/HorizontalBox.h"
#include "Components/HorizontalBoxSlot.h"
#include "Components/MultiLineEditableTextBox.h"
#include "Components/ScrollBox.h"
#include "Components/SizeBox.h"
#include "Components/TextBlock.h"
#include "Components/VerticalBox.h"
#include "Components/VerticalBoxSlot.h"
#include "Styling/CoreStyle.h"

namespace
{
	// colores de la receta verde tradicional
	const FLinearColor Papel(0.80f, 0.92f, 0.70f, 1.f);
	const FLinearColor PapelClaro(0.90f, 0.96f, 0.84f, 1.f);
	const FLinearColor Verde(0.22f, 0.52f, 0.08f, 1.f);
	const FLinearColor VerdeTexto(0.10f, 0.28f, 0.04f, 1.f);
	const FLinearColor Linea(0.35f, 0.62f, 0.18f, 1.f);
	const FLinearColor RojoSim(0.70f, 0.05f, 0.04f, 1.f);
	FSlateFontInfo Fuente(float Tam, const char* Estilo = "Regular") { return FCoreStyle::GetDefaultFontStyle(Estilo, Tam); }

	UTextBlock* Texto(UWidgetTree* T, const FString& S, float Tam, const FLinearColor& Color, const char* Estilo = "Regular")
	{
		UTextBlock* B = T->ConstructWidget<UTextBlock>();
		B->SetText(FText::FromString(S));
		B->SetFont(Fuente(Tam, Estilo));
		B->SetColorAndOpacity(FSlateColor(Color));
		B->SetAutoWrapText(true);
		return B;
	}
	UBorder* Caja(UWidgetTree* T, const FLinearColor& Fondo, const FMargin& Relleno)
	{
		UBorder* B = T->ConstructWidget<UBorder>();
		B->SetBrushColor(Fondo);
		B->SetPadding(Relleno);
		return B;
	}
	// recuadro con borde verde (un borde verde con otro de papel dentro)
	UBorder* Recuadro(UWidgetTree* T, UWidget* Dentro, const FLinearColor& Interior = PapelClaro)
	{
		UBorder* Fuera = Caja(T, Linea, FMargin(1.5f));
		UBorder* In = Caja(T, Interior, FMargin(8.f, 5.f));
		In->SetContent(Dentro);
		Fuera->SetContent(In);
		return Fuera;
	}
	FTextBlockStyle EstiloCampo(float Tam)
	{
		FTextBlockStyle E = FCoreStyle::Get().GetWidgetStyle<FTextBlockStyle>("NormalText");
		E.SetFont(Fuente(Tam));
		E.SetColorAndOpacity(FSlateColor(FLinearColor(0.02f, 0.06f, 0.15f)));   // tinta azul oscura, como escrita a mano
		return E;
	}
}

// Campos de texto como papel: fondo claro y tinta azul, también cuando la receta ya no se puede modificar
void EMMEstiloPapel(FEditableTextBoxStyle& S, float Tam)
{
	const FLinearColor Tinta(0.02f, 0.06f, 0.25f);
	FSlateBrush Fondo; Fondo.TintColor = FSlateColor(FLinearColor(0.98f, 0.99f, 0.96f, 1.f)); Fondo.DrawAs = ESlateBrushDrawType::Box;
	FSlateBrush Foco = Fondo; Foco.TintColor = FSlateColor(FLinearColor(1.f, 1.f, 0.93f, 1.f));
	S.SetBackgroundImageNormal(Fondo); S.SetBackgroundImageHovered(Foco); S.SetBackgroundImageFocused(Foco); S.SetBackgroundImageReadOnly(Fondo);
	S.SetForegroundColor(FSlateColor(Tinta)); S.SetFocusedForegroundColor(FSlateColor(Tinta)); S.SetReadOnlyForegroundColor(FSlateColor(Tinta));
	S.SetBackgroundColor(FSlateColor(FLinearColor::White));
	FTextBlockStyle T = EstiloCampo(Tam);
	T.SetColorAndOpacity(FSlateColor(Tinta));
	S.SetTextStyle(T);
}

TSharedRef<SWidget> UEMMRecetaUI::RebuildWidget()
{
	if (!WidgetTree->RootWidget) Construir();
	return Super::RebuildWidget();
}

UButton* UEMMRecetaUI::Boton(const FString& S, const FLinearColor& Color, float Tam)
{
	UButton* B = WidgetTree->ConstructWidget<UButton>();
	B->SetBackgroundColor(Color);
	UTextBlock* E = Texto(WidgetTree, S, Tam, FLinearColor::White, "Bold");
	E->SetJustification(ETextJustify::Center);
	if (UButtonSlot* R = Cast<UButtonSlot>(B->AddChild(E))) R->SetPadding(FMargin(12.f, 9.f));
	return B;
}

UWidget* UEMMRecetaUI::Campo(const FString& Titulo, UWidget* Contenido, float Alto)
{
	UVerticalBox* V = WidgetTree->ConstructWidget<UVerticalBox>();
	V->AddChildToVerticalBox(Texto(WidgetTree, Titulo, 10.5f, VerdeTexto, "Bold"));
	UWidget* C = Contenido;
	if (Alto > 0.f)
	{
		USizeBox* S = WidgetTree->ConstructWidget<USizeBox>();
		S->SetMinDesiredHeight(Alto);
		S->SetContent(Contenido);
		C = S;
	}
	if (UVerticalBoxSlot* R = V->AddChildToVerticalBox(C)) R->SetPadding(FMargin(0, 3, 0, 0));
	return Recuadro(WidgetTree, V);
}

void UEMMRecetaUI::Construir()
{
	UCanvasPanel* Lienzo = WidgetTree->ConstructWidget<UCanvasPanel>();
	WidgetTree->RootWidget = Lienzo;
	Fondo = Caja(WidgetTree, FLinearColor(0.f, 0.01f, 0.02f, 0.82f), FMargin(24.f));
	if (UCanvasPanelSlot* S = Lienzo->AddChildToCanvas(Fondo)) { S->SetAnchors(FAnchors(0, 0, 1, 1)); S->SetOffsets(FMargin(0)); }
	UHorizontalBox* Todo = WidgetTree->ConstructWidget<UHorizontalBox>();
	Fondo->SetContent(Todo);

	// ── izquierda: recetas de esta consulta ──
	UVerticalBox* Izq = WidgetTree->ConstructWidget<UVerticalBox>();
	Izq->AddChildToVerticalBox(Texto(WidgetTree, TEXT("RECETAS DE ESTA CONSULTA"), 17.f, FLinearColor::White, "Bold"));
	Izq->AddChildToVerticalBox(Texto(WidgetTree, TEXT("Una receta por medicamento o tratamiento."), 12.f, FLinearColor(0.7f, 0.8f, 0.9f)));
	UScrollBox* Desliza = WidgetTree->ConstructWidget<UScrollBox>();
	Lista = WidgetTree->ConstructWidget<UVerticalBox>();
	Desliza->AddChild(Lista);
	if (UVerticalBoxSlot* R = Izq->AddChildToVerticalBox(Desliza)) { R->SetSize(FSlateChildSize(ESlateSizeRule::Fill)); R->SetPadding(FMargin(0, 10)); }
	UButton* BNueva = Boton(TEXT("+ NUEVA RECETA"), FLinearColor(0.15f, 0.45f, 0.10f), 17.f);
	BNueva->OnClicked.AddDynamic(this, &UEMMRecetaUI::AlNueva);
	Izq->AddChildToVerticalBox(BNueva);
	UButton* BCerrar = Boton(TEXT("CERRAR Y VOLVER A LA CONSULTA"), FLinearColor(0.10f, 0.12f, 0.15f), 14.f);
	BCerrar->OnClicked.AddDynamic(this, &UEMMRecetaUI::AlCerrar);
	if (UVerticalBoxSlot* R = Izq->AddChildToVerticalBox(BCerrar)) R->SetPadding(FMargin(0, 8, 0, 0));
	if (UHorizontalBoxSlot* R = Todo->AddChildToHorizontalBox(Izq)) { FSlateChildSize T(ESlateSizeRule::Fill); T.Value = 0.24f; R->SetSize(T); R->SetPadding(FMargin(0, 0, 18, 0)); }

	// ── centro: la receta ──
	UVerticalBox* Centro = WidgetTree->ConstructWidget<UVerticalBox>();
	if (UHorizontalBoxSlot* R = Todo->AddChildToHorizontalBox(Centro)) { FSlateChildSize T(ESlateSizeRule::Fill); T.Value = 0.76f; R->SetSize(T); }
	UBorder* Hoja = Caja(WidgetTree, Papel, FMargin(0));
	if (UVerticalBoxSlot* R = Centro->AddChildToVerticalBox(Hoja)) R->SetSize(FSlateChildSize(ESlateSizeRule::Fill));
	UHorizontalBox* ConBandas = WidgetTree->ConstructWidget<UHorizontalBox>();
	Hoja->SetContent(ConBandas);
	// franjas verdes laterales, como en la receta tradicional
	auto Banda = [this](const FString& Letras) {
		UBorder* B = Caja(WidgetTree, Verde, FMargin(6.f, 10.f));
		UTextBlock* T = Texto(WidgetTree, Letras, 10.f, PapelClaro, "Bold");
		T->SetJustification(ETextJustify::Center);
		B->SetContent(T);
		B->SetVerticalAlignment(VAlign_Center);
		return B;
	};
	auto Vertical = [](const FString& S) { FString R; for (int32 i = 0; i < S.Len(); ++i) { R.AppendChar(S[i]); if (i + 1 < S.Len()) R += TEXT("\n"); } return R; };
	if (UHorizontalBoxSlot* R = ConBandas->AddChildToHorizontalBox(Banda(Vertical(TEXT("SIMULACIÓN"))))) R->SetSize(FSlateChildSize(ESlateSizeRule::Automatic));
	UVerticalBox* Cuerpo = WidgetTree->ConstructWidget<UVerticalBox>();
	if (UHorizontalBoxSlot* R = ConBandas->AddChildToHorizontalBox(Cuerpo)) { R->SetSize(FSlateChildSize(ESlateSizeRule::Fill)); R->SetPadding(FMargin(14.f, 10.f)); }
	if (UHorizontalBoxSlot* R = ConBandas->AddChildToHorizontalBox(Banda(Vertical(TEXT("RECETA MÉDICA"))))) R->SetSize(FSlateChildSize(ESlateSizeRule::Automatic));

	// cabecera: organismo ficticio · banda verde · número
	UHorizontalBox* Cab = WidgetTree->ConstructWidget<UHorizontalBox>();
	UVerticalBox* Org = WidgetTree->ConstructWidget<UVerticalBox>();
	Org->AddChildToVerticalBox(Texto(WidgetTree, TEXT("HOSPITAL SAN MARCOS"), 15.f, VerdeTexto, "Bold"));
	Org->AddChildToVerticalBox(Texto(WidgetTree, TEXT("Servicio de Salud (ficticio)"), 10.f, VerdeTexto));
	if (UHorizontalBoxSlot* R = Cab->AddChildToHorizontalBox(Org)) { FSlateChildSize T(ESlateSizeRule::Fill); T.Value = 0.28f; R->SetSize(T); R->SetVerticalAlignment(VAlign_Center); }
	UBorder* Franja = Caja(WidgetTree, Verde, FMargin(10.f, 4.f));
	UTextBlock* TF = Texto(WidgetTree, TEXT("ENFERMEDAD COMÚN O ACCIDENTE NO LABORAL"), 15.f, PapelClaro, "Bold");
	TF->SetJustification(ETextJustify::Center);
	Franja->SetContent(TF);
	if (UHorizontalBoxSlot* R = Cab->AddChildToHorizontalBox(Franja)) { FSlateChildSize T(ESlateSizeRule::Fill); T.Value = 0.5f; R->SetSize(T); R->SetPadding(FMargin(10, 0)); }
	Numero = Texto(WidgetTree, TEXT(""), 12.f, VerdeTexto, "Bold");
	Numero->SetJustification(ETextJustify::Right);
	if (UHorizontalBoxSlot* R = Cab->AddChildToHorizontalBox(Numero)) { FSlateChildSize T(ESlateSizeRule::Fill); T.Value = 0.22f; R->SetSize(T); R->SetVerticalAlignment(VAlign_Center); }
	Cuerpo->AddChildToVerticalBox(Cab);

	// marca de simulación, bien visible
	UBorder* Sim = Caja(WidgetTree, FLinearColor(1.f, 0.93f, 0.90f, 1.f), FMargin(6.f, 3.f));
	UTextBlock* TS = Texto(WidgetTree, TEXT("SIMULACIÓN - SIN VALIDEZ MÉDICA · Receta de un videojuego: no sirve en farmacias"), 13.f, RojoSim, "Bold");
	TS->SetJustification(ETextJustify::Center);
	Sim->SetContent(TS);
	if (UVerticalBoxSlot* R = Cuerpo->AddChildToVerticalBox(Sim)) R->SetPadding(FMargin(0, 8, 0, 6));

	// cuerpo: prescripción a la izquierda; paciente, médico y firma a la derecha
	UHorizontalBox* Fila = WidgetTree->ConstructWidget<UHorizontalBox>();
	if (UVerticalBoxSlot* R = Cuerpo->AddChildToVerticalBox(Fila)) R->SetSize(FSlateChildSize(ESlateSizeRule::Fill));
	UVerticalBox* Pres = WidgetTree->ConstructWidget<UVerticalBox>();
	if (UHorizontalBoxSlot* R = Fila->AddChildToHorizontalBox(Pres)) { FSlateChildSize T(ESlateSizeRule::Fill); T.Value = 0.64f; R->SetSize(T); R->SetPadding(FMargin(0, 0, 8, 0)); }
	UVerticalBox* Der = WidgetTree->ConstructWidget<UVerticalBox>();
	if (UHorizontalBoxSlot* R = Fila->AddChildToHorizontalBox(Der)) { FSlateChildSize T(ESlateSizeRule::Fill); T.Value = 0.36f; R->SetSize(T); }

	Medicamento = WidgetTree->ConstructWidget<UMultiLineEditableTextBox>();
	EMMEstiloPapel(Medicamento->WidgetStyle, 20.f);
	Medicamento->SetTextStyle(EstiloCampo(20.f));
	Medicamento->SetHintText(FText::FromString(TEXT("Medicamento o tratamiento (p. ej. Amoxicilina 500 mg cápsulas)")));
	Pres->AddChildToVerticalBox(Campo(TEXT("PRESCRIPCIÓN · MEDICAMENTO O TRATAMIENTO"), Medicamento, 80.f));
	UHorizontalBox* Pauta = WidgetTree->ConstructWidget<UHorizontalBox>();
	Dosis = WidgetTree->ConstructWidget<UEditableTextBox>();
	Frecuencia = WidgetTree->ConstructWidget<UEditableTextBox>();
	Duracion = WidgetTree->ConstructWidget<UEditableTextBox>();
	Dosis->SetHintText(FText::FromString(TEXT("1 cápsula")));
	Frecuencia->SetHintText(FText::FromString(TEXT("cada 8 horas")));
	Duracion->SetHintText(FText::FromString(TEXT("7 días")));
	for (UEditableTextBox* E : { Dosis.Get(), Frecuencia.Get(), Duracion.Get() }) EMMEstiloPapel(E->WidgetStyle, 18.f);
	for (TPair<FString, UWidget*> P : { TPair<FString, UWidget*>(TEXT("DOSIS"), Dosis), TPair<FString, UWidget*>(TEXT("FRECUENCIA / POSOLOGÍA"), Frecuencia), TPair<FString, UWidget*>(TEXT("DURACIÓN"), Duracion) })
		if (UHorizontalBoxSlot* R = Pauta->AddChildToHorizontalBox(Campo(P.Key, P.Value))) { R->SetSize(FSlateChildSize(ESlateSizeRule::Fill)); R->SetPadding(FMargin(0, 0, 6, 0)); }
	if (UVerticalBoxSlot* R = Pres->AddChildToVerticalBox(Pauta)) R->SetPadding(FMargin(0, 6, 0, 0));
	Instrucciones = WidgetTree->ConstructWidget<UMultiLineEditableTextBox>();
	EMMEstiloPapel(Instrucciones->WidgetStyle, 17.f);
	Instrucciones->SetTextStyle(EstiloCampo(17.f));
	Instrucciones->SetHintText(FText::FromString(TEXT("Instrucciones al paciente (cómo tomarlo, qué evitar, cuándo volver)")));
	if (UVerticalBoxSlot* R = Pres->AddChildToVerticalBox(Campo(TEXT("INSTRUCCIONES AL PACIENTE"), Instrucciones, 130.f))) R->SetPadding(FMargin(0, 6, 0, 0));
	// cupón precinto y farmacia (decorativos, como en la receta en papel)
	UHorizontalBox* Cupones = WidgetTree->ConstructWidget<UHorizontalBox>();
	for (const TCHAR* T : { TEXT("CUPÓN PRECINTO"), TEXT("CUPÓN PRECINTO"), TEXT("FARMACIA · sello y fecha de dispensación") })
	{
		UTextBlock* C = Texto(WidgetTree, T, 10.f, Linea, "Bold");
		C->SetJustification(ETextJustify::Center);
		USizeBox* S = WidgetTree->ConstructWidget<USizeBox>();
		S->SetMinDesiredHeight(70.f);
		S->SetContent(C);
		if (UHorizontalBoxSlot* R = Cupones->AddChildToHorizontalBox(Recuadro(WidgetTree, S, Papel))) { R->SetSize(FSlateChildSize(ESlateSizeRule::Fill)); R->SetPadding(FMargin(0, 0, 6, 0)); }
	}
	if (UVerticalBoxSlot* R = Pres->AddChildToVerticalBox(Cupones)) R->SetPadding(FMargin(0, 6, 0, 0));

	DatosPaciente = Texto(WidgetTree, TEXT(""), 13.f, FLinearColor(0.02f, 0.06f, 0.15f));
	Der->AddChildToVerticalBox(Campo(TEXT("PACIENTE · nombre, apellidos, edad y nº de historia"), DatosPaciente));
	DatosMedico = Texto(WidgetTree, TEXT(""), 13.f, FLinearColor(0.02f, 0.06f, 0.15f));
	if (UVerticalBoxSlot* R = Der->AddChildToVerticalBox(Campo(TEXT("MÉDICO · datos de identificación del prescriptor"), DatosMedico))) R->SetPadding(FMargin(0, 6, 0, 0));
	Fecha = Texto(WidgetTree, TEXT(""), 13.f, FLinearColor(0.02f, 0.06f, 0.15f));
	if (UVerticalBoxSlot* R = Der->AddChildToVerticalBox(Campo(TEXT("FECHA DE PRESCRIPCIÓN"), Fecha))) R->SetPadding(FMargin(0, 6, 0, 0));
	Firma = Texto(WidgetTree, TEXT(""), 22.f, FLinearColor(0.03f, 0.08f, 0.35f), "Italic");
	if (UVerticalBoxSlot* R = Der->AddChildToVerticalBox(Campo(TEXT("FIRMA DEL MÉDICO (ficticia)"), Firma))) R->SetPadding(FMargin(0, 6, 0, 0));
	EstadoReceta = Texto(WidgetTree, TEXT(""), 15.f, VerdeTexto, "Bold");
	EstadoReceta->SetJustification(ETextJustify::Center);
	if (UVerticalBoxSlot* R = Der->AddChildToVerticalBox(EstadoReceta)) R->SetPadding(FMargin(0, 8, 0, 0));

	// pie: código de barras (dibujado) y aviso legal
	UHorizontalBox* Pie = WidgetTree->ConstructWidget<UHorizontalBox>();
	Barras = WidgetTree->ConstructWidget<UHorizontalBox>();
	if (UHorizontalBoxSlot* R = Pie->AddChildToHorizontalBox(Barras)) { R->SetVerticalAlignment(VAlign_Center); R->SetPadding(FMargin(0, 0, 16, 0)); }
	UTextBlock* Legal = Texto(WidgetTree, TEXT("Documento generado por EL MEJOR MÉDICO, un videojuego. Paciente, médico, centro y número ficticios. No es una receta real, no tiene validez médica ni legal y no puede dispensarse."), 9.5f, VerdeTexto);
	if (UHorizontalBoxSlot* R = Pie->AddChildToHorizontalBox(Legal)) { R->SetSize(FSlateChildSize(ESlateSizeRule::Fill)); R->SetVerticalAlignment(VAlign_Center); }
	if (UVerticalBoxSlot* R = Cuerpo->AddChildToVerticalBox(Pie)) R->SetPadding(FMargin(0, 8, 0, 0));

	// avisos médicos de la simulación (riesgos)
	CajaAvisos = Caja(WidgetTree, FLinearColor(0.35f, 0.12f, 0.02f, 0.95f), FMargin(10.f, 6.f));
	Avisos = Texto(WidgetTree, TEXT(""), 14.f, FLinearColor(1.f, 0.92f, 0.8f), "Bold");
	CajaAvisos->SetContent(Avisos);
	CajaAvisos->SetVisibility(ESlateVisibility::Collapsed);
	if (UVerticalBoxSlot* R = Centro->AddChildToVerticalBox(CajaAvisos)) R->SetPadding(FMargin(0, 8, 0, 0));

	// botones de la receta
	UHorizontalBox* Acciones = WidgetTree->ConstructWidget<UHorizontalBox>();
	UButton* BDictar = WidgetTree->ConstructWidget<UButton>();
	BDictar->SetBackgroundColor(FLinearColor(0.10f, 0.12f, 0.15f));
	EtiquetaDictar = Texto(WidgetTree, TEXT("MICRÓFONO · DICTAR"), 16.f, FLinearColor::White, "Bold");
	EtiquetaDictar->SetJustification(ETextJustify::Center);
	if (UButtonSlot* R = Cast<UButtonSlot>(BDictar->AddChild(EtiquetaDictar))) R->SetPadding(FMargin(12.f, 9.f));
	BDictar->OnClicked.AddDynamic(this, &UEMMRecetaUI::AlDictar);
	BotonGuardar = Boton(TEXT("GUARDAR"), FLinearColor(0.12f, 0.33f, 0.62f), 17.f);
	BotonAnular = Boton(TEXT("ANULAR"), FLinearColor(0.55f, 0.08f, 0.06f), 17.f);
	BotonEntregar = Boton(TEXT("ENTREGAR AL PACIENTE"), FLinearColor(0.15f, 0.45f, 0.10f), 17.f);
	BotonGuardar->OnClicked.AddDynamic(this, &UEMMRecetaUI::AlGuardar);
	BotonAnular->OnClicked.AddDynamic(this, &UEMMRecetaUI::AlAnular);
	BotonEntregar->OnClicked.AddDynamic(this, &UEMMRecetaUI::AlEntregar);
	for (UButton* B : { BDictar, BotonGuardar.Get(), BotonAnular.Get(), BotonEntregar.Get() })
		if (UHorizontalBoxSlot* R = Acciones->AddChildToHorizontalBox(B)) { R->SetSize(FSlateChildSize(ESlateSizeRule::Fill)); R->SetPadding(FMargin(0, 0, 8, 0)); }
	if (UVerticalBoxSlot* R = Centro->AddChildToVerticalBox(Acciones)) R->SetPadding(FMargin(0, 10, 0, 0));
	SetVisibility(ESlateVisibility::Collapsed);
}

void UEMMRecetaUI::Abrir()
{
	SetVisibility(ESlateVisibility::Visible);
	Refrescar(IdActual);
}
void UEMMRecetaUI::Cerrar()
{
	if (EMMDictado::Escuchando()) EMMDictado::Parar();
	SetVisibility(ESlateVisibility::Collapsed);
}
bool UEMMRecetaUI::EstaAbierta() const { return GetVisibility() == ESlateVisibility::Visible; }

void UEMMRecetaUI::PonerCampos(bool bEditable)
{
	Medicamento->SetIsReadOnly(!bEditable);
	Instrucciones->SetIsReadOnly(!bEditable);
	for (UEditableTextBox* E : { Dosis.Get(), Frecuencia.Get(), Duracion.Get() }) E->SetIsReadOnly(!bEditable);
}

void UEMMRecetaUI::Refrescar(const FString& IdElegida)
{
	if (!Modo.IsValid() || !WidgetTree->RootWidget) return;
	const TArray<FString> Ids = Modo->RecetasVisita();
	IdActual = Ids.Contains(IdElegida) ? IdElegida : (Ids.Num() ? Ids.Last() : FString());
	FEMMFicha* F = Modo->Ficha();
	const FEMMReceta* R = F && !IdActual.IsEmpty() ? F->Receta(IdActual) : nullptr;

	// lista de recetas de esta consulta
	Lista->ClearChildren();
	for (int32 i = 0; i < Ids.Num(); ++i)
	{
		const FEMMReceta* X = F ? F->Receta(Ids[i]) : nullptr;
		if (!X) continue;
		const FString Nombre = X->Medicamento.IsEmpty() ? TEXT("(sin escribir)") : X->Medicamento.Left(34);
		const FLinearColor C = X->Estado == EEMMEstadoReceta::Anulada ? FLinearColor(0.25f, 0.08f, 0.07f) : X->Estado == EEMMEstadoReceta::Entregada ? FLinearColor(0.08f, 0.25f, 0.08f) : FLinearColor(0.10f, 0.14f, 0.2f);
		UButton* B = Boton(FString::Printf(TEXT("%d. %s\n%s"), i + 1, *Nombre, *FEMMReceta::TextoEstado(X->Estado)), X->Id == IdActual ? C * 2.2f : C, 13.f);
		B->OnClicked.AddDynamic(this, &UEMMRecetaUI::AlElegirLista);
		B->SetToolTipText(FText::FromString(X->Id));
		if (UVerticalBoxSlot* S = Lista->AddChildToVerticalBox(B)) S->SetPadding(FMargin(0, 0, 0, 6));
	}

	// la receta
	const FEMMPaciente& P = Modo->PacienteActual();
	DatosPaciente->SetText(FText::FromString(FString::Printf(TEXT("%s %s\n%s · %s\nNº historia: %s"), *P.Nombre, *P.Apellidos, *P.TextoEdad, P.EsMujer() ? TEXT("mujer") : TEXT("hombre"), F ? *F->NumeroHistoria : TEXT("-"))));
	DatosMedico->SetText(FText::FromString(FString::Printf(TEXT("%s\nMedicina de Familia · Hospital San Marcos\nNº colegiado: %s (ficticio)"), *Modo->NombreMedico(), *Modo->ColegiadoMedico())));
	Fecha->SetText(FText::FromString(FEMMHistorial::Fecha(R ? R->Dia : FEMMHistorial::Get().Dia)));
	Firma->SetText(FText::FromString(Modo->FirmaMedico()));
	Numero->SetText(FText::FromString(R ? FString::Printf(TEXT("Nº %s\nSERIE SIM"), *R->Id) : TEXT("Sin receta\nPulsa + NUEVA RECETA")));
	Medicamento->SetText(FText::FromString(R ? R->Medicamento : FString()));
	Dosis->SetText(FText::FromString(R ? R->Dosis : FString()));
	Frecuencia->SetText(FText::FromString(R ? R->Frecuencia : FString()));
	Duracion->SetText(FText::FromString(R ? R->Duracion : FString()));
	Instrucciones->SetText(FText::FromString(R ? R->Instrucciones : FString()));
	const bool bEditable = R && (R->Estado == EEMMEstadoReceta::Borrador || R->Estado == EEMMEstadoReceta::Guardada);
	PonerCampos(bEditable);
	EstadoReceta->SetText(FText::FromString(R ? FString::Printf(TEXT("Estado: %s"), *FEMMReceta::TextoEstado(R->Estado)) : FString()));
	EstadoReceta->SetColorAndOpacity(FSlateColor(R && R->Estado == EEMMEstadoReceta::Anulada ? RojoSim : VerdeTexto));
	BotonGuardar->SetIsEnabled(bEditable);
	BotonEntregar->SetIsEnabled(R && R->Estado == EEMMEstadoReceta::Guardada);
	BotonAnular->SetIsEnabled(R && R->Estado != EEMMEstadoReceta::Anulada);
	// riesgos que detecta la simulación
	if (R && R->Riesgos.Num())
	{
		Avisos->SetText(FText::FromString(TEXT("AVISO MÉDICO DE LA SIMULACIÓN\n• ") + FString::Join(R->Riesgos, TEXT("\n• "))));
		CajaAvisos->SetVisibility(ESlateVisibility::HitTestInvisible);
	}
	else CajaAvisos->SetVisibility(ESlateVisibility::Collapsed);
	// código de barras propio de cada receta
	Barras->ClearChildren();
	const uint32 H = GetTypeHash(R ? R->Id : FString(TEXT("X")));
	for (int32 i = 0; i < 42; ++i)
	{
		const float Ancho = 1.f + float((H >> (i % 29)) & 3u) * 0.9f;
		UBorder* B = Caja(WidgetTree, FLinearColor(0.02f, 0.03f, 0.02f), FMargin(Ancho * 0.5f, 17.f));
		if (UHorizontalBoxSlot* S = Barras->AddChildToHorizontalBox(B)) S->SetPadding(FMargin(0, 0, 1.f + float((H >> ((i + 7) % 31)) & 1u) * 1.5f, 0));
	}
}

void UEMMRecetaUI::NativeTick(const FGeometry& Geometria, float Dt)
{
	Super::NativeTick(Geometria, Dt);
	// el micrófono escribe en el último campo que se ha tocado
	for (UWidget* W : { (UWidget*)Medicamento.Get(), (UWidget*)Dosis.Get(), (UWidget*)Frecuencia.Get(), (UWidget*)Duracion.Get(), (UWidget*)Instrucciones.Get() })
		if (W && W->HasKeyboardFocus()) UltimoCampo = W;
}

void UEMMRecetaUI::Escribir(const FString& M, const FString& D, const FString& Fr, const FString& Du, const FString& I)
{
	Medicamento->SetText(FText::FromString(M)); Dosis->SetText(FText::FromString(D)); Frecuencia->SetText(FText::FromString(Fr));
	Duracion->SetText(FText::FromString(Du)); Instrucciones->SetText(FText::FromString(I));
}

void UEMMRecetaUI::AlNueva()
{
	if (!Modo.IsValid()) return;
	Refrescar(Modo->NuevaReceta());
	UltimoCampo = Medicamento;
}

void UEMMRecetaUI::AlGuardar()
{
	if (!Modo.IsValid() || IdActual.IsEmpty()) return;
	Modo->GuardarReceta(IdActual, Medicamento->GetText().ToString(), Dosis->GetText().ToString(), Frecuencia->GetText().ToString(), Duracion->GetText().ToString(), Instrucciones->GetText().ToString());
	Refrescar(IdActual);
}

void UEMMRecetaUI::AlAnular()
{
	if (!Modo.IsValid() || IdActual.IsEmpty()) return;
	Modo->AnularReceta(IdActual);
	Refrescar(IdActual);
}

void UEMMRecetaUI::AlEntregar()
{
	if (!Modo.IsValid() || IdActual.IsEmpty()) return;
	Modo->EntregarReceta(IdActual);
	Refrescar(IdActual);
}

void UEMMRecetaUI::AlCerrar() { Cerrar(); }

void UEMMRecetaUI::AlElegirLista()
{
	for (UWidget* W : Lista->GetAllChildren())
		if (UButton* B = Cast<UButton>(W); B && (B->IsHovered() || B->IsPressed()))
		{
			Refrescar(B->GetToolTipText().ToString());
			return;
		}
}

void UEMMRecetaUI::AlDictar()
{
	if (EMMDictado::Escuchando()) { EMMDictado::Parar(); return; }
	UWidget* Destino = UltimoCampo ? UltimoCampo.Get() : Medicamento.Get();
	auto Leer = [](UWidget* W) {
		if (UEditableTextBox* E = Cast<UEditableTextBox>(W)) return E->GetText().ToString();
		if (UMultiLineEditableTextBox* M = Cast<UMultiLineEditableTextBox>(W)) return M->GetText().ToString();
		return FString();
	};
	auto Poner = [](UWidget* W, const FString& T) {
		if (UEditableTextBox* E = Cast<UEditableTextBox>(W)) E->SetText(FText::FromString(T));
		if (UMultiLineEditableTextBox* M = Cast<UMultiLineEditableTextBox>(W)) M->SetText(FText::FromString(T));
	};
	const FString Previo = Leer(Destino).TrimEnd();
	TWeakObjectPtr<UWidget> WD(Destino);
	TWeakObjectPtr<UEMMRecetaUI> Yo(this);
	auto Unir = [Previo](const FString& T) { return Previo.IsEmpty() ? T : Previo + TEXT(" ") + T; };
	const bool bOk = EMMDictado::Empezar(
		[WD, Poner, Unir](const FString& T) { if (WD.IsValid()) Poner(WD.Get(), Unir(T)); },
		[WD, Poner, Unir, Yo](const FString& T, const FString& Error) {
			if (WD.IsValid() && !T.IsEmpty()) Poner(WD.Get(), Unir(T));
			if (Yo.IsValid()) Yo->EtiquetaDictar->SetText(FText::FromString(TEXT("MICRÓFONO · DICTAR")));
			if (Yo.IsValid() && !Error.IsEmpty() && Yo->Modo.IsValid()) Yo->Modo->Avisar(FString::Printf(TEXT("Micrófono: %s. Puedes escribir la receta."), *Error), false);
		});
	if (bOk) EtiquetaDictar->SetText(FText::FromString(TEXT("■ PARAR DICTADO")));
}
