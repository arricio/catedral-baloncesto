// EL MEJOR MÉDICO (Unreal): animación del cuerpo de los MetaHumans, hecha en C++ (sin recursos binarios).
// Postura sentada (Content/Datos/postura.json, ajustable sin recompilar), respiración, mirada hacia el otro
// y los controles faciales de la boca y el parpadeo a partir de la voz (UEMMHabla). La cara del MetaHuman copia
// la pose y las curvas del cuerpo, y su postproceso (RigLogic) convierte esas curvas en la expresión.
#pragma once

#include "CoreMinimal.h"
#include "Animation/AnimInstance.h"
#include "Animation/AnimInstanceProxy.h"
#include "EMMCuerpoAnim.generated.h"

struct FEMMGiroHueso
{
	FName Hueso;
	FVector Eje = FVector::UpVector;
	float Grados = 0.f;
	bool bCuerpo = false;   // eje en el espacio del cuerpo (X lado, Y delante, Z arriba) en vez del eje local del hueso
};

struct FEMMPostura
{
	FVector Pelvis = FVector::ZeroVector;     // desplazamiento de la pelvis (espacio del componente)
	TArray<FEMMGiroHueso> Giros;              // giros locales de los huesos
	static const FEMMPostura& Sentado();       // leída una vez de postura.json
};

USTRUCT()
struct FEMMCuerpoProxy : public FAnimInstanceProxy
{
	GENERATED_BODY()
	FEMMCuerpoProxy() = default;
	FEMMCuerpoProxy(UAnimInstance* Instancia) : FAnimInstanceProxy(Instancia) {}

	float Apertura = 0, Redondez = 0, Estiramiento = 0, Cierre = 0, Mordida = 0, Parpadeo = 0, Tiempo = 0, Fase = 0;
	float MirarYaw = 0, MirarPitch = 0;
	float Preocupacion = 0, Sonrisa = 0, Habla = 0;   // Habla: 0..1 suavizado mientras habla (gestos)
	FVector2D Ojos = FVector2D::ZeroVector, OjosDestino = FVector2D::ZeroVector;   // microsacadas de la mirada
	float ProximaSacada = 1.f;

	virtual void PreUpdate(UAnimInstance* Instancia, float Dt) override;
	virtual bool Evaluate(FPoseContext& Output) override;
};

UCLASS(Transient)
class ELMEJORMEDICOUE_API UEMMCuerpoAnim : public UAnimInstance
{
	GENERATED_BODY()
public:
	// a quién mira (la otra persona de la consulta)
	TWeakObjectPtr<AActor> Interlocutor;
	float Fase = 0.f;   // para que médico y paciente no respiren a la vez
	// gesto de fondo: el paciente preocupado frunce un poco las cejas; el médico, sonrisa leve y amable
	float Preocupacion = 0.f;
	float Sonrisa = 0.f;

protected:
	virtual FAnimInstanceProxy* CreateAnimInstanceProxy() override { return new FEMMCuerpoProxy(this); }
	virtual void DestroyAnimInstanceProxy(FAnimInstanceProxy* Proxy) override { delete Proxy; }
	friend struct FEMMCuerpoProxy;
};
