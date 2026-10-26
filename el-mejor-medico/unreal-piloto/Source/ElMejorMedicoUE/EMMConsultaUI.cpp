#include "EMMConsultaUI.h"
#include "EMMConsultaModo.h"
#include "Blueprint/WidgetTree.h"
#include "Components/Border.h"
#include "Components/Button.h"
#include "Components/ButtonSlot.h"
#include "Components/CanvasPanel.h"
#include "Components/CanvasPanelSlot.h"
#include "Components/HorizontalBox.h"
#include "Components/HorizontalBoxSlot.h"
#include "Components/MultiLineEditableTextBox.h"
#include "Components/ScrollBox.h"
#include "Components/SizeBox.h"
#include "Components/TextBlock.h"
#include "Components/VerticalBox.h"
#include "Components/VerticalBoxSlot.h"
#include "Styling/CoreStyle.h"
#include "TimerManager.h"

namespace
{
	const FLinearColor Panel(0.012f, 0.018f, 0.028f, 0.86f);
	const FLinearColor Azul(0.12f, 0.33f, 0.62f, 1.f);
	const FLinearColor Ambar(0.55f, 0.36f, 0.08f, 1.f);
	const FLinearColor Gris(0.10f, 0.12f, 0.15f, 1.f);
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
	UBorder* Recuadro(UWidgetTree* T, const FLinearColor& Fondo, float Relleno)
	{
		UBorder* B = T->ConstructWidget<UBorder>();
		B->SetBrushColor(Fondo);
		B->SetPadding(FMargin(Relleno));
		return B;
	}
}

TSharedRef<SWidget> UEMMConsultaUI::RebuildWidget()
{
	if (!WidgetTree->RootWidget) Construir();
	return Super::RebuildWidget();
}

UButton* UEMMConsultaUI::CrearBoton(const FString& S, const FLinearColor& Color, UTextBlock*& Etiqueta, float Tam)
{
	UButton* B = WidgetTree->ConstructWidget<UButton>();
	B->SetBackgroundColor(Color);
	Etiqueta = Texto(WidgetTree, S, Tam, FLinearColor::White, true);
	Etiqueta->SetJustification(ETextJustify::Center);
	if (UButtonSlot* Ranura = Cast<UButtonSlot>(B->AddChild(Etiqueta))) Ranura->SetPadding(FMargin(14.f, 10.f));
	return B;
}

void UEMMConsultaUI::Construir()
{
	UCanvasPanel* Lienzo = WidgetTree->ConstructWidget<UCanvasPanel>();
	WidgetTree->RootWidget = Lienzo;

	// Arriba a la izquierda: de dónde salen las respuestas (IA del ordenador, del móvil o predefinidas)
	UBorder* CajaIA = Recuadro(WidgetTree, Panel, 10.f);
	EstadoIA = Texto(WidgetTree, TEXT("Buscando la IA…"), 15.f, FLinearColor(0.75f, 0.85f, 1.f));
	CajaIA->SetContent(EstadoIA);
	if (UCanvasPanelSlot* S = Lienzo->AddChildToCanvas(CajaIA)) { S->SetAnchors(FAnchors(0, 0)); S->SetPosition(FVector2D(24, 20)); S->SetAutoSize(true); }

	// Subtítulos, arriba en el centro
	CajaSubtitulo = Recuadro(WidgetTree, Panel, 16.f);
	UVerticalBox* VSub = WidgetTree->ConstructWidget<UVerticalBox>();
	SubQuien = Texto(WidgetTree, TEXT(""), 15.f, FLinearColor(0.45f, 0.75f, 1.f), true);
	SubTexto = Texto(WidgetTree, TEXT(""), 24.f);
	VSub->AddChildToVerticalBox(SubQuien);
	VSub->AddChildToVerticalBox(SubTexto);
	CajaSubtitulo->SetContent(VSub);
	CajaSubtitulo->SetVisibility(ESlateVisibility::Collapsed);
	if (UCanvasPanelSlot* S = Lienzo->AddChildToCanvas(CajaSubtitulo)) { S->SetAnchors(FAnchors(0.2f, 0.f, 0.8f, 0.f)); S->SetOffsets(FMargin(0, 70, 0, 0)); S->SetAutoSize(true); }

	// Avisos, debajo de los subtítulos
	CajaAviso = Recuadro(WidgetTree, FLinearColor(0.05f, 0.08f, 0.05f, 0.9f), 10.f);
	TextoAviso = Texto(WidgetTree, TEXT(""), 16.f);
	CajaAviso->SetContent(TextoAviso);
	CajaAviso->SetVisibility(ESlateVisibility::Collapsed);
	if (UCanvasPanelSlot* S = Lienzo->AddChildToCanvas(CajaAviso)) { S->SetAnchors(FAnchors(0.25f, 0.f, 0.75f, 0.f)); S->SetOffsets(FMargin(0, 20, 0, 0)); S->SetAutoSize(true); }

	// Panel de la conversación, abajo
	UBorder* Abajo = Recuadro(WidgetTree, Panel, 14.f);
	UHorizontalBox* Fila = WidgetTree->ConstructWidget<UHorizontalBox>();
	Abajo->SetContent(Fila);
	if (UCanvasPanelSlot* S = Lienzo->AddChildToCanvas(Abajo)) { S->SetAnchors(FAnchors(0.f, 1.f, 1.f, 1.f)); S->SetAlignment(FVector2D(0, 1)); S->SetOffsets(FMargin(16, -16, 16, 300)); }

	// izquierda: preguntas sugeridas (se copian al cuadro; no se dicen solas)
	UVerticalBox* Izq = WidgetTree->ConstructWidget<UVerticalBox>();
	Izq->AddChildToVerticalBox(Texto(WidgetTree, TEXT("Preguntas sugeridas (se copian al cuadro):"), 14.f, FLinearColor(0.7f, 0.7f, 0.75f)));
	UScrollBox* Desliza = WidgetTree->ConstructWidget<UScrollBox>();
	Sugerencias = WidgetTree->ConstructWidget<UVerticalBox>();
	Desliza->AddChild(Sugerencias);
	if (UVerticalBoxSlot* S = Izq->AddChildToVerticalBox(Desliza)) S->SetSize(FSlateChildSize(ESlateSizeRule::Fill));
	if (UHorizontalBoxSlot* S = Fila->AddChildToHorizontalBox(Izq)) { S->SetSize(FSlateChildSize(ESlateSizeRule::Fill)); S->SetPadding(FMargin(0, 0, 14, 0)); }

	// derecha: estado, cuadro de texto y botones
	UVerticalBox* Der = WidgetTree->ConstructWidget<UVerticalBox>();
	Estado = Texto(WidgetTree, TEXT("Turno del médico: escribe lo que quieres decir."), 17.f, FLinearColor(0.85f, 0.9f, 1.f), true);
	Der->AddChildToVerticalBox(Estado);
	Caja = WidgetTree->ConstructWidget<UMultiLineEditableTextBox>();
	Caja->SetHintText(FText::FromString(TEXT("Escribe lo que quieres decir al paciente…")));
	FTextBlockStyle Estilo = FCoreStyle::Get().GetWidgetStyle<FTextBlockStyle>("NormalText");
	Estilo.SetFont(Fuente(19.f));
	Estilo.SetColorAndOpacity(FSlateColor(FLinearColor::Black));
	Caja->SetTextStyle(Estilo);
	if (UVerticalBoxSlot* S = Der->AddChildToVerticalBox(Caja)) { S->SetSize(FSlateChildSize(ESlateSizeRule::Fill)); S->SetPadding(FMargin(0, 8)); }
	UHorizontalBox* Botones = WidgetTree->ConstructWidget<UHorizontalBox>();
	UTextBlock* E1; UTextBlock* E2;
	BotonMedico = CrearBoton(TEXT("ENVIAR · HABLAR MÉDICO"), Azul, E1);
	BotonPaciente = CrearBoton(TEXT("RESPONDER PACIENTE"), Ambar, E2);
	BotonMedico->OnClicked.AddDynamic(this, &UEMMConsultaUI::AlPulsarMedico);
	BotonPaciente->OnClicked.AddDynamic(this, &UEMMConsultaUI::AlPulsarPaciente);
	if (UHorizontalBoxSlot* S = Botones->AddChildToHorizontalBox(BotonMedico)) { S->SetSize(FSlateChildSize(ESlateSizeRule::Fill)); S->SetPadding(FMargin(0, 0, 8, 0)); }
	if (UHorizontalBoxSlot* S = Botones->AddChildToHorizontalBox(BotonPaciente)) S->SetSize(FSlateChildSize(ESlateSizeRule::Fill));
	Der->AddChildToVerticalBox(Botones);
	if (UHorizontalBoxSlot* S = Fila->AddChildToHorizontalBox(Der)) { FSlateChildSize Tam(ESlateSizeRule::Fill); Tam.Value = 1.6f; S->SetSize(Tam); }

	// Descarga del modelo del móvil (sólo Android, la primera vez)
	CajaDescarga = Recuadro(WidgetTree, FLinearColor(0.02f, 0.03f, 0.05f, 0.95f), 24.f);
	UVerticalBox* VDes = WidgetTree->ConstructWidget<UVerticalBox>();
	VDes->AddChildToVerticalBox(Texto(WidgetTree, TEXT("IA de los pacientes en el móvil"), 26.f, FLinearColor::White, true));
	TextoDescarga = Texto(WidgetTree, TEXT(""), 18.f);
	VDes->AddChildToVerticalBox(TextoDescarga);
	UTextBlock* E3;
	BotonDescargar = CrearBoton(TEXT("DESCARGAR (2,59 GB)"), Azul, E3);
	BotonDescargar->OnClicked.AddDynamic(this, &UEMMConsultaUI::AlPulsarDescargar);
	if (UVerticalBoxSlot* S = VDes->AddChildToVerticalBox(BotonDescargar)) S->SetPadding(FMargin(0, 14, 0, 0));
	CajaDescarga->SetContent(VDes);
	CajaDescarga->SetVisibility(ESlateVisibility::Collapsed);
	if (UCanvasPanelSlot* S = Lienzo->AddChildToCanvas(CajaDescarga)) { S->SetAnchors(FAnchors(0.2f, 0.15f, 0.8f, 0.15f)); S->SetAutoSize(true); }
}

void UEMMConsultaUI::PonerEstado(const FString& T, bool bTurnoPaciente)
{
	Estado->SetText(FText::FromString(T));
	Estado->SetColorAndOpacity(FSlateColor(bTurnoPaciente ? FLinearColor(1.f, 0.8f, 0.4f) : FLinearColor(0.7f, 0.85f, 1.f)));
}
void UEMMConsultaUI::PonerIA(const FString& T) { EstadoIA->SetText(FText::FromString(T)); }
void UEMMConsultaUI::PonerSubtitulo(const FString& Quien, const FString& T, bool bMedico)
{
	SubQuien->SetText(FText::FromString(Quien.ToUpper()));
	SubQuien->SetColorAndOpacity(FSlateColor(bMedico ? FLinearColor(0.45f, 0.75f, 1.f) : FLinearColor(1.f, 0.75f, 0.35f)));
	SubTexto->SetText(FText::FromString(T));
	CajaSubtitulo->SetVisibility(ESlateVisibility::HitTestInvisible);
}
void UEMMConsultaUI::QuitarSubtitulo() { CajaSubtitulo->SetVisibility(ESlateVisibility::Collapsed); }
void UEMMConsultaUI::Aviso(const FString& T, bool bBien)
{
	TextoAviso->SetText(FText::FromString(T));
	CajaAviso->SetBrushColor(bBien ? FLinearColor(0.04f, 0.12f, 0.06f, 0.92f) : FLinearColor(0.16f, 0.05f, 0.04f, 0.92f));
	CajaAviso->SetVisibility(ESlateVisibility::HitTestInvisible);
	if (UWorld* W = GetWorld())
		W->GetTimerManager().SetTimer(TemporizadorAviso, FTimerDelegate::CreateWeakLambda(this, [this]() { CajaAviso->SetVisibility(ESlateVisibility::Collapsed); }), 7.f, false);
}
void UEMMConsultaUI::PonerBotones(bool bMedico, bool bPaciente)
{
	BotonMedico->SetIsEnabled(bMedico);
	BotonPaciente->SetIsEnabled(bPaciente);
	Caja->SetIsEnabled(bMedico);
	for (UButton* B : BotonesSugerencia) B->SetIsEnabled(bMedico);
}
void UEMMConsultaUI::PonerSugerencias(const TArray<FString>& Lista)
{
	Sugerencias->ClearChildren();
	BotonesSugerencia.Reset();
	TextosSugerencia = Lista;
	for (int32 i = 0; i < FMath::Min(Lista.Num(), 6); ++i)
	{
		UTextBlock* E;
		UButton* B = CrearBoton(Lista[i], Gris, E, 16.f);
		E->SetJustification(ETextJustify::Left);
		switch (i)
		{
		case 0: B->OnClicked.AddDynamic(this, &UEMMConsultaUI::AlPulsarSugerencia0); break;
		case 1: B->OnClicked.AddDynamic(this, &UEMMConsultaUI::AlPulsarSugerencia1); break;
		case 2: B->OnClicked.AddDynamic(this, &UEMMConsultaUI::AlPulsarSugerencia2); break;
		case 3: B->OnClicked.AddDynamic(this, &UEMMConsultaUI::AlPulsarSugerencia3); break;
		case 4: B->OnClicked.AddDynamic(this, &UEMMConsultaUI::AlPulsarSugerencia4); break;
		default: B->OnClicked.AddDynamic(this, &UEMMConsultaUI::AlPulsarSugerencia5); break;
		}
		if (UVerticalBoxSlot* S = Sugerencias->AddChildToVerticalBox(B)) S->SetPadding(FMargin(0, 3));
		BotonesSugerencia.Add(B);
	}
}
void UEMMConsultaUI::PonerDescarga(const FString& T, bool bVisible)
{
	TextoDescarga->SetText(FText::FromString(T));
	CajaDescarga->SetVisibility(bVisible ? ESlateVisibility::Visible : ESlateVisibility::Collapsed);
}
FString UEMMConsultaUI::TextoEscrito() const { return Caja->GetText().ToString().TrimStartAndEnd(); }
void UEMMConsultaUI::LimpiarTexto() { Caja->SetText(FText::GetEmpty()); }
void UEMMConsultaUI::EnfocarPrincipal()
{
	if (BotonPaciente->GetIsEnabled()) BotonPaciente->SetKeyboardFocus();
	else if (BotonesSugerencia.Num()) BotonesSugerencia[0]->SetKeyboardFocus();
}

void UEMMConsultaUI::AlPulsarMedico() { if (Modo.IsValid()) Modo->HablarMedico(TextoEscrito()); }
void UEMMConsultaUI::AlPulsarPaciente() { if (Modo.IsValid()) Modo->ResponderPaciente(); }
void UEMMConsultaUI::AlPulsarDescargar() { if (Modo.IsValid()) Modo->DescargarModelo(); }
void UEMMConsultaUI::UsarSugerencia(int32 i)
{
	if (!TextosSugerencia.IsValidIndex(i)) return;
	Caja->SetText(FText::FromString(TextosSugerencia[i]));
	BotonMedico->SetKeyboardFocus();   // con el mando, el siguiente botón es ENVIAR · HABLAR MÉDICO
}
void UEMMConsultaUI::AlPulsarSugerencia0() { UsarSugerencia(0); }
void UEMMConsultaUI::AlPulsarSugerencia1() { UsarSugerencia(1); }
void UEMMConsultaUI::AlPulsarSugerencia2() { UsarSugerencia(2); }
void UEMMConsultaUI::AlPulsarSugerencia3() { UsarSugerencia(3); }
void UEMMConsultaUI::AlPulsarSugerencia4() { UsarSugerencia(4); }
void UEMMConsultaUI::AlPulsarSugerencia5() { UsarSugerencia(5); }
