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
