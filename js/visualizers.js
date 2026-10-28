/** HTML Canvas visualizations – no libraries required. Graphics are educational. */
import { EARTH_RADIUS_KM, hopGeometry, solveElevationDeg, angleMufMHz, antennaLobeDb, toRad, clamp } from './propagation-engine.js';

function setup(canvas) {
  if (!canvas) return null;
  const box = canvas.getBoundingClientRect();
  const w = box.width; const h = box.height;
  if (w < 20 || h < 20) return null;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  }
  const c = canvas.getContext('2d');
  if (!c) return null;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, h);
  return { c, w, h };
}
function theme() {
  const el = document.body;
  const get = (prop) => getComputedStyle(el).getPropertyValue(prop).trim();
  return {
    green: get('--green'), cyan: get('--cyan'), amber: get('--amber'), rose: get('--rose'),
    purple: get('--purple'), muted: get('--muted'), subtle: get('--muted-deep'),
    border: get('--border'), bg: get('--surface-soft'), ink: get('--ink'),
    light: el.dataset.theme === 'light',
  };
}
function segment(c, start, end, color, width = 2.5, dash = []) {
  c.beginPath(); c.moveTo(start.x, start.y); c.lineTo(end.x, end.y);
  c.strokeStyle = color; c.lineWidth = width; c.setLineDash(dash); c.stroke(); c.setLineDash([]);
}
function txt(c, str, x, y, color, size = 10, align = 'left', weight = 500) {
  c.save(); c.font = `${weight} ${size}px 'JetBrains Mono',monospace`; c.fillStyle = color; c.textAlign = align;
  c.fillText(str, x, y); c.restore();
}
function circle(c, x, y, radius, fill, outline) {
  c.beginPath(); c.arc(x, y, radius, 0, Math.PI * 2); c.fillStyle = fill; c.fill();
  if (outline) { c.strokeStyle = outline; c.lineWidth = 1.5; c.stroke(); }
}
function arrow(c, start, end, color) {
  const a = Math.atan2(end.y - start.y, end.x - start.x);
  const x = start.x * .45 + end.x * .55; const y = start.y * .45 + end.y * .55;
  c.save(); c.translate(x, y); c.rotate(a); c.fillStyle = color;
  c.beginPath(); c.moveTo(5, 0); c.lineTo(-4, -3.5); c.lineTo(-4, 3.5); c.closePath(); c.fill(); c.restore();
}
function drawShell(c, project, maxAngle, low, high, color, alpha = 0.045) {
  c.save(); c.beginPath();
  for (let i = 0; i <= 90; i++) { const p = project(maxAngle * i / 90, high); if (i === 0) c.moveTo(p.x, p.y); else c.lineTo(p.x, p.y); }
  for (let i = 90; i >= 0; i--) { const p = project(maxAngle * i / 90, low); c.lineTo(p.x, p.y); }
  c.closePath(); c.fillStyle = color; c.globalAlpha = alpha; c.fill();
  c.globalAlpha = 0.45; c.setLineDash([5, 8]); c.beginPath();
  for (let i = 0; i <= 90; i++) { const p = project(maxAngle * i / 90, (low + high) / 2); if (i === 0) c.moveTo(p.x, p.y); else c.lineTo(p.x, p.y); }
  c.strokeStyle = color; c.lineWidth = 1; c.stroke(); c.setLineDash([]); c.restore();
}

export function drawRayCanvas(canvas, state, path) {
  const data = setup(canvas); if (!data) return;
  const { c, w, h } = data; const pal = theme();
  const viewKm = Math.max(1200, path.distanceKm * 1.20, path.landKm * 1.09);
  const totalAngle = viewKm / EARTH_RADIUS_KM;
  const center = totalAngle / 2;
  const scale = Math.min((w - 80) / viewKm, (h * .61) / Math.max(450, state.virtualHeight + 35));
  const base = h * .82;
  const project = (angle, altitude = 0) => {
    const delta = angle - center; const radius = EARTH_RADIUS_KM + altitude;
    return { x: w / 2 + radius * Math.sin(delta) * scale, y: base - (radius * Math.cos(delta) - EARTH_RADIUS_KM) * scale };
  };
  // Decorative vertical grid and stars, kept behind actual geometry.
  c.save(); c.strokeStyle = pal.border; c.lineWidth = .6; c.globalAlpha = .45;
  for (let x = 45; x < w; x += 58) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
  for (let y = 35; y < h; y += 45) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
  c.restore();
  drawShell(c, project, totalAngle, 65, 90, pal.rose, .058 * path.day + .015);
  drawShell(c, project, totalAngle, 97, 128, pal.amber, .05);
  drawShell(c, project, totalAngle, 170, 220, pal.cyan, .038);
  drawShell(c, project, totalAngle, 265, 380, pal.purple, .046);
  // Highlight the selected virtual reflecting altitude independently of real layers.
  c.save(); c.beginPath(); c.lineWidth = 1.75; c.setLineDash([4, 6]); c.strokeStyle = state.layer === 'E' ? pal.amber : pal.purple;
  for (let i = 0; i <= 100; i++) {
    const p = project(totalAngle * i / 100, state.virtualHeight);
    if (i === 0) c.moveTo(p.x, p.y); else c.lineTo(p.x, p.y);
  } c.stroke(); c.restore();
  // Earth surface with a curved horizon (spherical construction, no flat-Earth shortcut).
  c.beginPath();
  for (let i = 0; i <= 150; i++) { const p = project(totalAngle * i / 150); if (i === 0) c.moveTo(p.x, p.y); else c.lineTo(p.x, p.y); }
  c.lineTo(w + 10, h + 10); c.lineTo(-10, h + 10); c.closePath();
  const earth = c.createLinearGradient(0, h * .7, 0, h);
  earth.addColorStop(0, pal.light ? '#cce4e3' : '#183a49'); earth.addColorStop(1, pal.light ? '#e5efec' : '#10202d');
  c.fillStyle = earth; c.fill();
  c.beginPath(); for (let i = 0; i <= 150; i++) { const p = project(totalAngle * i / 150); if (i === 0) c.moveTo(p.x, p.y); else c.lineTo(p.x, p.y); }
  c.strokeStyle = pal.cyan; c.globalAlpha = .6; c.lineWidth = 1.8; c.stroke(); c.globalAlpha = 1;
  // Current modeled launch is responsible for where a hop actually lands.
  const failureEscape = state.frequency > path.angleMuf;
  const shade = path.status === 'absorption' ? pal.rose : path.status === 'weak' ? pal.amber : pal.green;
  const rayEndAngle = path.geometry.halfAngleRad * 2;
  if (failureEscape) {
    const from = project(0); const outer = project(Math.min(totalAngle * .77, path.geometry.halfAngleRad * 1.1), state.virtualHeight + 265);
    segment(c, from, outer, pal.amber, 3, [11, 6]); arrow(c, from, outer, pal.amber);
    txt(c, 'ESCAPES / f > MUF(θ)', clamp(outer.x - 96, 15, w - 170), clamp(outer.y - 16, 28, h - 58), pal.amber, 10);
  } else {
    for (let j = 0; j < state.hops; j++) {
      const a = project(j * rayEndAngle);
      const b = project(j * rayEndAngle + path.geometry.halfAngleRad, state.virtualHeight);
      const d = project((j + 1) * rayEndAngle);
      c.save(); c.shadowColor = shade; c.shadowBlur = 13; c.globalAlpha = path.status === 'absorption' ? .42 * (1 - j / 6) : path.status === 'weak' ? .55 : 1;
      segment(c, a, b, shade, 3.4); segment(c, b, d, shade, 3.4); c.restore();
      arrow(c, a, b, shade); arrow(c, b, d, shade);
      circle(c, b.x, b.y, 4.8, state.layer === 'E' ? pal.amber : pal.purple);
      if (j < state.hops - 1) circle(c, d.x, d.y, 5, pal.amber, pal.ink);
    }
    const land = project(state.hops * rayEndAngle);
    txt(c, 'TOUCHDOWN', clamp(land.x + 8, 10, w - 100), clamp(land.y - 13, 15, h - 32), shade, 9);
  }
  const src = project(0);
  const dst = project(path.distanceKm / EARTH_RADIUS_KM);
  // Receiver line remains visible even when modeled ray misses it.
  c.save(); c.setLineDash([4, 5]); segment(c, { x: dst.x, y: Math.max(23, dst.y - 48) }, { x: dst.x, y: dst.y }, pal.muted, 1, [4, 5]); c.restore();
  circle(c, src.x, src.y, 6, pal.green, pal.ink); circle(c, dst.x, dst.y, 6, pal.cyan, pal.ink);
  if (path.status === 'weak') txt(c, 'BELOW SNR THRESHOLD', clamp(dst.x - 82, 12, w - 170), clamp(dst.y - 38, 20, h - 60), pal.amber, 9);
  txt(c, 'TX', src.x + 10, clamp(src.y + 19, 15, h - 9), pal.green, 11, 'left', 700);
  txt(c, 'RX', dst.x - 10, clamp(dst.y + 20, 15, h - 9), pal.cyan, 11, 'right', 700);
  txt(c, `${Math.round(path.distanceKm).toLocaleString()} km GREAT CIRCLE`, w / 2, h - 13, pal.muted, 10, 'center');
  txt(c, `${state.frequency.toFixed(1)} MHz`, 14, 24, pal.ink, 12, 'left', 700);
  txt(c, `${state.elevation.toFixed(1)}° / ${state.hops} HOP${state.hops > 1 ? 'S' : ''}`, 14, 41, pal.subtle, 9);
  txt(c, `${state.layer} ≈ ${Math.round(state.virtualHeight)} km`, w - 15, h - 13, pal.purple, 9, 'right');
}

export function drawHopComparison(canvas, state, path, hops) {
  const data = setup(canvas); if (!data) return { ok: false, reason: 'No canvas' };
  const { c, w, h } = data; const pal = theme();
  const aim = solveElevationDeg(path.distanceKm / hops, state.virtualHeight);
  const fo = path.fo;
  const muf = aim === null ? 0 : angleMufMHz(fo, aim);
  const color = aim === null || state.frequency > muf ? pal.rose : pal.green;
  const base = h - 16; const top = 29; const left = 12; const right = w - 12;
  c.strokeStyle = pal.border; c.lineWidth = 1;
  c.beginPath(); c.moveTo(left, top); c.lineTo(right, top); c.setLineDash([4, 5]); c.stroke(); c.setLineDash([]);
  c.beginPath(); c.moveTo(left, base); c.lineTo(right, base); c.strokeStyle = pal.cyan; c.globalAlpha = .5; c.stroke(); c.globalAlpha = 1;
  if (aim !== null) {
    const segment = (right - left) / hops;
    for (let i = 0; i < hops; i++) {
      const a = { x: left + i * segment, y: base };
      const b = { x: left + (i + .5) * segment, y: top };
      const d = { x: left + (i + 1) * segment, y: base };
      segmentLine(a, b); segmentLine(b, d);
      if (i < hops - 1) circle(c, d.x, d.y, 2.8, pal.amber);
      function segmentLine(s, e) { segmentFn(c, s, e, color, 2.2, aim === null || state.frequency > muf ? [5, 3] : []); }
    }
  } else txt(c, 'OUT OF RANGE', w / 2, h / 2, pal.rose, 10, 'center');
  circle(c, left, base, 3.2, pal.green); circle(c, right, base, 3.2, pal.cyan);
  txt(c, `${aim === null ? '—' : aim.toFixed(1)}°`, w / 2, 18, pal.muted, 10, 'center');
  return { ok: aim !== null && state.frequency <= muf, aim, muf };
}
// Distinct name to avoid shadowing the local segment-length variable.
const segmentFn = segment;

export function drawSkipCanvas(canvas, state) {
  const data = setup(canvas); if (!data) return;
  const { c, w, h } = data; const pal = theme();
  const elev = 25; const muf = angleMufMHz(state.academyCritical, elev);
  const returnWave = state.academyFrequency <= muf;
  const left = 40; const ground = h - 28; const apex = { x: w * .55, y: 37 };
  const end = { x: w - 43, y: ground };
  c.fillStyle = pal.light ? '#d7e7e9' : '#142b39'; c.fillRect(0, ground, w, h - ground);
  segment(c, { x: 0, y: ground }, { x: w, y: ground }, pal.cyan, 1.4);
  c.fillStyle = pal.light ? '#d9d5f6' : '#3a2857'; c.globalAlpha = .3; c.fillRect(0, 34, w, 20); c.globalAlpha = 1;
  segment(c, { x: 0, y: 44 }, { x: w, y: 44 }, pal.purple, 1.5, [6, 4]);
  txt(c, 'VIRTUAL LAYER', 12, 20, pal.purple, 9);
  circle(c, left, ground, 4, pal.green); txt(c, 'TX', left + 9, ground + 15, pal.green, 9);
  if (returnWave) {
    segment(c, { x: left, y: ground }, apex, pal.green, 3);
    segment(c, apex, end, pal.green, 3);
    arrow(c, apex, end, pal.green); circle(c, end.x, end.y, 4, pal.green);
    txt(c, 'SKIP ZONE', (left + end.x) / 2, ground - 7, pal.muted, 10, 'center');
  } else {
    const ext = { x: w * .71, y: -30 };
    segment(c, { x: left, y: ground }, apex, pal.amber, 3);
    segment(c, apex, ext, pal.amber, 3, [8, 5]); arrow(c, apex, ext, pal.amber);
    txt(c, 'ESCAPE', w - 11, 22, pal.amber, 9, 'right');
  }
  txt(c, `${state.academyFrequency.toFixed(1)} MHz  /  MUF(25°) ${muf.toFixed(1)} MHz`, w / 2, h - 10, pal.muted, 9, 'center');
}

export function drawAntennaPattern(canvas, state) {
  const data = setup(canvas); if (!data) return;
  const { c, w, h } = data; const pal = theme();
  const cx = w / 2; const cy = h - 26; const radius = Math.min(w * .40, h - 43);
  // Upper half polar plot; r proportional to field amplitude (not power).
  c.save(); c.strokeStyle = pal.border; c.lineWidth = 1;
  for (const portion of [.25, .5, .75, 1]) {
    c.beginPath(); c.arc(cx, cy, radius * portion, Math.PI, 2 * Math.PI); c.stroke();
  }
  for (const angle of [0, 30, 60, 90, 120, 150, 180]) {
    const a = toRad(angle);
    segment(c, { x: cx, y: cy }, { x: cx - radius * Math.cos(a), y: cy - radius * Math.sin(a) }, pal.border, 1, [2, 4]);
  }
  c.restore();
  // Left/right symmetric profile for an ideal horizontal radiator.
  c.beginPath(); c.moveTo(cx, cy);
  for (let angle = 0; angle <= 180; angle += 1) {
    const physicalElevation = angle <= 90 ? angle : 180 - angle;
    const amplitude = 10 ** (antennaLobeDb(physicalElevation, state.antennaHeight) / 20);
    const a = toRad(angle);
    c.lineTo(cx - radius * amplitude * Math.cos(a), cy - radius * amplitude * Math.sin(a));
  }
  c.closePath(); c.fillStyle = pal.green; c.globalAlpha = .14; c.fill();
  c.strokeStyle = pal.green; c.lineWidth = 2.5; c.globalAlpha = 1; c.stroke();
  const selectedRad = toRad(state.elevation);
  const ref = { x: cx + radius * Math.cos(selectedRad), y: cy - radius * Math.sin(selectedRad) };
  segment(c, { x: cx, y: cy }, ref, pal.amber, 1.5, [6, 4]);
  const intensity = 10 ** (antennaLobeDb(state.elevation, state.antennaHeight) / 20);
  circle(c, cx + radius * intensity * Math.cos(selectedRad), cy - radius * intensity * Math.sin(selectedRad), 4, pal.amber);
  circle(c, cx, cy, 4, pal.cyan);
  txt(c, 'HORIZON 0°', w - 12, h - 7, pal.muted, 9, 'right');
  txt(c, '90° ZENITH', cx, 16, pal.muted, 9, 'center');
  txt(c, `${state.elevation.toFixed(1)}°`, clamp(ref.x + 5, 13, w - 36), clamp(ref.y - 7, 22, h - 18), pal.amber, 10);
}

/** Static non-CDN fallback when Chart.js cannot load (e.g. local offline preview). */
export function drawFallbackChart(canvas, curve) {
  const data = setup(canvas); if (!data) return;
  const { c, w, h } = data; const pal = theme();
  const left = 42, right = w - 16, top = 20, bottom = h - 30;
  const highest = Math.max(30, ...curve.map(x => x.muf * 1.1));
  const X = i => left + i / 23 * (right - left);
  const Y = value => bottom - value / highest * (bottom - top);
  c.lineWidth = 1; c.strokeStyle = pal.border;
  for (let f = 0; f <= highest; f += 5) { segment(c, { x: left, y: Y(f) }, { x: right, y: Y(f) }, pal.border, 1, [3, 5]); txt(c, `${f}`, left - 8, Y(f) + 4, pal.muted, 9, 'right'); }
  for (const i of [0, 6, 12, 18, 23]) txt(c, `${String(i).padStart(2, '0')}Z`, X(i), h - 10, pal.muted, 9, 'center');
  for (const [key, color] of [['luf',pal.amber], ['fot',pal.green], ['muf',pal.cyan]]) {
    c.beginPath(); curve.forEach((point, i) => { if (i === 0) c.moveTo(X(i), Y(point[key])); else c.lineTo(X(i), Y(point[key])); });
    c.strokeStyle = color; c.lineWidth = 2; c.stroke();
  }
  txt(c, 'MHz', 5, 14, pal.muted, 9);
}
