/**
 * HF Propagation Hub – deterministic educational physics engine.
 * Units: km, MHz, dBm, dB and degrees unless explicitly identified.
 * Geometric-optics virtual reflection + heuristic ionization/absorption.
 * NOT an ITU-R P.533/VOACAP/ionogram-based operational prediction.
 */
export const EARTH_RADIUS_KM = 6371;
export const BANDS = Object.freeze([
  { name: '160m', frequency: 1.9, label: '1.8–2.0 MHz' },
  { name: '80m', frequency: 3.65, label: '3.5–4.0 MHz' },
  { name: '60m', frequency: 5.35, label: 'channelized / regional' },
  { name: '40m', frequency: 7.15, label: '7.0–7.3 MHz' },
  { name: '30m', frequency: 10.12, label: '10.1 MHz' },
  { name: '20m', frequency: 14.2, label: '14 MHz' },
  { name: '17m', frequency: 18.1, label: '18 MHz' },
  { name: '15m', frequency: 21.2, label: '21 MHz' },
  { name: '12m', frequency: 24.93, label: '24 MHz' },
  { name: '10m', frequency: 28.4, label: '28 MHz' },
]);
export const MODE_THRESHOLDS_DB = Object.freeze({ SSB: 10, CW: -6, FT8: -20 });
// Simplified 2.5-kHz reference-bandwidth receiver noise examples, NOT live measurements.
export const NOISE_PRESETS_DBM = Object.freeze({ rural: -123, suburban: -113, urban: -103, qrm: -93 });
export const LAYER_HEIGHTS_KM = Object.freeze({ D: 75, E: 110, F1: 190, F2: 300 });
export const toRad = (degrees) => degrees * Math.PI / 180;
export const toDeg = (radians) => radians * 180 / Math.PI;
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function greatCircleDistanceKm(lat1, lon1, lat2, lon2) {
  const aLat = toRad(lat1); const bLat = toRad(lat2);
  const dLat = bLat - aLat; const dLon = toRad(lon2 - lon1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat) * Math.cos(bLat) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(clamp(h, 0, 1)));
}

export function greatCircleMidpoint(lat1, lon1, lat2, lon2) {
  const a = toRad(lat1); const b = toRad(lat2); const dl = toRad(lon2 - lon1);
  const bx = Math.cos(b) * Math.cos(dl); const by = Math.cos(b) * Math.sin(dl);
  const x = Math.cos(a) + bx; const y = by;
  if (Math.abs(x) + Math.abs(y) < 1e-9) return { lat: lat1, lon: lon1 };
  const lat = toDeg(Math.atan2(Math.sin(a) + Math.sin(b), Math.sqrt(x * x + y * y)));
  const lon = ((lon1 + toDeg(Math.atan2(y, x)) + 540) % 360) - 180;
  return { lat, lon };
}

/** Approximate astronomical daylight scaling, 0 night to 1 sun well above horizon. */
export function daylightFactor(lat, lon, utcHour, month = 6) {
  const dayOfYear = 15 + (clamp(month, 1, 12) - 1) * 30.44;
  const declination = toRad(23.44 * Math.sin(2 * Math.PI * (284 + dayOfYear) / 365));
  const latitude = toRad(lat);
  const hourAngle = toRad(15 * ((utcHour + lon / 15 + 24) % 24 - 12));
  const cosineZenith = Math.sin(latitude) * Math.sin(declination) + Math.cos(latitude) * Math.cos(declination) * Math.cos(hourAngle);
  return clamp((cosineZenith + 0.14) / 0.70, 0, 1);
}

/** Illustrative foE/foF1/foF2 heuristic; solar indices are user-supplied scenarios. */
export function criticalFrequencyMHz(layer, solar, daylight, latitude = 40) {
  const sfi = solar.sfi ?? 120; const ssn = solar.ssn ?? 90;
  const k = solar.k ?? 2; const a = solar.a ?? 10;
  const season = Math.cos(toRad(latitude)) * (1 - Math.abs((solar.month ?? 6) - 6.5) / 7);
  if (layer === 'E') return clamp(0.85 + 2.55 * daylight + (sfi - 100) * 0.003, 0.7, 5.3);
  if (layer === 'F1') return clamp(1.05 + 3.15 * daylight + (sfi - 100) * 0.009, 1.0, 8.0);
  if (layer === 'D') return clamp(0.2 + daylight * 0.5, 0.2, 1.0);
  const ionization = 2.7 + 3.0 * daylight + (sfi - 100) * 0.021 + (ssn - 70) * 0.006;
  const stormPenalty = Math.max(0, k - 3) * 0.28 + Math.max(0, a - 20) * 0.006;
  return clamp(ionization + 0.5 * season - stormPenalty, 1.8, 11.5);
}

/** Spherical-earth intersection with a virtual mirror-shell at R + height. */
export function hopGeometry(elevationDeg, heightKm) {
  const theta = toRad(clamp(elevationDeg, 0, 89.9));
  const h = clamp(heightKm, 70, 550);
  const r = EARTH_RADIUS_KM;
  const segmentKm = -r * Math.sin(theta) + Math.sqrt((r * Math.sin(theta)) ** 2 + 2 * r * h + h ** 2);
  const halfAngleRad = Math.atan2(segmentKm * Math.cos(theta), r + segmentKm * Math.sin(theta));
  return {
    segmentKm,
    slantKm: 2 * segmentKm,
    halfAngleRad,
    hopKm: 2 * r * halfAngleRad,
    heightKm: h,
    elevationDeg: clamp(elevationDeg, 0, 89.9),
  };
}

/** Required geometric elevation to hit a target per-hop ground distance. */
export function solveElevationDeg(targetHopKm, heightKm) {
  if (!Number.isFinite(targetHopKm) || targetHopKm <= 0) return null;
  if (targetHopKm > hopGeometry(0, heightKm).hopKm) return null;
  let low = 0; let high = 89.9;
  for (let i = 0; i < 64; i += 1) {
    const mid = (low + high) / 2;
    if (hopGeometry(mid, heightKm).hopKm > targetHopKm) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

/** Secant-law threshold from incidence angle (90°−elevation). */
export function angleMufMHz(criticalMHz, elevationDeg) {
  return criticalMHz / Math.max(0.045, Math.sin(toRad(clamp(elevationDeg, 0, 90))));
}

export function freeSpacePathLossDb(distanceKm, frequencyMHz) {
  if (distanceKm <= 0 || frequencyMHz <= 0) throw new RangeError('Distance and frequency must be positive');
  return 32.44 + 20 * Math.log10(distanceKm) + 20 * Math.log10(frequencyMHz);
}

/** Near-earth ideal horizontal antenna over a perfectly conducting ground plane. */
export function antennaLobeDb(elevationDeg, antennaHeightLambda = 0.5) {
  const intensity = (angle) => Math.abs(Math.sin(2 * Math.PI * antennaHeightLambda * Math.sin(toRad(angle))));
  let max = 0;
  for (let i = 1; i <= 90; i += 0.5) max = Math.max(max, intensity(i));
  const ratio = intensity(elevationDeg) / Math.max(0.001, max);
  return clamp(20 * Math.log10(Math.max(0.0178, ratio)), -35, 0);
}

export function absorptionDbPerHop(frequencyMHz, daylight, solar) {
  const baseline = 0.16;
  const dLayer = 2.1 * daylight * (7 / Math.max(1.5, frequencyMHz)) ** 2;
  const disturbance = Math.max(0, (solar.k ?? 2) - 3) * 0.42 + Math.max(0, (solar.a ?? 10) - 25) * 0.025;
  return baseline + dLayer + disturbance;
}

/** LUF here is an illustrative absorption+noise proxy, not a formal circuit LUF. */
export function estimateLufMHz(daylight, solar, noiseFloorDbm) {
  const noisePenalty = Math.max(0, noiseFloorDbm + 120) * 0.052;
  const geomag = Math.max(0, (solar.k ?? 2) - 4) * 0.18;
  return clamp(1.8 + 2.2 * daylight + noisePenalty + geomag, 1.8, 11.0);
}

/** First Fresnel zone radius at an obstruction between two ray endpoints. */
export function firstFresnelRadiusMeters(frequencyMHz, d1Meters, d2Meters) {
  if (frequencyMHz <= 0 || d1Meters <= 0 || d2Meters <= 0) return 0;
  return Math.sqrt((299792458 / (frequencyMHz * 1e6)) * d1Meters * d2Meters / (d1Meters + d2Meters));
}
export function fresnelClearance(clearanceMeters, radiusMeters, minFraction = 0.6) {
  return { ratio: radiusMeters > 0 ? clearanceMeters / radiusMeters : Infinity,
    clear: clearanceMeters >= minFraction * radiusMeters };
}

export function dbmFromWatts(powerW) {
  if (powerW <= 0) throw new RangeError('Transmitter power must be positive');
  return 30 + 10 * Math.log10(powerW);
}
export function sMeterLabel(dbm) {
  if (dbm < -121) return 'Below S1';
  if (dbm <= -73) return `S${clamp(Math.round(9 + (dbm + 73) / 6), 1, 9)}`;
  return `S9 +${Math.round(dbm + 73)} dB`;
}

export const DEFAULT_STATE = Object.freeze({
  txLat: 47.6062, txLon: -122.3321, rxLat: 39.7392, rxLon: -104.9903,
  frequency: 14.2, elevation: 16, layer: 'F2', virtualHeight: 300, hops: 1,
  txPower: 100, feedlineLoss: 1.5, txGain: 2, rxGain: 0,
  antennaHeight: 0.5, noisePreset: 'suburban', noiseOffset: 0, mode: 'SSB',
  sfi: 135, ssn: 110, k: 2, a: 9, utcHour: 19, month: 6,
  academyFrequency: 14, academyCritical: 5, academyLayer: 'F2',
});

/** Compute one coherent educational scenario, including explicit failure cause. */
export function evaluatePath(state) {
  const midpoint = greatCircleMidpoint(state.txLat, state.txLon, state.rxLat, state.rxLon);
  const distanceKm = greatCircleDistanceKm(state.txLat, state.txLon, state.rxLat, state.rxLon);
  const solar = { sfi: state.sfi, ssn: state.ssn, k: state.k, a: state.a, month: state.month };
  const day = daylightFactor(midpoint.lat, midpoint.lon, state.utcHour, state.month);
  const fo = criticalFrequencyMHz(state.layer, solar, day, midpoint.lat);
  const height = state.virtualHeight;
  const hops = state.hops;
  const geometry = hopGeometry(state.elevation, height);
  const aim = solveElevationDeg(distanceKm / hops, height);
  const angleMuf = angleMufMHz(fo, state.elevation);
  const pathMuf = aim === null ? 0 : angleMufMHz(fo, aim);
  const noiseDbm = NOISE_PRESETS_DBM[state.noisePreset] + state.noiseOffset;
  const luf = estimateLufMHz(day, solar, noiseDbm);
  const foT = pathMuf * 0.85;
  const landKm = geometry.hopKm * hops;
  const errorKm = landKm - distanceKm;
  const toleranceKm = Math.max(100, distanceKm * 0.12);
  const withinAim = Math.abs(errorKm) <= toleranceKm;
  const txDbm = dbmFromWatts(state.txPower);
  const lobeDb = antennaLobeDb(state.elevation, state.antennaHeight);
  const fsplDb = freeSpacePathLossDb(Math.max(1, geometry.slantKm * hops), state.frequency);
  const absorptionDb = absorptionDbPerHop(state.frequency, day, solar) * hops;
  const ordinaryIonoDb = 2.1 * hops; // aggregate scattering, mode conversion and fading allowance
  const groundDb = 2 * Math.max(0, hops - 1); // idealized intermediate ground reflections
  const rxDbm = txDbm - state.feedlineLoss + state.txGain + lobeDb + state.rxGain
    - fsplDb - absorptionDb - ordinaryIonoDb - groundDb;
  const snrDb = rxDbm - noiseDbm;
  const requiredSnr = MODE_THRESHOLDS_DB[state.mode];
  let status = 'open'; let reason = 'The geometry reaches the receiver and the modeled signal clears the selected mode threshold.';
  if (aim === null) {
    status = 'range'; reason = 'This layer cannot span the requested ground distance with the selected number of hops, even at a near-horizontal launch.';
  } else if (state.frequency > angleMuf) {
    status = 'escape'; reason = 'Frequency exceeds the secant-law MUF at this launch angle. The simplified ray penetrates the ionosphere instead of returning.';
  } else if (state.frequency < luf) {
    status = 'absorption'; reason = 'Frequency is below the educational LUF estimate. D-region absorption and background noise dominate this modeled link.';
  } else if (!withinAim) {
    status = errorKm > 0 ? 'overshoot' : 'undershoot';
    reason = `At ${state.elevation.toFixed(1)}° the ${hops}-hop virtual path lands ${Math.abs(errorKm).toFixed(0)} km ${errorKm > 0 ? 'beyond' : 'short of'} the destination.`;
  } else if (snrDb < requiredSnr) {
    status = 'weak'; reason = `The ray can reach the receiver, but modeled SNR is ${snrDb.toFixed(1)} dB, below the ${state.mode} threshold of ${requiredSnr} dB.`;
  }
  return {
    midpoint, distanceKm, day, fo, geometry, aim, angleMuf, pathMuf, fot: foT, luf,
    landKm, errorKm, toleranceKm, withinAim, noiseDbm, txDbm, lobeDb, fsplDb,
    absorptionDb, ordinaryIonoDb, groundDb, rxDbm, snrDb, requiredSnr,
    marginDb: snrDb - requiredSnr, hops, status, reason,
  };
}

export function evaluateBand(state, frequencyMHz) {
  const distanceKm = greatCircleDistanceKm(state.txLat, state.txLon, state.rxLat, state.rxLon);
  const aim = solveElevationDeg(distanceKm / state.hops, state.virtualHeight);
  if (aim === null) return { status: 'closed', reason: 'No virtual-hop geometry', snr: null, margin: null };
  const result = evaluatePath({ ...state, frequency: frequencyMHz, elevation: aim });
  return { status: result.status === 'open' ? (result.marginDb < 6 ? 'marginal' : 'open') : 'closed',
    reason: result.reason, snr: result.snrDb, margin: result.marginDb };
}

export function frequencyWindowCurve(state) {
  return Array.from({ length: 24 }, (_, utcHour) => {
    const result = evaluatePath({ ...state, utcHour });
    return { hour: utcHour, luf: result.luf, muf: result.pathMuf, fot: result.fot };
  });
}
