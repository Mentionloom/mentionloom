import { copyFile, mkdir, rm } from 'node:fs/promises';

const output = new URL('./dist/', import.meta.url);
const files = [
  'index.html',
  'orbit-tokens.css',
  'site.css',
  'product-portal.css',
  'site.js',
  'app/index.html',
  'app/app.css',
  'app/app.js',
  'waitlist.css',
  'waitlist.js',
  'assets/mark.svg',
  'assets/woven-light.png',
  'assets/OpenRunde-Regular.woff2',
  'assets/OpenRunde-Medium.woff2',
  'assets/OpenRunde-Semibold.woff2',
  'assets/OFL.txt',
];

await rm(output, { recursive: true, force: true });
await mkdir(new URL('assets/', output), { recursive: true });
await mkdir(new URL('app/', output), { recursive: true });
await Promise.all(files.map(file => copyFile(new URL(file, import.meta.url), new URL(file, output))));
console.log(`Built ${files.length} public files in dist/.`);
