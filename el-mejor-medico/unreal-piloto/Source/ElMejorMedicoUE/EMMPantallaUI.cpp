#include "EMMPantallaUI.h"
#include "EMMConsultaModo.h"
#include "EMMHistorial.h"
#include "Blueprint/WidgetTree.h"
#include "Components/Border.h"
#include "Components/Button.h"
#include "Components/ButtonSlot.h"
#include "Components/CanvasPanel.h"
#include "Components/CanvasPanelSlot.h"
#include "Components/HorizontalBox.h"
#include "Components/HorizontalBoxSlot.h"
#include "Components/ScrollBox.h"
#include "Components/TextBlock.h"
#include "Components/VerticalBox.h"
#include "Components/VerticalBoxSlot.h"
#include "Styling/CoreStyle.h"

namespace
{
	// colores de un programa clínico: azul marino, blanco y avisos en rojo o ámbar
	const FLinearColor Marino(0.012f, 0.045f, 0.11f, 1.f);
	const FLinearColor MenuFondo(0.025f, 0.075f, 0.16f, 1.f);
	const FLinearColor Activo(0.08f, 0.32f, 0.62f, 1.f);
	const FLinearColor Fondo(0.86f, 0.89f, 0.93f, 1.f);
	const FLinearColor Tinta(0.03f, 0.05f, 0.10f, 1.f);
	const FLinearColor Azul(0.05f, 0.25f, 0.55f, 1.f);
	const FLinearColor Rojo(0.70f, 0.06f, 0.05f, 1.f);
	const FLinearColor Ambar(0.65f, 0.38f, 0.02f, 1.f);
	const FLinearColor Verde(0.07f, 0.40f, 0.14f, 1.f);
	FSlateFontInfo Fuente(float Tam, bool bNegrita = false) { return FCoreStyle::GetDefaultFontStyle(bNegrita ? "Bold" : "Regular", Tam); }
	UTextBlock* Texto(UWidgetTree* T, const FString& S, float Tam, const FLinearColor& Color, bool bNegrita = false)
	{
		UTextBlock* B = T->ConstructWidget<UTextBlock>();
		B->SetText(FText::FromString(S));
		B->SetFont(Fuente(Tam, bNegrita));
		B->SetColorAndOpacity(FSlateColor(Color));
		B->SetAutoWrapText(true);
		return B;
	}
	UBorder* Caja(UWidgetTree* T, const FLinearColor& C, const FMargin& M)
	{
		UBorder* B = T->ConstructWidget<UBorder>();
		B->SetBrushColor(C);
		B->SetPadding(M);
		return B;
	}
	// ¿se pidió esta prueba? (en el texto libre de «Pruebas solicitadas»)
	bool Pedida(const FString& Pruebas, const TCHAR* Clave)
	{
		const FString P = EMMDatos::Normaliza(Pruebas);
		const FString K = Clave;
		if (K == TEXT("sangre")) return P.Contains(TEXT("anal")) || P.Contains(TEXT("sangre")) || P.Contains(TEXT("hemograma")) || P.Contains(TEXT("bioquim"));
		if (K == TEXT("orina")) return P.Contains(TEXT("orina"));
		if (K == TEXT("rx")) return P.Contains(TEXT("radiograf")) || P.Contains(TEXT("rx")) || P.Contains(TEXT("placa"));
		if (K == TEXT("ecg")) return P.Contains(TEXT("electro")) || P.Contains(TEXT("ecg"));
		if (K == TEXT("eco")) return P.Contains(TEXT("ecograf")) || P.Contains(TEXT("eco "));
		if (K == TEXT("tac")) return P.Contains(TEXT("tac")) || P.Contains(TEXT("escaner")) || P.Contains(TEXT("tomograf"));
		return false;
	}
}

FString UEMMPantallaUI::NombrePestana(EEMMPestana P)
{
	switch (P)
	{
	case EEMMPestana::Paciente: return TEXT("PACIENTE");
	case EEMMPestana::Consulta: return TEXT("CONSULTA ACTUAL");
	case EEMMPestana::Historial: return TEXT("HISTORIAL CLÍNICO");
	case EEMMPestana::Pruebas: return TEXT("PRUEBAS Y RESULTADOS");
	case EEMMPestana::Recetas: return TEXT("RECETAS Y TRATAMIENTOS");
	case EEMMPestana::Agenda: return TEXT("AGENDA Y CITAS");
	default: return FString();
	}
}

TSharedRef<SWidget> UEMMPantallaUI::RebuildWidget()
{
	if (!WidgetTree->RootWidget) Construir();
	return Super::RebuildWidget();
}

void UEMMPantallaUI::Construir()
{
	UCanvasPanel* Lienzo = WidgetTree->ConstructWidget<UCanvasPanel>();
	WidgetTree->RootWidget = Lienzo;
	UBorder* Marco = Caja(WidgetTree, bAmpliada ? FLinearColor(0, 0, 0, 0.75f) : Marino, FMargin(bAmpliada ? 40.f : 0.f));
	if (UCanvasPanelSlot* S = Lienzo->AddChildToCanvas(Marco)) { S->SetAnchors(FAnchors(0, 0, 1, 1)); S->SetOffsets(FMargin(0)); }
	UVerticalBox* Todo = WidgetTree->ConstructWidget<UVerticalBox>();
	UBorder* Ventana = Caja(WidgetTree, Fondo, FMargin(0));
	Ventana->SetContent(Todo);
	Marco->SetContent(Ventana);

	// barra superior: programa, paciente, médico, fecha y hora
	UBorder* Barra = Caja(WidgetTree, Marino, FMargin(18.f, 10.f));
	UHorizontalBox* FB = WidgetTree->ConstructWidget<UHorizontalBox>();
	Barra->SetContent(FB);
	UVerticalBox* Prog = WidgetTree->ConstructWidget<UVerticalBox>();
	Prog->AddChildToVerticalBox(Texto(WidgetTree, TEXT("HSM · Historia Clínica Electrónica"), 22.f, FLinearColor::White, true));
	Cabecera = Texto(WidgetTree, TEXT(""), 17.f, FLinearColor(0.7f, 0.85f, 1.f));
	Prog->AddChildToVerticalBox(Cabecera);
	if (UHorizontalBoxSlot* R = FB->AddChildToHorizontalBox(Prog)) R->SetSize(FSlateChildSize(ESlateSizeRule::Fill));
	CabeceraDerecha = Texto(WidgetTree, TEXT(""), 16.f, FLinearColor(0.85f, 0.9f, 1.f));
	CabeceraDerecha->SetJustification(ETextJustify::Right);
	if (UHorizontalBoxSlot* R = FB->AddChildToHorizontalBox(CabeceraDerecha)) R->SetVerticalAlignment(VAlign_Center);
	if (bAmpliada)
	{
		BotonCerrar = WidgetTree->ConstructWidget<UButton>();
		BotonCerrar->SetBackgroundColor(FLinearColor(0.55f, 0.08f, 0.06f));
		UTextBlock* E = Texto(WidgetTree, TEXT("CERRAR"), 18.f, FLinearColor::White, true);
		if (UButtonSlot* R = Cast<UButtonSlot>(BotonCerrar->AddChild(E))) R->SetPadding(FMargin(16, 8));
		BotonCerrar->OnClicked.AddDynamic(this, &UEMMPantallaUI::AlCerrar);
		if (UHorizontalBoxSlot* R = FB->AddChildToHorizontalBox(BotonCerrar)) { R->SetPadding(FMargin(16, 0, 0, 0)); R->SetVerticalAlignment(VAlign_Center); }
	}
	Todo->AddChildToVerticalBox(Barra);

	// menú lateral y contenido
	UHorizontalBox* Cuerpo = WidgetTree->ConstructWidget<UHorizontalBox>();
	if (UVerticalBoxSlot* R = Todo->AddChildToVerticalBox(Cuerpo)) R->SetSize(FSlateChildSize(ESlateSizeRule::Fill));
	UBorder* FondoMenu = Caja(WidgetTree, MenuFondo, FMargin(10.f));
	Menu = WidgetTree->ConstructWidget<UVerticalBox>();
	FondoMenu->SetContent(Menu);
	if (UHorizontalBoxSlot* R = Cuerpo->AddChildToHorizontalBox(FondoMenu)) R->SetSize(FSlateChildSize(ESlateSizeRule::Automatic));
	for (int32 i = 0; i < int32(EEMMPestana::Num); ++i)
	{
		UButton* B = WidgetTree->ConstructWidget<UButton>();
		B->SetBackgroundColor(MenuFondo);
		UTextBlock* E = Texto(WidgetTree, NombrePestana(EEMMPestana(i)), 17.f, FLinearColor::White, true);
		E->SetAutoWrapText(false);
		if (UButtonSlot* R = Cast<UButtonSlot>(B->AddChild(E))) { R->SetPadding(FMargin(14, 12)); R->SetHorizontalAlignment(HAlign_Left); }
		B->SetToolTipText(FText::AsNumber(i));
		B->OnClicked.AddDynamic(this, &UEMMPantallaUI::AlMenu);
		if (UVerticalBoxSlot* R = Menu->AddChildToVerticalBox(B)) R->SetPadding(FMargin(0, 0, 0, 6));
	}
	UVerticalBox* Derecha = WidgetTree->ConstructWidget<UVerticalBox>();
	if (UHorizontalBoxSlot* R = Cuerpo->AddChildToHorizontalBox(Derecha)) { R->SetSize(FSlateChildSize(ESlateSizeRule::Fill)); R->SetPadding(FMargin(16, 12)); }
	TituloPestana = Texto(WidgetTree, TEXT(""), 24.f, Azul, true);
	Derecha->AddChildToVerticalBox(TituloPestana);
	UScrollBox* Desliza = WidgetTree->ConstructWidget<UScrollBox>();
	if (UVerticalBoxSlot* R = Derecha->AddChildToVerticalBox(Desliza)) { R->SetSize(FSlateChildSize(ESlateSizeRule::Fill)); R->SetPadding(FMargin(0, 8, 0, 0)); }
	UHorizontalBox* Columnas = WidgetTree->ConstructWidget<UHorizontalBox>();
	Desliza->AddChild(Columnas);
	ColIzq = WidgetTree->ConstructWidget<UVerticalBox>();
	ColDer = WidgetTree->ConstructWidget<UVerticalBox>();
	if (UHorizontalBoxSlot* R = Columnas->AddChildToHorizontalBox(ColIzq)) { R->SetSize(FSlateChildSize(ESlateSizeRule::Fill)); R->SetPadding(FMargin(0, 0, 8, 0)); }
	if (UHorizontalBoxSlot* R = Columnas->AddChildToHorizontalBox(ColDer)) { R->SetSize(FSlateChildSize(ESlateSizeRule::Fill)); R->SetPadding(FMargin(8, 0, 0, 0)); }
}

TArray<UEMMPantallaUI::FTarjeta> UEMMPantallaUI::Contenido() const
{
	TArray<FTarjeta> T;
	if (!Modo.IsValid()) return T;
	const FEMMHistorial& H = FEMMHistorial::Get();
	const FEMMPaciente& P = Modo->PacienteActual();
	const FEMMFicha* F = Modo->Ficha();
	const FEMMVisita& V = Modo->VisitaActual();
	auto Receta = [](const FEMMReceta& R) {
		return FString::Printf(TEXT("%s · %s\n   %s %s · %s · %s%s"), *R.Id, *R.Medicamento, *R.Dosis, *R.Frecuencia, *R.Duracion, *FEMMReceta::TextoEstado(R.Estado), R.Riesgos.Num() ? *(FString(TEXT("\n   (!) ")) + R.Riesgos[0]) : TEXT(""));
	};
	switch (Pestana)
	{
	case EEMMPestana::Paciente:
	{
		// lo primero que se ve: los signos de alarma del triaje (un paciente grave no puede esperar)
		const TArray<FString> Alarma = EMMEvolucion::SignosAlarma(P);
		if (Alarma.Num()) T.Add({ TEXT("ALERTA DE TRIAJE · VALORAR URGENCIAS"), FString::Join(Alarma, TEXT("\n")), Rojo, true });
		T.Add({ TEXT("DATOS DEL PACIENTE"), FString::Printf(TEXT("%s %s\n%s · %s\nNº historia: %s%s"), *P.Nombre, *P.Apellidos, *P.TextoEdad, P.EsMujer() ? TEXT("mujer") : TEXT("hombre"),
			F ? *F->NumeroHistoria : TEXT("—"), P.Acompanante.IsEmpty() ? TEXT("") : *(TEXT("\nViene con ") + P.Acompanante.Replace(TEXT("su "), TEXT("su ")))), Tinta });
		T.Add({ TEXT("ALERGIAS"), P.Alergia.IsEmpty() ? FString(TEXT("No conocidas")) : P.Alergia == TEXT("aine") ? FString(TEXT("ANTIINFLAMATORIOS (AINE)")) : P.Alergia.ToUpper(), P.Alergia.IsEmpty() ? Verde : Rojo });
		T.Add({ TEXT("ANTECEDENTES"), P.Antecedentes.Num() ? FString::Join(P.Antecedentes, TEXT(" · ")) : FString(TEXT("Sin antecedentes de interés")), Tinta });
		T.Add({ TEXT("HÁBITOS"), FString::Printf(TEXT("Tabaco: %s · Alcohol: %s"), P.bFumador ? TEXT("sí") : TEXT("no"), P.bBebedor ? TEXT("habitual") : TEXT("ocasional o nunca")), Tinta });
		const float* Temp = P.Constantes.Find(TEXT("temp")); const float* Tas = P.Constantes.Find(TEXT("tas")); const float* Tad = P.Constantes.Find(TEXT("tad"));
		const float* Fc = P.Constantes.Find(TEXT("fc")); const float* Sat = P.Constantes.Find(TEXT("sat")); const float* Fr = P.Constantes.Find(TEXT("fr"));
		if (Temp && Tas && Tad && Fc && Sat)
		{
			const bool bMal = *Temp >= 37.8f || *Sat < 94.f || *Tas >= 150.f || *Fc > 105.f;
			T.Add({ TEXT("CONSTANTES DE HOY (enfermería)"), FString::Printf(TEXT("Temperatura %.1f °C%s\nTensión %.0f/%.0f mmHg%s\nPulso %.0f lpm%s · Respiración %.0f rpm\nSaturación O2 %.0f %%%s"),
				*Temp, *Temp >= 37.8f ? TEXT("  (fiebre)") : TEXT(""), *Tas, *Tad, *Tas >= 140.f ? TEXT("  (alta)") : TEXT(""), *Fc, *Fc > 100.f ? TEXT("  (alta)") : TEXT(""), Fr ? *Fr : 0.f, *Sat, *Sat < 94.f ? TEXT("  (baja)") : TEXT("")), bMal ? Ambar : Tinta });
		}
		T.Add({ TEXT("CITA DE HOY"), FString::Printf(TEXT("%s\n%s"), *FEMMHistorial::Fecha(H.Dia), V.bRevision ? TEXT("Revisión") : TEXT("Primera consulta")), Azul });
		if (!V.Evolucion.IsEmpty()) T.Add({ TEXT("EVOLUCIÓN DESDE LA ÚLTIMA VISITA"), V.Evolucion, Ambar, true });
		break;
	}
	case EEMMPestana::Consulta:
	{
		const FString Escrito = Modo->TextoMedico();
		T.Add({ TEXT("NOTAS DEL MÉDICO"), Escrito.IsEmpty() ? FString(TEXT("(sin notas)")) : Escrito + TEXT("|"), Tinta, true });
		TArray<FString> L;
		const TArray<FEMMLinea>& C = Modo->Conversacion();
		for (int32 i = FMath::Max(0, C.Num() - 10); i < C.Num(); ++i) L.Add(FString::Printf(TEXT("%s: %s"), C[i].bMedico ? TEXT("Médico") : *P.Nombre, *C[i].Texto));
		T.Add({ TEXT("REGISTRO DE LA CONVERSACIÓN"), L.Num() ? FString::Join(L, TEXT("\n")) : FString(TEXT("Aún no se ha hablado.")), Tinta, true });
		if (!V.Pruebas.IsEmpty()) T.Add({ TEXT("PRUEBAS PEDIDAS HOY"), V.Pruebas, Azul, true });
		break;
	}
	case EEMMPestana::Historial:
	{
		if (!F || !F->Visitas.Num()) T.Add({ TEXT("SIN CONSULTAS ANTERIORES"), TEXT("Es la primera vez que viene a esta consulta."), Tinta, true });
		if (F)
			for (int32 i = F->Visitas.Num() - 1; i >= 0; --i)
			{
				const FEMMVisita& X = F->Visitas[i];
				FString S = FString::Printf(TEXT("Diagnóstico: %s"), X.Diagnostico.IsEmpty() ? TEXT("(sin anotar)") : *X.Diagnostico);
				if (!X.Evolucion.IsEmpty()) S += TEXT("\nEvolución: ") + X.Evolucion;
				if (!X.Pruebas.IsEmpty()) S += TEXT("\nPruebas: ") + X.Pruebas;
				S += TEXT("\nDestino: ") + EMMEvolucion::NombreDestino(X.Destino);
				if (X.Seguridad.StartsWith(TEXT("AVISO"))) S += TEXT("\n(!) ") + X.Seguridad;
				for (const FString& Id : X.Recetas) if (const FEMMReceta* R = F->Recetas.FindByPredicate([&](const FEMMReceta& Y) { return Y.Id == Id; })) S += TEXT("\n• ") + R->Medicamento + TEXT(" (") + FEMMReceta::TextoEstado(R->Estado).ToLower() + TEXT(")");
				T.Add({ FString::Printf(TEXT("%s · %s"), *FEMMHistorial::Fecha(X.Dia).ToUpper(), X.bAnticipada ? TEXT("REVISIÓN ANTICIPADA (empeoraba)") : X.bRevision ? TEXT("REVISIÓN") : TEXT("PRIMERA CONSULTA")), S, X.bAnticipada ? Ambar : Tinta, true });
			}
		break;
	}
	case EEMMPestana::Pruebas:
	{
		// pedidas en visitas anteriores: ya tienen resultado; pedidas hoy: tira de orina y ECG en el momento, el resto pendientes
		FString Antes;
		if (F) for (const FEMMVisita& X : F->Visitas) Antes += TEXT(" ") + X.Pruebas;
		const FString Hoy = V.Pruebas;
		auto Estado = [&](const TCHAR* K, bool bRapida) { return Pedida(Antes, K) || (bRapida && Pedida(Hoy, K)) ? 2 : Pedida(Hoy, K) ? 1 : 0; };
		bool bAlguna = false;
		if (int32 E = Estado(TEXT("sangre"), false))
		{
			bAlguna = true;
			FString S;
			if (E == 1) S = TEXT("Extraída hoy. Resultado pendiente (estará en la revisión).");
			else
				for (const EMMDatos::FValorRef& R : EMMDatos::ReferenciasSangre())
					if (const float* X = P.Sangre.Find(R.Clave))
					{
						const bool bAlto = *X > R.Max, bBajo = *X < R.Min;
						S += FString::Printf(TEXT("%s:  %.*f %s   (normal %.*f–%.*f)%s\n"), *R.Nombre, R.Decimales, *X, *R.Unidad,
							R.Decimales, R.Min, R.Decimales, R.Max, bAlto ? TEXT("   ALTO") : bBajo ? TEXT("   BAJO") : TEXT(""));
					}
			T.Add({ TEXT("ANÁLISIS DE SANGRE"), S.TrimEnd(), E == 1 ? Ambar : Tinta, true });
		}
		if (int32 E = Estado(TEXT("orina"), true))
		{
			bAlguna = true;
			TArray<FString> L;
			for (const auto& X : P.Orina) L.Add(FString::Printf(TEXT("%s: %s"), *X.Key, *X.Value));
			T.Add({ TEXT("ORINA (tira reactiva)"), FString::Join(L, TEXT(" · ")), Tinta, true });
		}
		for (const TPair<const TCHAR*, const TCHAR*>& K : { TPair<const TCHAR*, const TCHAR*>(TEXT("ecg"), TEXT("ELECTROCARDIOGRAMA")), { TEXT("rx"), TEXT("RADIOGRAFÍA") }, { TEXT("eco"), TEXT("ECOGRAFÍA") }, { TEXT("tac"), TEXT("TAC") } })
			if (int32 E = Estado(K.Key, FCString::Strcmp(K.Key, TEXT("ecg")) == 0))
			{
				bAlguna = true;
				const FString* Inf = P.Pruebas.Find(K.Key);
				T.Add({ K.Value, E == 1 ? FString(TEXT("Solicitada hoy. Informe pendiente.")) : Inf ? *Inf : FString(TEXT("Sin hallazgos significativos.")), E == 1 ? Ambar : Tinta, true });
			}
		if (!bAlguna) T.Add({ TEXT("SIN PRUEBAS"), TEXT("No se han pedido pruebas. Puedes pedirlas en AGENDA · FICHA › Pruebas solicitadas (analítica, orina, electrocardiograma, radiografía, ecografía, TAC)."), Tinta, true });
		break;
	}
	case EEMMPestana::Recetas:
	{
		TArray<FString> Hoy, Antes;
		if (F)
			for (const FEMMReceta& R : F->Recetas)
				(V.Recetas.Contains(R.Id) ? Hoy : Antes).Add(Receta(R));
		T.Add({ TEXT("RECETAS DE HOY"), Hoy.Num() ? FString::Join(Hoy, TEXT("\n")) : FString(TEXT("Ninguna (botón RECETAR).")), Azul, true });
		T.Add({ TEXT("TRATAMIENTOS ANTERIORES"), Antes.Num() ? FString::Join(Antes, TEXT("\n")) : FString(TEXT("Ninguno.")), Tinta, true });
		break;
	}
	case EEMMPestana::Agenda:
	{
		TArray<FString> L;
		L.Add(FString::Printf(TEXT("HOY · %s %s (%s, en consulta)"), *P.Nombre, *P.Apellidos, V.bRevision ? TEXT("revisión") : TEXT("primera visita")));
		TArray<const FEMMFicha*> Citas;
		for (const FEMMFicha& X : H.Fichas) if (X.ProximaRevision > 0) Citas.Add(&X);
		Citas.Sort([](const FEMMFicha& A, const FEMMFicha& B) { return A.ProximaRevision < B.ProximaRevision; });
		for (const FEMMFicha* X : Citas) L.Add(FString::Printf(TEXT("%s · %s %s (revisión)"), *FEMMHistorial::Fecha(X->ProximaRevision), *X->Nombre, *X->Apellidos));
		T.Add({ FString::Printf(TEXT("AGENDA · %s"), *FEMMHistorial::Fecha(H.Dia).ToUpper()), FString::Join(L, TEXT("\n")), Tinta, true });
		T.Add({ TEXT("PACIENTES CON FICHA"), FString::Printf(TEXT("%d pacientes atendidos en total"), H.Fichas.Num()), Azul });
		break;
	}
	default: break;
	}
	return T;
}

void UEMMPantallaUI::Refrescar(bool bForzar)
{
	if (!Modo.IsValid() || !WidgetTree->RootWidget) return;
	const FEMMPaciente& P = Modo->PacienteActual();
	const FEMMFicha* F = Modo->Ficha();
	Cabecera->SetText(FText::FromString(FString::Printf(TEXT("%s %s · %s · NHC %s"), *P.Nombre, *P.Apellidos, *P.TextoEdad, F ? *F->NumeroHistoria : TEXT("—"))));
	const FDateTime Ahora = FDateTime::Now();
	CabeceraDerecha->SetText(FText::FromString(FString::Printf(TEXT("%s\n%s · %02d:%02d"), *Modo->NombreMedico(), *FEMMHistorial::Fecha(FEMMHistorial::Get().Dia), Ahora.GetHour(), Ahora.GetMinute())));
	const TArray<FTarjeta> C = Contenido();
	FString Nueva = FString::FromInt(int32(Pestana));
	for (const FTarjeta& X : C) Nueva += X.Titulo + X.Texto;
	if (!bForzar && Nueva == Firma) return;   // nada nuevo: no se reconstruye
	Firma = Nueva;
	TituloPestana->SetText(FText::FromString(NombrePestana(Pestana)));
	for (int32 i = 0; i < Menu->GetChildrenCount(); ++i)
		if (UButton* B = Cast<UButton>(Menu->GetChildAt(i))) B->SetBackgroundColor(i == int32(Pestana) ? Activo : MenuFondo);
	ColIzq->ClearChildren(); ColDer->ClearChildren();
	int32 n = 0;
	for (const FTarjeta& X : C)
	{
		UBorder* Tarjeta = Caja(WidgetTree, FLinearColor::White, FMargin(14.f, 10.f));
		UVerticalBox* V = WidgetTree->ConstructWidget<UVerticalBox>();
		V->AddChildToVerticalBox(Texto(WidgetTree, X.Titulo, 15.f, X.Color == Tinta ? Azul : X.Color, true));
		if (UVerticalBoxSlot* R = V->AddChildToVerticalBox(Texto(WidgetTree, X.Texto, 18.f, X.Color == Azul ? Tinta : X.Color))) R->SetPadding(FMargin(0, 4, 0, 0));
		Tarjeta->SetContent(V);
		// las anchas ocupan la columna izquierda entera; las pequeñas se reparten
		UVerticalBox* Col = X.bAncha ? ColIzq.Get() : (n++ % 2 == 0 ? ColIzq.Get() : ColDer.Get());
		if (UVerticalBoxSlot* R = Col->AddChildToVerticalBox(Tarjeta)) R->SetPadding(FMargin(0, 0, 0, 12));
	}
	// si todas son anchas, que usen todo el ancho
	ColDer->SetVisibility(ColDer->GetChildrenCount() ? ESlateVisibility::Visible : ESlateVisibility::Collapsed);
}

void UEMMPantallaUI::NativeTick(const FGeometry& Geometria, float Dt)
{
	Super::NativeTick(Geometria, Dt);
	Reloj += Dt;
	if (Reloj >= (bAmpliada ? 0.25f : 0.5f)) { Reloj = 0.f; Refrescar(); }
}

void UEMMPantallaUI::AlMenu()
{
	for (int32 i = 0; i < Menu->GetChildrenCount(); ++i)
		if (UButton* B = Cast<UButton>(Menu->GetChildAt(i)); B && (B->IsHovered() || B->IsPressed() || B->HasKeyboardFocus()))
		{
			PonerPestana(EEMMPestana(i));
			if (Modo.IsValid()) Modo->PestanaPortatil(EEMMPestana(i));   // el portátil 3D enseña lo mismo
			Refrescar(true);
			return;
		}
}

void UEMMPantallaUI::AlCerrar() { if (Modo.IsValid()) Modo->AbrirPortatil(); }

FReply UEMMPantallaUI::NativeOnPreviewKeyDown(const FGeometry& Geometria, const FKeyEvent& Tecla)
{
	if (Modo.IsValid() && (Tecla.GetKey() == EKeys::Gamepad_FaceButton_Right || Tecla.GetKey() == EKeys::Escape)) { Modo->CerrarVentanas(); return FReply::Handled(); }
	return Super::NativeOnPreviewKeyDown(Geometria, Tecla);
}
