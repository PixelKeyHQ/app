import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const release = join(dirname(fileURLToPath(import.meta.url)), 'release');
for (const name of readdirSync(release)) {
  if (!/\.(dmg|exe|deb)$/.test(name)) continue;
  const hash = createHash('sha256').update(readFileSync(join(release, name))).digest('hex');
  writeFileSync(join(release, `${name}.sha256`), `${hash}  ${name}\n`);
}
