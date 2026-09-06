import { mkdir } from 'node:fs/promises';

await mkdir(new URL('../build/', import.meta.url), { recursive: true });
