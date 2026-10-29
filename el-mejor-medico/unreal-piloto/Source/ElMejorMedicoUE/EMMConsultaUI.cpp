#include "EMMConsultaUI.h"
#include "EMMConsultaModo.h"
#include "EMMHabla.h"
#include "Blueprint/WidgetTree.h"
#include "Components/Border.h"
#include "Components/Button.h"
#include "Components/ButtonSlot.h"
#include "Components/CanvasPanel.h"
#include "Components/CanvasPanelSlot.h"
#include "Components/HorizontalBox.h"
#include "Components/HorizontalBoxSlot.h"
#include "Components/MultiLineEditableTextBox.h"
#include "Components/TextBlock.h"
#include "Components/VerticalBox.h"
#include "Components/VerticalBoxSlot.h"
#include "HAL/IConsoleManager.h"
#include "Misc/CommandLine.h"
#include "Misc/ConfigCacheIni.h"
#include "Styling/CoreStyle.h"
#include "TimerManager.h"

namespace
{
	const FLinearColor Panel(0.012f, 0.018f, 0.028f, 0.86f);
	const FLinearColor Azul(0.12f, 0.33f, 0.62f, 1.f);
	const FLinearColor Ambar(0.55f, 0.36f, 0.08f, 1.f);
	const FLinearColor Gris(0.10f, 0.12f, 0.15f, 1.f);
	const FLinearColor Rojo(0.55f, 0.08f, 0.06f, 1.f);
	const TCHAR* Seccion = TEXT("ElMejorMedico");
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

// ───────────────────────── Configuración guardada (GameUserSettings.ini) ─────────────────────────
bool UEMMConsultaUI::SubtitulosActivados()
{
	bool b = false;   // por defecto, desactivados
	GConfig->GetBool(Seccion, TEXT("Subtitulos"), b, GGameUserSettingsIni);
	return b;
}
void UEMMConsultaUI::GuardarSubtitulos(bool bActivos)
{
	GConfig->SetBool(Seccion, TEXT("Subtitulos"), bActivos, GGameUserSettingsIni);
	GConfig->Flush(false, GGameUserSettingsIni);
}

int32 UEMMConsultaUI::CalidadGrafica()
{
	int32 N = 1;
	if (!FParse::Value(FCommandLine::Get(), TEXT("EMMCalidad="), N)) GConfig->GetInt(Seccion, TEXT("Calidad"), N, GGameUserSettingsIni);
	return FMath::Clamp(N, 0, 2);
}
void UEMMConsultaUI::GuardarCalidad(int32 Nivel)
{
	GConfig->SetInt(Seccion, TEXT("Calidad"), FMath::Clamp(Nivel, 0, 2), GGameUserSettingsIni);
	GConfig->Flush(false, GGameUserSettingsIni);
}
FString UEMMConsultaUI::NombreCalidad(int32 Nivel) { return Nivel == 0 ? TEXT("RÁPIDA") : Nivel == 2 ? TEXT("ALTA") : TEXT("EQUILIBRADA"); }
void UEMMConsultaUI::AplicarCalidad(int32 Nivel)
{
	// la cámara está quieta y la escena es pequeña: lo que más cuesta es la resolución interna, Lumen y las sombras.
	// TSR reconstruye la imagen a resolución completa, así que bajar la interna apenas se nota en las caras.
	struct FValor { const TCHAR* Nombre; int32 Rapida, Equilibrada, Alta; };
	static const FValor Valores[] = {
		{ TEXT("r.ScreenPercentage"), 60, 85, 100 },
		{ TEXT("sg.GlobalIlluminationQuality"), 1, 2, 3 },
		{ TEXT("sg.ReflectionQuality"), 1, 2, 3 },
		{ TEXT("sg.ShadowQuality"), 1, 2, 3 },
		{ TEXT("sg.PostProcessQuality"), 1, 2, 3 },
		{ TEXT("sg.EffectsQuality"), 1, 2, 3 },
	};
	for (const FValor& V : Valores)
		if (IConsoleVariable* C = IConsoleManager::Get().FindConsoleVariable(V.Nombre))
			C->Set(Nivel == 0 ? V.Rapida : Nivel == 2 ? V.Alta : V.Equilibrada, ECVF_SetByGameSetting);
	UE_LOG(LogTemp, Display, TEXT("[EMM] Calidad gráfica: %s (nivel %d)"), *NombreCalidad(Nivel), Nivel);
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
	UVerticalBox* VIA = WidgetTree->ConstructWidget<UVerticalBox>();
	EstadoIA = Texto(WidgetTree, TEXT("Buscando la IA…"), 15.f, FLinearColor(0.75f, 0.85f, 1.f));
	TextoFecha = Texto(WidgetTree, TEXT(""), 14.f, FLinearColor(1.f, 0.9f, 0.65f), true);
	VIA->AddChildToVerticalBox(TextoFecha);
	VIA->AddChildToVerticalBox(EstadoIA);
	CajaIA->SetContent(VIA);
	if (UCanvasPanelSlot* S = Lienzo->AddChildToCanvas(CajaIA)) { S->SetAnchors(FAnchors(0, 0)); S->SetPosition(FVector2D(24, 20)); S->SetAutoSize(true); }

	// Arriba a la derecha: RECETAR, AGENDA · FICHA y CONFIGURACIÓN
	UHorizontalBox* Arriba = WidgetTree->ConstructWidget<UHorizontalBox>();
	UTextBlock* EAj; UTextBlock* ERec; UTextBlock* EAg; UTextBlock* EPor;
	UButton* BotonPortatil = CrearBoton(TEXT("PORTÁTIL"), FLinearColor(0.05f, 0.25f, 0.45f), EPor, 16.f);
	BotonPortatil->OnClicked.AddDynamic(this, &UEMMConsultaUI::AlPulsarPortatil);
	if (UHorizontalBoxSlot* R = Arriba->AddChildToHorizontalBox(BotonPortatil)) R->SetPadding(FMargin(8, 0, 0, 0));
	UButton* BotonRecetar = CrearBoton(TEXT("RECETAR"), FLinearColor(0.15f, 0.45f, 0.10f), ERec, 16.f);
	UButton* BotonAgenda = CrearBoton(TEXT("AGENDA · FICHA"), Azul, EAg, 16.f);
	UButton* BotonAjustes = CrearBoton(TEXT("CONFIGURACIÓN"), Gris, EAj, 15.f);
	BotonRecetar->OnClicked.AddDynamic(this, &UEMMConsultaUI::AlPulsarRecetar);
	BotonAgenda->OnClicked.AddDynamic(this, &UEMMConsultaUI::AlPulsarAgenda);
	BotonAjustes->OnClicked.AddDynamic(this, &UEMMConsultaUI::AlPulsarAjustes);
	for (UButton* B : { BotonRecetar, BotonAgenda, BotonAjustes })
		if (UHorizontalBoxSlot* R = Arriba->AddChildToHorizontalBox(B)) R->SetPadding(FMargin(8, 0, 0, 0));
	if (UCanvasPanelSlot* S = Lienzo->AddChildToCanvas(Arriba)) { S->SetAnchors(FAnchors(1, 0)); S->SetAlignment(FVector2D(1, 0)); S->SetPosition(FVector2D(-24, 20)); S->SetAutoSize(true); }

	// Avisos, arriba en el centro (breves)
	CajaAviso = Recuadro(WidgetTree, FLinearColor(0.05f, 0.08f, 0.05f, 0.9f), 10.f);
	TextoAviso = Texto(WidgetTree, TEXT(""), 16.f);
	CajaAviso->SetContent(TextoAviso);
	CajaAviso->SetVisibility(ESlateVisibility::Collapsed);
	if (UCanvasPanelSlot* S = Lienzo->AddChildToCanvas(CajaAviso)) { S->SetAnchors(FAnchors(0.25f, 0.f, 0.75f, 0.f)); S->SetOffsets(FMargin(0, 20, 0, 0)); S->SetAutoSize(true); }

	// Subtítulos: abajo, justo encima del panel de la conversación, para no tapar las caras
	CajaSubtitulo = Recuadro(WidgetTree, FLinearColor(0.f, 0.f, 0.f, 0.62f), 12.f);
	UVerticalBox* VSub = WidgetTree->ConstructWidget<UVerticalBox>();
	SubQuien = Texto(WidgetTree, TEXT(""), 14.f, FLinearColor(0.45f, 0.75f, 1.f), true);
	SubTexto = Texto(WidgetTree, TEXT(""), 22.f);
	SubTexto->SetJustification(ETextJustify::Center);
	SubQuien->SetJustification(ETextJustify::Center);
	VSub->AddChildToVerticalBox(SubQuien);
	VSub->AddChildToVerticalBox(SubTexto);
	CajaSubtitulo->SetContent(VSub);
	CajaSubtitulo->SetVisibility(ESlateVisibility::Collapsed);
	if (UCanvasPanelSlot* S = Lienzo->AddChildToCanvas(CajaSubtitulo)) { S->SetAnchors(FAnchors(0.15f, 1.f, 0.85f, 1.f)); S->SetAlignment(FVector2D(0, 1)); S->SetOffsets(FMargin(0, -232, 0, 0)); S->SetAutoSize(true); }

	// Panel de la conversación, abajo y compacto: escribir o dictar, y los dos botones de turno
	UBorder* Abajo = Recuadro(WidgetTree, Panel, 12.f);
	UVerticalBox* Columna = WidgetTree->ConstructWidget<UVerticalBox>();
	Abajo->SetContent(Columna);
	if (UCanvasPanelSlot* S = Lienzo->AddChildToCanvas(Abajo)) { S->SetAnchors(FAnchors(0.f, 1.f, 1.f, 1.f)); S->SetAlignment(FVector2D(0, 1)); S->SetOffsets(FMargin(16, -12, 16, 210)); }
	Estado = Texto(WidgetTree, TEXT("Turno del médico: escribe o dicta lo que quieres decir."), 16.f, FLinearColor(0.85f, 0.9f, 1.f), true);
	Columna->AddChildToVerticalBox(Estado);
	UHorizontalBox* Fila = WidgetTree->ConstructWidget<UHorizontalBox>();
	if (UVerticalBoxSlot* S = Columna->AddChildToVerticalBox(Fila)) { S->SetSize(FSlateChildSize(ESlateSizeRule::Fill)); S->SetPadding(FMargin(0, 8, 0, 0)); }
	Caja = WidgetTree->ConstructWidget<UMultiLineEditableTextBox>();
	Caja->SetHintText(FText::FromString(TEXT("Escribe o dicta lo que quieres decir al paciente…")));
	FTextBlockStyle Estilo = FCoreStyle::Get().GetWidgetStyle<FTextBlockStyle>("NormalText");
	Estilo.SetFont(Fuente(19.f));
	Estilo.SetColorAndOpacity(FSlateColor(FLinearColor::Black));
	Caja->SetTextStyle(Estilo);
	if (UHorizontalBoxSlot* S = Fila->AddChildToHorizontalBox(Caja)) { S->SetSize(FSlateChildSize(ESlateSizeRule::Fill)); S->SetPadding(FMargin(0, 0, 10, 0)); }
	UVerticalBox* Botones = WidgetTree->ConstructWidget<UVerticalBox>();
	UHorizontalBox* FilaArriba = WidgetTree->ConstructWidget<UHorizontalBox>();
	UTextBlock* E1; UTextBlock* E2;
	UTextBlock* EMic = nullptr;
	BotonMicrofono = CrearBoton(TEXT("MICRÓFONO"), Gris, EMic, 17.f);
	EtiquetaMicrofono = EMic;
	BotonMedico = CrearBoton(TEXT("ENVIAR · HABLAR MÉDICO"), Azul, E1);
	BotonPaciente = CrearBoton(TEXT("RESPONDER PACIENTE"), Ambar, E2);
	BotonMicrofono->OnClicked.AddDynamic(this, &UEMMConsultaUI::AlPulsarMicrofono);
	BotonMedico->OnClicked.AddDynamic(this, &UEMMConsultaUI::AlPulsarMedico);
	BotonPaciente->OnClicked.AddDynamic(this, &UEMMConsultaUI::AlPulsarPaciente);
	if (UHorizontalBoxSlot* S = FilaArriba->AddChildToHorizontalBox(BotonMicrofono)) { S->SetPadding(FMargin(0, 0, 8, 0)); }
	if (UHorizontalBoxSlot* S = FilaArriba->AddChildToHorizontalBox(BotonMedico)) S->SetSize(FSlateChildSize(ESlateSizeRule::Fill));
	Botones->AddChildToVerticalBox(FilaArriba);
	if (UVerticalBoxSlot* S = Botones->AddChildToVerticalBox(BotonPaciente)) S->SetPadding(FMargin(0, 8, 0, 0));
	if (UHorizontalBoxSlot* S = Fila->AddChildToHorizontalBox(Botones)) { FSlateChildSize Tam(ESlateSizeRule::Fill); Tam.Value = 0.8f; S->SetSize(Tam); }

	// CONFIGURACIÓN (ventana pequeña)
	CajaAjustes = Recuadro(WidgetTree, FLinearColor(0.02f, 0.03f, 0.05f, 0.96f), 22.f);
	UVerticalBox* VAj = WidgetTree->ConstructWidget<UVerticalBox>();
	VAj->AddChildToVerticalBox(Texto(WidgetTree, TEXT("CONFIGURACIÓN"), 22.f, FLinearColor::White, true));
	UTextBlock* ESub = nullptr;
	UButton* BotonSub = CrearBoton(TEXT(""), Gris, ESub, 18.f);
	EtiquetaSubtitulos = ESub;
	BotonSub->OnClicked.AddDynamic(this, &UEMMConsultaUI::AlPulsarSubtitulos);
	if (UVerticalBoxSlot* S = VAj->AddChildToVerticalBox(BotonSub)) S->SetPadding(FMargin(0, 14, 0, 0));
	UTextBlock* ECal = nullptr;
	UButton* BotonCal = CrearBoton(TEXT(""), Gris, ECal, 18.f);
	EtiquetaCalidad = ECal;
	BotonCal->OnClicked.AddDynamic(this, &UEMMConsultaUI::AlPulsarCalidad);
	if (UVerticalBoxSlot* S = VAj->AddChildToVerticalBox(BotonCal)) S->SetPadding(FMargin(0, 8, 0, 0));
	// créditos obligatorios de las voces (licencias CC BY) y aviso de simulación
	UTextBlock* Creditos = Texto(WidgetTree, TEXT("Créditos de voces: corpus Sharvard (Aubanel, García Lecumberri y Cooke), CC BY 3.0; Multilingual LibriSpeech (OpenSLR 94), CC BY 4.0; davefx (CC0); carlfm (dominio público). Modelos Piper (MIT).\nSimulación: pacientes, médicos, centro y recetas ficticios, sin validez médica."), 11.f, FLinearColor(0.7f, 0.75f, 0.85f));
	Creditos->SetWrapTextAt(430.f);
	if (UVerticalBoxSlot* S = VAj->AddChildToVerticalBox(Creditos)) S->SetPadding(FMargin(0, 12, 0, 0));
	UTextBlock* ECerrar;
	UButton* BotonCerrar = CrearBoton(TEXT("CERRAR"), Azul, ECerrar, 16.f);
	BotonCerrar->OnClicked.AddDynamic(this, &UEMMConsultaUI::AlPulsarCerrarAjustes);
	if (UVerticalBoxSlot* S = VAj->AddChildToVerticalBox(BotonCerrar)) S->SetPadding(FMargin(0, 14, 0, 0));
	CajaAjustes->SetContent(VAj);
	CajaAjustes->SetVisibility(ESlateVisibility::Collapsed);
	if (UCanvasPanelSlot* S = Lienzo->AddChildToCanvas(CajaAjustes)) { S->SetAnchors(FAnchors(1, 0)); S->SetAlignment(FVector2D(1, 0)); S->SetPosition(FVector2D(-24, 70)); S->SetAutoSize(true); }
	RefrescarAjustes();

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

void UEMMConsultaUI::RefrescarAjustes()
{
	EtiquetaSubtitulos->SetText(FText::FromString(SubtitulosActivados() ? TEXT("SUBTÍTULOS: ON") : TEXT("SUBTÍTULOS: OFF")));
	EtiquetaCalidad->SetText(FText::FromString(TEXT("CALIDAD GRÁFICA: ") + NombreCalidad(CalidadGrafica())));
}

void UEMMConsultaUI::NativeTick(const FGeometry& Geometria, float Dt)
{
	Super::NativeTick(Geometria, Dt);
	// subtítulos sincronizados: se ve lo que la voz ya ha dicho
	const FString Dicho = HablaSubtitulo && SubtitulosActivados() ? HablaSubtitulo->TextoDicho() : FString();
	if (Dicho.Len())
	{
		SubTexto->SetText(FText::FromString(Dicho));
		CajaSubtitulo->SetVisibility(ESlateVisibility::HitTestInvisible);
	}
	else CajaSubtitulo->SetVisibility(ESlateVisibility::Collapsed);
}

void UEMMConsultaUI::PonerEstado(const FString& T, bool bTurnoPaciente)
{
	Estado->SetText(FText::FromString(T));
	Estado->SetColorAndOpacity(FSlateColor(bTurnoPaciente ? FLinearColor(1.f, 0.8f, 0.4f) : FLinearColor(0.7f, 0.85f, 1.f)));
}
void UEMMConsultaUI::PonerIA(const FString& T) { EstadoIA->SetText(FText::FromString(T + TEXT(" · piloto Unreal 0.3"))); }
void UEMMConsultaUI::PonerFecha(const FString& T) { TextoFecha->SetText(FText::FromString(T)); }
void UEMMConsultaUI::AlPulsarRecetar() { if (Modo.IsValid()) Modo->AbrirRecetas(); }
void UEMMConsultaUI::AlPulsarAgenda() { if (Modo.IsValid()) Modo->AbrirAgenda(); }
void UEMMConsultaUI::AlPulsarPortatil() { if (Modo.IsValid()) Modo->AbrirPortatil(); }

FReply UEMMConsultaUI::NativeOnPreviewKeyDown(const FGeometry& Geometria, const FKeyEvent& Tecla)
{
	if (!Modo.IsValid()) return Super::NativeOnPreviewKeyDown(Geometria, Tecla);
	const FKey K = Tecla.GetKey();
	if (K == EKeys::Gamepad_FaceButton_Left) { Modo->Dictar(); return FReply::Handled(); }
	if (K == EKeys::Gamepad_RightShoulder) { Modo->HablarMedico(TextoEscrito()); return FReply::Handled(); }
	if (K == EKeys::Gamepad_FaceButton_Top) { Modo->ResponderPaciente(); return FReply::Handled(); }
	if (K == EKeys::Gamepad_LeftShoulder) { Modo->AbrirPortatil(); return FReply::Handled(); }
	if (K == EKeys::Gamepad_Special_Left) { Modo->AbrirAgenda(); return FReply::Handled(); }
	if (K == EKeys::Gamepad_Special_Right) { AlPulsarAjustes(); return FReply::Handled(); }
	if (K == EKeys::Gamepad_RightTrigger) { Modo->AbrirRecetas(); return FReply::Handled(); }
	if (K == EKeys::Gamepad_FaceButton_Right || K == EKeys::Escape) { Modo->CerrarVentanas(); CajaAjustes->SetVisibility(ESlateVisibility::Collapsed); return FReply::Handled(); }
	// teclado: Ctrl+Intro envía lo escrito
	if (K == EKeys::Enter && Tecla.IsControlDown()) { Modo->HablarMedico(TextoEscrito()); return FReply::Handled(); }
	return Super::NativeOnPreviewKeyDown(Geometria, Tecla);
}
void UEMMConsultaUI::PonerSubtitulo(const FString& Quien, UEMMHabla* Habla, bool bMedico)
{
	// FText::ToUpper usa las reglas del idioma (FString::ToUpper deja «ó» en minúscula)
	SubQuien->SetText(FText::FromString(Quien).ToUpper());
	SubQuien->SetColorAndOpacity(FSlateColor(bMedico ? FLinearColor(0.45f, 0.75f, 1.f) : FLinearColor(1.f, 0.75f, 0.35f)));
	HablaSubtitulo = Habla;
}
void UEMMConsultaUI::QuitarSubtitulo() { HablaSubtitulo = nullptr; }
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
	BotonMicrofono->SetIsEnabled(bMedico);
	Caja->SetIsEnabled(bMedico);
}
void UEMMConsultaUI::PonerDescarga(const FString& T, bool bVisible)
{
	TextoDescarga->SetText(FText::FromString(T));
	CajaDescarga->SetVisibility(bVisible ? ESlateVisibility::Visible : ESlateVisibility::Collapsed);
}
void UEMMConsultaUI::PonerDictado(bool bEscuchando)
{
	EtiquetaMicrofono->SetText(FText::FromString(bEscuchando ? TEXT("■ PARAR") : TEXT("MICRÓFONO")));
	BotonMicrofono->SetBackgroundColor(bEscuchando ? Rojo : Gris);
}
FString UEMMConsultaUI::TextoEscrito() const { return Caja->GetText().ToString().TrimStartAndEnd(); }
void UEMMConsultaUI::PonerTexto(const FString& T) { Caja->SetText(FText::FromString(T)); }
void UEMMConsultaUI::LimpiarTexto() { Caja->SetText(FText::GetEmpty()); }
void UEMMConsultaUI::EnfocarPrincipal()
{
	if (BotonPaciente->GetIsEnabled()) BotonPaciente->SetKeyboardFocus();
	else BotonMicrofono->SetKeyboardFocus();
}

void UEMMConsultaUI::AlPulsarMedico() { if (Modo.IsValid()) Modo->HablarMedico(TextoEscrito()); }
void UEMMConsultaUI::AlPulsarPaciente() { if (Modo.IsValid()) Modo->ResponderPaciente(); }
void UEMMConsultaUI::AlPulsarMicrofono() { if (Modo.IsValid()) Modo->Dictar(); }
void UEMMConsultaUI::AlPulsarDescargar() { if (Modo.IsValid()) Modo->DescargarModelo(); }
void UEMMConsultaUI::AlPulsarCalidad()
{
	const int32 N = (CalidadGrafica() + 1) % 3;   // equilibrada → alta → rápida → equilibrada
	GuardarCalidad(N);
	AplicarCalidad(N);
	if (Modo.IsValid()) Modo->AjustarLuces(N);
	RefrescarAjustes();
}

void UEMMConsultaUI::AlPulsarAjustes()
{
	RefrescarAjustes();
	CajaAjustes->SetVisibility(CajaAjustes->GetVisibility() == ESlateVisibility::Collapsed ? ESlateVisibility::Visible : ESlateVisibility::Collapsed);
}
void UEMMConsultaUI::AlPulsarSubtitulos() { GuardarSubtitulos(!SubtitulosActivados()); RefrescarAjustes(); }
void UEMMConsultaUI::AlPulsarCerrarAjustes() { CajaAjustes->SetVisibility(ESlateVisibility::Collapsed); }
