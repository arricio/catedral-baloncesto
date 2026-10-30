#include "EMMIA.h"
#include "Async/Async.h"
#include "Dom/JsonObject.h"
#include "HttpModule.h"
#include "Interfaces/IHttpRequest.h"
#include "Interfaces/IHttpResponse.h"
#include "Internationalization/Regex.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Serialization/JsonWriter.h"

#if PLATFORM_ANDROID
#include "Android/AndroidApplication.h"
#include "Android/AndroidJNI.h"
#include "Android/AndroidJava.h"
#endif

// ───────────────────────── Instrucciones (como js/ia.js › construirPrompt) ─────────────────────────
TArray<TPair<FString, FString>> UEMMIASubsystem::ConstruirMensajes(const FEMMPaciente& P, const TArray<FEMMLinea>& Historial, const FString& Pregunta, const FString& Referencia)
{
	// P.Sistema ya trae todo menos lo que depende de la conversación; se añade antes de la última línea
	TArray<FString> Lineas;
	P.Sistema.ParseIntoArray(Lineas, TEXT("\n"), false);
	const FString Ultima = Lineas.Num() ? Lineas.Pop() : FString();
	// los modelos pequeños olvidan lo dicho: se les recuerda para que no se contradigan
	TArray<FString> Dicho;
	for (const FEMMLinea& L : Historial) if (!L.bMedico) Dicho.Add(FString::Printf(TEXT("- «%s»"), *L.Texto));
	if (Dicho.Num() > 6) Dicho.RemoveAt(0, Dicho.Num() - 6);
	if (Dicho.Num())
	{
		Lineas.Add(TEXT("Lo que YA has contado en esta consulta (es verdad y no puedes cambiarlo ni contradecirlo):"));
		Lineas.Append(Dicho);
	}
	// los modelos pequeños se equivocan con el género: se les recuerda
	Lineas.Add(P.EsMujer()
		// sin frases de ejemplo: el modelo las copia tal cual en la respuesta
		? TEXT("Eres una mujer: cuando hables de ti, usa siempre el género femenino.")
		: TEXT("Eres un hombre: cuando hables de ti, usa siempre el género masculino."));
	if (!Referencia.IsEmpty())
		Lineas.Add(FString::Printf(TEXT("Datos que debe contener tu respuesta a esta pregunta (respétalos, pero dilos a tu manera, sin copiar la frase): %s"), *Referencia));
	Lineas.Add(Ultima);

	TArray<TPair<FString, FString>> M;
	M.Add({ TEXT("system"), FString::Join(Lineas, TEXT("\n")) });
	const int32 Desde = FMath::Max(0, Historial.Num() - 14);
	for (int32 i = Desde; i < Historial.Num(); ++i)
		M.Add({ Historial[i].bMedico ? TEXT("user") : TEXT("assistant"), Historial[i].Texto });
	M.Add({ TEXT("user"), Pregunta });
	return M;
}

// Limpia lo que devuelve el modelo: sin acotaciones, sin comillas y con longitud razonable
FString UEMMIASubsystem::LimpiarRespuesta(const FString& T)
{
	FString S = T;
	int32 A, B;
	while ((A = S.Find(TEXT("<think>"))) != INDEX_NONE && (B = S.Find(TEXT("</think>"), ESearchCase::IgnoreCase, ESearchDir::FromStart, A)) != INDEX_NONE) S.RemoveAt(A, B + 8 - A);
	// «Rubén: ...» al principio
	{
		FRegexMatcher M(FRegexPattern(TEXT("^\\s*[\\w áéíóúñÁÉÍÓÚÑ]{1,30}:\\s+")), S);
		if (M.FindNext()) S.RightChopInline(M.GetMatchEnding());
	}
	// *acotaciones*
	while ((A = S.Find(TEXT("*"))) != INDEX_NONE && (B = S.Find(TEXT("*"), ESearchCase::CaseSensitive, ESearchDir::FromStart, A + 1)) != INDEX_NONE) S.RemoveAt(A, B + 1 - A);
	S.ReplaceInline(TEXT(" / "), TEXT(" "));
	S.ReplaceInline(TEXT("\n"), TEXT(" "));
	S.ReplaceInline(TEXT("\t"), TEXT(" "));
	while (S.ReplaceInline(TEXT("  "), TEXT(" "))) {}
	S.TrimStartAndEndInline();
	while (S.Len() && FString(TEXT("\"«“")).Contains(S.Left(1))) S.RightChopInline(1);
	while (S.Len() && FString(TEXT("\"»”")).Contains(S.Right(1))) S.LeftChopInline(1);
	// como mucho 3 frases y 320 caracteres
	int32 Frases = 0;
	for (int32 i = 0; i < S.Len(); ++i)
	{
		if (FString(TEXT(".!?…")).Contains(FString(1, &S[i])) && (i + 1 >= S.Len() || S[i + 1] == ' '))
			if (++Frases == 3) { S.LeftInline(i + 1); break; }
	}
	if (S.Len() > 320) { S.LeftInline(317); int32 Esp; if (S.FindLastChar(' ', Esp)) S.LeftInline(Esp); S += TEXT("..."); }
	return S.TrimStartAndEnd();
}

// Los modelos pequeños confunden el género al hablar de sí mismos («estoy preocupado» dicho por una mujer).
// Se corrige sólo lo que va detrás de un verbo en primera persona, con adjetivos conocidos, para no tocar
// lo que dice de otras personas («mi hijo está cansado»).
FString UEMMIASubsystem::CorregirGenero(const FString& T, bool bMujer)
{
	static const FString Patron = []() {
		const TCHAR* Raices[] = { TEXT("preocupad"), TEXT("cansad"), TEXT("agotad"), TEXT("maread"), TEXT("asustad"), TEXT("nervios"), TEXT("hinchad"),
			TEXT("resfriad"), TEXT("constipad"), TEXT("acatarrad"), TEXT("agobiad"), TEXT("angustiad"), TEXT("desesperad"), TEXT("tranquil"), TEXT("operad"),
			TEXT("vacunad"), TEXT("alérgic"), TEXT("alergic"), TEXT("enferm"), TEXT("asmátic"), TEXT("diabétic"), TEXT("hipertens"), TEXT("dolorid"),
			TEXT("debilitad"), TEXT("segur"), TEXT("convencid"), TEXT("hart"), TEXT("aburrid"), TEXT("estresad"), TEXT("deprimid"), TEXT("desanimad"),
			TEXT("contagiad"), TEXT("quemad"), TEXT("lesionad"), TEXT("recuperad"), TEXT("curad"), TEXT("ingresad"), TEXT("jubilad"), TEXT("casad"),
			TEXT("divorciad"), TEXT("viud"), TEXT("solter"), TEXT("sol"), TEXT("acostumbrad"), TEXT("obligad"), TEXT("molest"), TEXT("mojad"),
			TEXT("dormid"), TEXT("despiert"), TEXT("atascad"), TEXT("hundid"), TEXT("baj"), TEXT("fastidiad"), TEXT("mism") };
		TArray<FString> R; for (const TCHAR* X : Raices) R.Add(X);
		return FString(TEXT("\\b(estoy|estaba|estuve|he estado|me siento|me sentía|me sentia|me he sentido|me encuentro|me encontraba|me noto|ando|andaba|soy|era|me quedé|me quede|me quedo|me pongo|me puse|me he puesto|vivo|yo)\\s+((?:muy|un poco|algo|bastante|tan|más|mas|súper|super|como|medio|demasiado)\\s+)?(")) +
			FString::Join(R, TEXT("|")) + TEXT(")(o|a|os|as)\\b");
	}();
	FString S = T;
	TArray<int32> Vocales;
	FRegexMatcher M(FRegexPattern(Patron, ERegexPatternFlags::CaseInsensitive), T);
	while (M.FindNext()) Vocales.Add(M.GetCaptureGroupBeginning(4));
	for (int32 i : Vocales)
		if (S.IsValidIndex(i)) S[i] = bMujer ? TEXT('a') : TEXT('o');
	// al médico se le habla de usted: los tuteos más frecuentes de los modelos pequeños
	for (const TPair<const TCHAR*, const TCHAR*>& P : { TPair<const TCHAR*, const TCHAR*>(TEXT("me recetaste"), TEXT("me recetó")), { TEXT("me dijiste"), TEXT("me dijo") },
		{ TEXT("me mandaste"), TEXT("me mandó") }, { TEXT("me diste"), TEXT("me dio") }, { TEXT("me pusiste"), TEXT("me puso") }, { TEXT("tú crees"), TEXT("usted cree") } })
		S = S.Replace(P.Key, P.Value, ESearchCase::IgnoreCase);
	// «no soy el único» / «la única»
	for (const TCHAR* V : { TEXT("soy"), TEXT("era"), TEXT("fui") })
	{
		const FString El = FString::Printf(TEXT("%s el único"), V), La = FString::Printf(TEXT("%s la única"), V);
		S = bMujer ? S.Replace(*El, *La, ESearchCase::IgnoreCase) : S.Replace(*La, *El, ESearchCase::IgnoreCase);
	}
	return S;
}

// ¿Repite casi igual algo que el paciente ya ha dicho? (palabras con sustancia en común, en las dos direcciones)
bool UEMMIASubsystem::Repetida(const FString& Respuesta, const TArray<FString>& Anteriores)
{
	auto Palabras = [](const FString& S) {
		FString N = EMMDatos::Normaliza(S);
		for (TCHAR& C : N) if (!FChar::IsAlpha(C)) C = ' ';
		TArray<FString> W; TSet<FString> R;
		N.ParseIntoArray(W, TEXT(" "));
		for (const FString& X : W) if (X.Len() > 3) R.Add(X);
		return R;
	};
	const TSet<FString> R = Palabras(Respuesta);
	if (R.Num() < 4) return false;   // las respuestas muy cortas («No, doctor») se pueden repetir
	for (const FString& A : Anteriores)
	{
		const TSet<FString> B = Palabras(A);
		if (!B.Num()) continue;
		const int32 Comunes = R.Intersect(B).Num();
		if (float(Comunes) / R.Num() >= 0.7f && float(Comunes) / B.Num() >= 0.5f) return true;
	}
	return false;
}

// ¿La respuesta sólo repite lo que ha dicho el médico? «No he tenido fiebre» comparte palabras pero contesta.
bool UEMMIASubsystem::EsEco(const FString& Respuesta, const FString& Pregunta)
{
	auto Palabras = [](const FString& S) {
		FString N = EMMDatos::Normaliza(S);
		for (TCHAR& C : N) if (!(FChar::IsAlnum(C) || C == ' ')) C = ' ';
		TArray<FString> W, R;
		N.ParseIntoArray(W, TEXT(" "));
		for (const FString& X : W) if (X.Len() > 2) R.Add(X);
		return R;
	};
	const TArray<FString> R = Palabras(Respuesta);
	const TSet<FString> Q(Palabras(Pregunta));
	if (!R.Num() || !Q.Num()) return false;
	int32 Comunes = 0;
	for (const FString& W : R) if (Q.Contains(W)) ++Comunes;
	if ((float)Comunes / R.Num() <= 0.6f) return false;
	if (Respuesta.TrimEnd().EndsWith(TEXT("?"))) return true;
	FRegexMatcher M(FRegexPattern(TEXT("\\b(no|si|nada|nunca|tengo|tenia|tuve|he|me|mi|estoy|estaba|llevo|creo|pues|bueno|vale|claro|ayer|hoy)\\b")), EMMDatos::Normaliza(Respuesta));
	return !M.FindNext();
}

FString UEMMIASubsystem::Descripcion() const
{
	switch (Modo)
	{
	case EEMMModoIA::Ollama: return FString::Printf(TEXT("IA: %s, en este ordenador"), *Modelo);
	case EEMMModoIA::Movil: return bCargando ? TEXT("Cargando la IA del móvil…") : FString::Printf(TEXT("IA: %s, en el móvil"), *Modelo);
	default: return TEXT("Sin IA instalada: respuestas predefinidas");
	}
}

// ───────────────────────── Ollama (PC) ─────────────────────────
void UEMMIASubsystem::PedirOllama(const FString& Ruta, const FString& Cuerpo, float Espera, TFunction<void(bool, const FString&)> Hecho)
{
	TSharedRef<IHttpRequest, ESPMode::ThreadSafe> R = FHttpModule::Get().CreateRequest();
	R->SetURL(Url + Ruta);
	R->SetVerb(Cuerpo.IsEmpty() ? TEXT("GET") : TEXT("POST"));
	R->SetHeader(TEXT("Content-Type"), TEXT("application/json"));
	if (!Cuerpo.IsEmpty()) R->SetContentAsString(Cuerpo);
	R->SetTimeout(Espera);
	R->OnProcessRequestComplete().BindLambda([Hecho](FHttpRequestPtr, FHttpResponsePtr Res, bool bOk) {
		if (bOk && Res.IsValid() && Res->GetResponseCode() == 200) Hecho(true, Res->GetContentAsString());
		else Hecho(false, Res.IsValid() ? FString::Printf(TEXT("Ollama respondió %d"), Res->GetResponseCode()) : TEXT("no contesta"));
	});
	R->ProcessRequest();
}

void UEMMIASubsystem::Detectar(TFunction<void(const FString&, bool)> Hecho)
{
#if PLATFORM_ANDROID
	const FString E = EstadoMovilJson();
	TSharedPtr<FJsonObject> O;
	if (!FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(E), O) || !O.IsValid()) { Hecho(TEXT("IA del móvil no disponible"), false); return; }
	if (!O->GetBoolField(TEXT("instalado"))) { Modo = EEMMModoIA::Predefinida; Hecho(TEXT("NO_INSTALADO"), false); return; }
	Modo = EEMMModoIA::Movil; Modelo = TEXT("Gemma 4 E2B"); bCargando = true;
	TWeakObjectPtr<UEMMIASubsystem> Yo(this);
	AsyncTask(ENamedThreads::AnyBackgroundThreadNormalTask, [Yo, Hecho]() {
		JNIEnv* Env = FAndroidApplication::GetJavaEnv();
		jclass C = FAndroidApplication::FindJavaClassGlobalRef("es/elmejormedico/nativo/EMMNativo");
		jmethodID Met = Env->GetStaticMethodID(C, "cargar", "(Landroid/content/Context;Ljava/lang/String;)Ljava/lang/String;");
		jstring Acel = Env->NewStringUTF("gpu");
		jstring Res = (jstring)Env->CallStaticObjectMethod(C, Met, FJavaWrapper::GameActivityThis, Acel);
		const FString J = FJavaHelper::FStringFromLocalRef(Env, Res);
		Env->DeleteLocalRef(Acel);
		AsyncTask(ENamedThreads::GameThread, [Yo, Hecho, J]() {
			if (!Yo.IsValid()) return;
			Yo->bCargando = false;
			TSharedPtr<FJsonObject> O2;
			if (FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(J), O2) && O2.IsValid() && O2->GetBoolField(TEXT("ok")))
				Hecho(FString::Printf(TEXT("IA del móvil lista (Gemma 4 E2B, %s, %.1f s). Funciona sin Internet."), O2->GetStringField(TEXT("aceleracion")) == TEXT("gpu") ? TEXT("en la GPU") : TEXT("en el procesador"), O2->GetNumberField(TEXT("ms")) / 1000.0), true);
			else { Yo->Modo = EEMMModoIA::Predefinida; Hecho(FString::Printf(TEXT("La IA del móvil no ha arrancado: %s. Respuestas predefinidas."), O2.IsValid() ? *O2->GetStringField(TEXT("error")) : *J), false); }
		});
	});
#else
	TWeakObjectPtr<UEMMIASubsystem> Yo(this);
	PedirOllama(TEXT("/api/tags"), FString(), 3.f, [Yo, Hecho](bool bOk, const FString& Texto) {
		if (!Yo.IsValid()) return;
		TSharedPtr<FJsonObject> O;
		TArray<FString> Modelos;
		if (bOk && FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Texto), O) && O.IsValid())
			for (const TSharedPtr<FJsonValue>& V : O->GetArrayField(TEXT("models"))) Modelos.Add(V->AsObject()->GetStringField(TEXT("name")));
		if (!Modelos.Num()) { Yo->Modo = EEMMModoIA::Predefinida; Hecho(TEXT("No se encuentra Ollama: los pacientes usarán las respuestas predefinidas."), false); return; }
		// el mismo orden de preferencia que el juego web. En el portátil la IA va en el procesador (num_gpu 0):
		// la GPU (RTX 3050, 4 GB) se queda para los gráficos; con Qwen 3B responde en menos de un segundo.
		// 6 hilos: el resto del procesador queda libre para el juego (hilos de juego y de render)
		Yo->Modelo = Modelos[0];
		for (const TCHAR* Pref : { TEXT("qwen2.5:3b"), TEXT("gemma") })
			if (const FString* M = Modelos.FindByPredicate([Pref](const FString& X) { return X.Contains(Pref); })) { Yo->Modelo = *M; break; }
		Yo->Modo = EEMMModoIA::Ollama;
		// precalentar: el modelo se queda cargado 30 minutos
		Yo->PedirOllama(TEXT("/api/chat"), FString::Printf(TEXT("{\"model\":\"%s\",\"messages\":[],\"keep_alive\":\"30m\",\"options\":{\"num_gpu\":0,\"num_thread\":6}}"), *Yo->Modelo), 60.f, [](bool, const FString&) {});
		Hecho(FString::Printf(TEXT("IA local detectada (%s): los pacientes responderán con inteligencia artificial."), *Yo->Modelo), true);
	});
#endif
}

void UEMMIASubsystem::Llamar(TArray<TPair<FString, FString>> Mensajes, TFunction<void(bool, const FString&, const FString&)> Hecho)
{
	// JSON de mensajes: [{role, content}]
	FString Lista;
	{
		TSharedRef<TJsonWriter<>> W = TJsonWriterFactory<>::Create(&Lista);
		W->WriteArrayStart();
		for (const auto& M : Mensajes) { W->WriteObjectStart(); W->WriteValue(TEXT("role"), M.Key); W->WriteValue(TEXT("content"), M.Value); W->WriteObjectEnd(); }
		W->WriteArrayEnd();
		W->Close();
	}
#if PLATFORM_ANDROID
	AsyncTask(ENamedThreads::AnyBackgroundThreadNormalTask, [Lista, Hecho]() {
		JNIEnv* Env = FAndroidApplication::GetJavaEnv();
		jclass C = FAndroidApplication::FindJavaClassGlobalRef("es/elmejormedico/nativo/EMMNativo");
		jmethodID Met = Env->GetStaticMethodID(C, "generar", "(Ljava/lang/String;FI)Ljava/lang/String;");
		jstring JL = Env->NewStringUTF(TCHAR_TO_UTF8(*Lista));
		jstring Res = (jstring)Env->CallStaticObjectMethod(C, Met, JL, 0.8f, 120);
		const FString J = FJavaHelper::FStringFromLocalRef(Env, Res);
		Env->DeleteLocalRef(JL);
		TSharedPtr<FJsonObject> O;
		const bool bOk = FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(J), O) && O.IsValid() && O->GetBoolField(TEXT("ok"));
		const FString Texto = O.IsValid() ? O->GetStringField(TEXT("texto")) : FString();
		const FString Error = O.IsValid() ? O->GetStringField(TEXT("error")) : J;
		AsyncTask(ENamedThreads::GameThread, [Hecho, bOk, Texto, Error]() { Hecho(bOk, Texto, Error); });
	});
#else
	const FString Cuerpo = FString::Printf(TEXT("{\"model\":\"%s\",\"messages\":%s,\"stream\":false,\"keep_alive\":\"30m\",\"options\":{\"temperature\":0.8,\"num_predict\":120,\"num_gpu\":0,\"num_thread\":6}}"), *Modelo, *Lista);
	PedirOllama(TEXT("/api/chat"), Cuerpo, 45.f, [Hecho](bool bOk, const FString& Texto) {
		if (!bOk) { Hecho(false, FString(), Texto); return; }
		TSharedPtr<FJsonObject> O;
		if (FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Texto), O) && O.IsValid())
			Hecho(true, O->GetObjectField(TEXT("message"))->GetStringField(TEXT("content")), FString());
		else Hecho(false, FString(), TEXT("respuesta no válida de Ollama"));
	});
#endif
}

void UEMMIASubsystem::Responder(const FEMMPaciente& P, const TArray<FEMMLinea>& Historial, const FString& Pregunta, const FString& Referencia, TFunction<void(const FEMMRespuesta&)> Hecho)
{
	const double T0 = FPlatformTime::Seconds();
	if (Modo == EEMMModoIA::Predefinida) { Hecho({ Referencia, TEXT("predefinida"), FString(), 0 }); return; }
	TArray<TPair<FString, FString>> M = ConstruirMensajes(P, Historial, Pregunta, Referencia);
	TWeakObjectPtr<UEMMIASubsystem> Yo(this);
	const bool bMujer = P.EsMujer();
	// lo que ya ha dicho el paciente: si la respuesta es casi igual, se le pide que lo diga de otra forma
	TArray<FString> Dicho;
	for (const FEMMLinea& L : Historial) if (!L.bMedico) Dicho.Add(L.Texto);
	Llamar(M, [Yo, M, Pregunta, Referencia, Hecho, T0, bMujer, Dicho](bool bOk, const FString& Bruto, const FString& Error) mutable {
		if (!Yo.IsValid()) return;
		const FString Texto = CorregirGenero(LimpiarRespuesta(Bruto), bMujer);
		const bool bEco = EsEco(Texto, Pregunta), bRepite = !bEco && Repetida(Texto, Dicho);
		if (bOk && !Texto.IsEmpty() && !bEco && !bRepite) { Hecho({ Texto, TEXT("ia"), FString(), FPlatformTime::Seconds() - T0 }); return; }
		if (!bOk) { Hecho({ Referencia, TEXT("predefinida"), Error, 0 }); return; }
		// si repite la pregunta, se repite a sí mismo o no dice nada, se le pide otra vez
		M.Add({ TEXT("assistant"), Texto.IsEmpty() ? TEXT("...") : Texto });
		M.Add({ TEXT("user"), bRepite ? TEXT("(Eso ya lo has dicho casi igual. Contesta a lo que te acaba de preguntar el médico con otras palabras y, si viene a cuento, añade algo nuevo de tu historia.)")
			: TEXT("(Eso es repetir lo que ha dicho el médico. Contesta tú, como paciente, a su pregunta.)") });
		const FString Primera = Texto;
		Yo->Llamar(M, [Pregunta, Referencia, Hecho, T0, bMujer, Dicho, Primera, bRepite](bool bOk2, const FString& Bruto2, const FString& Error2) {
			const FString T2 = CorregirGenero(LimpiarRespuesta(Bruto2), bMujer);
			if (bOk2 && !T2.IsEmpty() && !EsEco(T2, Pregunta) && !Repetida(T2, Dicho)) Hecho({ T2, TEXT("ia"), FString(), FPlatformTime::Seconds() - T0 });
			// si vuelve a repetirse, mejor su primera respuesta (era válida) que la predefinida
			else if (bRepite && !Primera.IsEmpty()) Hecho({ Primera, TEXT("ia"), FString(), FPlatformTime::Seconds() - T0 });
			else Hecho({ Referencia, TEXT("predefinida"), bOk2 ? TEXT("la IA no ha dado una respuesta válida") : Error2, 0 });
		});
	});
}

// ───────────────────────── El médico con IA (MÉDICO: IA) ─────────────────────────
FString UEMMIASubsystem::PreguntaGuiada(const FEMMPaciente& P, const FString& NombreMedico, const TArray<FEMMLinea>& Historial)
{
	// la entrevista clínica de siempre, en orden: cada vez la siguiente que no se haya hecho
	int32 N = 0;
	for (const FEMMLinea& L : Historial) N += L.bMedico;
	const bool bNino = P.Edad < 14.f;
	// «Dr. Lorenzo Prieto» → «el doctor Lorenzo Prieto» (dicho en voz alta)
	const FString Soy = NombreMedico.Replace(TEXT("Dra. "), TEXT("la doctora ")).Replace(TEXT("Dr. "), TEXT("el doctor "));
	if (N == 0)
		return P.bHablaAcomp ? FString::Printf(TEXT("Hola, buenos días. Soy %s. Siéntense, por favor. Cuéntenme, ¿qué le ocurre a %s?"), *Soy, *P.Nombre)
			: bNino ? FString::Printf(TEXT("Hola, %s, buenos días. Soy %s. Siéntate, por favor. Cuéntame, ¿qué te pasa?"), *P.Nombre, *Soy)
			: FString::Printf(TEXT("Buenos días, soy %s. Siéntese, por favor. Cuénteme, ¿qué le ocurre?"), *Soy);
	static const TCHAR* Adultos[] = {
		TEXT("¿Desde cuándo le pasa?"),
		TEXT("¿Cómo es exactamente la molestia y dónde la nota?"),
		TEXT("¿Ha tenido fiebre o algún otro síntoma?"),
		TEXT("¿Hay algo que lo mejore o que lo empeore?"),
		TEXT("¿Toma alguna medicación de forma habitual?"),
		TEXT("¿Es alérgico a algún medicamento?"),
		TEXT("¿Ha tenido alguna enfermedad importante o alguna operación?"),
		TEXT("¿Fuma o bebe alcohol?"),
		TEXT("¿Hay algo más que quiera contarme?"),
		TEXT("De acuerdo. Ahora voy a explorarle, si le parece bien."),
	};
	static const TCHAR* Ninos[] = {
		TEXT("¿Desde cuándo le pasa?"),
		TEXT("¿Dónde le duele o qué le molesta exactamente?"),
		TEXT("¿Ha tenido fiebre? ¿Cuánto le ha llegado a subir?"),
		TEXT("¿Come y duerme bien estos días?"),
		TEXT("¿Toma alguna medicación?"),
		TEXT("¿Tiene alergia a algún medicamento?"),
		TEXT("¿Lleva las vacunas al día?"),
		TEXT("¿Hay algo más que les preocupe?"),
		TEXT("Muy bien. Ahora voy a explorarle con cuidado."),
	};
	if (bNino && !P.bHablaAcomp)
	{
		// el niño contesta él mismo: de tú
		static const TCHAR* Tu[] = {
			TEXT("¿Desde cuándo te pasa?"), TEXT("¿Dónde te duele o qué te molesta exactamente?"), TEXT("¿Has tenido fiebre?"),
			TEXT("¿Comes y duermes bien estos días?"), TEXT("¿Tomas alguna medicina?"), TEXT("¿Eres alérgico a alguna medicina?"),
			TEXT("¿Hay algo más que quieras contarme?"), TEXT("Muy bien. Ahora voy a explorarte con cuidado, ¿vale?") };
		return Tu[FMath::Min(N - 1, int32(UE_ARRAY_COUNT(Tu)) - 1)];
	}
	if (bNino) return Ninos[FMath::Min(N - 1, int32(UE_ARRAY_COUNT(Ninos)) - 1)];
	return Adultos[FMath::Min(N - 1, int32(UE_ARRAY_COUNT(Adultos)) - 1)];
}

TArray<TPair<FString, FString>> UEMMIASubsystem::MensajesMedico(const FEMMPaciente& P, const FString& NombreMedico, bool bMedicaMujer, const TArray<FEMMLinea>& Historial)
{
	const bool bNino = P.Edad < 14.f;
	const FString Acomp = P.Acompanante.IsEmpty() ? FString(TEXT("un familiar")) : P.Acompanante;
	TArray<FString> S;
	S.Add(FString::Printf(TEXT("Eres %s, %s de familia en un centro de salud de España. Ya has saludado y te has presentado."), *NombreMedico, bMedicaMujer ? TEXT("médica") : TEXT("médico")));
	if (P.bHablaAcomp)
		S.Add(FString::Printf(TEXT("El paciente es %s, %s de %s. Ha venido con %s, que es quien te contesta: háblale a esa persona, de usted, y pregunta por %s en tercera persona (le pasa, le duele, ha tenido…). No le hables directamente a %s."),
			*P.Nombre, P.EsMujer() ? TEXT("una niña") : TEXT("un niño"), *P.TextoEdad, *Acomp, *P.Nombre, *P.Nombre));
	else if (bNino)
		S.Add(FString::Printf(TEXT("El paciente es %s, %s de %s, que viene con %s pero te contesta él mismo: háblale de tú, con palabras sencillas."), *P.Nombre, P.EsMujer() ? TEXT("una niña") : TEXT("un niño"), *P.TextoEdad, *Acomp));
	else
		S.Add(FString::Printf(TEXT("La paciente o el paciente es %s %s, %s de %s: háblale de usted."), *P.Nombre, *P.Apellidos, P.EsMujer() ? TEXT("una mujer") : TEXT("un hombre"), *P.TextoEdad));
	S.Add(TEXT("Tu tarea ahora es la entrevista clínica: averiguar qué le pasa preguntando, como en una consulta real."));
	S.Add(TEXT("Habla en español de España, con un tono amable, cercano y profesional. No vuelvas a saludar ni a decir tu nombre."));
	S.Add(TEXT("En cada turno di UNA sola intervención breve (una o dos frases cortas) y haz como mucho UNA pregunta."));
	S.Add(TEXT("Después ve preguntando, según lo que te cuente: desde cuándo, cómo es y dónde, intensidad, qué lo mejora o lo empeora, fiebre y otros síntomas, medicación habitual, alergias, enfermedades previas y hábitos."));
	S.Add(TEXT("Aprovecha lo que ya te han contado: no repitas preguntas hechas y no preguntes lo que ya sabes."));
	S.Add(TEXT("No digas todavía un diagnóstico ni recetes nada. No escribas acotaciones, ni tu nombre delante, ni comillas."));
	TArray<FString> Hecho, Contado;
	for (const FEMMLinea& L : Historial) (L.bMedico ? Hecho : Contado).Add(FString::Printf(TEXT("- «%s»"), *L.Texto));
	if (Hecho.Num() > 8) Hecho.RemoveAt(0, Hecho.Num() - 8);
	if (Contado.Num() > 8) Contado.RemoveAt(0, Contado.Num() - 8);
	if (Hecho.Num()) { S.Add(TEXT("Lo que YA has dicho tú (no lo repitas):")); S.Append(Hecho); }
	if (Contado.Num()) { S.Add(TEXT("Lo que te ha contado el paciente (tenlo en cuenta para la siguiente pregunta):")); S.Append(Contado); }
	TArray<TPair<FString, FString>> M;
	M.Add({ TEXT("system"), FString::Join(S, TEXT("\n")) });
	// los papeles al revés que con el paciente: el médico es el asistente
	const int32 Desde = FMath::Max(0, Historial.Num() - 14);
	for (int32 i = Desde; i < Historial.Num(); ++i)
		M.Add({ Historial[i].bMedico ? TEXT("assistant") : TEXT("user"), Historial[i].Texto });
	if (!Historial.Num()) M.Add({ TEXT("user"), TEXT("(El paciente entra en la consulta y se sienta. Empieza tú.)") });
	else if (Historial.Last().bMedico) M.Add({ TEXT("user"), TEXT("(El paciente espera a que sigas. Continúa con la siguiente pregunta.)") });
	return M;
}

void UEMMIASubsystem::ResponderMedico(const FEMMPaciente& P, const FString& NombreMedico, bool bMedicaMujer, const TArray<FEMMLinea>& Historial, TFunction<void(const FEMMRespuesta&)> Hecho)
{
	const double T0 = FPlatformTime::Seconds();
	const FString Guiada = PreguntaGuiada(P, NombreMedico, Historial);
	if (Modo == EEMMModoIA::Predefinida) { Hecho({ Guiada, TEXT("predefinida"), FString(), 0 }); return; }
	// el saludo y la presentación, siempre bien (nombre, género y a quién se habla): los modelos pequeños se
	// confunden ahí; a partir de ahí, las preguntas las decide la IA según lo que le cuenten
	if (!Historial.ContainsByPredicate([](const FEMMLinea& L) { return L.bMedico; })) { Hecho({ Guiada, TEXT("saludo"), FString(), 0 }); return; }
	TArray<TPair<FString, FString>> M = MensajesMedico(P, NombreMedico, bMedicaMujer, Historial);
	TArray<FString> Dicho;
	FString Ultima;
	for (const FEMMLinea& L : Historial) { if (L.bMedico) Dicho.Add(L.Texto); else Ultima = L.Texto; }
	TWeakObjectPtr<UEMMIASubsystem> Yo(this);
	Llamar(M, [Yo, M, Guiada, Dicho, Ultima, Hecho, T0, bMedicaMujer](bool bOk, const FString& Bruto, const FString& Error) mutable {
		if (!Yo.IsValid()) return;
		const FString Texto = CorregirGenero(LimpiarRespuesta(Bruto), bMedicaMujer);
		const bool bMal = Texto.IsEmpty() || (!Ultima.IsEmpty() && EsEco(Texto, Ultima)) || Repetida(Texto, Dicho);
		if (bOk && !bMal) { Hecho({ Texto, TEXT("ia"), FString(), FPlatformTime::Seconds() - T0 }); return; }
		if (!bOk) { Hecho({ Guiada, TEXT("predefinida"), Error, 0 }); return; }
		// se ha repetido o ha contestado como si fuera el paciente: otra vez, y si no, la pregunta guiada
		M.Add({ TEXT("assistant"), Texto.IsEmpty() ? TEXT("...") : Texto });
		M.Add({ TEXT("user"), TEXT("(Eso no vale: eres el médico y eso ya está dicho. Haz una pregunta NUEVA y breve al paciente.)") });
		Yo->Llamar(M, [Guiada, Dicho, Ultima, Hecho, T0, bMedicaMujer](bool bOk2, const FString& Bruto2, const FString& Error2) {
			const FString T2 = CorregirGenero(LimpiarRespuesta(Bruto2), bMedicaMujer);
			if (bOk2 && !T2.IsEmpty() && !(!Ultima.IsEmpty() && EsEco(T2, Ultima)) && !Repetida(T2, Dicho)) Hecho({ T2, TEXT("ia"), FString(), FPlatformTime::Seconds() - T0 });
			else Hecho({ Guiada, TEXT("predefinida"), bOk2 ? TEXT("la IA no ha dado una pregunta válida") : Error2, 0 });
		});
	});
}

#if PLATFORM_ANDROID
static FString LlamarNativoTexto(const char* Metodo)
{
	JNIEnv* Env = FAndroidApplication::GetJavaEnv();
	jclass C = FAndroidApplication::FindJavaClassGlobalRef("es/elmejormedico/nativo/EMMNativo");
	jmethodID Met = Env->GetStaticMethodID(C, Metodo, "(Landroid/content/Context;)Ljava/lang/String;");
	jstring Res = (jstring)Env->CallStaticObjectMethod(C, Met, FJavaWrapper::GameActivityThis);
	return FJavaHelper::FStringFromLocalRef(Env, Res);
}
FString UEMMIASubsystem::EstadoMovilJson() { return LlamarNativoTexto("estado"); }
void UEMMIASubsystem::DescargarModelo() { LlamarNativoTexto("descargar"); }
FString UEMMIASubsystem::ProgresoDescargaJson() { return LlamarNativoTexto("progreso"); }
#endif
