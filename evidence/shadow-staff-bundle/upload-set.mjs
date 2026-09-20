// Read-only: runs firebase-tools' OWN deploy-time file lister (lib/listFiles.js,
// used by lib/deploy/hosting/deploy.js) against each config variant.
import { createRequire } from 'node:module';
const require = createRequire('/usr/local/lib/node_modules/firebase-tools/lib/');
const { listFiles } = require('/usr/local/lib/node_modules/firebase-tools/lib/listFiles.js');
import { readFileSync } from 'node:fs';

for (const variant of process.argv.slice(2)) {
  const cfg = JSON.parse(readFileSync(variant, 'utf8'));
  console.log(`\n### ${variant}`);
  for (const h of cfg.hosting) {
    const files = listFiles(h.public, h.ignore);
    const shadow = files.filter(f => f.startsWith('staff-bundle/'));
    console.log(`  ${h.site || h.target}  public=${h.public}`);
    console.log(`    files uploaded      : ${files.length}`);
    console.log(`    under staff-bundle/ : ${shadow.length}${shadow.length ? '  e.g. ' + shadow.slice(0,2).join(', ') : ''}`);
    console.log(`    index.html present  : ${files.includes('index.html')}`);
  }
}
