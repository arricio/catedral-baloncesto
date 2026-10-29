#include "EMMPiper.h"
#include "EMMFonetica.h"
#include "Dom/JsonObject.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Misc/ScopeLock.h"
#include "NNE.h"
#include "NNEModelData.h"
#include "NNERuntimeCPU.h"
#include "NNETypes.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "UObject/StrongObjectPtr.h"
#include "HAL/FileManager.h"
#if PLATFORM_ANDROID
#include "Android/AndroidApplication.h"
#include "Android/AndroidJNI.h"
#include "Android/AndroidJava.h"
#endif

namespace
{
	// ids de los fonemas (el mismo mapa en todas las voces es-ES de Piper; se lee del .onnx.json exportado a voces.json)
	struct FModelo
	{
		TStrongObjectPtr<UNNEModelData> Datos;
		TSharedPtr<UE::NNE::IModelInstanceCPU> Instancia;
		int32 Frecuencia = 22050;
		bool bVariosHablantes = false;
		FCriticalSection Cerrojo;   // una síntesis a la vez por modelo
		FString Archivo;            // Android: el .onnx tal cual (VocesOnnx/), que ejecuta ONNX Runtime desde Kotlin
		bool bEnKotlin = false;
	};
	TMap<FString, TSharedPtr<FModelo>> Modelos;        // por ruta del modelo
	TMap<TCHAR, int64> Ids;                             // fonema → id
	TArray<EMMPiper::FVozPiper> ListaVoces;
	bool bCargado = false;
	FCriticalSection CerrojoCarga;

	void Cargar()
	{
		FScopeLock L(&CerrojoCarga);
		if (bCargado) return;
		bCargado = true;
		FString J; TSharedPtr<FJsonObject> O;
		if (!FFileHelper::LoadFileToString(J, *(FPaths::ProjectContentDir() / TEXT("Datos/voces.json"))) || !FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(J), O) || !O.IsValid()) return;
		for (const auto& Par : O->GetObjectField(TEXT("fonemas"))->Values)
		{
			const FString Clave(Par.Key);
			if (Clave.Len() == 1) Ids.Add(Clave[0], int64(Par.Value->AsNumber()));
		}
#if PLATFORM_ANDROID
		// en Android no hay NNERuntimeORT: los modelos van como archivos y los ejecuta ONNX Runtime (EMMNativo.kt)
		for (const TSharedPtr<FJsonValue>& V : O->GetArrayField(TEXT("voces")))
		{
			const TSharedPtr<FJsonObject> X = V->AsObject();
			EMMPiper::FVozPiper Voz{ X->GetStringField(TEXT("id")), X->GetStringField(TEXT("modelo")), X->GetStringField(TEXT("sexo")), int32(X->GetNumberField(TEXT("hablante"))) };
			TSharedPtr<FModelo>& M = Modelos.FindOrAdd(Voz.Modelo);
			if (!M.IsValid())
			{
				const FString Archivo = FPaths::ProjectDir() / TEXT("VocesOnnx") / (FPaths::GetExtension(Voz.Modelo) + TEXT(".onnx"));
				if (IFileManager::Get().FileSize(*Archivo) <= 0) { UE_LOG(LogTemp, Warning, TEXT("[EMM] Piper: falta %s"), *Archivo); Modelos.Remove(Voz.Modelo); continue; }
				M = MakeShared<FModelo>();
				M->Archivo = Archivo;
				M->Frecuencia = int32(X->GetNumberField(TEXT("hz")));
			}
			ListaVoces.Add(Voz);
		}
		UE_LOG(LogTemp, Display, TEXT("[EMM] Piper (Android): %d voces, %d modelos"), ListaVoces.Num(), Modelos.Num());
		return;
#endif
		TWeakInterfacePtr<INNERuntimeCPU> Motor = UE::NNE::GetRuntime<INNERuntimeCPU>(TEXT("NNERuntimeORTCpu"));
		if (!Motor.IsValid()) { UE_LOG(LogTemp, Warning, TEXT("[EMM] Piper: no hay NNERuntimeORTCpu en esta plataforma")); return; }
		for (const TSharedPtr<FJsonValue>& V : O->GetArrayField(TEXT("voces")))
		{
			const TSharedPtr<FJsonObject> X = V->AsObject();
			EMMPiper::FVozPiper Voz{ X->GetStringField(TEXT("id")), X->GetStringField(TEXT("modelo")), X->GetStringField(TEXT("sexo")), int32(X->GetNumberField(TEXT("hablante"))) };
			TSharedPtr<FModelo>& M = Modelos.FindOrAdd(Voz.Modelo);
			if (!M.IsValid())
			{
				UNNEModelData* Datos = LoadObject<UNNEModelData>(nullptr, *Voz.Modelo);
				if (!Datos) { UE_LOG(LogTemp, Warning, TEXT("[EMM] Piper: falta el modelo %s"), *Voz.Modelo); Modelos.Remove(Voz.Modelo); continue; }
				TSharedPtr<UE::NNE::IModelCPU> Modelo = Motor->CreateModelCPU(Datos);
				if (!Modelo.IsValid()) { Modelos.Remove(Voz.Modelo); continue; }
				M = MakeShared<FModelo>();
				M->Datos.Reset(Datos);
				M->Instancia = Modelo->CreateModelInstanceCPU();
				M->Frecuencia = int32(X->GetNumberField(TEXT("hz")));
				for (const UE::NNE::FTensorDesc& D : M->Instancia->GetInputTensorDescs()) if (D.GetName() == TEXT("sid")) M->bVariosHablantes = true;
			}
			ListaVoces.Add(Voz);
		}
		UE_LOG(LogTemp, Display, TEXT("[EMM] Piper: %d voces, %d modelos (NNE)"), ListaVoces.Num(), Modelos.Num());
	}

	// visema (numeración de SAPI, la que entiende UEMMHabla) de cada fonema
	uint8 Visema(TCHAR F)
	{
		switch (F)
		{
		case TEXT('a'): return 2;
		case TEXT('e'): return 4;
		case TEXT('i'): case TEXT('j'): return 6;
		case TEXT('o'): return 8;
		case TEXT('u'): case TEXT('w'): return 7;
		case TEXT('p'): case TEXT('b'): case TEXT('m'): return 21;
		case TEXT('f'): return 18;
		case TEXT('θ'): case TEXT('ð'): return 17;
		case TEXT('s'): case TEXT('z'): return 15;
		case TEXT('t'): case TEXT('d'): case TEXT('n'): return 19;
		case TEXT('l'): return 14;
		case TEXT('k'): case TEXT('ɡ'): case TEXT('ɣ'): case TEXT('x'): case TEXT('ŋ'): return 20;
		case TEXT('ʃ'): case TEXT('ʎ'): case TEXT('ʝ'): case TEXT('ɲ'): return 16;
		case TEXT('r'): case TEXT('ɾ'): return 13;
		case TEXT('β'): return 21;
		default: return 0;
		}
	}
}

const TArray<EMMPiper::FVozPiper>& EMMPiper::Voces() { Cargar(); return ListaVoces; }
bool EMMPiper::Disponible() { Cargar(); return ListaVoces.Num() > 0; }

bool EMMPiper::Sintetizar(const FString& Texto, const FEMMPerfilVoz& Perfil, FEMMAudio& A)
{
	Cargar();
	const FVozPiper* Voz = ListaVoces.FindByPredicate([&](const FVozPiper& V) { return V.Id == Perfil.Piper; });
	if (!Voz) return false;
	TSharedPtr<FModelo> M = Modelos.FindRef(Voz->Modelo);
	if (!M.IsValid() || (!M->Instancia.IsValid() && M->Archivo.IsEmpty())) return false;

	// texto → fonemas → ids (^ inicio, _ entre fonemas, $ final)
	const FString Fon = EMMFonetica::Fonemas(Texto);
	TArray<int64> Entrada;
	auto Id = [](TCHAR C) { const int64* X = Ids.Find(C); return X ? *X : int64(-1); };
	Entrada.Add(Id(TEXT('^'))); Entrada.Add(Id(TEXT('_')));
	for (TCHAR C : Fon) { const int64 X = Id(C); if (X >= 0) { Entrada.Add(X); Entrada.Add(Id(TEXT('_'))); } }
	Entrada.Add(Id(TEXT('$')));
	if (Entrada.Num() < 5) return false;

	// tono: se reproduce más rápido o más despacio (agudo o grave) y se compensa la duración con length_scale
	const float Tono = FMath::Clamp(Perfil.Tono, 0.7f, 1.9f), Vel = FMath::Clamp(Perfil.Vel, 0.6f, 1.6f);
	float Escalas[3] = { 0.667f, Tono / Vel, 0.8f };
	[[maybe_unused]] int64 Largo = Entrada.Num();
	int64 Hablante = Voz->Hablante;
	TArray<float> Salida;
	Salida.SetNumUninitialized(int32(Entrada.Num() * 4096 * FMath::Max(1.f, Escalas[1])));
	const float Marca = 1e30f;
	for (float& X : Salida) X = Marca;
#if PLATFORM_ANDROID
	{
		FScopeLock L(&M->Cerrojo);
		JNIEnv* Env = FAndroidApplication::GetJavaEnv();
		jclass C = FAndroidApplication::FindJavaClassGlobalRef("es/elmejormedico/nativo/EMMNativo");
		jstring Clave = Env->NewStringUTF(TCHAR_TO_UTF8(*Voz->Modelo));
		if (!M->bEnKotlin)
		{
			// la primera vez se pasa el modelo a ONNX Runtime (luego queda cargado)
			TArray<uint8> Bytes;
			if (!FFileHelper::LoadFileToArray(Bytes, *M->Archivo)) { Env->DeleteLocalRef(Clave); A.Error = TEXT("Piper: no se lee el modelo"); return false; }
			jbyteArray JB = Env->NewByteArray(Bytes.Num());
			Env->SetByteArrayRegion(JB, 0, Bytes.Num(), reinterpret_cast<const jbyte*>(Bytes.GetData()));
			jmethodID MC = Env->GetStaticMethodID(C, "piperCargar", "(Ljava/lang/String;[B)Z");
			M->bEnKotlin = Env->CallStaticBooleanMethod(C, MC, Clave, JB) == JNI_TRUE;
			Env->DeleteLocalRef(JB);
			if (!M->bEnKotlin) { Env->DeleteLocalRef(Clave); A.Error = TEXT("Piper: ONNX Runtime no carga el modelo"); return false; }
		}
		jlongArray JIds = Env->NewLongArray(Entrada.Num());
		Env->SetLongArrayRegion(JIds, 0, Entrada.Num(), reinterpret_cast<const jlong*>(Entrada.GetData()));
		jfloatArray JEsc = Env->NewFloatArray(3);
		Env->SetFloatArrayRegion(JEsc, 0, 3, Escalas);
		jmethodID MP = Env->GetStaticMethodID(C, "piper", "(Ljava/lang/String;[J[FJ)[F");
		jfloatArray JSal = (jfloatArray)Env->CallStaticObjectMethod(C, MP, Clave, JIds, JEsc, jlong(Hablante));
		Salida.Reset();
		if (JSal)
		{
			Salida.SetNumUninitialized(Env->GetArrayLength(JSal));
			Env->GetFloatArrayRegion(JSal, 0, Salida.Num(), Salida.GetData());
			Env->DeleteLocalRef(JSal);
		}
		Env->DeleteLocalRef(JIds); Env->DeleteLocalRef(JEsc); Env->DeleteLocalRef(Clave);
		if (!Salida.Num()) { A.Error = TEXT("Piper: inferencia"); return false; }
	}
#else
	{
		FScopeLock L(&M->Cerrojo);
		TArray<UE::NNE::FTensorShape> Formas;
		TArray<UE::NNE::FTensorBindingCPU> Entradas;
		for (const UE::NNE::FTensorDesc& D : M->Instancia->GetInputTensorDescs())
		{
			const FString N = D.GetName();
			if (N == TEXT("input")) { Formas.Add(UE::NNE::FTensorShape::Make({ 1u, uint32(Entrada.Num()) })); Entradas.Add({ Entrada.GetData(), uint64(Entrada.Num() * sizeof(int64)) }); }
			else if (N == TEXT("input_lengths")) { Formas.Add(UE::NNE::FTensorShape::Make({ 1u })); Entradas.Add({ &Largo, sizeof(int64) }); }
			else if (N == TEXT("scales")) { Formas.Add(UE::NNE::FTensorShape::Make({ 3u })); Entradas.Add({ Escalas, sizeof(Escalas) }); }
			else if (N == TEXT("sid")) { Formas.Add(UE::NNE::FTensorShape::Make({ 1u })); Entradas.Add({ &Hablante, sizeof(int64) }); }
		}
		if (M->Instancia->SetInputTensorShapes(Formas) != UE::NNE::EResultStatus::Ok) { A.Error = TEXT("Piper: formas"); return false; }
		TArray<UE::NNE::FTensorBindingCPU> Salidas = { { Salida.GetData(), uint64(Salida.Num() * sizeof(float)) } };
		if (M->Instancia->RunSync(Entradas, Salidas) != UE::NNE::EResultStatus::Ok) { A.Error = TEXT("Piper: inferencia"); return false; }
		// muestras: la forma resuelta tras ejecutar o, si no, hasta la última escrita
		int32 N = 0;
		const TConstArrayView<UE::NNE::FTensorShape> FS = M->Instancia->GetOutputTensorShapes();
		if (FS.Num() && FS[0].Volume() > 0 && FS[0].Volume() <= uint64(Salida.Num())) N = int32(FS[0].Volume());
		else { N = Salida.Num(); while (N > 0 && Salida[N - 1] == Marca) --N; }
		Salida.SetNum(N);
	}
#endif
	if (!Salida.Num()) return false;

	// PCM de 16 bits, normalizado sin saturar; la frecuencia de reproducción da el tono
	float Max = 0.01f;
	for (float X : Salida) Max = FMath::Max(Max, FMath::Abs(X));
	const float G = FMath::Min(1.f, 0.95f / Max) * 32767.f;
	A.PCM.SetNumUninitialized(Salida.Num() * 2);
	int16* P = reinterpret_cast<int16*>(A.PCM.GetData());
	for (int32 i = 0; i < Salida.Num(); ++i) P[i] = int16(FMath::Clamp(Salida[i] * G, -32767.f, 32767.f));
	A.Frecuencia = FMath::RoundToInt(M->Frecuencia * Tono);
	A.Voz = FString::Printf(TEXT("Piper %s"), *Voz->Id);
	EMMVoz::CalcularApertura(A);   // apertura de la boca por el volumen (también fija Duracion y el tamaño de Visema)

	// visemas y palabras: repartidos en el tiempo según los fonemas (las vocales duran algo más)
	TArray<float> Peso; TArray<uint8> Vis;
	for (TCHAR C : Fon)
	{
		if (C == TEXT('ˈ')) continue;
		const bool bPausa = C == TEXT(',') || C == TEXT('.') || C == TEXT('?') || C == TEXT('!') || C == TEXT(';') || C == TEXT(':');
		const uint8 V = Visema(C);
		Peso.Add(bPausa ? 3.f : C == TEXT(' ') ? 0.4f : (V >= 2 && V <= 8) ? 1.4f : 1.f);
		Vis.Add(bPausa || C == TEXT(' ') ? 0 : V);
	}
	float Total = 0; for (float X : Peso) Total += X;
	if (Total > 0 && A.Visema.Num())
	{
		float Acum = 0;
		for (int32 k = 0; k < Peso.Num(); ++k)
		{
			const int32 De = FMath::Clamp(int32(Acum / Total * A.Visema.Num()), 0, A.Visema.Num());
			Acum += Peso[k];
			const int32 Hasta = FMath::Clamp(int32(Acum / Total * A.Visema.Num()), 0, A.Visema.Num());
			for (int32 c = De; c < Hasta; ++c) A.Visema[c] = Vis[k];
		}
	}
	// subtítulos: cada palabra del texto en proporción a su longitud
	int32 Letras = 0; for (TCHAR C : Texto) if (!FChar::IsWhitespace(C)) ++Letras;
	int32 Vistas = 0;
	for (int32 i = 0; i < Texto.Len(); ++i)
	{
		const bool bFin = i + 1 == Texto.Len() || FChar::IsWhitespace(Texto[i + 1]);
		if (!FChar::IsWhitespace(Texto[i])) ++Vistas;
		if (bFin && !FChar::IsWhitespace(Texto[i]) && Letras) A.Palabras.Add({ A.Duracion * float(Vistas) / Letras * 0.97f - 0.15f, i + 1 });
	}
	return true;
}
