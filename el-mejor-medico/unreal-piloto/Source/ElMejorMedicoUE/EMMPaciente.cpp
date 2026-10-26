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
		P.Id = O->GetStringField(TEXT("id"));
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
