import fs from 'node:fs';
import path from 'node:path';
import { rootDir } from './paths.js';
import type { RegistryFile, LocalRegistryFile, LocalEntry, RegistryEntry } from './types.js';
import { YoError } from './types.js';

export const DEFAULT_REPO = 'that-yolanda/yo-toolkits';
export const DEFAULT_REF = 'main';

export const LOCAL_DIR = rootDir();
export const LOCAL_REGISTRY_PATH = path.join(LOCAL_DIR, 'registry.local.json');

export function remoteRegistryUrl(repo: string = DEFAULT_REPO, ref: string = DEFAULT_REF): string {
  return `https://raw.githubusercontent.com/${repo}/${ref}/registry.json`;
}

/** 拉取远程 registry.json */
export async function fetchRemoteRegistry(
  repo: string = DEFAULT_REPO,
  ref: string = DEFAULT_REF,
): Promise<RegistryFile> {
  const url = remoteRegistryUrl(repo, ref);
  let res: Response;
  try {
    res = await fetch(url);
  } catch (e) {
    throw new YoError(
      'REGISTRY_FETCH_FAILED',
      `拉取远程 registry 网络错误: ${(e as Error).message}`,
      `检查网络连接: ${url}`,
    );
  }
  if (!res.ok) {
    throw new YoError(
      'REGISTRY_FETCH_FAILED',
      `拉取远程 registry 失败: HTTP ${res.status}`,
      `检查仓库地址与分支: ${url}`,
    );
  }
  return (await res.json()) as RegistryFile;
}

function readLocal(): LocalRegistryFile {
  try {
    const raw = fs.readFileSync(LOCAL_REGISTRY_PATH, 'utf8');
    return JSON.parse(raw) as LocalRegistryFile;
  } catch {
    return { plugins: {} };
  }
}

function writeLocal(data: LocalRegistryFile): void {
  fs.mkdirSync(LOCAL_DIR, { recursive: true });
  fs.writeFileSync(LOCAL_REGISTRY_PATH, JSON.stringify(data, null, 2), 'utf8');
}

/** 列出本地已安装插件 */
export function listLocal(): LocalEntry[] {
  return Object.values(readLocal().plugins);
}

export function getLocal(name: string): LocalEntry | undefined {
  return readLocal().plugins[name];
}

/** 记录一条已安装插件 */
export function addLocal(entry: RegistryEntry, source: string): void {
  const data = readLocal();
  data.plugins[entry.name] = { ...entry, installedAt: new Date().toISOString(), source };
  writeLocal(data);
}

/** 移除一条已安装记录,返回是否曾存在 */
export function removeLocal(name: string): boolean {
  const data = readLocal();
  if (!data.plugins[name]) return false;
  delete data.plugins[name];
  writeLocal(data);
  return true;
}
