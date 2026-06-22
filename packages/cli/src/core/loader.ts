import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createJiti } from 'jiti';
import type { Command, LoadedPlugin } from './types.js';
import { listLocal } from './registry.js';

// 单例 jiti 实例:运行时把插件 TS 源码转译并 import
const jiti = createJiti(import.meta.url);

/** 向上查找 monorepo 根(含 pnpm-workspace.yaml + packages/plugins) */
function findMonorepoRoot(start: string): string | null {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    const hasWs = fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'));
    const hasPlugins = fs.existsSync(path.join(dir, 'packages', 'plugins'));
    if (hasWs && hasPlugins) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

async function loadFromEntry(absPath: string): Promise<Command> {
  const mod = (await jiti.import(absPath)) as { default?: Command };
  const plugin = mod.default;
  if (!plugin || typeof plugin.register !== 'function') {
    throw new Error(`插件入口未导出合法 Command: ${absPath}`);
  }
  return plugin;
}

/** dev 模式:加载 packages/plugins/* 下的 workspace 插件源码 */
async function loadWorkspace(root: string): Promise<LoadedPlugin[]> {
  const pluginsDir = path.join(root, 'packages', 'plugins');
  const results: LoadedPlugin[] = [];
  let entries: string[] = [];
  try {
    entries = fs.readdirSync(pluginsDir);
  } catch {
    return results;
  }
  for (const name of entries) {
    const entry = path.join(pluginsDir, name, 'index.ts');
    if (!fs.existsSync(entry)) continue;
    try {
      const plugin = await loadFromEntry(entry);
      results.push({ plugin, source: 'workspace', path: entry });
    } catch (err) {
      console.error(`[loader] 加载 workspace 插件 ${name} 失败: ${(err as Error).message}`);
    }
  }
  return results;
}

/** prod 模式:加载 ~/.yo/store/* 下已安装插件 */
async function loadStore(): Promise<LoadedPlugin[]> {
  const results: LoadedPlugin[] = [];
  for (const entry of listLocal()) {
    const absPath = path.join(os.homedir(), '.yo', 'store', entry.name, 'index.ts');
    if (!fs.existsSync(absPath)) continue;
    try {
      const plugin = await loadFromEntry(absPath);
      results.push({ plugin, source: 'store', path: absPath });
    } catch (err) {
      console.error(`[loader] 加载已装插件 ${entry.name} 失败: ${(err as Error).message}`);
    }
  }
  return results;
}

/**
 * 加载全部插件。dev 模式(workspace)优先:同名插件 workspace 覆盖 store,
 * 便于在 monorepo 内直接改源码调试。
 */
export async function loadPlugins(cwd: string = process.cwd()): Promise<LoadedPlugin[]> {
  const root = findMonorepoRoot(cwd);
  const workspace = root ? await loadWorkspace(root) : [];
  const store = await loadStore();

  const byName = new Map<string, LoadedPlugin>();
  for (const p of store) byName.set(p.plugin.name, p);
  for (const p of workspace) byName.set(p.plugin.name, p); // dev 覆盖
  return [...byName.values()];
}
