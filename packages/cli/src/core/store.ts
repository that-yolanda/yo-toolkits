import fs from 'node:fs';
import path from 'node:path';
import { cacheDir, dataDir } from './paths.js';
import type { Store } from './types.js';

const STORE = path.join(dataDir(), 'store');
const TMP = path.join(cacheDir(), 'tmp');

/** 插件数据 / 临时目录管理 */
export class FileSystemStore implements Store {
  dataDir(...segments: string[]): string {
    return path.join(STORE, ...segments);
  }

  tmpDir(...segments: string[]): string {
    return path.join(TMP, ...segments);
  }

  ensureDir(dir: string): void {
    fs.mkdirSync(dir, { recursive: true });
  }
}
