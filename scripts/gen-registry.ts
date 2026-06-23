/**
 * 从 packages/plugins/<name>/index.ts 的 Command 派生 registry.json,
 * 并把 Command.version 同步回各插件 package.json。
 *
 * 用法:
 *   pnpm gen:registry     生成(写盘)
 *   pnpm check:registry   校验(不写盘,不一致则退出 1,CI 用)
 *
 * 设计:index.ts 是 name/version/description/deps/env 的唯一来源;
 * registry.json 是派生物(browser/add 远程拉取它),不再手写。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLUGINS_DIR = path.join(ROOT, 'packages', 'plugins');
const REGISTRY_PATH = path.join(ROOT, 'registry.json');

/** registry.json 文件格式版本(与插件版本无关) */
const REGISTRY_VERSION = '1.0.0';
const DEFAULT_REPO = 'that-yolanda/yo-toolkits';

interface CommandLike {
  name: string;
  version: string;
  description: string;
  deps?: string[];
  env?: string[];
  register: unknown;
}

interface RegistryEntry {
  name: string;
  version: string;
  description: string;
  subdir: string;
  deps?: string[];
  env?: string[];
}

interface RegistryFile {
  version: string;
  repo: string;
  plugins: Record<string, RegistryEntry>;
}

function listPluginDirs(): string[] {
  const entries = fs.readdirSync(PLUGINS_DIR, { withFileTypes: true });
  return entries
    .filter((e: fs.Dirent) => e.isDirectory())
    .map((e: fs.Dirent) => e.name)
    .sort();
}

async function loadCommand(name: string): Promise<CommandLike> {
  const entry = path.join(PLUGINS_DIR, name, 'index.ts');
  if (!fs.existsSync(entry)) throw new Error(`插件 ${name} 缺少 index.ts`);
  // tsx 运行时已注册 .ts loader,直接动态 import 即可,无需 jiti
  const mod = (await import(pathToFileURL(entry).href)) as { default?: CommandLike };
  const cmd = mod.default;
  if (!cmd || typeof cmd.register !== 'function') {
    throw new Error(`插件 ${name} 未导出合法 Command(需 default export 含 register)`);
  }
  if (!cmd.name || !cmd.version || !cmd.description) {
    throw new Error(`插件 ${name} 缺少 name/version/description`);
  }
  return cmd;
}

function buildRegistry(cmds: CommandLike[]): RegistryFile {
  const plugins: Record<string, RegistryEntry> = {};
  for (const cmd of cmds) {
    const entry: RegistryEntry = {
      name: cmd.name,
      version: cmd.version,
      description: cmd.description,
      subdir: `packages/plugins/${cmd.name}`,
    };
    if (cmd.deps?.length) entry.deps = cmd.deps;
    if (cmd.env?.length) entry.env = cmd.env;
    plugins[cmd.name] = entry;
  }
  return { version: REGISTRY_VERSION, repo: DEFAULT_REPO, plugins };
}

/** 稳定序列化:plugins 按 name 排序,避免无意义 diff */
function serialize(file: RegistryFile): string {
  const sorted: Record<string, RegistryEntry> = {};
  for (const k of Object.keys(file.plugins).sort()) sorted[k] = file.plugins[k];
  return JSON.stringify({ ...file, plugins: sorted }, null, 2) + '\n';
}

async function main(): Promise<void> {
  const check = process.argv.includes('--check');
  const dirs = listPluginDirs();
  const cmds = await Promise.all(dirs.map(loadCommand));
  const serialized = serialize(buildRegistry(cmds));

  let drift = false;

  // 1. registry.json:与 index.ts 派生内容比对
  const existing = fs.existsSync(REGISTRY_PATH) ? fs.readFileSync(REGISTRY_PATH, 'utf8') : '';
  if (existing !== serialized) {
    if (check) {
      console.error('[check] registry.json 与 index.ts 不一致,请运行 pnpm gen:registry');
      drift = true;
    } else {
      fs.writeFileSync(REGISTRY_PATH, serialized, 'utf8');
      console.log(`[gen] 已生成 registry.json(${cmds.length} 个插件)`);
    }
  }

  // 2. 各插件 package.json.version:唯一来源是 Command.version
  for (const cmd of cmds) {
    const pkgPath = path.join(PLUGINS_DIR, cmd.name, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { version?: string };
    if (pkg.version !== cmd.version) {
      if (check) {
        console.error(`[check] ${cmd.name}/package.json version(${pkg.version}) ≠ index.ts(${cmd.version})`);
        drift = true;
      } else {
        pkg.version = cmd.version;
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
        console.log(`[gen] 同步 ${cmd.name}/package.json version → ${cmd.version}`);
      }
    }
  }

  if (check && drift) {
    console.error('[check] 检测到漂移,请运行 pnpm gen:registry 后重新提交');
    process.exit(1);
  }
  if (check) console.log('[check] registry.json 与各插件 package.json 均与 index.ts 一致');
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
