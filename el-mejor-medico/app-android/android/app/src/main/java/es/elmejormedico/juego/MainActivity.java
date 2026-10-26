package es.elmejormedico.juego;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // módulos propios del juego: IA dentro del móvil, voces del sistema y dictado
        registerPlugin(IALocalPlugin.class);
        registerPlugin(VozNativaPlugin.class);
        registerPlugin(DictadoNativoPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
