import { homedir } from 'node:os';
import { join } from 'node:path';

const APP = 'yo';

const isWindows = process.platform === 'win32';

/**
 * 跨平台 XDG 路径。
 * - macOS / Linux:统一用 XDG 规范(~/.config、~/.local/share、~/.cache),读对应 XDG_* 环境变量覆盖
 * - Windows:%APPDATA% / %LOCALAPPDATA%
 */
export function configDir(): string {
  if (isWindows) {
    return join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), APP);
  }
  return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), APP);
}

export function dataDir(): string {
  if (isWindows) {
    return join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), APP);
  }
  return join(process.env.XDG_DATA_HOME ?? join(homedir(), '.local', 'share'), APP);
}

export function cacheDir(): string {
  if (isWindows) {
    return join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), APP);
  }
  return join(process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache'), APP);
}
