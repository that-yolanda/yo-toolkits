import { homedir } from 'node:os';
import { join } from 'node:path';

const APP = 'yo';
const isWindows = process.platform === 'win32';

/**
 * 统一根目录:所有 yo 数据(store / registry.local.json / tmp)与 yolanda-skills
 * 的配置(config.env / music.md 等)都归口于此,便于查找、备份、迁移。
 * 与 skills 的 YO_CONFIG_HOME 默认值保持一致。
 *
 * 优先级:YO_CONFIG_HOME > XDG_DATA_HOME > 默认
 * - macOS / Linux: ~/.local/share/yo
 * - Windows:       %LOCALAPPDATA%\yo
 */
export function rootDir(): string {
  if (isWindows) {
    return join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), APP);
  }
  const base = process.env.YO_CONFIG_HOME
    ?? process.env.XDG_DATA_HOME
    ?? join(homedir(), '.local', 'share');
  return join(base, APP);
}
