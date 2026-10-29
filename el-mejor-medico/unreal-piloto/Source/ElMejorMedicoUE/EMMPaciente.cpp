#include "EMMPaciente.h"
#include "Dom/JsonObject.h"
#include "Internationalization/Regex.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"

FString FEMMPaciente::Respuesta(const FString& Intencion) const
{
	const TArray<FString>* L = Respuestas.Find(Intencion);
	if (!L || L->Num() == 0) L = Respuestas.Find(TEXT("general"));
	return L && L->Num() ? (*L)[FMath::RandRange(0, L->Num() - 1)] : FString(TEXT("Pues... no sabría decirle, doctor."));
}

bool EMMDatos::CargarPacientes(TArray<FEMMPaciente>& Salida, FString& Error)
{
	const FString Ruta = FPaths::ProjectContentDir() / TEXT("Datos/casos.json");
	FString Texto;
	if (!FFileHelper::LoadFileToString(Texto, *Ruta)) { Error = FString::Printf(TEXT("No se encuentra %s"), *Ruta); return false; }
	TSharedPtr<FJsonObject> Raiz;
	if (!FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Texto), Raiz) || !Raiz.IsValid()) { Error = TEXT("casos.json no es válido"); return false; }
	for (const TSharedPtr<FJsonValue>& V : Raiz->GetArrayField(TEXT("pacientes")))
	{
		const TSharedPtr<FJsonObject> O = V->AsObject();
		FEMMPaciente P;
		P.Id = O->GetStringField(TEXT("id")); P.Caso = P.Id;
		P.Enfermedad = O->GetStringField(TEXT("enfermedad"));
		P.Nombre = O->GetStringField(TEXT("nombre"));
		P.Apellidos = O->GetStringField(TEXT("apellidos"));
		P.Sexo = O->GetStringField(TEXT("sexo"));
		P.TextoEdad = O->GetStringField(TEXT("textoEdad"));
		P.Edad = O->GetNumberField(TEXT("edad"));
		P.Sistema = O->GetStringField(TEXT("sistema"));
		if (const TSharedPtr<FJsonObject>* Voz; O->TryGetObjectField(TEXT("voz"), Voz))
		{
			P.Voz.Tono = (*Voz)->GetNumberField(TEXT("tono"));
			P.Voz.Vel = (*Voz)->GetNumberField(TEXT("vel"));
		}
		for (const auto& Par : O->GetObjectField(TEXT("respuestas"))->Values)
		{
			TArray<FString>& L = P.Respuestas.FindOrAdd(FString(Par.Key));
			for (const TSharedPtr<FJsonValue>& T : Par.Value->AsArray()) L.Add(T->AsString());
		}
		auto Lista = [](const TArray<TSharedPtr<FJsonValue>>& A) { TArray<FString> R; for (const auto& X : A) R.Add(X->AsString()); return R; };
		O->TryGetStringField(TEXT("enfId"), P.EnfId);
		O->TryGetStringField(TEXT("alergia"), P.Alergia);
		O->TryGetBoolField(TEXT("fumador"), P.bFumador);
		O->TryGetBoolField(TEXT("bebedor"), P.bBebedor);
		if (const TArray<TSharedPtr<FJsonValue>>* A; O->TryGetArrayField(TEXT("antecedentes"), A)) P.Antecedentes = Lista(*A);
		if (const TSharedPtr<FJsonObject>* Tr; O->TryGetObjectField(TEXT("trat"), Tr))
		{
			for (const auto& G : (*Tr)->GetArrayField(TEXT("med"))) P.TratMed.Add(Lista(G->AsArray()));
			P.TratBuena = Lista((*Tr)->GetArrayField(TEXT("buena")));
			P.TratEvitar = Lista((*Tr)->GetArrayField(TEXT("evitar")));
		}
		O->TryGetStringField(TEXT("personalidad"), P.Personalidad);
		O->TryGetStringField(TEXT("acompanante"), P.Acompanante);
		O->TryGetStringField(TEXT("sistemaAcomp"), P.SistemaAcomp);
		O->TryGetBoolField(TEXT("hablaAcomp"), P.bHablaAcomp);
		O->TryGetBoolField(TEXT("bebe"), P.bBebe);
		O->TryGetBoolField(TEXT("cronica"), P.bCronica);
		O->TryGetNumberField(TEXT("grav"), P.Grav);
		auto Numeros = [](const TSharedPtr<FJsonObject>& J, TMap<FString, float>& M) { for (const auto& X : J->Values) M.Add(FString(X.Key), float(X.Value->AsNumber())); };
		auto Textos = [](const TSharedPtr<FJsonObject>& J, TMap<FString, FString>& M) { for (const auto& X : J->Values) M.Add(FString(X.Key), X.Value->AsString()); };
		if (const TSharedPtr<FJsonObject>* J; O->TryGetObjectField(TEXT("constantes"), J)) Numeros(*J, P.Constantes);
		if (const TSharedPtr<FJsonObject>* J; O->TryGetObjectField(TEXT("sangre"), J)) Numeros(*J, P.Sangre);
		if (const TSharedPtr<FJsonObject>* J; O->TryGetObjectField(TEXT("orina"), J)) Textos(*J, P.Orina);
		if (const TSharedPtr<FJsonObject>* J; O->TryGetObjectField(TEXT("pruebas"), J)) Textos(*J, P.Pruebas);
		if (const TSharedPtr<FJsonObject>* J; O->TryGetObjectField(TEXT("apariencia"), J))
		{
			(*J)->TryGetNumberField(TEXT("complexion"), P.Complexion);
			(*J)->TryGetNumberField(TEXT("altura"), P.Altura);
			(*J)->TryGetBoolField(TEXT("gafas"), P.bGafas);
		}
		Salida.Add(MoveTemp(P));
	}
	return Salida.Num() > 0;
}

FString EMMDatos::Normaliza(const FString& Texto)
{
	// como normaliza() del juego web: minúsculas y sin tildes (la ñ queda como n)
	FString S = Texto.ToLower();
	static const TCHAR* De = TEXT("áàäâéèëêíìïîóòöôúùüûñç");
	static const TCHAR* A = TEXT("aaaaeeeeiiiioooouuuunc");
	for (TCHAR& C : S)
		for (int32 i = 0; De[i]; ++i) if (C == De[i]) { C = A[i]; break; }
	return S.TrimStartAndEnd();
}

TArray<FString> EMMDatos::EtiquetasDe(const FString& Texto, FString* Nombre)
{
	// recetario y pistas del juego web, leídos una vez de casos.json
	struct FItem { FString N; TArray<FString> Claves; TArray<FString> Tags; };
	struct FPista { FString Re; TArray<FString> Tags; };
	static TArray<FItem> Recetario;
	static TArray<FPista> Pistas;
	static bool bCargado = false;
	if (!bCargado)
	{
		bCargado = true;
		FString J; TSharedPtr<FJsonObject> Raiz;
		if (FFileHelper::LoadFileToString(J, *(FPaths::ProjectContentDir() / TEXT("Datos/casos.json"))) && FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(J), Raiz) && Raiz.IsValid())
		{
			auto Lista = [](const TArray<TSharedPtr<FJsonValue>>& A) { TArray<FString> R; for (const auto& X : A) R.Add(X->AsString()); return R; };
			if (const TArray<TSharedPtr<FJsonValue>>* A; Raiz->TryGetArrayField(TEXT("recetario"), A))
				for (const auto& V : *A)
				{
					const TSharedPtr<FJsonObject> O = V->AsObject();
					FItem I{ O->GetStringField(TEXT("n")), {}, Lista(O->GetArrayField(TEXT("tags"))) };
					// claves: las palabras con sustancia del nombre; tienen que aparecer todas
					// («Amoxicilina 500 mg» → amoxicilina; «Agua oxigenada» no salta sólo por «agua»)
					FString N = Normaliza(I.N);
					for (TCHAR& C : N) if (!FChar::IsAlpha(C)) C = ' ';
					TArray<FString> Pal; N.ParseIntoArray(Pal, TEXT(" "));
					for (const FString& P : Pal) if (P.Len() >= 4) I.Claves.AddUnique(P);
					if (I.Claves.Num()) Recetario.Add(MoveTemp(I));
				}
			if (const TArray<TSharedPtr<FJsonValue>>* A; Raiz->TryGetArrayField(TEXT("pistas"), A))
				for (const auto& V : *A)
				{
					const TSharedPtr<FJsonObject> O = V->AsObject();
					Pistas.Add({ O->GetStringField(TEXT("re")), Lista(O->GetArrayField(TEXT("tags"))) });
				}
		}
	}
	FString T = TEXT(" ") + Normaliza(Texto) + TEXT(" ");
	FString Palabras = T;
	for (TCHAR& C : Palabras) if (!FChar::IsAlpha(C)) C = ' ';
	TArray<FString> Lista; Palabras.ParseIntoArray(Lista, TEXT(" "));
	const TSet<FString> Hay(Lista);
	TArray<FString> Tags;
	// primero el recetario (nombre concreto); después las pistas generales
	for (const FItem& I : Recetario)
		if (!I.Claves.ContainsByPredicate([&](const FString& K) { return !Hay.Contains(K); }))
		{
			for (const FString& X : I.Tags) Tags.AddUnique(X);
			if (Nombre && Nombre->IsEmpty()) *Nombre = I.N;
		}
	for (const FPista& P : Pistas)
	{
		FRegexMatcher M(FRegexPattern(P.Re), T);
		if (M.FindNext()) for (const FString& X : P.Tags) Tags.AddUnique(X);
	}
	return Tags;
}

const TArray<EMMDatos::FValorRef>& EMMDatos::ReferenciasSangre()
{
	static TArray<FValorRef> R = []() {
		TArray<FValorRef> L;
		FString J; TSharedPtr<FJsonObject> Raiz;
		if (FFileHelper::LoadFileToString(J, *(FPaths::ProjectContentDir() / TEXT("Datos/casos.json"))) && FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(J), Raiz) && Raiz.IsValid())
			if (const TSharedPtr<FJsonObject>* Ref; Raiz->TryGetObjectField(TEXT("referencias"), Ref))
				for (const auto& V : (*Ref)->GetArrayField(TEXT("sangre")))
				{
					const TSharedPtr<FJsonObject> O = V->AsObject();
					const TArray<TSharedPtr<FJsonValue>>& Rango = O->GetArrayField(TEXT("r"));
					L.Add({ O->GetStringField(TEXT("k")), O->GetStringField(TEXT("n")), O->GetStringField(TEXT("u")), float(Rango[0]->AsNumber()), float(Rango[1]->AsNumber()), int32(O->GetNumberField(TEXT("d"))) });
				}
		return L;
	}();
	return R;
}

TArray<FString> EMMDatos::Intenciones(const FString& Texto)
{
	// mismas expresiones y orden que js/ia.js › INTENCIONES
	static const TArray<TPair<FString, FString>> Lista = {
		{ TEXT("acomp"), TEXT("(esperar|espere|salir|salga|sal).{0,20}(fuera|afuera|un momento)|dejarnos solos|a solas") },
		{ TEXT("secreto"), TEXT("algo mas que (deba|deberia|tenga que) saber|confidencial|no (me|nos) (ha|has|han) contado|ocult|secreto|algo que no (me|nos) (hayas|haya|hayan)") },
		{ TEXT("presionar"), TEXT("no me (esta|estas|estan) (contando|diciendo) (toda )?la verdad|mintiendo|me (esta|estas) mintiendo|no me lo creo") },
		{ TEXT("alergia"), TEXT("alergi|alergic") },
		{ TEXT("antecedentes"), TEXT("enfermedad(es)?|medicacion|medicamento|pastilla|tratamiento (habitual|actual)|operad|antecedente|vacuna") },
		{ TEXT("habitos"), TEXT("fuma|tabaco|bebe|alcohol|habito|come|comida|dieta|deporte|ejercicio|duerme|cigarr") },
		{ TEXT("fiebre"), TEXT("fiebre|temperatura|escalofrio|tiritona|calentura") },
		{ TEXT("inicio"), TEXT("desde cuando|cuando (empezo|empezaron|comenzo|le paso|te paso)|cuanto tiempo|hace cuanto|cuantos dias") },
		{ TEXT("dolor"), TEXT("duele|dolor|molest|pincha|escuece|donde (le|te)") },
		{ TEXT("extra"), TEXT("algo mas|otra cosa|otros? sintoma|ha notado|has notado|han notado") },
		{ TEXT("calmar"), TEXT("tranquil|no se preocupe|no te preocupes|buenas manos|confie|confia|no pasa nada|no te voy a hacer dano") },
		{ TEXT("motivo"), TEXT("que le (pasa|ocurre|trae)|que te (pasa|ocurre)|que (les|os) trae|en que (le|te) puedo ayudar|cuenteme|cuentame|como (se encuentra|esta|estas)|que tal (esta|estas)|que le sucede") },
		{ TEXT("nombre"), TEXT("como (se llama|te llamas)|su nombre|tu nombre") },
		{ TEXT("edad"), TEXT("cuantos anos|que edad") },
		{ TEXT("gracias"), TEXT("gracias") },
		{ TEXT("despedida"), TEXT("adios|hasta luego|que se mejore|que te mejores|cuidese|cuidate") },
		{ TEXT("saludo"), TEXT("^(hola|buenos dias|buenas tardes|buenas noches|buenas)[\\s.,!]*$") },
	};
	FString T = Normaliza(Texto);
	for (const TCHAR* C : { TEXT("¿"), TEXT("?"), TEXT("¡"), TEXT("!") }) T.ReplaceInline(C, TEXT(" "));
	while (T.ReplaceInline(TEXT("  "), TEXT(" "))) {}
	T.TrimStartAndEndInline();
	TArray<FString> Res;
	for (const TPair<FString, FString>& P : Lista)
	{
		FRegexMatcher M(FRegexPattern(P.Value), T);
		if (M.FindNext()) Res.Add(P.Key);
	}
	return Res;
}
