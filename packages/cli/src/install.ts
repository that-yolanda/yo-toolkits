import fs from 'node:fs';
import path from 'node:path';
import type { Spawner } from './core/index.js';

/**
 * 移除 package.json 中的 workspace:* 依赖。
 *
 * store 插件是独立目录(不在 monorepo workspace),`workspace:*` 解析不了,会导致
 * `pnpm install` 整体失败、回退 `npm install` 同样失败,连带真正的运行时依赖
 * (如 sherpa-onnx-node)也装不上 —— 运行时报 `Cannot find module`。
 *
 * 插件运行时零框架依赖(只 `import type`,jiti 擦除;框架能力全走 ctx),故可安全移除。
 */
function stripWorkspaceDeps(dir: string): void {
  const pkgPath = path.join(dir, 'package.json');
  if (!fs.existsSync(pkgPath)) return;
  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch {
    return;
  }
  let changed = false;
  for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    const deps = pkg[section] as Record<string, string> | undefined;
    if (!deps) continue;
    for (const name of Object.keys(deps)) {
      if (String(deps[name]).startsWith('workspace:')) {
        delete deps[name];
        changed = true;
      }
    }
    if (Object.keys(deps).length === 0) delete pkg[section];
  }
  if (changed) {
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  }
}

/** 在目标目录安装 npm 依赖(优先 pnpm,回退 npm)。静默执行,避免污染输出。 */
export async function installDeps(spawn: Spawner, dir: string): Promise<void> {
  // store 插件不在 workspace,先移除 workspace:* 依赖,否则 install 整体失败
  stripWorkspaceDeps(dir);
  const r = await spawn.run(
    'pnpm',
    ['install', '--prod', '--no-frozen-lockfile'],
    { cwd: dir, silent: true },
  );
  if (r.exitCode !== 0) {
    await spawn.run('npm', ['install', '--omit=dev'], { cwd: dir, silent: true });
  }
}
