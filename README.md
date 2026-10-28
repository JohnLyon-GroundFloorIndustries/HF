# IONOSCOPE / HF Propagation Learning Hub

A polished, responsive, browser-only learning lab for High Frequency (HF) skywave propagation. Explore spherical-Earth virtual-hop geometry, MUF/FOT/LUF, sunlight-driven ionization, modeled signal strength and a 160m–10m band matrix. **Works as a static website on GitHub Pages; no server, API token, database or build command required.**

> **Important:** This is an **educational scenario simulator**, not a live propagation forecast, validated operational planning tool, ionogram-based refractive ray tracer or ITU-R P.533/VOACAP implementation. Its solar values, noise environments and ionosphere coefficients are adjustable assumptions. It does **not** fetch current band openings. Do not use its results for safety-critical communications or legal transmit eligibility.

## Features

- **Mission control:** path length, path MUF, received dBm/S-units and diagnostic status in one display.
- **Spherical-Earth ray lab:** editable TX/RX coordinates, takeoff elevation, frequency, virtual altitude, F2/E selection, one to three hops, and visual escape, skip, absorption and weak-signal conditions. Presets for Seattle–Denver, New York–Chicago, and London–Berlin.
- **Ionospheric academy:** interactive SVG D/E/F1/F2 layers, day/night/season/solar-cycle explanations, visual secant-law return/escape lab, frequency window and correlated space-weather inputs.
- **Link budget:** power, line loss, both antenna gains, ground-interference elevation lobes, receiver noise preset and fine adjustment, SSB/CW/FT8 threshold, detailed dB ledger and signal-to-noise margin.
- **Band & frequency planner:** 160m through 10m model-compatibility matrix; clickable bands; UTC 24-hour LUF/FOT/MUF curve with Chart.js and a no-CDN canvas fallback.
- **Comfort:** dark radio-console styling, high-contrast daylight theme, responsive layouts, keyboard-accessible controls, shareable URL parameters and scenario reset.
- **Tests:** 18+ tests covering hop-angle inverse, great-circle calculations, solar/daylight proxies, FSPL, dBm, Fresnel geometry, absorption and link diagnoses.

## Repository structure

```text
hf-propagation-hub/
├── index.html                    # Entire single-page application
├── css/
│   └── style.css                 # Polished dark/light responsive design and fallback CSS
├── js/
│   ├── app.js                    # State, accessible controls, data binding and Chart.js
│   ├── propagation-engine.js     # Pure, tested HF geometry and link calculations
│   └── visualizers.js           # HiDPI Canvas ray, hops, skip zone and antenna lobes
├── assets/
│   └── favicon.svg               # Project icon
├── tests/
│   └── propagation-engine.test.js
├── package.json                 # Node test command; no runtime dependencies
├── LICENSE
└── README.md
```

## Deploy to GitHub Pages

1. Create a new GitHub repository, for example `hf-propagation-hub`.
2. Upload **the contents of the `hf-propagation-hub` folder** to the repository root. `index.html` must be in the root (not buried inside a second subdirectory). Commit to `main`.
3. Go to **Settings → Pages → Build and deployment → Source: Deploy from a branch**.
4. Set **Branch: `main`**, **Folder: `/ (root)`**; click **Save**.
5. Open `https://YOUR-USERNAME.github.io/hf-propagation-hub/` after GitHub publishes the site. Refresh with an empty cache if you uploaded a new version.

No npm build or server deployment is needed. All local file paths are relative (`./css/...`, `./js/...`) and work beneath a GitHub Pages repository prefix.

Optional Git command sequence after creating the empty GitHub repo:

```bash
git init
git add .
git commit -m "Launch IONOSCOPE HF lab"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/hf-propagation-hub.git
git push -u origin main
```

### Local development

Browsers restrict ES module imports from `file://`. Serve the folder locally rather than double-clicking `index.html`:

```bash
cd hf-propagation-hub
python3 -m http.server 8000
# open http://localhost:8000
```

Run automated engine tests with Node.js 18+:

```bash
npm test
```

No `npm install` is required: Node's built-in test runner is used, and the browser dependencies are loaded from CDNs.

## How the model works

All numeric formulas are in `js/propagation-engine.js`, and are kept independent of the DOM. The model explicitly reports failure categories; a strong mathematical RX level is **not** treated as reception when the ray does not reach the receiver.

| Mechanism | Implemented approximation | Known limitation |
| --- | --- | --- |
| Geodesic | Haversine great-circle route, spherical midpoint | No detailed geodesy, terrain profile, off-great-circle modes |
| Day/night | Solar declination + local solar hour at midpoint, smoothed day fraction | Month-center approximation, no exact ephemerides or terminator integration across full path |
| Ionization | Layer-specific empirical `fo` proxy from daylight, SFI, SSN, Kp, A, month | **Not measured foF2**, no IRI/NeQuick/ionosonde, no storm-time physics or latitude mapping |
| Ray path | Straight legs reflecting from a virtual spherical shell at height *h* | A visual virtual-reflection model—not curved refractive numerical ray tracing |
| Oblique MUF | `MUF(θ) = fo / sin(θ)` with θ measured above local horizon | Flat-layer secant-law approximation applied to spherical-hop geometry, not full magnetoionic physics |
| Hop geometry | Ray/spherical-shell intersection and Earth-central-angle landing position | Reflecting layer assumed uniform; no tilts or asymmetric hops |
| FOT | `0.85 × path MUF` | Heuristic convention; reliability is not calculated |
| LUF | Illustrative day/noise/Kp proxy | Formal LUF is a circuit-performance/SNR requirement; model is a teaching proxy |
| Loss | `FSPL(dB) = 32.44 + 20 log₁₀(d_km) + 20 log₁₀(f_MHz)` for total ray-leg distance; per-hop D loss, residual skywave and ground losses | Path loss heuristic, no measured attenuation, ground conductivity, polarization, caustics or statistical fading |
| Gain | TX/RX dBi plus normalized 2-ray elevation pattern for a horizontal ideal radiator | Requires antenna pattern/soil simulation for real sites; ideal perfect-ground approximation |
| Noise | Adjustable dBm examples for a common **2.5 kHz reference bandwidth** | Not real local QRM/QRN; actual receiver noise, bandwidth, mode thresholds and decode performance vary |
| Modes | SSB `+10 dB`, CW `−6 dB`, FT8 `−20 dB` proxy SNR thresholds relative to reference | Not guaranteed demodulation; FT8 reports conventionally reference ~2.5 kHz, thresholds are approximate |
| S-meter | Amateur HF calibration convention S9 ≈ −73 dBm with nominal 6 dB per S-unit | Actual radio S-meters vary |
| Fresnel | First-zone radius `sqrt(λ d₁ d₂/(d₁+d₂))`, configurable clearance ratio | Geometry utility only: not a terrain-intersection / obstruction map |
| Band matrix | Auto-aim each candidate frequency at the current endpoint and apply frequency/strength proxies | **Synthetic eligibility**, not measured real-time opening probability |

The drawn ionosphere is intentionally schematic and the vertical layer depiction is labeled **not to scale**. Each parameter's direction of influence is made explicit, but using it as a probability prediction would be misleading. A solar flare causes D-layer absorption through enhanced X-rays; SFI is *not* a direct flare indicator. The SFI and SSN controls are correlated solar-cycle proxies, not two independent physical drivers. Geomagnetic storms have geography-specific effects and can either depress or increase particular F-region frequencies.

### Representative equations

```text
Ptx(dBm)        = 30 + 10 log10(Ptx[W])
FSPL(dB)        = 32.44 + 20 log10(f[MHz]) + 20 log10(slantDistance[km])
Prx(dBm)        = Ptx(dBm) - Lfeed + Gtx + Globe + Grx - FSPL
                   - L_D_absorption - L_other_iono - L_ground_reflections
SNR(dB)         = Prx(dBm) - NoiseFloor(dBm)
ModeMargin(dB)  = SNR(dB) - ModeThreshold(dB)
MUF(angle)      ≈ criticalFrequency / sin(elevation)
FOT             ≈ 0.85 × pathMUF
```

The spherical hop algorithm derives the distance `t` from launch at Earth radius `R` to virtual shell radius `R+h` using

```text
t = -R sin(θ) + sqrt((R sin(θ))² + 2 R h + h²)
α = atan2(t cos(θ), R + t sin(θ))
Hop ground distance = 2 R α
Hop ray distance    = 2 t
```

The required takeoff angle is solved with bisection. **The input elevation** determines actual virtual landing positions. A separate **auto-aimed elevation** supports 1/2/3-hop and band comparisons. The model checks frequency above angle-MUF, frequency below LUF, geographic miss distance, then SNR—rather than assuming all contacts work when power is high.

## External front-end dependencies

The application requests CDN-hosted **Tailwind Play CDN v4**, **Chart.js v4.4.8**, **Lucide v0.468.0**, and optional Google Fonts. If Chart.js cannot load, the 24h graph uses a Canvas fallback; Lucide is decorative and custom CSS provides the app's core layout. Physics and controls do not depend on third-party JavaScript.

**Tailwind's Play CDN is officially for development/prototyping, not hardened production.** It is included to meet the requested no-build/CDN workflow, but the site is principally styled in `css/style.css` and remains styled when Play CDN is unavailable. For a stricter production deployment, remove the Play CDN script and ship a **precompiled Tailwind CSS file** (or keep the already provided standalone CSS), self-host pinned Chart.js/Lucide assets, and deploy with a suitable Content Security Policy. GitHub Pages supports static generated assets with no runtime build system.

## Extending to live solar data

The present app deliberately has no live-feed mode, to prevent a stale API response being mistaken for verified propagation conditions. For a production live-data enhancement:

1. Integrate official [NOAA Space Weather Prediction Center](https://www.swpc.noaa.gov/) products for current **observed** SFI, Kp and A; show each feed's timestamp, units, freshness, and provenance. SSN values and their averaging windows differ by product.
2. Add a user-visible **Manual / Live** switch; on fetch failure, clearly revert to **STALE / MANUAL**, never silently retain a green “live” badge.
3. Verify NOAA's CORS/availability requirements. A GitHub Actions scheduled retrieval into repository JSON or a hosted edge proxy can keep GitHub Pages static if a chosen endpoint does not permit browser CORS. Respect rate limits and cache-control.
4. For operational propagation probability rather than just educational behavior, adopt measured ionograms or a validated **ITU-R P.533 / VOACAP / IRI-based** propagation calculation. Do not simply change the site's “mock” label to “live” while retaining the synthetic heuristic model.

## Scientific and documentation references

- [ITU-R Recommendation P.533 — Method for the prediction of the performance of HF circuits](https://www.itu.int/rec/R-REC-P.533/en)
- [NOAA SWPC — HF radio communications and space weather impacts](https://www.spaceweather.gov/impacts/hf-radio-communications)
- [NOAA SWPC — K and A geomagnetic indices](https://www.swpc.noaa.gov/products/planetary-k-index)
- [Tailwind — Play CDN suitability](https://tailwindcss.com/docs/installation/play-cdn)

The code in this repository is distributed under the MIT License. It is intended for HF learning, exploration and software prototyping.
