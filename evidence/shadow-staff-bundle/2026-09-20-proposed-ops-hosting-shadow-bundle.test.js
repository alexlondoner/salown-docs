import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sync as globSync } from 'glob';
import { describe, expect, it } from 'vitest';

// SHADOW-STAFF-BUNDLE — `salown.com/staff-bundle/**` must never be a second,
// unversioned entry point to the Staff app.
//
// `hosting/staff-bundle/` is the Staff site's own public root AND a tracked
// build artefact sitting inside the directory the `salown` site publishes whole.
// Until 2026-09-20 that made https://salown.com/staff-bundle/index.html a live
// 200 serving a Staff build older than STAFF-AVAIL-GAP Phase 1+2: it carried no
// `salownCreateStaffWalkIn`/`salownCreateStaffBooking` and called the legacy,
// unenforced `salownCreateWalkIn` instead. Nobody deployed it on purpose — the
// `salown-staff` predeploy hook rebuilds it on EVERY hosting deploy (firebase-tools
// filters predeploy configs by `config.target`, and these configs declare `site`,
// so no `--only` can exclude one), and the `salown` upload then carries it along.
//
// The fix is config, so the guard is config: the publish set of the `salown`
// site must contain no `staff-bundle/` file, the Staff site's own publish set
// must be unaffected, and the stale path must redirect to the real Staff site.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const firebaseJson = JSON.parse(readFileSync(resolve(ROOT, 'firebase.json'), 'utf8'));
const siteConfig = (site) => firebaseJson.hosting.find((h) => h.site === site);

/**
 * The exact upload set firebase-tools would compute. Mirrors `listFiles()`
 * (lib/listFiles.js), which `deploy/hosting/deploy.js` calls with the site's
 * own `ignore` list — the `ignore` key is an UPLOAD filter, so nothing else
 * (including the hosting emulator) can be used to prove this.
 */
const publishSet = (site) => {
  const config = siteConfig(site);
  return globSync('**/*', {
    cwd: resolve(ROOT, config.public),
    dot: true,
    follow: true,
    ignore: ['**/firebase-debug.log', '**/firebase-debug.*.log', '.firebase/*'].concat(config.ignore ?? []),
    nodir: true,
    posix: true,
  });
};

describe('the salown site never publishes the Staff bundle', () => {
  it('ignores staff-bundle/** on the salown target', () => {
    expect(siteConfig('salown').ignore).toContain('staff-bundle/**');
  });

  it('publishes no staff-bundle file at all', () => {
    expect(publishSet('salown').filter((f) => f.startsWith('staff-bundle/'))).toEqual([]);
  });

  it('still publishes the landing page — the ignore rule is not over-broad', () => {
    expect(publishSet('salown')).toContain('index.html');
  });
});

describe('the Staff site is untouched by that rule', () => {
  it('still publishes its own entry point', () => {
    expect(publishSet('salown-staff')).toContain('index.html');
  });

  it('publishes a bundle, not an empty directory', () => {
    expect(publishSet('salown-staff').some((f) => f.startsWith('assets/'))).toBe(true);
  });
});

describe('the stale path redirects instead of 404-ing', () => {
  const redirects = siteConfig('salown').redirects ?? [];
  const destinations = redirects
    .filter((r) => r.source === '/staff-bundle' || r.source === '/staff-bundle/**')
    .map((r) => `${r.destination}|${r.type}`);

  it('sends both the bare path and everything under it to the real Staff site', () => {
    expect(destinations).toEqual(['https://staff.salown.com/|302', 'https://staff.salown.com/|302']);
  });

  it('keeps the redirect temporary, so a rollback is not cached in browsers forever', () => {
    for (const r of redirects) expect(r.type).not.toBe(301);
  });
});
