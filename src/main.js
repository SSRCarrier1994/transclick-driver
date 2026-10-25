/* TransClick Driver — native background tracking app (bundled with esbuild) */
import { registerPlugin, Capacitor, CapacitorHttp } from '@capacitor/core'
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning'

// ── Config ──────────────────────────────────────────────────────────
var API = 'https://transclick.in'

// ── Capacitor plugin handles (real registerPlugin from @capacitor/core) ─
// NOTE: native plugin name is "BarcodeScanner" (not "BarcodeScanning").
// Using the package's own exported object guarantees the name matches the
// native @CapacitorPlugin(name = "BarcodeScanner") registration.
var BG_PLUGIN = registerPlugin('BackgroundGeolocation')
var SCANNER_PLUGIN = BarcodeScanner
function getBG() { return BG_PLUGIN }
function getScanner() { return SCANNER_PLUGIN }
function isNative() { try { return Capacitor.isNativePlatform() } catch (e) { return true } }

// ── State ───────────────────────────────────────────────────────────
var state = {
  sessionId: null,
  bilty: null,          // trip info for display
  biltyId: null,        // QR path
  watcherId: null,
  pollTimer: null,
  awaitingClose: false,
}

// ── Tiny helpers ────────────────────────────────────────────────────
function $(id) { return document.getElementById(id) }
function show(id) {
  var s = document.querySelectorAll('.screen')
  for (var i = 0; i < s.length; i++) s[i].classList.remove('active')
  $(id).classList.add('active')
}
function setErr(id, msg) { var e = $(id); if (!e) return; if (msg) { e.textContent = msg; e.classList.remove('hidden') } else { e.classList.add('hidden') } }
function save() {
  try {
    if (state.sessionId) localStorage.setItem('tc_session', state.sessionId)
    if (state.bilty) localStorage.setItem('tc_bilty', JSON.stringify(state.bilty))
  } catch (e) {}
}
function clearSaved() { try { localStorage.removeItem('tc_session'); localStorage.removeItem('tc_bilty') } catch (e) {} }

// ── API ─────────────────────────────────────────────────────────────
// On the device we use CapacitorHttp (native HTTP) so requests are NOT
// subject to the WebView's cross-origin (CORS) rules. On the web we fall
// back to plain fetch.
function api(path, body) {
  var url = API + path
  var headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
  if (isNative() && CapacitorHttp) {
    var req = body
      ? CapacitorHttp.post({ url: url, headers: headers, data: body })
      : CapacitorHttp.get({ url: url, headers: headers })
    return req.then(function (res) {
      var data = res.data
      if (typeof data === 'string') { try { data = JSON.parse(data) } catch (e) {} }
      return { ok: res.status >= 200 && res.status < 300, status: res.status, data: data }
    })
  }
  return fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: body ? headers : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, status: r.status, data: d } }) })
}

// ── QR scan (MLKit live camera — no Google module needed) ───────────
var scanListener = null

function dbg(stage, extra) {
  var msg = '[scan] ' + stage + (extra ? ' :: ' + extra : '')
  try { console.log(msg) } catch (e) {}
  try { var el = $('scan-dbg'); if (el) el.textContent = msg } catch (e) {}
}

function scanQR() {
  setErr('scan-error', '')
  var Scanner = getScanner()
  dbg('tap', 'native=' + isNative() + ' scanner=' + (!!Scanner))
  if (!Scanner) {
    setErr('scan-error', 'Scanner not available on this device. Please use "Enter bilty manually".')
    return
  }
  dbg('requestPermissions...')
  Scanner.requestPermissions().then(function (p) {
    dbg('permission', p && p.camera)
    if (p && p.camera !== 'granted' && p.camera !== 'limited') {
      setErr('scan-error', 'Camera permission is needed. Enable it for this app in Settings, or use "Enter bilty manually".')
      return
    }
    // Make the page transparent so the camera preview shows behind it.
    document.documentElement.classList.add('scanning')
    document.body.classList.add('scanning')
    $('scan-overlay').classList.remove('hidden')
    dbg('overlay shown, adding listener')

    return Scanner.addListener('barcodeScanned', function (result) {
      var raw = result && result.barcode && (result.barcode.rawValue || result.barcode.displayValue)
      dbg('barcodeScanned', raw)
      stopScan()
      if (raw) onScanned(raw)
    }).then(function (handle) {
      scanListener = handle
      dbg('listener added, calling startScan')
      return Scanner.startScan({ formats: ['QR_CODE'], lensFacing: 'BACK' })
    }).then(function () {
      dbg('startScan resolved (camera should be live)')
    })
  }).catch(function (e) {
    var msg = (e && (e.message || e.errorMessage)) ? (e.message || e.errorMessage) : String(e)
    dbg('ERROR', msg)
    stopScan()
    setErr('scan-error', 'Camera error: ' + msg + ' — use "Enter bilty manually".')
  })
}

function stopScan() {
  var Scanner = getScanner()
  try { if (scanListener && scanListener.remove) scanListener.remove() } catch (e) {}
  scanListener = null
  try { if (Scanner && Scanner.stopScan) Scanner.stopScan() } catch (e) {}
  document.documentElement.classList.remove('scanning')
  document.body.classList.remove('scanning')
  var ov = $('scan-overlay'); if (ov) ov.classList.add('hidden')
}

function onScanned(raw) {
  // QR encodes e.g. https://transclick.in/driver/t/<biltyId>
  var id = ''
  try {
    var m = String(raw).match(/\/driver\/t\/([^/?#]+)/)
    if (m) id = m[1]
    else if (/^[0-9a-fA-F-]{10,}$/.test(raw)) id = raw   // bare id
  } catch (e) {}
  if (!id) { setErr('scan-error', 'This QR is not a TransClick bilty.'); return }
  loadTrip(id)
}

// ── Load trip summary for confirm screen ────────────────────────────
function loadTrip(biltyId) {
  state.biltyId = biltyId
  show('screen-loading')
  api('/api/driver/scan?b=' + encodeURIComponent(biltyId)).then(function (r) {
    if (!r.ok) { show('screen-scan'); setErr('scan-error', (r.data && r.data.error) || 'This bilty could not be opened.'); return }
    var t = r.data
    $('c-bilty').textContent = t.bilty_number || '—'
    $('c-vehicle').textContent = t.vehicle_number || '—'
    $('c-to').textContent = t.unloading_point || t.to_state || '—'
    $('c-consignee').textContent = t.consignee_name || '—'
    $('d-name').value = t.driver_name || ''
    $('d-mobile').value = t.driver_mobile || ''
    state._manual = null
    show('screen-confirm')
  }).catch(function () { show('screen-scan'); setErr('scan-error', 'Network error. Check your internet.') })
}

// ── Manual entry fallback ───────────────────────────────────────────
function manualGo() {
  var b = $('m-bilty').value.trim(), v = $('m-vehicle').value.trim()
  if (!b || !v) { setErr('scan-error', 'Enter both bilty number and vehicle number.'); return }
  state.biltyId = null
  state._manual = { bilty_number: b, vehicle_number: v }
  $('c-bilty').textContent = b
  $('c-vehicle').textContent = v
  $('c-to').textContent = '—'; $('c-consignee').textContent = '—'
  show('screen-confirm')
}

// ── Start: login then begin background tracking ─────────────────────
function startTrip() {
  setErr('confirm-error', '')
  var name = $('d-name').value.trim(), mobile = $('d-mobile').value.trim()
  var body = { driver_name: name || null, driver_mobile: mobile || null }
  if (state.biltyId) body.bilty_id = state.biltyId
  else if (state._manual) { body.bilty_number = state._manual.bilty_number; body.vehicle_number = state._manual.vehicle_number }
  var btn = $('btn-start'); btn.disabled = true; btn.textContent = 'Starting…'
  api('/api/driver/login', body).then(function (r) {
    btn.disabled = false; btn.textContent = 'Start Live Tracking'
    if (!r.ok) { setErr('confirm-error', (r.data && r.data.error) || 'Could not start. Please try again.'); return }
    state.sessionId = r.data.session_id
    state.bilty = r.data.bilty
    save()
    enterTracking()
    startWatcher()
  }).catch(function (e) {
    btn.disabled = false; btn.textContent = 'Start Live Tracking'
    var msg = (e && (e.message || e.error || (e.toString && e.toString()))) || 'unknown'
    setErr('confirm-error', 'Could not reach server: ' + msg)
  })
}

function enterTracking() {
  var b = state.bilty || {}
  $('t-bilty').textContent = b.bilty_number || '—'
  $('t-vehicle').textContent = b.vehicle_number || '—'
  $('t-last').textContent = '—'
  $('await-close').classList.toggle('hidden', !state.awaitingClose)
  $('pod-zone').classList.toggle('hidden', state.awaitingClose)
  show('screen-track')
  startPoll()
}

// ── Background geolocation ──────────────────────────────────────────
function startWatcher() {
  var BG = getBG()
  if (!BG) { // browser fallback (testing only)
    browserWatch(); return
  }
  if (state.watcherId) return
  BG.addWatcher({
    backgroundMessage: 'Trip location is being shared.',
    backgroundTitle: 'TransClick Driver — tracking on',
    requestPermissions: true,
    stale: false,
    distanceFilter: 25,
  }, function (location, error) {
    if (error) {
      if (error.code === 'NOT_AUTHORIZED') {
        if (window.confirm('Location permission is off. Open settings to allow "Allow all the time"?')) {
          BG.openSettings && BG.openSettings()
        }
      }
      return
    }
    if (location) postLocation(location.latitude, location.longitude, location.accuracy)
  }).then(function (id) { state.watcherId = id })
}

function stopWatcher() {
  var BG = getBG()
  if (BG && state.watcherId) { try { BG.removeWatcher({ id: state.watcherId }) } catch (e) {} state.watcherId = null }
  if (state._bw) { clearInterval(state._bw); state._bw = null }
  if (navigator.geolocation && state._wid != null) { navigator.geolocation.clearWatch(state._wid); state._wid = null }
}

// Browser-only fallback so the UI is testable without the native build
function browserWatch() {
  if (!navigator.geolocation) return
  state._wid = navigator.geolocation.watchPosition(function (p) {
    postLocation(p.coords.latitude, p.coords.longitude, p.coords.accuracy)
  }, function () {}, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 })
}

function postLocation(lat, lng, acc) {
  if (!state.sessionId) return
  api('/api/driver/location', { session_id: state.sessionId, lat: lat, lng: lng, accuracy: acc || null })
    .then(function (r) { if (r.ok) { var d = new Date(); $('t-last').textContent = pad(d.getHours()) + ':' + pad(d.getMinutes()) } })
    .catch(function () {})
}
function pad(n) { return (n < 10 ? '0' : '') + n }

// ── Poll session → detect admin close ───────────────────────────────
function startPoll() {
  stopPoll()
  state.pollTimer = setInterval(checkSession, 20000)
  checkSession()
}
function stopPoll() { if (state.pollTimer) { clearInterval(state.pollTimer); state.pollTimer = null } }

function checkSession() {
  if (!state.sessionId) return
  api('/api/driver/session?session_id=' + encodeURIComponent(state.sessionId)).then(function (r) {
    if (!r.ok) return
    var d = r.data
    if (d.pod_submitted) setAwaiting(true)
    if (d.is_active === false) tripClosed()
  }).catch(function () {})
}

function setAwaiting(v) {
  state.awaitingClose = v
  $('await-close').classList.toggle('hidden', !v)
  $('pod-zone').classList.toggle('hidden', v)
}

// ── POD ─────────────────────────────────────────────────────────────
var podPhotoData = null

// Read the chosen photo, shrink it (so uploads stay small), show a preview.
function handlePodPhoto(e) {
  var file = e.target.files && e.target.files[0]
  if (!file) return
  var reader = new FileReader()
  reader.onload = function (ev) {
    var img = new Image()
    img.onload = function () {
      var max = 1280, w = img.width, h = img.height
      if (w > h && w > max) { h = Math.round(h * max / w); w = max }
      else if (h >= w && h > max) { w = Math.round(w * max / h); h = max }
      var c = document.createElement('canvas')
      c.width = w; c.height = h
      c.getContext('2d').drawImage(img, 0, 0, w, h)
      try { podPhotoData = c.toDataURL('image/jpeg', 0.7) } catch (err) { podPhotoData = ev.target.result }
      var prev = $('pod-preview'); if (prev) { prev.src = podPhotoData; prev.classList.remove('hidden') }
      var lbl = $('pod-photo-label'); if (lbl) lbl.textContent = '📷 Photo added — tap to change'
    }
    img.src = ev.target.result
  }
  reader.readAsDataURL(file)
}

function submitPOD() {
  if (!state.sessionId) return
  if (!window.confirm('Mark this delivery as delivered? Tracking will continue until the admin closes it.')) return
  var btn = $('btn-pod'); btn.disabled = true; btn.textContent = 'Submitting…'
  var payload = { session_id: state.sessionId }
  if (podPhotoData) payload.pod_image = podPhotoData
  api('/api/driver/pod', payload).then(function (r) {
    btn.disabled = false; btn.textContent = 'Mark Delivered'
    if (!r.ok) { window.alert((r.data && r.data.error) || 'POD failed. Try again.'); return }
    podPhotoData = null
    setAwaiting(true)
  }).catch(function () { btn.disabled = false; btn.textContent = 'Mark Delivered'; window.alert('No internet. Try again.') })
}

// ── Trip closed by admin ────────────────────────────────────────────
function tripClosed() {
  stopWatcher(); stopPoll()
  $('done-bilty').textContent = (state.bilty && state.bilty.bilty_number) || ''
  clearSaved()
  state.sessionId = null; state.bilty = null; state.awaitingClose = false
  show('screen-done')
}

// ── Resume on launch ────────────────────────────────────────────────
function resume() {
  var sid = null, bilty = null
  try { sid = localStorage.getItem('tc_session'); bilty = JSON.parse(localStorage.getItem('tc_bilty') || 'null') } catch (e) {}
  if (!sid) { show('screen-scan'); return }
  state.sessionId = sid; state.bilty = bilty
  api('/api/driver/session?session_id=' + encodeURIComponent(sid)).then(function (r) {
    if (r.ok && r.data && r.data.is_active !== false) {
      state.awaitingClose = !!r.data.pod_submitted
      enterTracking()
      startWatcher()
    } else {
      clearSaved(); state.sessionId = null; show('screen-scan')
    }
  }).catch(function () { enterTracking(); startWatcher() })  // offline: assume still active
}

// ── Wire up ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  $('btn-scan').addEventListener('click', scanQR)
  var sc = $('btn-scan-cancel'); if (sc) sc.addEventListener('click', stopScan)
  $('btn-manual-toggle').addEventListener('click', function () { $('manual-box').classList.toggle('hidden') })
  $('btn-manual-go').addEventListener('click', manualGo)
  $('btn-start').addEventListener('click', startTrip)
  $('btn-confirm-back').addEventListener('click', function () { show('screen-scan') })
  $('btn-pod').addEventListener('click', submitPOD)
  var pp = $('pod-photo'); if (pp) pp.addEventListener('change', handlePodPhoto)
  $('btn-new').addEventListener('click', function () { show('screen-scan') })
  resume()
})
