# EL MEJOR MÉDICO: ¿se entiende cada voz? Transcribe los WAV de Saved/Voces (prueba -EMMVoces) con el
# reconocedor de voz es-ES de Windows (sin Internet) y cuenta qué parte de las palabras de la frase reconoce.
# No es un oído humano: sirve para comparar (los niños frente a los adultos, antes y después de un cambio).
param([string]$Carpeta = "$PSScriptRoot\..\Saved\Voces", [string]$Filtro = '*.wav')
Add-Type -AssemblyName System.Speech
$frases = @{
  'n1' = 'Me duele mucho la garganta y no puedo tragar.'; 'n2' = 'Empezó el lunes, cuando volví del colegio.'; 'n3' = 'Sí, tengo un poco de fiebre y me pica la cabeza.'
  'a1' = 'Buenos días, doctor. Vengo porque me duele la garganta.'; 'a2' = 'Empezó hace tres días, más o menos.'; 'a3' = 'Sí, anoche tuve treinta y ocho de fiebre.'
}
function Normaliza([string]$t) {
  $t = $t.ToLowerInvariant().Normalize([Text.NormalizationForm]::FormD)
  $t = -join ($t.ToCharArray() | ? { [Globalization.CharUnicodeInfo]::GetUnicodeCategory($_) -ne 'NonSpacingMark' })
  ($t -replace '[^a-zñ0-9 ]', ' ' -split '\s+') | ? { $_ }
}
$motor = New-Object System.Speech.Recognition.SpeechRecognitionEngine ([Globalization.CultureInfo]'es-ES')
$motor.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
$res = foreach ($f in Get-ChildItem $Carpeta -Filter $Filtro | Sort Name) {
  $n = [int]($f.BaseName -replace '.*_(\d)$', '$1')
  # niños (frases «n») o adultos («a»): según la frase que se dijo (la prueba usa las de niño para menores de 13)
  $texto = ''
  $motor.SetInputToWaveFile($f.FullName)
  try { while ($r = $motor.Recognize()) { $texto += ' ' + $r.Text } } catch {}
  $motor.SetInputToNull()
  $oido = Normaliza $texto
  $mejor = $null
  foreach ($k in "n$n", "a$n") {
    $esperado = Normaliza $frases[$k]
    $ok = ($esperado | ? { $oido -contains $_ }).Count
    $p = [math]::Round(100 * $ok / $esperado.Count)
    if (-not $mejor -or $p -gt $mejor.P) { $mejor = [pscustomobject]@{ Archivo = $f.BaseName; P = $p; Oido = $texto.Trim() } }
  }
  $mejor
}
$res | % { '{0,-40} {1,4} %  «{2}»' -f $_.Archivo, $_.P, $_.Oido }
$res | Group-Object { $_.Archivo -replace '_\d$', '' } | % { '{0,-38} media {1,4} %' -f $_.Name, [math]::Round(($_.Group | Measure-Object P -Average).Average) }
