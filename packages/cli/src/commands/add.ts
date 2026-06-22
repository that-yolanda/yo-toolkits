import path from 'node:path';
import os from 'node:os';
import type { Context } from '../core/index.js';
import { fetchRemoteRegistry, fetchSubdir, addLocal } from '../core/index.js';
import { installDeps } from '../install.js';

export function registerAdd(ctx: Context): void {
  ctx.cli
    .command('add <name>', '从 GitHub 安装一个插件命令')
    .action(async (name: string) => {
      ctx.log.info('查询远程 registry...');
      const registry = await fetchRemoteRegistry();
      const entry = registry.plugins[name];
      if (!entry) {
        ctx.output.fail(
          'PLUGIN_NOT_FOUND',
          `registry 中找不到插件: ${name}`,
          '运行 yo browser 查看可用插件',
        );
      }

      const dest = path.join(os.homedir(), '.yo', 'store', name);
      ctx.log.info(`从 GitHub 拉取 ${registry.repo}/${entry.subdir} ...`);
      await fetchSubdir(registry.repo, entry.subdir, dest, { force: true });

      ctx.log.info('安装依赖...');
      await installDeps(ctx.spawn, dest);

      if (entry.deps?.length) {
        ctx.spawn.assertDeps(entry.deps);
      }

      addLocal(entry, `github:${registry.repo}`);
      ctx.output.success(
        { name, version: entry.version, path: dest },
        `已安装 ${name}@${entry.version}`,
      );
    });
}
