// Read-only: runs firebase-tools' OWN predeploy dispatcher (lib/deploy/lifecycleHooks.js)
// with the real hook commands replaced by a harmless echo, to observe WHICH hosting
// configs fire under `--only hosting:salown`. No network, no deploy, no build.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire('/usr/local/lib/node_modules/firebase-tools/lib/');
const { lifecycleHooks } = require('/usr/local/lib/node_modules/firebase-tools/lib/deploy/lifecycleHooks.js');

const [variant, only] = process.argv.slice(2);
const cfg = JSON.parse(readFileSync(variant, 'utf8'));
const hosting = cfg.hosting.map(h => ({ ...h, predeploy: [`echo "    HOOK FIRED -> ${h.site || h.target} (${h.predeploy[0]})"`] }));

const options = {
  only,
  projectId: 'havuz-44f70',
  project: 'havuz-44f70',
  projectRoot: process.cwd(),
  config: { get: (k) => (k === 'hosting' ? hosting : undefined), projectDir: process.cwd(), path: (p) => p },
};
console.log(`\n### ${variant}   --only ${only}`);
await lifecycleHooks('hosting', 'predeploy')({}, options);
