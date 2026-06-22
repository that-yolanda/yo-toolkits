import type { Spawner } from '@that-yolanda/yo-core';

/** 在目标目录安装 npm 依赖(优先 pnpm,回退 npm)。静默执行,避免污染输出。 */
export async function installDeps(spawn: Spawner, dir: string): Promise<void> {
  const r = await spawn.run(
    'pnpm',
    ['install', '--prod', '--no-frozen-lockfile'],
    { cwd: dir, silent: true },
  );
  if (r.exitCode !== 0) {
    await spawn.run('npm', ['install', '--omit=dev'], { cwd: dir, silent: true });
  }
}
