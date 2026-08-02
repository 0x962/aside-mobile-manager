#!/usr/bin/env node
// The minibridge command: run the bridge, or show a pairing code.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const port = Number(process.env.MINIBRIDGE_PORT ?? 4720);
const [command = 'serve'] = process.argv.slice(2);

if (command === 'serve') {
  await import(path.join(root, 'server.mjs'));
} else if (command === 'pair') {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/pair`, {
      method: 'POST',
      body: JSON.stringify({ label: 'minibridge pair' }),
    });
    if (!res.ok) throw new Error(`the bridge answered ${res.status}`);
    console.log('A pairing code is open on this screen. Scan it in the phone app.');
    console.log('The code expires in 3 minutes.');
  } catch (err) {
    console.error(`The bridge is not answering on port ${port}: ${err.message}`);
    console.error('Start it with: brew services start minibridge');
    process.exit(1);
  }
} else if (command === '--version' || command === '-v') {
  console.log(require(path.join(root, 'package.json')).version);
} else {
  console.log('Usage: minibridge [serve|pair|--version]');
  process.exit(command === '--help' || command === '-h' ? 0 : 1);
}
