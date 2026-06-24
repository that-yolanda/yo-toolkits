import fs from 'node:fs';
import path from 'node:path';
import { rootDir } from './paths.js';
import type { Config } from './types.js';

const CONFIG_FILE = path.join(rootDir(), 'config.env');

/** 解析 .env 文件为 Record<string, string>(跳过注释和空行) */
function parseEnv(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    // 去掉首尾引号(单引或双引)
    if ((value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key) result[key] = value;
  }
  return result;
}

/**
 * 配置读写:与 yolanda-skills 共享 $YO_CONFIG_HOME/config.env。
 *
 * get(): process.env 优先(shell source 已导出),再直接解析文件兜底。
 * set(): 写入 config.env(更新已有行或追加新行)。
 */
export class FileConfig implements Config {
  private cache: Record<string, string> | null = null;

  private load(): Record<string, string> {
    if (this.cache) return this.cache;
    try {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
      this.cache = parseEnv(raw);
    } catch {
      this.cache = {};
    }
    return this.cache;
  }

  get(key: string, fallback?: string): string | undefined {
    if (process.env[key] !== undefined) return process.env[key];
    const data = this.load();
    return data[key] ?? fallback;
  }

  set(key: string, value: string): void {
    // 读取原始行,更新或追加
    let lines: string[];
    try {
      lines = fs.readFileSync(CONFIG_FILE, 'utf8').split('\n');
    } catch {
      lines = [''];
    }

    let found = false;
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      if (trimmed.slice(0, eq).trim() === key) {
        lines[i] = `${key}=${value}`;
        found = true;
        break;
      }
    }
    if (!found) {
      if (lines[lines.length - 1] !== '') lines.push('');
      lines.push(`${key}=${value}`);
    }

    fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
    fs.writeFileSync(CONFIG_FILE, lines.join('\n'), 'utf8');

    if (!this.cache) this.cache = {};
    this.cache[key] = value;
  }
}
