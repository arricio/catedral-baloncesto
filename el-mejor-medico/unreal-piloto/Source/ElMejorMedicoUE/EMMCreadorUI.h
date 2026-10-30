// EL MEJOR MÉDICO (Unreal): CREADOR DE PERSONAJES (CONFIGURACIÓN › CREADOR DE PERSONAJES). Para el médico y para
// cada persona de la partida: nombre y apellidos, sexo, edad, cara (los MetaHumans y los niños del juego), tono de
// piel, color y peinado del pelo, barba, bigote y ojos. Se guarda en el historial y se ve al momento en la consulta.
#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "EMMHistorial.h"
#include "EMMCreadorUI.generated.h"

class AEMMConsultaModo;
class UButton;
class UTextBlock;
class UVerticalBox;
class UScrollBox;
class UEditableTextBox;

UCLASS()
class ELMEJORMEDICOUE_API UEMMCreadorUI : public UUserWidget
{
	GENERATED_BODY()
public:
	TWeakObjectPtr<AEMMConsultaModo> Modo;

	void Abrir();
	void Cerrar();
	bool EstaAbierta() const;
	// para la prueba automática
	void Elegir(int32 IndicePersona);   // -1: el médico
	void PonerNombre(const FString& Nombre, const FString& Apellidos);
	void Cambiar(const FString& Que, int32 Paso);   // «sexo», «edad», «cara», «piel», «pelo», «peinado», «barba», «bigote», «ojos»
	FString Guardar();
	FString Resumen() const;

protected:
	virtual TSharedRef<SWidget> RebuildWidget() override;
	virtual FReply NativeOnPreviewKeyDown(const FGeometry& Geometria, const FKeyEvent& Tecla) override;

private:
	void Construir();
	void Refrescar();
	void RellenarLista();
	void Cargar(int32 IndicePersona);   // lo guardado de esa persona
	TArray<int32> CarasValidas() const;  // índices de Modo->Caras() de su sexo y edad
	UButton* Boton(const FString& Texto, const FLinearColor& Color, float Tam = 15.f);
	UTextBlock* Selector(UVerticalBox* Columna, const FString& Etiqueta, UButton*& Menos, UButton*& Mas);

	int32 Indice = -1;          // -1 el médico; si no, la persona de la plantilla
	FString Cara;               // nombre del personaje (cara)
	bool bMujer = false;
	int32 Edad = 40;
	FEMMAspecto Aspecto;

	UPROPERTY() TObjectPtr<UScrollBox> Lista;
	UPROPERTY() TObjectPtr<UTextBlock> Titulo;
	UPROPERTY() TObjectPtr<UEditableTextBox> CajaNombre;
	UPROPERTY() TObjectPtr<UEditableTextBox> CajaApellidos;
	UPROPERTY() TObjectPtr<UTextBlock> TSexo;
	UPROPERTY() TObjectPtr<UTextBlock> TEdad;
	UPROPERTY() TObjectPtr<UTextBlock> TCara;
	UPROPERTY() TObjectPtr<UTextBlock> TPiel;
	UPROPERTY() TObjectPtr<UTextBlock> TPelo;
	UPROPERTY() TObjectPtr<UTextBlock> TPeinado;
	UPROPERTY() TObjectPtr<UTextBlock> TBarba;
	UPROPERTY() TObjectPtr<UTextBlock> TBigote;
	UPROPERTY() TObjectPtr<UTextBlock> TOjos;
	UPROPERTY() TObjectPtr<UTextBlock> Estado;
	UPROPERTY() TArray<TObjectPtr<UButton>> BotonesLista;

	UFUNCTION() void AlLista();
	UFUNCTION() void AlSexoMenos();   UFUNCTION() void AlSexoMas();
	UFUNCTION() void AlEdadMenos();   UFUNCTION() void AlEdadMas();
	UFUNCTION() void AlCaraMenos();   UFUNCTION() void AlCaraMas();
	UFUNCTION() void AlPielMenos();   UFUNCTION() void AlPielMas();
	UFUNCTION() void AlPeloMenos();   UFUNCTION() void AlPeloMas();
	UFUNCTION() void AlPeinadoMenos(); UFUNCTION() void AlPeinadoMas();
	UFUNCTION() void AlBarbaMenos();  UFUNCTION() void AlBarbaMas();
	UFUNCTION() void AlBigoteMenos(); UFUNCTION() void AlBigoteMas();
	UFUNCTION() void AlOjosMenos();   UFUNCTION() void AlOjosMas();
	UFUNCTION() void AlGuardar();
	UFUNCTION() void AlDeshacer();
	UFUNCTION() void AlCerrar();
};
