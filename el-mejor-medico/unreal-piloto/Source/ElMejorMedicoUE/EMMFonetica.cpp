#include "EMMFonetica.h"

namespace
{
	// ───────────────────────── Números ─────────────────────────
	FString Unidades(int32 N, bool bApocope)
	{
		static const TCHAR* U[] = { TEXT("cero"), TEXT("uno"), TEXT("dos"), TEXT("tres"), TEXT("cuatro"), TEXT("cinco"), TEXT("seis"), TEXT("siete"), TEXT("ocho"), TEXT("nueve"),
			TEXT("diez"), TEXT("once"), TEXT("doce"), TEXT("trece"), TEXT("catorce"), TEXT("quince"), TEXT("dieciséis"), TEXT("diecisiete"), TEXT("dieciocho"), TEXT("diecinueve"),
			TEXT("veinte"), TEXT("veintiuno"), TEXT("veintidós"), TEXT("veintitrés"), TEXT("veinticuatro"), TEXT("veinticinco"), TEXT("veintiséis"), TEXT("veintisiete"), TEXT("veintiocho"), TEXT("veintinueve") };
		if (bApocope && N == 1) return TEXT("un");
		if (bApocope && N == 21) return TEXT("veintiún");
		return U[N];
	}
	FString Centenas(int32 N, bool bApocope)
	{
		static const TCHAR* D[] = { TEXT(""), TEXT(""), TEXT(""), TEXT("treinta"), TEXT("cuarenta"), TEXT("cincuenta"), TEXT("sesenta"), TEXT("setenta"), TEXT("ochenta"), TEXT("noventa") };
		static const TCHAR* C[] = { TEXT(""), TEXT("ciento"), TEXT("doscientos"), TEXT("trescientos"), TEXT("cuatrocientos"), TEXT("quinientos"), TEXT("seiscientos"), TEXT("setecientos"), TEXT("ochocientos"), TEXT("novecientos") };
		if (N == 100) return TEXT("cien");
		FString R;
		if (N >= 100) { R = C[N / 100]; N %= 100; if (N) R += TEXT(" "); else return R; }
		if (N < 30) return R + Unidades(N, bApocope);
		R += D[N / 10];
		if (N % 10) R += TEXT(" y ") + Unidades(N % 10, bApocope);
		return R;
	}
	FString Numero(int64 N)
	{
		if (N == 0) return TEXT("cero");
		if (N >= 1000000) return Numero(N / 1000000) + (N / 1000000 == 1 ? TEXT(" millón") : TEXT(" millones")) + (N % 1000000 ? TEXT(" ") + Numero(N % 1000000) : FString());
		FString R;
		if (N >= 1000)
		{
			const int32 M = int32(N / 1000);
			R = M == 1 ? FString(TEXT("mil")) : Centenas(M, true) + TEXT(" mil");
			N %= 1000;
			if (!N) return R;
			R += TEXT(" ");
		}
		return R + Centenas(int32(N), false);
	}

	// ───────────────────────── Letras → segmentos ─────────────────────────
	struct FSeg
	{
		FString Fon;          // consonante (AFI) o vocal (a e i o u)
		bool bVocal = false;
		bool bTilde = false;  // vocal con tilde (acento escrito)
		bool bDebil = false;  // i/u sin tilde (puede ser semivocal)
		bool bNucleo = false; // núcleo de sílaba
		bool bAcento = false; // sílaba tónica
		bool bInicial = false;
	};

	bool EsVocal(TCHAR C) { return FString(TEXT("aeiouáéíóúü")).Contains(FString(1, &C)); }
	TCHAR SinTilde(TCHAR C)
	{
		switch (C) { case TEXT('á'): return TEXT('a'); case TEXT('é'): return TEXT('e'); case TEXT('í'): return TEXT('i'); case TEXT('ó'): return TEXT('o'); case TEXT('ú'): case TEXT('ü'): return TEXT('u'); default: return C; }
	}

	// palabras átonas (artículos, preposiciones, pronombres átonos, conjunciones): sin acento
	bool Atona(const FString& P)
	{
		static const TSet<FString> L = { TEXT("el"), TEXT("la"), TEXT("los"), TEXT("las"), TEXT("lo"), TEXT("le"), TEXT("les"), TEXT("de"), TEXT("del"), TEXT("a"), TEXT("al"),
			TEXT("en"), TEXT("y"), TEXT("e"), TEXT("o"), TEXT("u"), TEXT("que"), TEXT("se"), TEXT("me"), TEXT("te"), TEXT("nos"), TEXT("os"), TEXT("su"), TEXT("sus"), TEXT("mi"),
			TEXT("mis"), TEXT("tu"), TEXT("tus"), TEXT("por"), TEXT("con"), TEXT("sin"), TEXT("un"), TEXT("unos"), TEXT("unas"), TEXT("ni"), TEXT("si"), TEXT("pero"), TEXT("como"),
			TEXT("cuando"), TEXT("donde"), TEXT("para"), TEXT("tan"), TEXT("muy") };
		return L.Contains(P);
	}

	TArray<FSeg> Segmentos(const FString& W)
	{
		TArray<FSeg> S;
		const int32 N = W.Len();
		auto Sig = [&](int32 i) { return i + 1 < N ? W[i + 1] : TEXT('\0'); };
		auto Cons = [&](const TCHAR* F) { FSeg X; X.Fon = F; S.Add(X); };
		for (int32 i = 0; i < N; ++i)
		{
			const TCHAR C = W[i], D = Sig(i), D2 = i + 2 < N ? W[i + 2] : TEXT('\0');
			const bool bEI = D == TEXT('e') || D == TEXT('i') || D == TEXT('é') || D == TEXT('í');
			if (EsVocal(C))
			{
				FSeg X; X.bVocal = true;
				const TCHAR V = SinTilde(C);
				X.Fon = FString(1, &V);
				X.bTilde = C == TEXT('á') || C == TEXT('é') || C == TEXT('í') || C == TEXT('ó') || C == TEXT('ú');
				X.bDebil = (V == TEXT('i') || V == TEXT('u')) && !X.bTilde;
				S.Add(X);
				continue;
			}
			switch (C)
			{
			case TEXT('c'):
				if (D == TEXT('h')) { Cons(TEXT("tʃ")); ++i; }
				else Cons(bEI ? TEXT("θ") : TEXT("k"));
				break;
			case TEXT('q'): Cons(TEXT("k")); if (D == TEXT('u')) ++i; break;
			case TEXT('g'):
				if (D == TEXT('u') && (D2 == TEXT('e') || D2 == TEXT('i') || D2 == TEXT('é') || D2 == TEXT('í'))) { Cons(TEXT("g")); ++i; }
				else Cons(bEI ? TEXT("x") : TEXT("g"));
				break;
			case TEXT('l'): if (D == TEXT('l')) { Cons(TEXT("ʎ")); ++i; } else Cons(TEXT("l")); break;
			case TEXT('r'):
				if (D == TEXT('r')) { Cons(TEXT("r")); ++i; }
				else if (i == 0 || (S.Num() && (S.Last().Fon == TEXT("l") || S.Last().Fon == TEXT("n") || S.Last().Fon == TEXT("s")))) Cons(TEXT("r"));
				else Cons(TEXT("ɾ"));
				break;
			case TEXT('y'):
				if (i == N - 1 || !EsVocal(D)) { FSeg X; X.bVocal = true; X.Fon = TEXT("i"); X.bDebil = true; S.Add(X); }
				else Cons(TEXT("ʝ"));
				break;
			case TEXT('z'): Cons(TEXT("θ")); break;
			case TEXT('j'): Cons(TEXT("x")); break;
			case TEXT('ñ'): Cons(TEXT("ɲ")); break;
			case TEXT('h'): break;   // muda
			case TEXT('v'): case TEXT('b'): Cons(TEXT("b")); break;
			case TEXT('x'): Cons(TEXT("k")); Cons(TEXT("s")); break;
			case TEXT('w'): { FSeg X; X.bVocal = true; X.Fon = TEXT("u"); X.bDebil = true; S.Add(X); break; }
			case TEXT('k'): case TEXT('f'): case TEXT('m'): case TEXT('n'): case TEXT('p'): case TEXT('s'): case TEXT('t'): case TEXT('d'):
				Cons(*FString(1, &C)); break;
			default: break;   // otros signos dentro de la palabra se ignoran
			}
		}
		if (S.Num()) S[0].bInicial = true;
		return S;
	}

	// núcleos silábicos, diptongos (semivocales) y acento
	void Silabas(TArray<FSeg>& S, const FString& Palabra)
	{
		// grupos de vocales seguidas
		for (int32 i = 0; i < S.Num();)
		{
			if (!S[i].bVocal) { ++i; continue; }
			int32 j = i;
			while (j < S.Num() && S[j].bVocal) ++j;
			// en el grupo [i, j): las fuertes (a e o, o i/u con tilde) son núcleo; i/u débiles junto a otra vocal, semivocales
			int32 Fuertes = 0;
			for (int32 k = i; k < j; ++k) if (!S[k].bDebil) { S[k].bNucleo = true; ++Fuertes; }
			if (!Fuertes)
			{
				// sólo débiles: «ui», «iu» → la segunda es el núcleo; una sola, núcleo
				S[j - 1].bNucleo = true;
			}
			i = j;
		}
		TArray<int32> Nucleos;
		for (int32 k = 0; k < S.Num(); ++k) if (S[k].bNucleo) Nucleos.Add(k);
		if (!Nucleos.Num() || Atona(Palabra)) return;
		int32 Tonica = INDEX_NONE;
		for (int32 k : Nucleos) if (S[k].bTilde) Tonica = k;
		if (Tonica == INDEX_NONE)
		{
			const TCHAR Fin = Palabra.Len() ? Palabra[Palabra.Len() - 1] : TEXT(' ');
			const bool bLlana = EsVocal(Fin) || Fin == TEXT('n') || Fin == TEXT('s') || Fin == TEXT('y');
			Tonica = Nucleos.Num() >= 2 && bLlana ? Nucleos[Nucleos.Num() - 2] : Nucleos.Last();
		}
		S[Tonica].bAcento = true;
	}

	// AFI de la palabra, con alófonos según lo que hay alrededor
	FString Afi(const TArray<FSeg>& S, bool bTrasPausa)
	{
		FString R;
		for (int32 k = 0; k < S.Num(); ++k)
		{
			const FSeg& X = S[k];
			const FString Ant = k > 0 ? S[k - 1].Fon : FString();
			const FString Sig = k + 1 < S.Num() ? S[k + 1].Fon : FString();
			if (X.bVocal)
			{
				if (X.bAcento) R += TEXT("ˈ");
				if (!X.bNucleo) R += X.Fon == TEXT("i") ? TEXT("j") : TEXT("w");
				else R += X.Fon;
				continue;
			}
			const bool bInicio = X.bInicial && bTrasPausa;
			const bool bTrasNasal = Ant == TEXT("m") || Ant == TEXT("n");
			if (X.Fon == TEXT("b")) R += (bInicio || bTrasNasal) ? TEXT("b") : TEXT("β");
			else if (X.Fon == TEXT("d")) R += (bInicio || bTrasNasal || Ant == TEXT("l")) ? TEXT("d") : TEXT("ð");
			else if (X.Fon == TEXT("g")) R += (bInicio || bTrasNasal) ? TEXT("ɡ") : TEXT("ɣ");
			else if (X.Fon == TEXT("n") && (Sig == TEXT("k") || Sig == TEXT("g") || Sig == TEXT("x"))) R += TEXT("ŋ");
			else if (X.Fon == TEXT("n") && (Sig == TEXT("b") || Sig == TEXT("p") || Sig == TEXT("m"))) R += TEXT("m");
			else if (X.Fon == TEXT("s") && (Sig == TEXT("b") || Sig == TEXT("d") || Sig == TEXT("g") || Sig == TEXT("m") || Sig == TEXT("n") || Sig == TEXT("l"))) R += TEXT("z");
			else R += X.Fon;
		}
		return R;
	}
}

FString EMMFonetica::NumerosEnLetra(const FString& Texto)
{
	FString R;
	for (int32 i = 0; i < Texto.Len();)
	{
		if (!FChar::IsDigit(Texto[i])) { R.AppendChar(Texto[i++]); continue; }
		int32 j = i;
		while (j < Texto.Len() && FChar::IsDigit(Texto[j])) ++j;
		const FString Entero = Texto.Mid(i, j - i);
		R += Numero(FCString::Atoi64(*Entero));
		// decimales: «37,5» o «37.5» → «treinta y siete coma cinco»
		if (j + 1 < Texto.Len() && (Texto[j] == TEXT(',') || Texto[j] == TEXT('.')) && FChar::IsDigit(Texto[j + 1]))
		{
			int32 k = j + 1;
			while (k < Texto.Len() && FChar::IsDigit(Texto[k])) ++k;
			R += TEXT(" coma ") + Numero(FCString::Atoi64(*Texto.Mid(j + 1, k - j - 1)));
			j = k;
		}
		i = j;
	}
	return R;
}

FString EMMFonetica::Fonemas(const FString& Texto)
{
	FString T = NumerosEnLetra(Texto).ToLower();
	T.ReplaceInline(TEXT("%"), TEXT(" por ciento"));
	FString R;
	bool bTrasPausa = true;
	FString Palabra;
	auto Cerrar = [&]() {
		if (Palabra.IsEmpty()) return;
		TArray<FSeg> S = Segmentos(Palabra);
		Silabas(S, Palabra);
		const FString A = Afi(S, bTrasPausa);
		if (!A.IsEmpty()) { if (!R.IsEmpty() && !R.EndsWith(TEXT(" "))) R += TEXT(" "); R += A; }
		bTrasPausa = false;
		Palabra.Reset();
	};
	for (int32 i = 0; i < T.Len(); ++i)
	{
		const TCHAR C = T[i];
		if (FChar::IsAlpha(C) || EsVocal(C) || C == TEXT('ñ')) { Palabra.AppendChar(C); continue; }
		Cerrar();
		// signos: pausa (y entonación) que entiende el modelo; ¿ ¡ « » se quitan
		if (C == TEXT(',') || C == TEXT('.') || C == TEXT(';') || C == TEXT(':') || C == TEXT('?') || C == TEXT('!'))
		{
			R += FString(1, &C);
			bTrasPausa = true;
		}
		else if (C == TEXT('-') || C == TEXT('…')) { R += TEXT(","); bTrasPausa = true; }
		else if (!R.IsEmpty() && !R.EndsWith(TEXT(" "))) R += TEXT(" ");
	}
	Cerrar();
	return R.TrimStartAndEnd();
}
