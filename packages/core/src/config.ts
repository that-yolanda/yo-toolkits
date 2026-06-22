import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { Config } from './types.js';

const CONFIG_DIR = path.join(os.homedir(), '.yo');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

/** 配置读写:优先 process.env(兼容旧脚本),再 ~/.yo/config.json */
export class FileConfig implements Config {
  private cache: Record<string, string> | null = null;

  private load(): Record<string, string> {
    if (this.cache) return this.cache;
    try {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
      this.cache = JSON.parse(raw) as Record<string, string>;
    } catch {
      this.cache = {};
    }
    return this.cache;
  }

  private save(data: Record<string, string>): void {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2), 'utf8');
    this.cache = data;
  }

  get(key: string, fallback?: string): string | undefined {
    if (process.env[key] !== undefined) return process.env[key];
    const data = this.load();
    return data[key] ?? fallback;
  }

  set(key: string, value: string): void {
    const data = this.load();
    data[key] = value;
    this.save(data);
  }
}
