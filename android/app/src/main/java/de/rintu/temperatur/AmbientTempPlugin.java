package de.rintu.temperatur;

import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Exposes Android's ambient temperature sensor (TYPE_AMBIENT_TEMPERATURE)
 * to the WebView. Most consumer phones do NOT ship this sensor —
 * isAvailable() reports that honestly so the app can fall back to manual input.
 */
@CapacitorPlugin(name = "AmbientTemp")
public class AmbientTempPlugin extends Plugin implements SensorEventListener {

    private SensorManager sensorManager;
    private Sensor tempSensor;
    private boolean listening = false;

    @Override
    public void load() {
        sensorManager = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager != null) {
            tempSensor = sensorManager.getDefaultSensor(Sensor.TYPE_AMBIENT_TEMPERATURE);
        }
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", tempSensor != null);
        call.resolve(ret);
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (tempSensor == null) {
            call.reject("Kein Umgebungstemperatur-Sensor auf diesem Gerät");
            return;
        }
        if (!listening) {
            sensorManager.registerListener(this, tempSensor, SensorManager.SENSOR_DELAY_NORMAL);
            listening = true;
        }
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        unregister();
        call.resolve();
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        JSObject data = new JSObject();
        data.put("value", (double) event.values[0]);
        notifyListeners("temperature", data);
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        JSObject data = new JSObject();
        data.put("accuracy", accuracy);
        notifyListeners("accuracy", data);
    }

    private void unregister() {
        if (listening && sensorManager != null) {
            sensorManager.unregisterListener(this);
        }
        listening = false;
    }

    @Override
    protected void handleOnDestroy() {
        unregister();
    }
}
