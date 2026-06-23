import fs from 'node:fs';
import path from 'node:path';
import { rootDir } from './paths.js';
import type { Store } from './types.js';

const STORE = path.join(rootDir(), 'store');
const TMP = path.join(rootDir(), 'tmp');

/** 插件数据 / 临时目录管理(均在统一根下) */
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
