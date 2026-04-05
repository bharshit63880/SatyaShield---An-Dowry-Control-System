import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import { env } from './env.js';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFilePath);

export const serverRoot = path.resolve(currentDirectory, '..', '..');
export const uploadsDirectory = path.isAbsolute(env.uploadsDir)
  ? env.uploadsDir
  : path.join(serverRoot, env.uploadsDir);

export async function ensureRuntimeDirectories() {
  await fs.mkdir(uploadsDirectory, { recursive: true });
}
