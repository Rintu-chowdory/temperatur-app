# Temperatur-App 🌡️

Android-App, die die **Innentemperatur** (Sensor im Handy, falls vorhanden) und die
**Außentemperatur** (OpenWeatherMap) anzeigt.

## Aufbau
- **React + Vite** (Web-App) → **Capacitor** → Android-APK
- **AmbientTempPlugin.java**: natives Plugin für `TYPE_AMBIENT_TEMPERATURE`.
  Die meisten Handys haben diesen Sensor *nicht* — die App zeigt dann einen
  Hinweis + manuelle Eingabe.
- **OpenWeatherMap API**: Außentemperatur + Wetter für eine Stadt (kostenloser API-Key,
  wird nur lokal auf dem Gerät gespeichert).

## APK bauen
Wird automatisch bei jedem Push auf `main` gebaut → GitHub Actions Artifact
`.github/workflows/android-build.yml`. Alternativ lokal:

```bash
npm install
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
```

## Einstellungen in der App
1. Kostenlos auf https://openweathermap.org/api registrieren
2. API-Key in der App eintragen (dauert ~10 Min bis der Key aktiv ist)
3. Stadt eintragen (z.B. „Aachen")
4. Speichern — die Außentemperatur erscheint und aktualisiert sich alle 10 Minuten
