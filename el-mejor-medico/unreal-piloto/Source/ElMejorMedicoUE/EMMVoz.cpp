#include "EMMVoz.h"
#include "Async/Async.h"
#include "HAL/PlatformFileManager.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"

#if PLATFORM_WINDOWS
#include "Windows/AllowWindowsPlatformTypes.h"
#include "Windows/PreWindowsApi.h"
#include <objbase.h>
#include <sapi.h>
#include "Windows/PostWindowsApi.h"
#include "Windows/HideWindowsPlatformTypes.h"
#endif

#if PLATFORM_ANDROID
#include "Android/AndroidApplication.h"
#include "Android/AndroidJNI.h"
#include "Android/AndroidJava.h"
#endif

void EMMVoz::CalcularApertura(FEMMAudio& A)
{
	const int32 N = A.PCM.Num() / 2;
	const int16* M = reinterpret_cast<const int16*>(A.PCM.GetData());
	const int32 Paso = FMath::Max(1, A.Frecuencia / 60);
	const int32 Cuadros = FMath::DivideAndRoundUp(N, Paso);
	TArray<float> Rms; Rms.SetNumZeroed(Cuadros);
	for (int32 c = 0; c < Cuadros; ++c)
	{
		double S = 0; int32 K = 0;
		for (int32 i = c * Paso; i < FMath::Min(N, (c + 1) * Paso); ++i, ++K) S += FMath::Square(M[i] / 32768.0);
		Rms[c] = K ? FMath::Sqrt(S / K) : 0.f;
	}
	// normaliza con el percentil 95 para que voces flojas y fuertes muevan la boca igual
	TArray<float> Ord = Rms; Ord.Sort();
	const float Ref = FMath::Max(0.02f, Ord.Num() ? Ord[FMath::Clamp(int32(Ord.Num() * 0.95f), 0, Ord.Num() - 1)] : 0.1f);
	A.Apertura.SetNumZeroed(Cuadros);
	float Prev = 0.f;
	for (int32 c = 0; c < Cuadros; ++c)
	{
		float V = FMath::Clamp((Rms[c] / Ref - 0.08f) / 0.92f, 0.f, 1.f);
		V = FMath::Pow(V, 0.8f);
		// la boca abre deprisa y cierra algo más despacio, como al hablar
		Prev = V > Prev ? FMath::Lerp(Prev, V, 0.7f) : FMath::Lerp(Prev, V, 0.35f);
		A.Apertura[c] = Prev;
	}
	if (A.Visema.Num() != Cuadros) { A.Visema.Init(255, Cuadros); }
	A.Duracion = N / float(A.Frecuencia);
}

#if PLATFORM_WINDOWS
// ───────────────────────── Windows: SAPI con las voces OneCore ─────────────────────────
static TArray<TPair<FString, ISpObjectToken*>> VocesWindows()
{
	TArray<TPair<FString, ISpObjectToken*>> R;
	// las voces modernas (Pablo, Laura, Helena) están en Speech_OneCore; las clásicas, en Speech
	for (const TCHAR* Cat : { TEXT("HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Speech_OneCore\\Voices"), TEXT("HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Speech\\Voices") })
	{
		ISpObjectTokenCategory* Categoria = nullptr;
		if (FAILED(CoCreateInstance(CLSID_SpObjectTokenCategory, nullptr, CLSCTX_ALL, IID_ISpObjectTokenCategory, (void**)&Categoria))) continue;
		IEnumSpObjectTokens* Lista = nullptr;
		if (SUCCEEDED(Categoria->SetId(Cat, false)) && SUCCEEDED(Categoria->EnumTokens(nullptr, nullptr, &Lista)))
		{
			ISpObjectToken* T = nullptr;
			while (Lista->Next(1, &T, nullptr) == S_OK)
			{
				WCHAR* Nombre = nullptr;
				if (SUCCEEDED(T->GetStringValue(nullptr, &Nombre)) && Nombre)
				{
					const FString N(Nombre);
					CoTaskMemFree(Nombre);
					if (N.Contains(TEXT("Spain")) || N.Contains(TEXT("España"))) { R.Add({ N, T }); continue; }
				}
				T->Release();
			}
			Lista->Release();
		}
		Categoria->Release();
	}
	return R;
}

static void SintetizarWindows(const FString& Texto, const FEMMPerfilVoz& P, FEMMAudio& A)
{
	const HRESULT HrInit = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
	ISpVoice* Voz = nullptr;
	if (FAILED(CoCreateInstance(CLSID_SpVoice, nullptr, CLSCTX_ALL, IID_ISpVoice, (void**)&Voz))) { A.Error = TEXT("SAPI no disponible"); return; }
	TArray<TPair<FString, ISpObjectToken*>> Voces = VocesWindows();
	// voz: la preferida; si no, una del sexo del personaje (Pablo hombre; Laura y Helena mujer)
	int32 Elegida = INDEX_NONE;
	if (!P.Preferida.IsEmpty()) Elegida = Voces.IndexOfByPredicate([&](const auto& V) { return V.Key.Contains(P.Preferida); });
	if (Elegida == INDEX_NONE) Elegida = Voces.IndexOfByPredicate([&](const auto& V) { return P.bMujer ? (V.Key.Contains(TEXT("Laura")) || V.Key.Contains(TEXT("Helena"))) : V.Key.Contains(TEXT("Pablo")); });
	if (Elegida == INDEX_NONE && Voces.Num()) Elegida = 0;
	if (Elegida != INDEX_NONE) { Voz->SetVoice(Voces[Elegida].Value); A.Voz = Voces[Elegida].Key; }
	for (auto& V : Voces) V.Value->Release();

	// salida a memoria: 22 050 Hz, 16 bits, mono
	IStream* Memoria = nullptr;
	CreateStreamOnHGlobal(nullptr, true, &Memoria);
	ISpStream* Flujo = nullptr;
	CoCreateInstance(CLSID_SpStream, nullptr, CLSCTX_ALL, IID_ISpStream, (void**)&Flujo);
	WAVEFORMATEX F = {}; F.wFormatTag = WAVE_FORMAT_PCM; F.nChannels = 1; F.nSamplesPerSec = 22050; F.wBitsPerSample = 16;
	F.nBlockAlign = 2; F.nAvgBytesPerSec = 44100;
	Flujo->SetBaseStream(Memoria, SPDFID_WaveFormatEx, &F);
	Voz->SetOutput(Flujo, true);
	Voz->SetInterest(SPFEI(SPEI_VISEME), SPFEI(SPEI_VISEME));
	// tono y velocidad con el XML de SAPI (-10..10)
	const int32 Tono = FMath::Clamp(FMath::RoundToInt((P.Tono - 1.f) * 12.f), -10, 10);
	const int32 Vel = FMath::Clamp(FMath::RoundToInt((P.Vel - 1.f) * 10.f), -10, 10);
	FString Seguro = Texto.Replace(TEXT("&"), TEXT("y")).Replace(TEXT("<"), TEXT(" ")).Replace(TEXT(">"), TEXT(" "));
	const FString Xml = FString::Printf(TEXT("<pitch absmiddle=\"%d\"><rate absspeed=\"%d\">%s</rate></pitch>"), Tono, Vel, *Seguro);
	if (FAILED(Voz->Speak(*Xml, SPF_IS_XML, nullptr))) Voz->Speak(*Seguro, SPF_IS_NOT_XML, nullptr);

	// visemas con su instante en el audio
	TArray<TPair<double, uint8>> Visemas;
	SPEVENT Ev; ULONG Leidos = 0;
	while (Voz->GetEvents(1, &Ev, &Leidos) == S_OK && Leidos == 1)
		if (Ev.eEventId == SPEI_VISEME) Visemas.Add({ double(Ev.ullAudioStreamOffset) / F.nAvgBytesPerSec, uint8(LOWORD(Ev.lParam)) });

	STATSTG Info = {};
	Memoria->Stat(&Info, STATFLAG_NONAME);
	HGLOBAL H = nullptr;
	GetHGlobalFromStream(Memoria, &H);
	if (H && Info.cbSize.QuadPart > 0)
	{
		const uint8* D = (const uint8*)GlobalLock(H);
		A.PCM.Append(D, int32(Info.cbSize.QuadPart));
		GlobalUnlock(H);
	}
	A.Frecuencia = 22050;
	Flujo->Release(); Memoria->Release(); Voz->Release();
	if (SUCCEEDED(HrInit)) CoUninitialize();

	EMMVoz::CalcularApertura(A);
	for (int32 i = 0; i < Visemas.Num(); ++i)
	{
		const int32 De = FMath::Clamp(int32(Visemas[i].Key * 60.0), 0, A.Visema.Num());
		const int32 Hasta = i + 1 < Visemas.Num() ? FMath::Clamp(int32(Visemas[i + 1].Key * 60.0), 0, A.Visema.Num()) : A.Visema.Num();
		for (int32 c = De; c < Hasta; ++c) A.Visema[c] = Visemas[i].Value;
	}
	if (!A.PCM.Num()) A.Error = TEXT("la voz no ha producido audio");
}
#endif

#if PLATFORM_ANDROID
// WAV de TextToSpeech.synthesizeToFile → PCM
static bool LeerWav(const TArray<uint8>& W, FEMMAudio& A)
{
	if (W.Num() < 44 || FMemory::Memcmp(W.GetData(), "RIFF", 4) != 0) return false;
	int32 Pos = 12, Canales = 1;
	while (Pos + 8 <= W.Num())
	{
		const int32 Tam = *(const int32*)(W.GetData() + Pos + 4);
		if (FMemory::Memcmp(W.GetData() + Pos, "fmt ", 4) == 0) { Canales = *(const int16*)(W.GetData() + Pos + 10); A.Frecuencia = *(const int32*)(W.GetData() + Pos + 12); }
		else if (FMemory::Memcmp(W.GetData() + Pos, "data", 4) == 0)
		{
			const int32 Bytes = FMath::Min(Tam, W.Num() - Pos - 8);
			if (Canales == 1) A.PCM.Append(W.GetData() + Pos + 8, Bytes);
			else for (int32 i = 0; i + 2 * Canales <= Bytes; i += 2 * Canales) A.PCM.Append(W.GetData() + Pos + 8 + i, 2);
			return true;
		}
		Pos += 8 + Tam + (Tam & 1);
	}
	return false;
}
#endif

TArray<FString> EMMVoz::VocesDisponibles()
{
	TArray<FString> R;
#if PLATFORM_WINDOWS
	const HRESULT Hr = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
	for (auto& V : VocesWindows()) { R.Add(V.Key); V.Value->Release(); }
	if (SUCCEEDED(Hr)) CoUninitialize();
#endif
	return R;
}

void EMMVoz::Sintetizar(const FString& Texto, const FEMMPerfilVoz& Perfil, TFunction<void(TSharedPtr<FEMMAudio>)> Hecho)
{
	AsyncTask(ENamedThreads::AnyBackgroundThreadNormalTask, [Texto, Perfil, Hecho]() {
		TSharedPtr<FEMMAudio> A = MakeShared<FEMMAudio>();
#if PLATFORM_WINDOWS
		SintetizarWindows(Texto, Perfil, *A);
#elif PLATFORM_ANDROID
		JNIEnv* Env = FAndroidApplication::GetJavaEnv();
		jclass C = FAndroidApplication::FindJavaClassGlobalRef("es/elmejormedico/nativo/EMMNativo");
		jmethodID Met = Env->GetStaticMethodID(C, "sintetizar", "(Landroid/content/Context;Ljava/lang/String;ZFFLjava/lang/String;)Ljava/lang/String;");
		const FString Ruta = FPaths::ConvertRelativePathToFull(FPaths::ProjectSavedDir() / TEXT("voz.wav"));
		IFileManager::Get().MakeDirectory(*FPaths::GetPath(Ruta), true);
		const FString RutaJava = IFileManager::Get().ConvertToAbsolutePathForExternalAppForWrite(*Ruta);
		jstring JT = Env->NewStringUTF(TCHAR_TO_UTF8(*Texto));
		jstring JR = Env->NewStringUTF(TCHAR_TO_UTF8(*RutaJava));
		jstring Res = (jstring)Env->CallStaticObjectMethod(C, Met, FJavaWrapper::GameActivityThis, JT, (jboolean)Perfil.bMujer, Perfil.Tono, Perfil.Vel, JR);
		A->Voz = FJavaHelper::FStringFromLocalRef(Env, Res);
		Env->DeleteLocalRef(JT); Env->DeleteLocalRef(JR);
		TArray<uint8> Wav;
		if (A->Voz.StartsWith(TEXT("error")) || !FFileHelper::LoadFileToArray(Wav, *RutaJava) || !LeerWav(Wav, *A)) A->Error = A->Voz.IsEmpty() ? TEXT("la voz no ha producido audio") : A->Voz;
		else EMMVoz::CalcularApertura(*A);
#else
		A->Error = TEXT("sin voces en esta plataforma");
#endif
		AsyncTask(ENamedThreads::GameThread, [A, Hecho]() { Hecho(A); });
	});
}
