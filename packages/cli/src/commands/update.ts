import path from 'node:path';
import os from 'node:os';
import type { Context } from '../core/index.js';
import { listLocal, fetchRemoteRegistry, fetchSubdir, addLocal } from '../core/index.js';
import { installDeps } from '../install.js';

export function registerUpdate(ctx: Context): void {
  ctx.cli
    .command('update [name]', '升级插件(name 省略则升级所有已安装插件)')
    .action(async (name?: string) => {
      const installed = listLocal();
      if (installed.length === 0) {
        ctx.output.success({ updated: [] }, '没有已安装的插件可升级');
        return;
      }

      const registry = await fetchRemoteRegistry();
      const targets = name ? installed.filter((p) => p.name === name) : installed;
      if (name && targets.length === 0) {
        ctx.output.fail('PLUGIN_NOT_INSTALLED', `未安装的插件: ${name}`);
      }

      const updated: string[] = [];
      for (const p of targets) {
        const entry = registry.plugins[p.name];
        if (!entry) {
          ctx.log.warn(`${p.name}: registry 中已不存在,跳过`);
          continue;
        }
        const dest = path.join(os.homedir(), '.yo', 'store', p.name);
        ctx.log.info(`更新 ${p.name}...`);
        await fetchSubdir(registry.repo, entry.subdir, dest, { force: true });
        await installDeps(ctx.spawn, dest);
        addLocal(entry, `github:${registry.repo}`);
        updated.push(p.name);
      }

      ctx.log.info('提示:升级 yo 本体请运行  npm i -g @that-yolanda/yo-toolkits@latest');
      ctx.output.success({ updated }, `已更新 ${updated.length} 个插件`);
    });
}
