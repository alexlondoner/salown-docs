// Runs the PROPOSED guard's assertions standalone (no vitest in this archive
// workspace), against any firebase.json variant — including the unpatched one,
// as a firing negative control.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire('/usr/local/lib/node_modules/firebase-tools/lib/');
const { listFiles } = require('/usr/local/lib/node_modules/firebase-tools/lib/listFiles.js');

for (const v of process.argv.slice(2)) {
  const j = JSON.parse(readFileSync(v, 'utf8'));
  const site = (s) => j.hosting.find((h) => h.site === s);
  const set = (s) => listFiles(site(s).public, site(s).ignore);
  const red = (site('salown').redirects ?? [])
    .filter((r) => r.source === '/staff-bundle' || r.source === '/staff-bundle/**')
    .map((r) => `${r.destination}|${r.type}`);
  const checks = {
    'salown ignores staff-bundle/**': (site('salown').ignore ?? []).includes('staff-bundle/**'),
    'salown publishes 0 staff-bundle files': set('salown').filter((f) => f.startsWith('staff-bundle/')).length === 0,
    'salown still publishes index.html': set('salown').includes('index.html'),
    'salown-staff still publishes index.html': set('salown-staff').includes('index.html'),
    'salown-staff still publishes assets/': set('salown-staff').some((f) => f.startsWith('assets/')),
    'both stale paths redirect to staff.salown.com (302)':
      JSON.stringify(red) === JSON.stringify(['https://staff.salown.com/|302', 'https://staff.salown.com/|302']),
    'no permanent (301) redirect': (site('salown').redirects ?? []).every((r) => r.type !== 301),
  };
  const failed = Object.values(checks).filter((v) => !v).length;
  console.log(`\n### ${v}  →  ${failed ? `${failed} FAILING` : 'ALL PASS'}`);
  for (const [name, ok] of Object.entries(checks)) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
}
