package de.rintu.temperatur;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AmbientTempPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
