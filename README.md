# TransClick Driver (Android)

A small native Android app whose **only** job is reliable **background GPS tracking** for drivers.
Everything else in TransClick stays on the web. The app talks to your live site
`https://transclick.in` using the APIs that already exist.

**Flow:** driver installs the app once → scans the bilty QR (or enters bilty + vehicle) →
enters name + mobile → **background tracking starts** (keeps running when the screen is off or
the app is in the background) → after delivery the driver submits **POD** → tracking stays ON
until the **admin approves "Close"** from the admin dashboard → then tracking stops.

No OTP for now (just name + mobile), as agreed.

---

## 1. Put this on GitHub

1. Create a new **empty** GitHub repository, e.g. `transclick-driver` (separate from your website repo).
2. Upload **all files from this folder** to that repo (keep the folder structure — `www/`, `android/`,
   `.github/`, `package.json`, `capacitor.config.json`, etc.). Do **not** upload `node_modules` (there isn't one in the zip).
3. Commit.

## 2. Build the APK (automatic, no software needed)

- GitHub builds the APK for you. After you push, open the repo's **Actions** tab.
- Open the **"Build Debug APK"** run (it starts on push; you can also click **Run workflow**).
- Wait ~5–10 min. When it's green, scroll to **Artifacts** → download **`transclick-driver-apk`**.
- Inside the zip is **`app-debug.apk`**.

## 3. Install on a driver's phone

1. Send `app-debug.apk` to the phone (WhatsApp / USB / link).
2. Open it → Android will ask to **allow installing from this source** → allow → Install.
3. Open **TransClick Driver**.

## 4. Using it

1. Tap **Scan Bilty QR** and scan the QR printed on the **driver copy** of the bilty
   (or tap **Enter bilty manually** and type the bilty number + vehicle number).
2. Confirm **name + mobile** → **Start Live Tracking**.
3. When Android asks for **Location**, choose **"Allow all the time"** (needed for background),
   and **allow Camera** for scanning. Allow notifications too (shows the "tracking on" notice).
4. The admin now sees the driver live on the dashboard.
5. After delivery, tap **Mark Delivery Complete (POD)**. Tracking keeps running.
6. The admin taps **Approve & Close** on the dashboard → the driver's app shows **Trip Closed** and
   tracking stops.

> Keep the app installed and signed in. Battery optimization for the app should be turned **off**
> (Android Settings → Apps → TransClick Driver → Battery → **Unrestricted**) so tracking isn't killed.

---

## What it uses

- **Capacitor 8** (wraps the small web UI in `www/`).
- `@capacitor-community/background-geolocation` — foreground-service background GPS.
- `@capacitor-mlkit/barcode-scanning` — QR scanning.
- Backend APIs (already live): `/api/driver/login`, `/api/driver/location`,
  `/api/driver/session`, `/api/driver/pod`, `/api/driver/scan`.

## Change the website URL

If your domain changes, edit **`www/app.js`**, line near the top:

```js
var API = 'https://transclick.in'
```

then re-run the build.

## Notes / limits

- This is a **debug** APK (installable by sideloading). For the Play Store later, we'd add release signing.
- Background tracking is best-effort on Android: it survives backgrounding and screen-off via a
  foreground service, but if the OS kills the app (aggressive battery savers), the driver should
  reopen it — it resumes the active trip automatically.
- First build can take longer while GitHub downloads the Android SDK.
