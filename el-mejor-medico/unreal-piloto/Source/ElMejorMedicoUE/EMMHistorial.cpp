#include "EMMHistorial.h"
#include "Dom/JsonObject.h"
#include "Internationalization/Regex.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Serialization/JsonWriter.h"

// ───────────────────────── Recetas ─────────────────────────
int32 FEMMReceta::DiasDuracion() const
{
	const FString T = EMMDatos::Normaliza(Duracion);
	FRegexMatcher M(FRegexPattern(TEXT("(\\d+)\\s*(dia|semana|mes)")), T);
	if (M.FindNext())
	{
		const int32 N = FCString::Atoi(*M.GetCaptureGroup(1));
		const FString U = M.GetCaptureGroup(2);
		return U == TEXT("semana") ? N * 7 : U == TEXT("mes") ? N * 30 : N;
	}
	if (T.Contains(TEXT("un mes"))) return 30;
	if (T.Contains(TEXT("una semana"))) return 7;
	if (T.Contains(TEXT("quince dias"))) return 15;
	const int32 N = FCString::Atoi(*T);
	return N > 0 ? N : 0;
}

FString FEMMReceta::TextoEstado(EEMMEstadoReceta E)
{
	switch (E)
	{
	case EEMMEstadoReceta::Guardada: return TEXT("GUARDADA");
	case EEMMEstadoReceta::Entregada: return TEXT("ENTREGADA AL PACIENTE");
	case EEMMEstadoReceta::Anulada: return TEXT("ANULADA");
	default: return TEXT("BORRADOR");
	}
}

FEMMReceta* FEMMFicha::Receta(const FString& Id) { return Recetas.FindByPredicate([&](const FEMMReceta& R) { return R.Id == Id; }); }

// ───────────────────────── Historial (JSON) ─────────────────────────
FEMMHistorial& FEMMHistorial::Get() { static FEMMHistorial H; return H; }

namespace
{
	TArray<TSharedPtr<FJsonValue>> ListaJson(const TArray<FString>& L)
	{
		TArray<TSharedPtr<FJsonValue>> R;
		for (const FString& S : L) R.Add(MakeShared<FJsonValueString>(S));
		return R;
	}
	TArray<FString> ListaDe(const TSharedPtr<FJsonObject>& O, const TCHAR* Campo)
	{
		TArray<FString> R;
		const TArray<TSharedPtr<FJsonValue>>* A;
		if (O->TryGetArrayField(Campo, A)) for (const auto& V : *A) R.Add(V->AsString());
		return R;
	}
}

void FEMMHistorial::Cargar(bool bPrueba)
{
	RutaArchivo = FPaths::ProjectSavedDir() / TEXT("Historial") / (bPrueba ? TEXT("historial_prueba.json") : TEXT("historial.json"));
	Dia = 1; SiguienteReceta = 1; Fichas.Reset();
	if (bPrueba) return;   // la prueba empieza siempre de cero
	FString J; TSharedPtr<FJsonObject> Raiz;
	if (!FFileHelper::LoadFileToString(J, *RutaArchivo) || !FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(J), Raiz) || !Raiz.IsValid()) return;
	Dia = FMath::Max(1, int32(Raiz->GetNumberField(TEXT("dia"))));
	SiguienteReceta = FMath::Max(1, int32(Raiz->GetNumberField(TEXT("siguienteReceta"))));
	for (const auto& VF : Raiz->GetArrayField(TEXT("fichas")))
	{
		const TSharedPtr<FJsonObject> O = VF->AsObject();
		FEMMFicha F;
		F.CasoId = O->GetStringField(TEXT("caso")); F.Nombre = O->GetStringField(TEXT("nombre")); F.Apellidos = O->GetStringField(TEXT("apellidos"));
		F.Sexo = O->GetStringField(TEXT("sexo")); F.Enfermedad = O->GetStringField(TEXT("enfermedad")); F.TextoEdad = O->GetStringField(TEXT("edad"));
		F.NumeroHistoria = O->GetStringField(TEXT("historia"));
		F.ProximaRevision = int32(O->GetNumberField(TEXT("proximaRevision")));
		for (const auto& VR : O->GetArrayField(TEXT("recetas")))
		{
			const TSharedPtr<FJsonObject> R = VR->AsObject();
			FEMMReceta X;
			X.Id = R->GetStringField(TEXT("id")); X.Dia = int32(R->GetNumberField(TEXT("dia")));
			X.Medicamento = R->GetStringField(TEXT("medicamento")); X.Dosis = R->GetStringField(TEXT("dosis"));
			X.Frecuencia = R->GetStringField(TEXT("frecuencia")); X.Duracion = R->GetStringField(TEXT("duracion"));
			X.Instrucciones = R->GetStringField(TEXT("instrucciones"));
			X.Estado = EEMMEstadoReceta(FMath::Clamp(int32(R->GetNumberField(TEXT("estado"))), 0, 3));
			X.Etiquetas = ListaDe(R, TEXT("etiquetas")); X.Riesgos = ListaDe(R, TEXT("riesgos"));
			F.Recetas.Add(MoveTemp(X));
		}
		for (const auto& VV : O->GetArrayField(TEXT("visitas")))
		{
			const TSharedPtr<FJsonObject> V = VV->AsObject();
			FEMMVisita X;
			X.Dia = int32(V->GetNumberField(TEXT("dia"))); X.bRevision = V->GetBoolField(TEXT("revision"));
			X.Diagnostico = V->GetStringField(TEXT("diagnostico")); X.Pruebas = V->GetStringField(TEXT("pruebas"));
			X.Evolucion = V->GetStringField(TEXT("evolucion")); X.Recetas = ListaDe(V, TEXT("recetas"));
			for (const auto& VL : V->GetArrayField(TEXT("charla")))
			{
				const TSharedPtr<FJsonObject> L = VL->AsObject();
				X.Charla.Add({ L->GetBoolField(TEXT("medico")), L->GetStringField(TEXT("texto")), FString() });
			}
			F.Visitas.Add(MoveTemp(X));
		}
		Fichas.Add(MoveTemp(F));
	}
}

bool FEMMHistorial::Guardar() const
{
	TSharedRef<FJsonObject> Raiz = MakeShared<FJsonObject>();
	Raiz->SetStringField(TEXT("aviso"), TEXT("EL MEJOR MÉDICO: datos de una simulación. Pacientes, médicos y recetas ficticios, sin validez médica."));
	Raiz->SetNumberField(TEXT("dia"), Dia);
	Raiz->SetStringField(TEXT("fecha"), Fecha(Dia));
	Raiz->SetNumberField(TEXT("siguienteReceta"), SiguienteReceta);
	TArray<TSharedPtr<FJsonValue>> LF;
	for (const FEMMFicha& F : Fichas)
	{
		TSharedRef<FJsonObject> O = MakeShared<FJsonObject>();
		O->SetStringField(TEXT("caso"), F.CasoId); O->SetStringField(TEXT("nombre"), F.Nombre); O->SetStringField(TEXT("apellidos"), F.Apellidos);
		O->SetStringField(TEXT("sexo"), F.Sexo); O->SetStringField(TEXT("enfermedad"), F.Enfermedad); O->SetStringField(TEXT("edad"), F.TextoEdad);
		O->SetStringField(TEXT("historia"), F.NumeroHistoria);
		O->SetNumberField(TEXT("proximaRevision"), F.ProximaRevision);
		TArray<TSharedPtr<FJsonValue>> LR;
		for (const FEMMReceta& X : F.Recetas)
		{
			TSharedRef<FJsonObject> R = MakeShared<FJsonObject>();
			R->SetStringField(TEXT("id"), X.Id); R->SetNumberField(TEXT("dia"), X.Dia);
			R->SetStringField(TEXT("medicamento"), X.Medicamento); R->SetStringField(TEXT("dosis"), X.Dosis);
			R->SetStringField(TEXT("frecuencia"), X.Frecuencia); R->SetStringField(TEXT("duracion"), X.Duracion);
			R->SetStringField(TEXT("instrucciones"), X.Instrucciones);
			R->SetNumberField(TEXT("estado"), int32(X.Estado)); R->SetStringField(TEXT("estadoTexto"), FEMMReceta::TextoEstado(X.Estado));
			R->SetArrayField(TEXT("etiquetas"), ListaJson(X.Etiquetas)); R->SetArrayField(TEXT("riesgos"), ListaJson(X.Riesgos));
			LR.Add(MakeShared<FJsonValueObject>(R));
		}
		O->SetArrayField(TEXT("recetas"), LR);
		TArray<TSharedPtr<FJsonValue>> LV;
		for (const FEMMVisita& X : F.Visitas)
		{
			TSharedRef<FJsonObject> V = MakeShared<FJsonObject>();
			V->SetNumberField(TEXT("dia"), X.Dia); V->SetStringField(TEXT("fecha"), Fecha(X.Dia)); V->SetBoolField(TEXT("revision"), X.bRevision);
			V->SetStringField(TEXT("diagnostico"), X.Diagnostico); V->SetStringField(TEXT("pruebas"), X.Pruebas);
			V->SetStringField(TEXT("evolucion"), X.Evolucion); V->SetArrayField(TEXT("recetas"), ListaJson(X.Recetas));
			TArray<TSharedPtr<FJsonValue>> LC;
			for (const FEMMLinea& L : X.Charla)
			{
				TSharedRef<FJsonObject> C = MakeShared<FJsonObject>();
				C->SetBoolField(TEXT("medico"), L.bMedico); C->SetStringField(TEXT("texto"), L.Texto);
				LC.Add(MakeShared<FJsonValueObject>(C));
			}
			V->SetArrayField(TEXT("charla"), LC);
			LV.Add(MakeShared<FJsonValueObject>(V));
		}
		O->SetArrayField(TEXT("visitas"), LV);
		LF.Add(MakeShared<FJsonValueObject>(O));
	}
	Raiz->SetArrayField(TEXT("fichas"), LF);
	FString J;
	TSharedRef<TJsonWriter<>> W = TJsonWriterFactory<>::Create(&J);
	FJsonSerializer::Serialize(Raiz, W);
	return FFileHelper::SaveStringToFile(J, *RutaArchivo, FFileHelper::EEncodingOptions::ForceUTF8WithoutBOM);
}

FEMMFicha& FEMMHistorial::FichaDe(const FEMMPaciente& P)
{
	if (FEMMFicha* F = Buscar(P.Id)) return *F;
	FEMMFicha& F = Fichas.AddDefaulted_GetRef();
	F.CasoId = P.Id; F.Nombre = P.Nombre; F.Apellidos = P.Apellidos; F.Sexo = P.Sexo; F.Enfermedad = P.Enfermedad; F.TextoEdad = P.TextoEdad;
	F.NumeroHistoria = FString::Printf(TEXT("HSM-%06u"), GetTypeHash(P.Id + P.Nombre + P.Apellidos) % 1000000u);
	return F;
}

FEMMFicha* FEMMHistorial::Buscar(const FString& CasoId) { return Fichas.FindByPredicate([&](const FEMMFicha& F) { return F.CasoId == CasoId; }); }

FEMMFicha* FEMMHistorial::RevisionPendiente()
{
	FEMMFicha* Mejor = nullptr;
	for (FEMMFicha& F : Fichas)
		if (F.ProximaRevision > 0 && F.ProximaRevision <= Dia && (!Mejor || F.ProximaRevision < Mejor->ProximaRevision)) Mejor = &F;
	return Mejor;
}

int32 FEMMHistorial::ProximaCita() const
{
	int32 R = -1;
	for (const FEMMFicha& F : Fichas) if (F.ProximaRevision > 0 && (R < 0 || F.ProximaRevision < R)) R = F.ProximaRevision;
	return R;
}

FString FEMMHistorial::Fecha(int32 DiaJuego)
{
	static const TCHAR* Dias[] = { TEXT("lunes"), TEXT("martes"), TEXT("miércoles"), TEXT("jueves"), TEXT("viernes"), TEXT("sábado"), TEXT("domingo") };
	static const TCHAR* Meses[] = { TEXT("enero"), TEXT("febrero"), TEXT("marzo"), TEXT("abril"), TEXT("mayo"), TEXT("junio"), TEXT("julio"), TEXT("agosto"), TEXT("septiembre"), TEXT("octubre"), TEXT("noviembre"), TEXT("diciembre") };
	const FDateTime F = FDateTime(2027, 1, 4) + FTimespan::FromDays(DiaJuego - 1);
	return FString::Printf(TEXT("%s, %d de %s de %d"), Dias[int32(F.GetDayOfWeek())], F.GetDay(), Meses[F.GetMonth() - 1], F.GetYear());
}

// ───────────────────────── Riesgos y evolución ─────────────────────────
namespace
{
	bool Tiene(const TArray<FString>& Tags, const TCHAR* T) { return Tags.Contains(T); }
	FString NombreTag(const FString& T)
	{
		static const TMap<FString, FString> N = {
			{ TEXT("alcohol"), TEXT("el alcohol") }, { TEXT("alcohol_fuerte"), TEXT("las bebidas de alta graduación") }, { TEXT("tabaco"), TEXT("el tabaco") },
			{ TEXT("antibiotico"), TEXT("un antibiótico") }, { TEXT("grasa"), TEXT("la comida grasa") }, { TEXT("frito"), TEXT("los fritos") },
			{ TEXT("picante"), TEXT("el picante") }, { TEXT("lacteo"), TEXT("los lácteos") }, { TEXT("contundente"), TEXT("la comida contundente") },
			{ TEXT("embutido"), TEXT("el embutido") }, { TEXT("cafeina"), TEXT("la cafeína") }, { TEXT("refresco"), TEXT("los refrescos") },
			{ TEXT("laxante"), TEXT("los laxantes") }, { TEXT("fibra"), TEXT("la fibra") }, { TEXT("marisco"), TEXT("el marisco") },
			{ TEXT("crudo"), TEXT("los alimentos crudos") }, { TEXT("frio"), TEXT("el frío") }, { TEXT("ejercicio"), TEXT("el ejercicio intenso") },
			{ TEXT("antitusivo"), TEXT("los antitusivos") }, { TEXT("benzodiacepina"), TEXT("los tranquilizantes") }, { TEXT("acido"), TEXT("los ácidos") },
			{ TEXT("agua_oido"), TEXT("que le entre agua en el oído") }, { TEXT("antidiarreico_fuerte"), TEXT("los antidiarreicos fuertes") },
		};
		const FString* S = N.Find(T);
		return S ? *S : T.Replace(TEXT("_"), TEXT(" "));
	}
	// Días hasta curarse con el tratamiento correcto (adulto sano)
	float DiasCuracion(const FString& Enf)
	{
		if (Enf == TEXT("gastroenteritis")) return 4.f;
		if (Enf == TEXT("intoxicacion")) return 3.f;
		if (Enf == TEXT("gripe")) return 7.f;
		if (Enf == TEXT("faringitis")) return 8.f;
		if (Enf == TEXT("otitis")) return 8.f;
		if (Enf == TEXT("neumonia")) return 18.f;
		return 10.f;
	}
	const TArray<FString> Niveles = { TEXT("recuperado"), TEXT("mejor"), TEXT("igual"), TEXT("peor"), TEXT("complicacion") };
}

TArray<FString> EMMEvolucion::Riesgos(const FEMMPaciente& P, const FEMMReceta& R)
{
	TArray<FString> L;
	const TArray<FString>& T = R.Etiquetas;
	const FString Todo = EMMDatos::Normaliza(R.Medicamento + TEXT(" ") + R.Dosis + TEXT(" ") + R.Frecuencia + TEXT(" ") + R.Instrucciones);
	const bool bMujer = P.EsMujer();
	if (P.Alergia == TEXT("penicilina") && Tiene(T, TEXT("penicilina")))
		L.Add(FString::Printf(TEXT("PELIGRO: %s a la penicilina. Esta receta puede causar una reacción alérgica grave."), bMujer ? TEXT("es alérgica") : TEXT("es alérgico")));
	if (P.Alergia == TEXT("aine") && Tiene(T, TEXT("aine")))
		L.Add(FString::Printf(TEXT("PELIGRO: %s a los antiinflamatorios (ibuprofeno y similares)."), bMujer ? TEXT("es alérgica") : TEXT("es alérgico")));
	if (Tiene(T, TEXT("alcohol")) || Tiene(T, TEXT("alcohol_fuerte")))
	{
		L.Add(TEXT("Indicación perjudicial: el alcohol no es un tratamiento ni es saludable. Deshidrata, irrita el estómago, empeora el sueño y las defensas, interacciona con el paracetamol y los antibióticos y daña el hígado."));
		if (Todo.Contains(TEXT("litro")) || Todo.Contains(TEXT("botella")) || Tiene(T, TEXT("alcohol_fuerte")))
			L.Add(TEXT("Consumo de alto riesgo: esa cantidad de alcohol diaria multiplica el riesgo de hepatitis, hemorragia digestiva, arritmias y accidentes."));
	}
	if (Tiene(T, TEXT("tabaco"))) L.Add(TEXT("Indicación perjudicial: fumar empeora las infecciones respiratorias y retrasa la curación."));
	// dosis: paracetamol o ibuprofeno con menos de 6 horas entre tomas
	FRegexMatcher M(FRegexPattern(TEXT("cada (\\d+) ?h")), Todo);
	if (M.FindNext())
	{
		const int32 Horas = FCString::Atoi(*M.GetCaptureGroup(1));
		if (Horas > 0 && Horas < 6 && (Tiene(T, TEXT("paracetamol")) || Tiene(T, TEXT("aine"))))
			L.Add(FString::Printf(TEXT("Dosis excesiva: cada %d horas supera la dosis máxima diaria (riesgo para el hígado o el estómago)."), Horas));
	}
	for (const FString& X : P.TratEvitar)
		if (X != TEXT("alcohol") && X != TEXT("alcohol_fuerte") && X != TEXT("tabaco") && Tiene(T, *X))
			L.Add(FString::Printf(TEXT("No conviene en %s: %s."), *P.Enfermedad.ToLower(), *NombreTag(X)));
	return L;
}

FEMMEvolucion EMMEvolucion::Calcular(const FEMMPaciente& P, const FEMMFicha& F, int32 Hoy)
{
	FEMMEvolucion E;
	const FEMMVisita* V = F.UltimaVisita();
	E.Dias = V ? FMath::Max(0, Hoy - V->Dia) : 0;
	// lo que se le entregó en la última consulta (las anuladas no cuentan)
	TArray<FString> Tags;
	TArray<const FEMMReceta*> Entregadas;
	if (V)
		for (const FString& Id : V->Recetas)
			for (const FEMMReceta& R : F.Recetas)
				if (R.Id == Id && R.Estado == EEMMEstadoReceta::Entregada)
				{
					Entregadas.Add(&R);
					for (const FString& T : R.Etiquetas) Tags.AddUnique(T);
					for (const FString& X : R.Riesgos) E.Riesgos.AddUnique(X);
				}
	// ¿cubre lo que necesita la enfermedad?
	int32 Cubiertos = 0;
	TArray<FString> Faltan;
	for (const TArray<FString>& G : P.TratMed)
	{
		if (G.ContainsByPredicate([&](const FString& X) { return Tags.Contains(X); })) ++Cubiertos;
		else Faltan.Add(G[0]);
	}
	const float MedOk = P.TratMed.Num() ? float(Cubiertos) / P.TratMed.Num() : 1.f;
	const bool bNecesitaAntibiotico = P.TratMed.ContainsByPredicate([](const TArray<FString>& G) { return G.Contains(TEXT("antibiotico")); });
	const bool bAntibiotico = Tags.Contains(TEXT("antibiotico"));
	const bool bAlcohol = Tags.Contains(TEXT("alcohol")) || Tags.Contains(TEXT("alcohol_fuerte"));
	const bool bAlergia = E.Riesgos.ContainsByPredicate([](const FString& R) { return R.StartsWith(TEXT("PELIGRO")); });
	int32 Malos = 0;
	for (const FString& X : P.TratEvitar) if (Tags.Contains(X)) ++Malos;
	int32 Buenos = 0;
	for (const FString& X : P.TratBuena) if (Tags.Contains(X)) ++Buenos;

	// cumplimiento: casi todos lo hacen bien; algunos se olvidan (fijo para cada paciente y consulta)
	FRandomStream Azar(int32(GetTypeHash(F.CasoId) + (V ? V->Dia : 0) * 7919));
	E.Cumplimiento = FMath::Clamp(Azar.FRandRange(0.62f, 1.f) + (P.Edad > 70 ? -0.08f : 0.f) + (Entregadas.Num() > 3 ? -0.08f : 0.f), 0.4f, 1.f);

	// tiempo de curación: edad, antecedentes y lo que falta del tratamiento
	float Curacion = DiasCuracion(P.EnfId) * (P.Edad > 60 ? 1.35f : 1.f) * (1.f + 0.15f * P.Antecedentes.Num());
	if (bNecesitaAntibiotico && !bAntibiotico) Curacion *= 2.2f;
	else Curacion *= 1.f + 0.6f * (1.f - MedOk);
	Curacion *= 1.f - FMath::Min(0.15f, 0.04f * Buenos);
	float Progreso = E.Dias / Curacion * (0.45f + 0.55f * E.Cumplimiento);
	Progreso *= FMath::Pow(0.85f, float(Malos));

	int32 Nivel = Progreso >= 1.f ? 0 : Progreso >= 0.55f ? 1 : Progreso >= 0.3f ? 2 : 3;
	if (E.Dias < 1) Nivel = 2;
	if (bAlcohol) Nivel = FMath::Min(3, Nivel + (Tags.Contains(TEXT("alcohol_fuerte")) || bAntibiotico ? 2 : 1));
	if (P.EnfId == TEXT("neumonia") && !bAntibiotico && E.Dias >= 4) Nivel = 4;
	if ((P.EnfId == TEXT("faringitis") || P.EnfId == TEXT("otitis")) && !bAntibiotico && E.Dias >= 10 && Azar.FRand() < 0.35f) Nivel = FMath::Max(Nivel, 3);
	if (bAlergia) Nivel = 4;
	E.Estado = Niveles[Nivel];

	// lo que contará el paciente (referencia para la IA) y el resumen para la ficha
	const bool bMujer = P.EsMujer();
	const TCHAR* o = bMujer ? TEXT("a") : TEXT("o");
	TArray<FString> Frase;
	switch (Nivel)
	{
	case 0: Frase.Add(TEXT("Pues estoy muy bien, doctor. Ya no tengo nada de lo que me trajo aquí.")); break;
	case 1: Frase.Add(TEXT("Estoy bastante mejor, doctor, aunque todavía no del todo.")); break;
	case 2: Frase.Add(TEXT("Pues sigo más o menos igual, doctor. No noto mucha mejoría.")); break;
	case 3: Frase.Add(TEXT("Estoy peor, doctor. Me encuentro bastante mal.")); break;
	default: Frase.Add(bAlergia ? FString::Printf(TEXT("Doctor, con lo que me mandó me salieron ronchas por todo el cuerpo y se me hinchó la cara; tuve que ir a urgencias.")) : FString(TEXT("Doctor, me he puesto muy mal. Fui a urgencias y me dijeron que se había complicado."))); break;
	}
	if (E.Cumplimiento < 0.75f && Entregadas.Num()) Frase.Add(TEXT("Le confieso que algunos días se me olvidó tomarlo."));
	if (bAlcohol) Frase.Add(FString::Printf(TEXT("Lo del alcohol lo he hecho como usted me dijo, pero tengo el estómago fatal, duermo mal y me noto más cansad%s."), o));
	if (!Entregadas.Num() && V) Frase.Add(TEXT("Como no me mandó nada, he ido aguantando como he podido."));
	E.FrasePaciente = FString::Join(Frase, TEXT(" "));

	static const TCHAR* NombreNivel[] = { TEXT("Recuperación completa"), TEXT("Mejoría parcial"), TEXT("Sin cambios"), TEXT("Empeoramiento"), TEXT("Complicación") };
	E.Resumen = FString::Printf(TEXT("%s a los %d días. Cumplimiento %s (%d %%)."), NombreNivel[Nivel], E.Dias,
		E.Cumplimiento >= 0.85f ? TEXT("alto") : E.Cumplimiento >= 0.7f ? TEXT("parcial") : TEXT("bajo"), FMath::RoundToInt(E.Cumplimiento * 100.f));
	if (Faltan.Num() && Nivel > 0) E.Resumen += TEXT(" Faltó en el tratamiento: ") + FString::Join(Faltan, TEXT(", ")).Replace(TEXT("_"), TEXT(" ")) + TEXT(".");
	if (E.Riesgos.Num()) E.Resumen += TEXT(" Riesgos: ") + FString::Join(E.Riesgos, TEXT(" "));
	static const float Preoc[] = { 0.05f, 0.3f, 0.55f, 0.85f, 1.f };
	E.Preocupacion = Preoc[Nivel];
	return E;
}

FString EMMEvolucion::Memoria(const FEMMFicha& F, const FEMMEvolucion* E, int32 Hoy)
{
	if (!F.Visitas.Num()) return FString();
	TArray<FString> L;
	L.Add(TEXT("TU HISTORIA EN ESTA CONSULTA (lo recuerdas y no te contradices):"));
	for (const FEMMVisita& V : F.Visitas)
	{
		L.Add(FString::Printf(TEXT("- %s (hace %d días)%s."), *FEMMHistorial::Fecha(V.Dia), Hoy - V.Dia, V.bRevision ? TEXT(", revisión") : TEXT(", primera consulta")));
		TArray<FString> Dicho;
		for (const FEMMLinea& X : V.Charla) if (!X.bMedico) Dicho.Add(X.Texto);
		if (Dicho.Num() > 4) Dicho.RemoveAt(0, Dicho.Num() - 4);
		if (Dicho.Num()) L.Add(TEXT("  Contaste: «") + FString::Join(Dicho, TEXT(" ")) + TEXT("»"));
		if (!V.Diagnostico.IsEmpty()) L.Add(TEXT("  El médico te dijo que tenías: ") + V.Diagnostico + TEXT("."));
		for (const FString& Id : V.Recetas)
			for (const FEMMReceta& R : F.Recetas)
				if (R.Id == Id && R.Estado == EEMMEstadoReceta::Entregada)
					L.Add(FString::Printf(TEXT("  Te recetó: %s, %s, %s, durante %s. %s"), *R.Medicamento, *R.Dosis, *R.Frecuencia, *R.Duracion, *R.Instrucciones));
	}
	if (E)
	{
		L.Add(FString::Printf(TEXT("Han pasado %d días desde la última consulta. Cómo estás ahora (dilo con tus palabras, sin tecnicismos): %s"), E->Dias, *E->FrasePaciente));
		if (E->Riesgos.Num()) L.Add(TEXT("Si te recetó algo perjudicial, has notado sus efectos negativos; no digas que te ha sentado bien."));
	}
	return FString::Join(L, TEXT("\n"));
}
