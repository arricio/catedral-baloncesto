// EL MEJOR MÉDICO (Unreal Engine 5.8): módulo del juego.
using System.IO;
using UnrealBuildTool;

public class ElMejorMedicoUE : ModuleRules
{
	public ElMejorMedicoUE(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

		PublicDependencyModuleNames.AddRange(new string[] { "Core", "CoreUObject", "Engine", "InputCore", "EnhancedInput", "UMG", "AudioMixer" });
		PrivateDependencyModuleNames.AddRange(new string[] { "Slate", "SlateCore", "HTTP", "Json", "JsonUtilities", "Projects", "RenderCore", "RHI", "NNE", "HairStrandsCore", "AssetRegistry" });
		if (Target.bBuildEditor) PrivateDependencyModuleNames.Add("Engine");

		if (Target.Platform == UnrealTargetPlatform.Win64)
		{
			// voces de Windows (SAPI 5, también las voces OneCore: Helena, Laura y Pablo)
			PublicSystemLibraries.AddRange(new string[] { "sapi.lib", "ole32.lib" });
		}
		else if (Target.Platform == UnrealTargetPlatform.Android)
		{
			// IA (LiteRT-LM), voces (TextToSpeech) y dictado del propio móvil, por JNI
			PrivateDependencyModuleNames.AddRange(new string[] { "Launch", "AndroidPermission" });
			AdditionalPropertiesForReceipt.Add("AndroidPlugin", Path.Combine(ModuleDirectory, "ElMejorMedicoUE_UPL.xml"));
			// voces neuronales Piper: los .onnx tal cual (en Android los ejecuta ONNX Runtime de Microsoft desde Kotlin)
			RuntimeDependencies.Add("$(ProjectDir)/VocesOnnx/*.onnx", StagedFileType.NonUFS);
		}
	}
}
