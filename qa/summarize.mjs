import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(), 'findings');
if (!fs.existsSync(dir)) {
  console.error('No findings/ directory. Run the usability suite first.');
  process.exit(1);
}

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
const rows = files.map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));

// Group by route, summarise across devices.
const byRoute = new Map();
for (const r of rows) {
  const key = r.route;
  if (!byRoute.has(key)) byRoute.set(key, []);
  byRoute.get(key).push(r);
}

let out = '# Mobile Usability Findings — rbbp.fun\n\n';
out += `Generated: ${new Date().toISOString()}\n\n`;
out += `Devices tested per route: WebKit (iPhone SE/14/14 Pro Max — Safari engine), Chromium (Pixel 7), Desktop.\n\n`;

// Site-wide PWA / viewport status (same across pages, sample one).
const sample = rows.find((r) => r.pwa) || rows[0];
if (sample?.pwa) {
  out += '## Site-wide PWA / "Add to Home Screen" readiness\n\n';
  const p = sample.pwa;
  const yn = (b) => (b ? '✅' : '❌');
  out += `- Viewport meta present: ${yn(p.hasViewportMeta)} (\`${p.content || ''}\`)\n`;
  out += `- viewport-fit=cover (notch safe-area): ${yn(p.viewportFitCover)}\n`;
  out += `- theme-color: ${yn(p.hasThemeColor)}\n`;
  out += `- Web App Manifest: ${yn(p.hasManifest)}\n`;
  out += `- apple-touch-icon (iOS home-screen icon): ${yn(p.hasAppleTouchIcon)}\n`;
  out += `- apple/mobile-web-app-capable: ${yn(p.hasAppleWebAppCapable)}\n\n`;
}

out += '## Per-route summary (mobile viewports)\n\n';
out += '| Route | Overflow? | Tap <40px | Inputs <16px | Tiny text | Edge-touch | Overlap | Broken img | Clipped | Off-screen |\n';
out += '|---|---|---|---|---|---|---|---|---|---|\n';

const issues = [];
for (const [route, list] of [...byRoute.entries()].sort()) {
  const mob = list.filter((r) => r.isMobile !== false && !r.project?.startsWith('desktop'));
  const anyOverflow = mob.some((r) => r.overflow?.hasHorizontalOverflow);
  const maxTap = Math.max(0, ...mob.map((r) => r.tapTargets?.tooSmall?.length || 0));
  const maxInput = Math.max(0, ...mob.map((r) => r.inputs?.tooSmall?.length || 0));
  const maxTiny = Math.max(0, ...mob.map((r) => r.tinyText?.count || 0));
  const maxEdge = Math.max(0, ...mob.map((r) => r.layout?.edgeTouching?.length || 0));
  const maxOverlap = Math.max(0, ...mob.map((r) => r.layout?.overlappingTargets?.length || 0));
  const maxBroken = Math.max(0, ...mob.map((r) => (r.layout?.brokenImages || []).filter((i) => i.reason === 'failed-to-load').length));
  const maxClipAcc = Math.max(0, ...mob.map((r) => (r.layout?.clippedText || []).filter((c) => c.kind === 'accidental').length));
  const maxClipInt = Math.max(0, ...mob.map((r) => (r.layout?.clippedText || []).filter((c) => c.kind === 'intentional').length));
  const maxOff = Math.max(0, ...mob.map((r) => r.layout?.offScreen?.length || 0));
  out += `| \`${route}\` | ${anyOverflow ? '⚠️ YES' : 'ok'} | ${maxTap || '-'} | ${maxInput ? '⚠️ ' + maxInput : '-'} | ${maxTiny || '-'} | ${maxEdge || '-'} | ${maxOverlap ? '⚠️ ' + maxOverlap : '-'} | ${maxBroken ? '⚠️ ' + maxBroken : '-'} | ${maxClipAcc ? '⚠️ ' + maxClipAcc : (maxClipInt ? maxClipInt + ' (by design)' : '-')} | ${maxOff ? '⚠️ ' + maxOff : '-'} |\n`;

  if (maxBroken > 0) {
    const bi = mob.find((r) => (r.layout?.brokenImages || []).some((i) => i.reason === 'failed-to-load'))?.layout.brokenImages;
    issues.push(`### Broken images on \`${route}\`\n` + bi.filter((i) => i.reason === 'failed-to-load').map((i) => `- ${i.src} (natural ${i.natural})`).join('\n'));
  }
  if (maxOverlap > 0) {
    const ov = mob.find((r) => (r.layout?.overlappingTargets?.length || 0) > 0)?.layout.overlappingTargets;
    issues.push(`### Overlapping tap targets on \`${route}\`\n` + ov.slice(0, 6).map((o) => `- \`${o.a}\` overlaps \`${o.b}\` by ${o.overlap}px`).join('\n'));
  }
  if (maxOff > 0) {
    const of = mob.find((r) => (r.layout?.offScreen?.length || 0) > 0)?.layout.offScreen;
    issues.push(`### Off-screen content on \`${route}\`\n` + of.slice(0, 6).map((o) => `- \`${o.selector}\` left=${o.left} "${o.text}"`).join('\n'));
  }
  if (maxClipAcc > 0) {
    const cl = mob.find((r) => (r.layout?.clippedText || []).some((c) => c.kind === 'accidental'))?.layout.clippedText.filter((c) => c.kind === 'accidental');
    issues.push(`### Accidentally clipped text on \`${route}\` (bug)\n` + cl.slice(0, 6).map((o) => `- \`${o.selector}\` "${o.text}"`).join('\n'));
  }

  if (anyOverflow) {
    const off = mob.find((r) => r.overflow?.hasHorizontalOverflow)?.overflow;
    issues.push(`### Overflow on \`${route}\`\nViewport ${off.viewportWidth}px, document ${off.documentScrollWidth}px.\nOffenders:\n` +
      off.offenders.slice(0, 6).map((o) => `- \`${o.selector}\` right=${o.right} w=${o.width} "${o.text}"`).join('\n'));
  }
  if (maxInput > 0) {
    const inp = mob.find((r) => (r.inputs?.tooSmall?.length || 0) > 0)?.inputs;
    issues.push(`### Inputs <16px on \`${route}\` (iOS zoom-on-focus)\n` +
      inp.tooSmall.map((i) => `- \`${i.selector}\` font-size=${i.fontSize}px type=${i.type}`).join('\n'));
  }
}

out += '\n';
if (issues.length) {
  out += '## Detailed issues\n\n' + issues.join('\n\n') + '\n';
} else {
  out += '_No hard failures (overflow / input-zoom) detected._\n';
}

fs.writeFileSync(path.join(process.cwd(), 'FINDINGS.md'), out);
console.log(out);
