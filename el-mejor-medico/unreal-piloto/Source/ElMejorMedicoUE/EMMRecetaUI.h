// EL MEJOR MÉDICO (Unreal): recetas de la consulta (botón RECETAR). Una receta por medicamento o tratamiento,
// con diseño inspirado en la receta verde tradicional, datos ficticios y la marca «SIMULACIÓN - SIN VALIDEZ MÉDICA».
// Se escribe o dicta libremente; cada receta se puede guardar, modificar, anular y entregar al paciente.
#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "EMMRecetaUI.generated.h"

class AEMMConsultaModo;
class UButton;
class UTextBlock;
class UVerticalBox;
class UHorizontalBox;
class UBorder;
class UEditableTextBox;
class UMultiLineEditableTextBox;
class UWidget;

UCLASS()
class ELMEJORMEDICOUE_API UEMMRecetaUI : public UUserWidget
{
	GENERATED_BODY()
public:
	TWeakObjectPtr<AEMMConsultaModo> Modo;

	void Abrir();
	void Cerrar();
	bool EstaAbierta() const;
	// muestra una receta (o la primera / ninguna) y la lista de esta consulta
	void Refrescar(const FString& IdElegida = FString());
	FString Elegida() const { return IdActual; }
	// para la prueba automática: rellena los campos como si los escribiera el jugador
	void Escribir(const FString& Medicamento, const FString& Dosis, const FString& Frecuencia, const FString& Duracion, const FString& Instrucciones);
	void PulsarNueva() { AlNueva(); }
	void PulsarGuardar() { AlGuardar(); }
	void PulsarAnular() { AlAnular(); }
	void PulsarEntregar() { AlEntregar(); }

protected:
	virtual TSharedRef<SWidget> RebuildWidget() override;
	virtual void NativeTick(const FGeometry& Geometria, float Dt) override;

private:
	void Construir();
	UButton* Boton(const FString& Texto, const FLinearColor& Color, float Tam = 16.f);
	UWidget* Campo(const FString& Titulo, UWidget* Contenido, float Alto = 0.f);
	FString IdActual;
	FString DictadoPrevio;

	UPROPERTY() TObjectPtr<UBorder> Fondo;
	UPROPERTY() TObjectPtr<UVerticalBox> Lista;
	UPROPERTY() TObjectPtr<UTextBlock> Numero;
	UPROPERTY() TObjectPtr<UTextBlock> EstadoReceta;
	UPROPERTY() TObjectPtr<UTextBlock> DatosPaciente;
	UPROPERTY() TObjectPtr<UTextBlock> DatosMedico;
	UPROPERTY() TObjectPtr<UTextBlock> Fecha;
	UPROPERTY() TObjectPtr<UTextBlock> Firma;
	UPROPERTY() TObjectPtr<UTextBlock> Avisos;
	UPROPERTY() TObjectPtr<UBorder> CajaAvisos;
	UPROPERTY() TObjectPtr<UHorizontalBox> Barras;
	UPROPERTY() TObjectPtr<UMultiLineEditableTextBox> Medicamento;
	UPROPERTY() TObjectPtr<UEditableTextBox> Dosis;
	UPROPERTY() TObjectPtr<UEditableTextBox> Frecuencia;
	UPROPERTY() TObjectPtr<UEditableTextBox> Duracion;
	UPROPERTY() TObjectPtr<UMultiLineEditableTextBox> Instrucciones;
	UPROPERTY() TObjectPtr<UWidget> UltimoCampo;
	UPROPERTY() TObjectPtr<UTextBlock> EtiquetaDictar;
	UPROPERTY() TObjectPtr<UButton> BotonGuardar;
	UPROPERTY() TObjectPtr<UButton> BotonAnular;
	UPROPERTY() TObjectPtr<UButton> BotonEntregar;

	UFUNCTION() void AlNueva();
	UFUNCTION() void AlGuardar();
	UFUNCTION() void AlAnular();
	UFUNCTION() void AlEntregar();
	UFUNCTION() void AlDictar();
	UFUNCTION() void AlCerrar();
	UFUNCTION() void AlElegirLista();
	void PonerCampos(bool bEditable);
};
