import { useEffect, useRef, useState } from 'react'

const getNative = () =>
  window.Capacitor?.isNativePlatform?.()
    ? window.Capacitor.Plugins.AmbientTemp
    : null

const fmt = (t) => (t == null ? '--.-' : t.toFixed(1).replace('.', ','))
const HISTORY_KEY = 'temp_history_v1'
const pushHistory = (entry) => {
  try {
    const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
    const last = h[h.length - 1]
    if (last && Date.now() - last.t < 5 * 60 * 1000) h[h.length - 1] = entry
    else h.push(entry)
    while (h.length > 48) h.shift()
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h))
  } catch {}
}
const loadHistory = () => {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') } catch { return [] }
}

function Sparkline({ history, colorA, colorB }) {
  const ref = useRef(null)
  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const dpr = window.devicePixelRatio || 1
    const w = cv.clientWidth, h = cv.clientHeight
    cv.width = w * dpr; cv.height = h * dpr
    const ctx = cv.getContext('2d')
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, w, h)

    // grid
    ctx.strokeStyle = 'rgba(56,189,248,0.08)'
    ctx.lineWidth = 1
    for (let y = 0; y <= 3; y++) { const yy = (h / 3) * y + 0.5; ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(w, yy); ctx.stroke() }

    const series = [
      { key: 'i', color: colorA },
      { key: 'o', color: colorB },
    ]
    let any = false
    for (const s of series) {
      const pts = history.filter((e) => e[s.key] != null)
      if (pts.length < 2) continue
      any = true
      const vals = history.map((e) => e[s.key]).filter((v) => v != null)
      const min = Math.min(...vals), max = Math.max(...vals)
      const pad = Math.max(1, (max - min) / 4)
      const lo = min - pad, hi = max + pad
      const x = (i) => (i / (history.length - 1)) * w
      const y = (v) => h - 6 - ((v - lo) / (hi - lo)) * (h - 12)
      ctx.strokeStyle = s.color
      ctx.lineWidth = 2
      ctx.shadowColor = s.color
      ctx.shadowBlur = 6
      ctx.beginPath()
      history.forEach((e, i) => {
        if (e[s.key] == null) return
        const px = x(i), py = y(e[s.key])
        i === 0 || history[i - 1][s.key] == null ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
      })
      ctx.stroke()
      ctx.shadowBlur = 0
      // last point
      const li = history.length - 1
      if (history[li][s.key] != null) {
        ctx.fillStyle = s.color
        ctx.beginPath(); ctx.arc(x(li), y(history[li][s.key]), 3, 0, Math.PI * 2); ctx.fill()
      }
    }
    if (!any) {
      ctx.fillStyle = 'rgba(95,122,150,0.8)'
      ctx.font = '10px ui-monospace, monospace'
      ctx.fillText('SAMMLE DATEN ...', 12, h / 2)
    }
  })
  return <canvas ref={ref} className="chart" />
}

export default function App() {
  const native = getNative()
  const [sensorAvailable, setSensorAvailable] = useState(null)
  const [insideTemp, setInsideTemp] = useState(null)
  const [insideSource, setInsideSource] = useState(null)
  const [manualValue, setManualValue] = useState('')
  const [outside, setOutside] = useState(null)
  const [outsideErr, setOutsideErr] = useState(null)
  const [apiKey, setApiKey] = useState('')
  const [city, setCity] = useState('')
  const [settingsStatus, setSettingsStatus] = useState(null)
  const [now, setNow] = useState(new Date())
  const [history, setHistory] = useState(loadHistory)

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    setApiKey(localStorage.getItem('temp_api_key') || '')
    setCity(localStorage.getItem('temp_city') || '')
  }, [])

  // record history when either value changes
  useEffect(() => {
    if (insideTemp == null && outside?.temp == null) return
    const entry = { t: Date.now(), i: insideTemp, o: outside?.temp }
    pushHistory(entry)
    setHistory(loadHistory())
  }, [insideTemp, outside?.temp])

  // indoor: native sensor
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

  // outdoor: OpenWeatherMap
  async function fetchWeather(silent = false) {
    const key = localStorage.getItem('temp_api_key')
    const c = localStorage.getItem('temp_city')
    if (!key || !c) return
    if (!silent) setOutsideErr(null)
    try {
      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(c)}&units=metric&appid=${key}`
      )
      if (!res.ok) throw new Error(res.status === 401 ? 'API-KEY UNGÜLTIG' : res.status === 404 ? 'STADT NICHT GEFUNDEN' : `HTTP ${res.status}`)
      const d = await res.json()
      setOutside({
        temp: d.main.temp, name: d.name,
        desc: d.weather?.[0]?.description,
        feels: d.main.feels_like, humidity: d.main.humidity,
        wind: d.wind?.speed, pressure: d.main.pressure,
        updated: new Date(),
      })
    } catch (e) { setOutsideErr(e.message) }
  }

  useEffect(() => {
    fetchWeather(true)
    const id = setInterval(() => fetchWeather(true), 10 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  function saveSettings() {
    localStorage.setItem('temp_api_key', apiKey.trim())
    localStorage.setItem('temp_city', city.trim())
    setSettingsStatus('ÜBERTRAGE ...')
    fetchWeather().then(() => setSettingsStatus(outsideErr ? null : 'GESPEICHERT ✓'))
  }

  function applyManual(e) {
    e.preventDefault()
    const v = parseFloat(manualValue.replace(',', '.'))
    if (isNaN(v)) return
    setInsideTemp(v)
    setInsideSource('manual')
    setManualValue('')
  }

  const pad = (n) => String(n).padStart(2, '0')
  const clock = `${pad(now.getHours())}:${pad(now.getMinutes())}`
  const dateStr = now.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short' })
  const inRange = (t) => t != null

  return (
    <div className="app">
      <div className="statusbar">
        <span>TEMP.SYS v1.0</span>
        <span className="sys">ONLINE</span>
      </div>

      <div className="clock">
        <div className="time">{clock}</div>
        <div className="date">{dateStr}</div>
      </div>

      <div className="section-title">Sensor Innen</div>
      <div className="panel indoor">
        {insideSource === 'sensor' && <div className="tag live">Live</div>}
        {insideSource === 'manual' && <div className="tag">Manuell</div>}
        <div className="readout">
          <span className="num">{fmt(insideTemp)}</span>
          <span className="unit">°C <em>INNEN</em></span>
        </div>
        <div className="subtiles">
          <div className="subtile"><div className="k">Sensor</div><div className="v">{sensorAvailable ? 'AKTIV' : 'N/A'}</div></div>
          <div className="subtile"><div className="k">Quelle</div><div className="v">{insideSource === 'sensor' ? 'HANDY' : insideSource === 'manual' ? 'MANUELL' : '—'}</div></div>
          <div className="subtile"><div className="k">Status</div><div className="v">{inRange(insideTemp) ? 'OK' : 'WARTEN'}</div></div>
        </div>
        {sensorAvailable === false && (
          <div className="note">Kein Temperatur-Sensor gefunden — Wert unten manuell eintragen.</div>
        )}
        <form className="manual" onSubmit={applyManual}>
          <input inputMode="decimal" placeholder="z.B. 21,5 °C" value={manualValue}
            onChange={(e) => setManualValue(e.target.value)} />
          <button type="submit">Eingabe</button>
        </form>
      </div>

      <div className="section-title">Sensor Außen</div>
      <div className="panel outdoor">
        {outside && <div className="tag live">Live</div>}
        <div className="readout">
          <span className="num">{fmt(outside?.temp)}</span>
          <span className="unit">°C <em>AUSSEN</em></span>
        </div>
        <div className="subtiles">
          <div className="subtile"><div className="k">Gefühlt</div><div className="v">{outside ? fmt(outside.feels) : '--.-'}</div></div>
          <div className="subtile"><div className="k">Feuchte</div><div className="v">{outside ? Math.round(outside.humidity) : '--'}<small>%</small></div></div>
          <div className="subtile"><div className="k">Wind</div><div className="v">{outside ? outside.wind.toFixed(1) : '--.-'}<small>m/s</small></div></div>
        </div>
        <div className="note">
          {outside
            ? `STANDORT: ${outside.name.toUpperCase()} · ${outside.desc ? outside.desc.toUpperCase() : '—'} · LUFT ${outside.pressure} hPa${outside.updated ? ' · AKTUALISIERT ' + pad(outside.updated.getHours()) + ':' + pad(outside.updated.getMinutes()) : ''}`
            : outsideErr || 'WETTERDATEN WARTEN AUF KONFIGURATION ...'}
        </div>
      </div>

      <div className="chart-wrap">
        <div className="k"><span>Verlauf Innen / Außen</span><span>≈ 24H</span></div>
        <Sparkline history={history} colorA="#ffb020" colorB="#38e1ff" />
      </div>

      <div className="section-title">Konfiguration</div>
      <div className="settings">
        <h2>Datenquelle Außen</h2>
        <p className="desc">Kostenloser OpenWeatherMap-API-Key + Stadt. Der Key bleibt nur auf deinem Gerät.</p>
        <label>API-Key</label>
        <input type="password" placeholder="OPENWEATHERMAP KEY" value={apiKey}
          onChange={(e) => setApiKey(e.target.value)} />
        <label>Stadt</label>
        <input placeholder="z.B. Aachen" value={city}
          onChange={(e) => setCity(e.target.value)} />
        <button className="btn save" onClick={saveSettings}>Speichern &amp; Laden</button>
        {settingsStatus && <div className={`status ${settingsStatus.includes('✓') ? 'ok' : ''}`}>{settingsStatus}</div>}
        {outsideErr && <div className="status err">{outsideErr}</div>}
        <details>
          <summary>API-Key Info</summary>
          <p>
            1. Auf <a href="https://openweathermap.org/api" target="_blank" rel="noreferrer">openweathermap.org</a> kostenlos registrieren<br />
            2. Unter „API Keys" kopieren (aktiv nach ~10 Min)<br />
            3. Hier eintragen, Stadt setzen, speichern — fertig.
          </p>
        </details>
      </div>
    </div>
  )
}
