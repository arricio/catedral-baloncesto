# EL MEJOR MÉDICO (Unreal): copia el código fuente del piloto al repositorio (el-mejor-medico/unreal-piloto).
# Sólo texto (C++, Python, Kotlin, configuración y casos); el contenido binario (Content, MetaHumans) no se sube.
$P = Split-Path $PSScriptRoot
$D = 'C:\Users\arric\EL MEJOR MEDICO\el-mejor-medico\unreal-piloto'
New-Item -ItemType Directory -Force $D | Out-Null
Copy-Item "$P\ElMejorMedicoUE.uproject" $D -Force
foreach ($c in 'Source', 'Config', 'Herramientas', 'Content\Python', 'Content\Datos') {
  robocopy "$P\$c" "$D\$c" /MIR /NFL /NDL /NJH /NJS /XF *.aar | Out-Null
}
robocopy "$P\Nativo" "$D\Nativo" /MIR /NFL /NDL /NJH /NJS /XD build .gradle /XF local.properties | Out-Null
Copy-Item "$P\Source\ElMejorMedicoUE\Android\emm-nativo.aar" "$D\Source\ElMejorMedicoUE\Android\" -Force
'Copiado a ' + $D
