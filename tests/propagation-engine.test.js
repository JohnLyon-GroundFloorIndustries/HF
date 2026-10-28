import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_STATE, EARTH_RADIUS_KM, greatCircleDistanceKm, greatCircleMidpoint,
  hopGeometry, solveElevationDeg, freeSpacePathLossDb, angleMufMHz,
  antennaLobeDb, absorptionDbPerHop, daylightFactor, criticalFrequencyMHz,
  firstFresnelRadiusMeters, fresnelClearance, dbmFromWatts, sMeterLabel,
  evaluatePath, evaluateBand, frequencyWindowCurve,
} from '../js/propagation-engine.js';

test('great-circle distance is symmetric, zero on same site, quarter circumference', () => {
  assert.equal(greatCircleDistanceKm(10,30,10,30),0);
  const a = greatCircleDistanceKm(47.6062,-122.3321,39.7392,-104.9903);
  const b = greatCircleDistanceKm(39.7392,-104.9903,47.6062,-122.3321);
  assert.ok(Math.abs(a-1641)<2);
  assert.ok(Math.abs(a-b)<1e-8);
  assert.ok(Math.abs(greatCircleDistanceKm(0,0,0,90)-Math.PI*EARTH_RADIUS_KM/2)<1e-5);
});
test('midpoint resolves a known equatorial path', () => {
  const p=greatCircleMidpoint(0,0,0,90);
  assert.ok(Math.abs(p.lat)<1e-9); assert.ok(Math.abs(p.lon-45)<1e-9);
});
test('spherical virtual-hop range decreases with steeper elevation', () => {
  const low=hopGeometry(5,300); const high=hopGeometry(45,300);
  assert.ok(low.hopKm>high.hopKm);
  assert.ok(low.hopKm<Math.PI*EARTH_RADIUS_KM);
  assert.ok(Math.abs(low.slantKm-2*low.segmentKm)<1e-9);
});
test('inversion of geometry recovers launch angle and detects impossible hop', () => {
  for(const theta of [3,12,27,52,80]) {
    const g=hopGeometry(theta,300);
    const inverse=solveElevationDeg(g.hopKm,300);
    assert.ok(Math.abs(theta-inverse)<1e-7,`${theta}: ${inverse}`);
  }
  assert.equal(solveElevationDeg(5000,110),null);
});
test('secant-law MUF rises at grazing incidence and equals fo at vertical', () => {
  assert.ok(angleMufMHz(5,15)>angleMufMHz(5,45));
  assert.equal(angleMufMHz(5,90),5);
});
test('FSPL equals standard 1,000 km, 10 MHz example and doubles distance at +6.02dB', () => {
  const a=freeSpacePathLossDb(1000,10);
  assert.ok(Math.abs(a-112.44)<1e-5);
  assert.ok(Math.abs(freeSpacePathLossDb(2000,10)-a-6.0206)<.001);
  assert.throws(()=>freeSpacePathLossDb(0,10),RangeError);
});
test('power/S-meter references are sound', () => {
  assert.equal(dbmFromWatts(100),50);
  assert.equal(sMeterLabel(-73),'S9');
  assert.equal(sMeterLabel(-121),'S1');
  assert.equal(sMeterLabel(-53),'S9 +20 dB');
  assert.throws(()=>dbmFromWatts(-1));
});
test('antenna height controls lobes, no positive normalized gain', () => {
  assert.ok(antennaLobeDb(0,.5)<=-30);
  assert.ok(antennaLobeDb(30,.5)<=0);
  assert.ok(antennaLobeDb(30,.5)>antennaLobeDb(0,.5));
});
test('D absorption increases at lower frequency and in daylight', () => {
  const solar={k:2,a:9};
  assert.ok(absorptionDbPerHop(3,1,solar)>absorptionDbPerHop(14,1,solar));
  assert.ok(absorptionDbPerHop(3,1,solar)>absorptionDbPerHop(3,0,solar));
});
test('daylight follows longitude and solar local noon', () => {
  assert.ok(daylightFactor(0,0,12,3)>.7);
  assert.ok(daylightFactor(0,0,0,3)<.15);
  assert.ok(daylightFactor(0,-90,18,3)>.7);
});
test('F2 critical frequency responds to daylight and long-term solar proxies', () => {
  const solar={sfi:140,ssn:100,k:2,a:9,month:6};
  assert.ok(criticalFrequencyMHz('F2',solar,1)>criticalFrequencyMHz('F2',solar,0));
  assert.ok(criticalFrequencyMHz('F2',{...solar,sfi:220,ssn:200},1)>criticalFrequencyMHz('F2',solar,1));
});
test('Fresnel radius and 60% clearance formula', () => {
  const r=firstFresnelRadiusMeters(14,500,500);
  assert.ok(r>0);
  assert.equal(fresnelClearance(r*.61,r).clear,true);
  assert.equal(fresnelClearance(r*.59,r).clear,false);
  assert.equal(firstFresnelRadiusMeters(0,500,500),0);
});
test('default route is valid and nominally reachable', () => {
  const p=evaluatePath(DEFAULT_STATE);
  assert.equal(p.status,'open');
  assert.ok(p.distanceKm>1500 && p.distanceKm<1700);
  assert.ok(p.rxDbm<p.txDbm);
  assert.ok(p.luf<p.pathMuf);
  assert.ok(Math.abs(p.landKm-p.distanceKm)<p.toleranceKm);
});
test('extreme frequency at vertical inclination escapes', () => {
  const p=evaluatePath({...DEFAULT_STATE, frequency:28, elevation:55});
  assert.equal(p.status,'escape');
});
test('steep angle undershoots destination', () => {
  const p=evaluatePath({...DEFAULT_STATE, elevation:35, frequency:7});
  assert.equal(p.status,'undershoot');
});
test('very low frequency during daylight trips LUF warning', () => {
  const p=evaluatePath({...DEFAULT_STATE,frequency:1.9});
  assert.equal(p.status,'absorption');
});
test('higher TX power increases received strength by 10 dB per decade', () => {
  const p1=evaluatePath({...DEFAULT_STATE,txPower:10});
  const p2=evaluatePath({...DEFAULT_STATE,txPower:100});
  assert.ok(Math.abs(p2.rxDbm-p1.rxDbm-10)<1e-9);
});
test('bands and 24h curve return ten entries and 24 hourly samples', () => {
  const testBand=evaluateBand(DEFAULT_STATE,14.2);
  assert.equal(testBand.status,'open');
  const curve=frequencyWindowCurve(DEFAULT_STATE);
  assert.equal(curve.length,24); assert.equal(curve[0].hour,0); assert.equal(curve[23].hour,23);
  assert.ok(curve.every(p=>p.luf>0 && p.muf>0));
});
