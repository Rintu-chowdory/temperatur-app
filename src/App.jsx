import { useEffect, useRef, useState } from 'react'

// Capacitor native plugin bridge for Android's ambient temperature sensor.
// Returns null when not running in Capacitor (web dev mode).
const getNative = () =>
  window.Capacitor?.isNativePlatform?.()
    ? window.Capacitor.Plugins.AmbientTemp
    : null

const fmt = (t) => (t == null ? '--' : t.toFixed(1).replace('.', ','))

export default function App() {
  const native = getNative()
  const [sensorAvailable, setSensorAvailable] = useState(null) // null = unknown
  const [insideTemp, setInsideTemp] = useState(null)
  const [insideSource, setInsideSource] = useState(null) // 'sensor' | 'manual'
  const [manualValue, setManualValue] = useState('')
  const [outside, setOutside] = useState(null) // { temp, name, desc, updated }
  const [outsideErr, setOutsideErr] = useState(null)
  const [apiKey, setApiKey] = useState('')
  const [city, setCity] = useState('')
  const [settingsStatus, setSettingsStatus] = useState(null)
  const [lastRefresh, setLastRefresh] = useState(null)
  const nativeRef = useRef(native)
  nativeRef.current = native

  // --- settings persistence
  useEffect(() => {
    setApiKey(localStorage.getItem('temp_api_key') || '')
    setCity(localStorage.getItem('temp_city') || '')
  }, [])

  // --- indoor: native ambient temperature sensor
  useEffect(() => {
    let cleanup = () => {}
    if (!native) { setSensorAvailable(false); return }
    native.isAvailable().then((r) => {
      setSensorAvailable(r.available)
      if (!r.available) return
      const sub = native.addListener('temperature', (e) => {
        setInsideTemp(e.value)
        setInsideSource('sensor')
      })
      native.start()
      cleanup = () => { sub.then?.((s) => s.remove?.()); native.stop() }
    })
    return cleanup
  }, [])

  // --- outdoor: OpenWeatherMap
  async function fetchWeather(silent = false) {
    const key = localStorage.getItem('temp_api_key')
    const c = localStorage.getItem('temp_city')
    if (!key || !c) return
    if (!silent) setOutsideErr(null)
    try {
      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(c)}&units=metric&appid=${key}`
      )
      if (!res.ok) throw new Error(res.status === 401 ? 'API-Key ungültig' : res.status === 404 ? 'Stadt nicht gefunden' : `HTTP ${res.status}`)
      const d = await res.json()
      setOutside({
        temp: d.main.temp,
        name: d.name,
        desc: d.weather?.[0]?.description,
        icon: d.weather?.[0]?.icon,
        wind: d.wind?.speed,
      })
      setLastRefresh(new Date())
      setOutsideErr(null)
    } catch (e) {
      setOutsideErr(e.message)
    }
  }

  // periodic refresh every 10 min
  useEffect(() => {
    fetchWeather(true)
    const id = setInterval(() => fetchWeather(true), 10 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  function saveSettings() {
    localStorage.setItem('temp_api_key', apiKey.trim())
    localStorage.setItem('temp_city', city.trim())
    setSettingsStatus('Gespeichert — lade Wetter...')
    fetchWeather().then(() => setSettingsStatus(outsideErr ? null : 'Gespeichert ✓'))
  }

  function applyManual(e) {
    e.preventDefault()
    const v = parseFloat(manualValue.replace(',', '.'))
    if (isNaN(v)) return
    setInsideTemp(v)
    setInsideSource('manual')
    setManualValue('')
  }

  return (
    <div className="app">
      <div className="header">
        <h1>Temperatur</h1>
        <div className="updated">
          {lastRefresh ? `Aktualisiert ${lastRefresh.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr` : '—'}
        </div>
      </div>

      <div className="cards">
        <div className="card indoor">
          <div className="label"><span className="dot" /> Innen</div>
          {insideSource === 'sensor' && <div className="badge live">● Sensor live</div>}
          {insideSource === 'manual' && <div className="badge">manuell</div>}
          <div className="value">
            <span className="num">{fmt(insideTemp)}</span>
            <span className="unit">°C</span>
          </div>
          {sensorAvailable === false && (
            <div className="sub">
              Dein Handy hat keinen Temperatur-Sensor. Unten manuell eintragen:
            </div>
          )}
          {sensorAvailable === null && !native && (
            <div className="sub">Sensor-Status: wird auf dem Handy erkannt</div>
          )}
          <form className="manual" onSubmit={applyManual}>
            <input
              inputMode="decimal" placeholder="z.B. 21,5"
              value={manualValue} onChange={(e) => setManualValue(e.target.value)}
            />
            <button type="submit">Setzen</button>
          </form>
        </div>

        <div className="card outdoor">
          <div className="label"><span className="dot" /> Außen</div>
          <div className="value">
            <span className="num">{fmt(outside?.temp)}</span>
            <span className="unit">°C</span>
          </div>
          <div className="sub">
            {outside
              ? `${outside.name}${outside.desc ? ' · ' + outside.desc : ''}${outside.wind != null ? ' · Wind ' + outside.wind.toFixed(1) + ' m/s' : ''}`
              : outsideErr || 'Wetter wird geladen — API-Key & Stadt unten eintragen'}
          </div>
        </div>
      </div>

      <div className="settings">
        <h2>Einstellungen</h2>
        <p className="desc">Für die Außentemperatur brauchst du einen kostenlosen API-Key von OpenWeatherMap.</p>
        <label>OpenWeatherMap API-Key</label>
        <input type="password" placeholder="API-Key" value={apiKey}
          onChange={(e) => setApiKey(e.target.value)} />
        <label>Stadt</label>
        <div className="row">
          <input placeholder="z.B. Aachen" value={city}
            onChange={(e) => setCity(e.target.value)} />
        </div>
        <button className="btn save" onClick={saveSettings}>Speichern & laden</button>
        {settingsStatus && <div className={`status ${settingsStatus.includes('✓') ? 'ok' : ''}`}>{settingsStatus}</div>}
        {outsideErr && <div className="status err">{outsideErr}</div>}
        <details>
          <summary>Wo bekomme ich den API-Key?</summary>
          <p>
            1. Auf <a href="https://openweathermap.org/api" target="_blank" rel="noreferrer">openweathermap.org</a> kostenlos registrieren<br />
            2. Unter „API Keys" den Key kopieren (Key ist nach ~10 Min aktiv)<br />
            3. Hier einfügen, Stadt eintragen, speichern — fertig. Der Key bleibt nur auf deinem Handy.
          </p>
        </details>
      </div>
    </div>
  )
}
