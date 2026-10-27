#include "EMMAgendaUI.h"
#include "EMMConsultaModo.h"
#include "EMMHistorial.h"
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
#include "Components/UniformGridPanel.h"
#include "Components/UniformGridSlot.h"
#include "Components/VerticalBox.h"
#include "Components/VerticalBoxSlot.h"
#include "Components/WrapBox.h"
#include "Styling/CoreStyle.h"

void EMMEstiloPapel(FEditableTextBoxStyle& S, float Tam);   // EMMRecetaUI.cpp

namespace
{
	const FLinearColor Panel(0.015f, 0.025f, 0.04f, 0.97f);
	const FLinearColor Claro(0.75f, 0.85f, 1.f);
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
}

TSharedRef<SWidget> UEMMAgendaUI::RebuildWidget()
{
	if (!WidgetTree->RootWidget) Construir();
	return Super::RebuildWidget();
}

UButton* UEMMAgendaUI::Boton(const FString& S, const FLinearColor& Color, float Tam)
{
	UButton* B = WidgetTree->ConstructWidget<UButton>();
	B->SetBackgroundColor(Color);
	UTextBlock* E = Texto(WidgetTree, S, Tam, FLinearColor::White, true);
	E->SetJustification(ETextJustify::Center);
	if (UButtonSlot* R = Cast<UButtonSlot>(B->AddChild(E))) R->SetPadding(FMargin(10.f, 8.f));
	return B;
}

void UEMMAgendaUI::Construir()
{
	UCanvasPanel* Lienzo = WidgetTree->ConstructWidget<UCanvasPanel>();
	WidgetTree->RootWidget = Lienzo;
	UBorder* Fondo = Caja(WidgetTree, FLinearColor(0.f, 0.f, 0.f, 0.6f), 30.f);
	if (UCanvasPanelSlot* S = Lienzo->AddChildToCanvas(Fondo)) { S->SetAnchors(FAnchors(0, 0, 1, 1)); S->SetOffsets(FMargin(0)); }
	UBorder* Ventana = Caja(WidgetTree, Panel, 20.f);
	Fondo->SetContent(Ventana);
	UVerticalBox* V = WidgetTree->ConstructWidget<UVerticalBox>();
	Ventana->SetContent(V);
	V->AddChildToVerticalBox(Texto(WidgetTree, TEXT("AGENDA Y FICHA CLÍNICA"), 24.f, FLinearColor::White, true));
	Hoy = Texto(WidgetTree, TEXT(""), 16.f, Claro);
	V->AddChildToVerticalBox(Hoy);
	UHorizontalBox* Columnas = WidgetTree->ConstructWidget<UHorizontalBox>();
	if (UVerticalBoxSlot* R = V->AddChildToVerticalBox(Columnas)) { R->SetSize(FSlateChildSize(ESlateSizeRule::Fill)); R->SetPadding(FMargin(0, 12, 0, 0)); }

	// ── ficha clínica ──
	UBorder* CajaFicha = Caja(WidgetTree, FLinearColor(0.93f, 0.95f, 0.97f, 1.f), 14.f);
	UScrollBox* Desliza = WidgetTree->ConstructWidget<UScrollBox>();
	TextoFicha = Texto(WidgetTree, TEXT(""), 14.f, FLinearColor(0.03f, 0.05f, 0.1f));
	Desliza->AddChild(TextoFicha);
	CajaFicha->SetContent(Desliza);
	if (UHorizontalBoxSlot* R = Columnas->AddChildToHorizontalBox(CajaFicha)) { FSlateChildSize T(ESlateSizeRule::Fill); T.Value = 0.45f; R->SetSize(T); R->SetPadding(FMargin(0, 0, 16, 0)); }

	// ── esta consulta y el calendario ──
	UVerticalBox* Der = WidgetTree->ConstructWidget<UVerticalBox>();
	if (UHorizontalBoxSlot* R = Columnas->AddChildToHorizontalBox(Der)) { FSlateChildSize T(ESlateSizeRule::Fill); T.Value = 0.55f; R->SetSize(T); }
	Der->AddChildToVerticalBox(Texto(WidgetTree, TEXT("ESTA CONSULTA"), 17.f, FLinearColor::White, true));
	Diagnostico = WidgetTree->ConstructWidget<UEditableTextBox>();
	Diagnostico->SetHintText(FText::FromString(TEXT("Diagnóstico (lo escribes tú)")));
	Pruebas = WidgetTree->ConstructWidget<UEditableTextBox>();
	Pruebas->SetHintText(FText::FromString(TEXT("Pruebas solicitadas (analítica, radiografía…)")));
	for (UEditableTextBox* E : { Diagnostico.Get(), Pruebas.Get() })
	{
		EMMEstiloPapel(E->WidgetStyle, 17.f);
		if (UVerticalBoxSlot* R = Der->AddChildToVerticalBox(E)) R->SetPadding(FMargin(0, 6, 0, 0));
	}
	Der->AddChildToVerticalBox(Texto(WidgetTree, TEXT("Revisión en:"), 14.f, Claro, true));
	UWrapBox* Envoltura = WidgetTree->ConstructWidget<UWrapBox>();
	Envoltura->SetInnerSlotPadding(FVector2D(6, 6));
	for (const TPair<FString, int32>& P : TArray<TPair<FString, int32>>{ { TEXT("3 días"), 3 }, { TEXT("1 semana"), 7 }, { TEXT("2 semanas"), 14 }, { TEXT("1 mes"), 30 }, { TEXT("3 meses"), 90 }, { TEXT("Al acabar el tratamiento"), -2 }, { TEXT("Sin revisión"), -1 } })
	{
		UButton* B = Boton(P.Key, FLinearColor(0.10f, 0.14f, 0.2f), 13.f);
		B->SetToolTipText(FText::AsNumber(P.Value));
		B->OnClicked.AddDynamic(this, &UEMMAgendaUI::AlIntervalo);
		Envoltura->AddChildToWrapBox(B);
	}
	if (UVerticalBoxSlot* R = Der->AddChildToVerticalBox(Envoltura)) R->SetPadding(FMargin(0, 4, 0, 0));
	TextoRevision = Texto(WidgetTree, TEXT(""), 14.f, FLinearColor(0.6f, 1.f, 0.6f), true);
	if (UVerticalBoxSlot* R = Der->AddChildToVerticalBox(TextoRevision)) R->SetPadding(FMargin(0, 6, 0, 0));
	BotonTerminar = Boton(TEXT("TERMINAR CONSULTA Y GUARDAR EN LA FICHA"), FLinearColor(0.12f, 0.33f, 0.62f), 16.f);
	BotonTerminar->OnClicked.AddDynamic(this, &UEMMAgendaUI::AlTerminar);
	if (UVerticalBoxSlot* R = Der->AddChildToVerticalBox(BotonTerminar)) R->SetPadding(FMargin(0, 8, 0, 0));

	// calendario del mes
	UHorizontalBox* Cal = WidgetTree->ConstructWidget<UHorizontalBox>();
	if (UVerticalBoxSlot* R = Der->AddChildToVerticalBox(Cal)) { R->SetPadding(FMargin(0, 14, 0, 0)); R->SetSize(FSlateChildSize(ESlateSizeRule::Fill)); }
	UVerticalBox* CMes = WidgetTree->ConstructWidget<UVerticalBox>();
	TituloMes = Texto(WidgetTree, TEXT(""), 15.f, FLinearColor::White, true);
	CMes->AddChildToVerticalBox(TituloMes);
	Mes = WidgetTree->ConstructWidget<UUniformGridPanel>();
	Mes->SetSlotPadding(FMargin(2));
	Mes->SetMinDesiredSlotWidth(34.f);
	Mes->SetMinDesiredSlotHeight(26.f);
	CMes->AddChildToVerticalBox(Mes);
	if (UHorizontalBoxSlot* R = Cal->AddChildToHorizontalBox(CMes)) R->SetPadding(FMargin(0, 0, 14, 0));
	UVerticalBox* CCitas = WidgetTree->ConstructWidget<UVerticalBox>();
	CCitas->AddChildToVerticalBox(Texto(WidgetTree, TEXT("PRÓXIMAS CITAS"), 15.f, FLinearColor::White, true));
	TextoCitas = Texto(WidgetTree, TEXT(""), 13.f, Claro);
	CCitas->AddChildToVerticalBox(TextoCitas);
	if (UHorizontalBoxSlot* R = Cal->AddChildToHorizontalBox(CCitas)) R->SetSize(FSlateChildSize(ESlateSizeRule::Fill));

	UHorizontalBox* Pie = WidgetTree->ConstructWidget<UHorizontalBox>();
	BotonAvanzar = Boton(TEXT("AVANZAR EL TIEMPO HASTA LA PRÓXIMA CITA"), FLinearColor(0.15f, 0.45f, 0.10f), 15.f);
	BotonNuevo = Boton(TEXT("PACIENTE NUEVO (DÍA SIGUIENTE)"), FLinearColor(0.55f, 0.36f, 0.08f), 15.f);
	UButton* BCerrar = Boton(TEXT("CERRAR"), FLinearColor(0.10f, 0.12f, 0.15f), 15.f);
	BotonAvanzar->OnClicked.AddDynamic(this, &UEMMAgendaUI::AlAvanzar);
	BotonNuevo->OnClicked.AddDynamic(this, &UEMMAgendaUI::AlNuevo);
	BCerrar->OnClicked.AddDynamic(this, &UEMMAgendaUI::AlCerrar);
	for (UButton* B : { BotonAvanzar.Get(), BotonNuevo.Get(), BCerrar })
		if (UHorizontalBoxSlot* R = Pie->AddChildToHorizontalBox(B)) { R->SetSize(FSlateChildSize(ESlateSizeRule::Fill)); R->SetPadding(FMargin(0, 0, 8, 0)); }
	if (UVerticalBoxSlot* R = V->AddChildToVerticalBox(Pie)) R->SetPadding(FMargin(0, 14, 0, 0));
	SetVisibility(ESlateVisibility::Collapsed);
}

void UEMMAgendaUI::Abrir() { SetVisibility(ESlateVisibility::Visible); Refrescar(); }
void UEMMAgendaUI::Cerrar() { SetVisibility(ESlateVisibility::Collapsed); }
bool UEMMAgendaUI::EstaAbierta() const { return GetVisibility() == ESlateVisibility::Visible; }
void UEMMAgendaUI::Escribir(const FString& D, const FString& P) { Diagnostico->SetText(FText::FromString(D)); Pruebas->SetText(FText::FromString(P)); }

void UEMMAgendaUI::Refrescar()
{
	if (!Modo.IsValid() || !WidgetTree->RootWidget) return;
	FEMMHistorial& H = FEMMHistorial::Get();
	const FEMMPaciente& P = Modo->PacienteActual();
	FEMMFicha* F = Modo->Ficha();
	Hoy->SetText(FText::FromString(FString::Printf(TEXT("Hoy: %s (día %d del juego) · %s"), *FEMMHistorial::Fecha(H.Dia), H.Dia, Modo->EsRevision() ? TEXT("revisión") : TEXT("primera consulta"))));

	// ficha clínica
	TArray<FString> L;
	L.Add(FString::Printf(TEXT("FICHA CLÍNICA · %s %s"), *P.Nombre, *P.Apellidos));
	L.Add(FString::Printf(TEXT("%s · %s · Nº historia %s"), *P.TextoEdad, P.EsMujer() ? TEXT("mujer") : TEXT("hombre"), F ? *F->NumeroHistoria : TEXT("-")));
	L.Add(FString::Printf(TEXT("Antecedentes: %s"), P.Antecedentes.Num() ? *FString::Join(P.Antecedentes, TEXT(", ")) : TEXT("sin antecedentes de interés")));
	L.Add(FString::Printf(TEXT("Alergias: %s"), P.Alergia.IsEmpty() ? TEXT("no conocidas") : P.Alergia == TEXT("aine") ? TEXT("antiinflamatorios (AINE)") : *P.Alergia));
	L.Add(TEXT(""));
	auto Recetas = [&](const TArray<FString>& Ids) {
		for (const FString& Id : Ids)
			if (const FEMMReceta* R = F ? F->Receta(Id) : nullptr)
				L.Add(FString::Printf(TEXT("   %s · %s · %s %s %s · %s%s"), *R->Id, *R->Medicamento, *R->Dosis, *R->Frecuencia, *R->Duracion, *FEMMReceta::TextoEstado(R->Estado), R->Riesgos.Num() ? TEXT(" · (!) RIESGO") : TEXT("")));
	};
	if (F)
		for (const FEMMVisita& X : F->Visitas)
		{
			L.Add(FString::Printf(TEXT("■ %s · %s"), *FEMMHistorial::Fecha(X.Dia), X.bRevision ? TEXT("REVISIÓN") : TEXT("PRIMERA CONSULTA")));
			if (!X.Evolucion.IsEmpty()) L.Add(TEXT("   Evolución: ") + X.Evolucion);
			L.Add(TEXT("   Diagnóstico: ") + (X.Diagnostico.IsEmpty() ? FString(TEXT("(sin anotar)")) : X.Diagnostico));
			if (!X.Pruebas.IsEmpty()) L.Add(TEXT("   Pruebas: ") + X.Pruebas);
			L.Add(FString::Printf(TEXT("   Conversación: %d intervenciones"), X.Charla.Num()));
			Recetas(X.Recetas);
		}
	if (!Modo->ConsultaTerminada())   // ya guardada, sale arriba con las demás
	{
		L.Add(FString::Printf(TEXT("■ HOY · %s (en curso)"), Modo->EsRevision() ? TEXT("REVISIÓN") : TEXT("PRIMERA CONSULTA")));
		if (!Modo->EvolucionActual().IsEmpty()) L.Add(TEXT("   Evolución: ") + Modo->EvolucionActual());
		Recetas(Modo->RecetasVisita());
	}
	TextoFicha->SetText(FText::FromString(FString::Join(L, TEXT("\n"))));

	// revisión elegida
	FString Rev;
	if (Modo->ConsultaTerminada()) Rev = F && F->ProximaRevision > 0 ? FString::Printf(TEXT("Consulta guardada. Revisión: %s."), *FEMMHistorial::Fecha(F->ProximaRevision)) : FString(TEXT("Consulta guardada, sin revisión."));
	else if (DiasRevision == -1) Rev = TEXT("Sin revisión.");
	else if (DiasRevision == -2) Rev = FString::Printf(TEXT("Al acabar el tratamiento: %s."), *FEMMHistorial::Fecha(H.Dia + Modo->DiasTratamiento()));
	else if (DiasRevision > 0) Rev = FString::Printf(TEXT("Revisión el %s."), *FEMMHistorial::Fecha(H.Dia + DiasRevision));
	else Rev = TEXT("Elige cuándo vuelve el paciente.");
	TextoRevision->SetText(FText::FromString(Rev));
	BotonTerminar->SetIsEnabled(!Modo->ConsultaTerminada());
	BotonAvanzar->SetIsEnabled(Modo->ConsultaTerminada() && H.ProximaCita() > 0);
	BotonNuevo->SetIsEnabled(Modo->ConsultaTerminada());

	// calendario: mes de hoy, con hoy en azul y las citas en verde
	const FDateTime D = FDateTime(2027, 1, 4) + FTimespan::FromDays(H.Dia - 1);
	static const TCHAR* Meses[] = { TEXT("ENERO"), TEXT("FEBRERO"), TEXT("MARZO"), TEXT("ABRIL"), TEXT("MAYO"), TEXT("JUNIO"), TEXT("JULIO"), TEXT("AGOSTO"), TEXT("SEPTIEMBRE"), TEXT("OCTUBRE"), TEXT("NOVIEMBRE"), TEXT("DICIEMBRE") };
	TituloMes->SetText(FText::FromString(FString::Printf(TEXT("%s %d"), Meses[D.GetMonth() - 1], D.GetYear())));
	Mes->ClearChildren();
	static const TCHAR* Sem[] = { TEXT("L"), TEXT("M"), TEXT("X"), TEXT("J"), TEXT("V"), TEXT("S"), TEXT("D") };
	for (int32 c = 0; c < 7; ++c)
	{
		UTextBlock* T = Texto(WidgetTree, Sem[c], 12.f, Claro, true);
		T->SetJustification(ETextJustify::Center);
		Mes->AddChildToUniformGrid(T, 0, c);
	}
	const FDateTime Uno(D.GetYear(), D.GetMonth(), 1);
	const int32 Desfase = int32(Uno.GetDayOfWeek());
	const int32 DiaJuegoUno = H.Dia - (D.GetDay() - 1);
	for (int32 d = 1; d <= FDateTime::DaysInMonth(D.GetYear(), D.GetMonth()); ++d)
	{
		const int32 DJ = DiaJuegoUno + d - 1;
		const bool bHoy = DJ == H.Dia;
		const bool bCita = H.Fichas.ContainsByPredicate([&](const FEMMFicha& X) { return X.ProximaRevision == DJ; });
		UBorder* B = Caja(WidgetTree, bHoy ? FLinearColor(0.12f, 0.33f, 0.62f) : bCita ? FLinearColor(0.15f, 0.45f, 0.10f) : FLinearColor(0.08f, 0.1f, 0.13f), 3.f);
		UTextBlock* T = Texto(WidgetTree, FString::FromInt(d), 12.f, FLinearColor::White, bHoy || bCita);
		T->SetJustification(ETextJustify::Center);
		B->SetContent(T);
		const int32 Pos = Desfase + d - 1;
		Mes->AddChildToUniformGrid(B, 1 + Pos / 7, Pos % 7);
	}
	// citas
	TArray<const FEMMFicha*> Citas;
	for (const FEMMFicha& X : H.Fichas) if (X.ProximaRevision > 0) Citas.Add(&X);
	Citas.Sort([](const FEMMFicha& A, const FEMMFicha& B) { return A.ProximaRevision < B.ProximaRevision; });
	TArray<FString> C;
	for (const FEMMFicha* X : Citas) C.Add(FString::Printf(TEXT("%s\n   %s %s (revisión)"), *FEMMHistorial::Fecha(X->ProximaRevision), *X->Nombre, *X->Apellidos));
	TextoCitas->SetText(FText::FromString(C.Num() ? FString::Join(C, TEXT("\n")) : FString(TEXT("No hay citas programadas."))));
}

void UEMMAgendaUI::AlIntervalo()
{
	TArray<UWidget*> Botones;
	WidgetTree->GetAllWidgets(Botones);
	for (UWidget* W : Botones)
		if (UButton* B = Cast<UButton>(W); B && (B->IsHovered() || B->IsPressed()) && !B->GetToolTipText().IsEmpty())
		{
			DiasRevision = FCString::Atoi(*B->GetToolTipText().ToString());
			break;
		}
	Refrescar();
}

void UEMMAgendaUI::AlTerminar()
{
	if (!Modo.IsValid()) return;
	Modo->TerminarConsulta(Diagnostico->GetText().ToString(), Pruebas->GetText().ToString(), DiasRevision);
	Refrescar();
}

void UEMMAgendaUI::AlAvanzar()
{
	if (!Modo.IsValid()) return;
	DiasRevision = 0;
	Diagnostico->SetText(FText::GetEmpty()); Pruebas->SetText(FText::GetEmpty());
	Modo->AvanzarTiempo();
	Refrescar();
}

void UEMMAgendaUI::AlNuevo()
{
	if (!Modo.IsValid()) return;
	DiasRevision = 0;
	Diagnostico->SetText(FText::GetEmpty()); Pruebas->SetText(FText::GetEmpty());
	Modo->PacienteNuevo();
	Cerrar();
}

void UEMMAgendaUI::AlCerrar() { Cerrar(); }
