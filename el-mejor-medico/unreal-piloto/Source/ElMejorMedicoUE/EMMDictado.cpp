#include "EMMDictado.h"
#include "Async/Async.h"
#include "HAL/RunnableThread.h"
#include <atomic>

#if PLATFORM_WINDOWS
#include "Windows/AllowWindowsPlatformTypes.h"
#include "Windows/PreWindowsApi.h"
#include <objbase.h>
#include <sapi.h>
#include "Windows/PostWindowsApi.h"
#include "Windows/HideWindowsPlatformTypes.h"
#endif

namespace
{
	std::atomic<bool> GParar{ false };
	std::atomic<bool> GEscuchando{ false };
}

bool EMMDictado::Escuchando() { return GEscuchando; }
void EMMDictado::Parar() { GParar = true; }

bool EMMDictado::Empezar(TFunction<void(const FString&)> AlTexto, TFunction<void(const FString&, const FString&)> AlTerminar)
{
	if (GEscuchando) return false;
	GParar = false;
	GEscuchando = true;
	Async(EAsyncExecution::Thread, [AlTexto, AlTerminar]() {
		FString Dicho, Error;
#if PLATFORM_WINDOWS
		const HRESULT HrInit = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
		ISpRecognizer* Reco = nullptr; ISpRecoContext* Ctx = nullptr; ISpRecoGrammar* Gram = nullptr; ISpAudio* Audio = nullptr;
		do
		{
			if (FAILED(CoCreateInstance(CLSID_SpInprocRecognizer, nullptr, CLSCTX_ALL, IID_ISpRecognizer, (void**)&Reco))) { Error = TEXT("no hay reconocedor de voz"); break; }
			// reconocedor en español (el de Windows, sin Internet)
			ISpObjectTokenCategory* Cat = nullptr; IEnumSpObjectTokens* Lista = nullptr; ISpObjectToken* Elegido = nullptr;
			if (SUCCEEDED(CoCreateInstance(CLSID_SpObjectTokenCategory, nullptr, CLSCTX_ALL, IID_ISpObjectTokenCategory, (void**)&Cat)) &&
				SUCCEEDED(Cat->SetId(L"HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Speech\\Recognizers", false)) && SUCCEEDED(Cat->EnumTokens(nullptr, nullptr, &Lista)))
			{
				ISpObjectToken* T = nullptr;
				while (!Elegido && Lista->Next(1, &T, nullptr) == S_OK)
				{
					WCHAR* Nombre = nullptr;
					if (SUCCEEDED(T->GetStringValue(nullptr, &Nombre)) && Nombre && FString(Nombre).Contains(TEXT("Spanish"))) Elegido = T; else T->Release();
					if (Nombre) CoTaskMemFree(Nombre);
				}
				Lista->Release();
			}
			if (Cat) Cat->Release();
			if (!Elegido) { Error = TEXT("no está instalado el reconocimiento de voz en español"); break; }
			Reco->SetRecognizer(Elegido);
			Elegido->Release();
			if (FAILED(CoCreateInstance(CLSID_SpMMAudioIn, nullptr, CLSCTX_ALL, IID_ISpAudio, (void**)&Audio))) { Error = TEXT("no se encuentra el micrófono"); break; }
			Reco->SetInput(Audio, true);
			if (FAILED(Reco->CreateRecoContext(&Ctx))) { Error = TEXT("no se ha podido iniciar el dictado"); break; }
			Ctx->SetNotifyWin32Event();
			Ctx->SetInterest(SPFEI(SPEI_RECOGNITION) | SPFEI(SPEI_HYPOTHESIS), SPFEI(SPEI_RECOGNITION) | SPFEI(SPEI_HYPOTHESIS));
			if (FAILED(Ctx->CreateGrammar(0, &Gram)) || FAILED(Gram->LoadDictation(nullptr, SPLO_STATIC)) || FAILED(Gram->SetDictationState(SPRS_ACTIVE))) { Error = TEXT("no se ha podido cargar el dictado"); break; }
			// escucha hasta que el jugador pulsa PARAR (o 60 s)
			const double Fin = FPlatformTime::Seconds() + 60.0;
			while (!GParar && FPlatformTime::Seconds() < Fin)
			{
				Ctx->WaitForNotifyEvent(200);
				SPEVENT Ev; ULONG Leidos = 0;
				while (Ctx->GetEvents(1, &Ev, &Leidos) == S_OK && Leidos == 1)
				{
					if ((Ev.eEventId == SPEI_RECOGNITION || Ev.eEventId == SPEI_HYPOTHESIS) && Ev.elParamType == SPET_LPARAM_IS_OBJECT)
					{
						ISpRecoResult* R = reinterpret_cast<ISpRecoResult*>(Ev.lParam);
						WCHAR* Texto = nullptr;
						if (SUCCEEDED(R->GetText(SP_GETWHOLEPHRASE, SP_GETWHOLEPHRASE, true, &Texto, nullptr)) && Texto)
						{
							const FString Frase(Texto);
							CoTaskMemFree(Texto);
							const FString Vista = Dicho.IsEmpty() ? Frase : Dicho + TEXT(" ") + Frase;
							if (Ev.eEventId == SPEI_RECOGNITION) Dicho = Vista;
							AsyncTask(ENamedThreads::GameThread, [AlTexto, Vista]() { AlTexto(Vista); });
						}
					}
					if (Ev.elParamType == SPET_LPARAM_IS_OBJECT && Ev.lParam) reinterpret_cast<IUnknown*>(Ev.lParam)->Release();
					else if ((Ev.elParamType == SPET_LPARAM_IS_POINTER || Ev.elParamType == SPET_LPARAM_IS_STRING) && Ev.lParam) CoTaskMemFree(reinterpret_cast<void*>(Ev.lParam));
				}
			}
			Gram->SetDictationState(SPRS_INACTIVE);
		} while (false);
		if (Gram) Gram->Release();
		if (Ctx) Ctx->Release();
		if (Audio) Audio->Release();
		if (Reco) Reco->Release();
		if (SUCCEEDED(HrInit)) CoUninitialize();
#else
		Error = TEXT("dictado no disponible en esta plataforma");
#endif
		GEscuchando = false;
		// primera letra en mayúscula, como se escribe
		if (Dicho.Len()) Dicho = FText::FromString(Dicho.Left(1)).ToUpper().ToString() + Dicho.Mid(1);
		AsyncTask(ENamedThreads::GameThread, [AlTerminar, Dicho, Error]() { AlTerminar(Dicho, Error); });
	});
	return true;
}
