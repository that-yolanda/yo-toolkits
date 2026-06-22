import type { Context } from '@that-yolanda/yo-core';
import { fetchRemoteRegistry, listLocal } from '@that-yolanda/yo-core';

export function registerBrowser(ctx: Context): void {
  ctx.cli
    .command('browser', '浏览 GitHub 上可用的插件命令')
    .action(async () => {
      ctx.log.info('拉取远程 registry...');
      const registry = await fetchRemoteRegistry();
      const installed = new Set(listLocal().map((p) => p.name));
      const entries = Object.values(registry.plugins);
      const data = entries.map((e) => ({ ...e, installed: installed.has(e.name) }));

      if (ctx.output.isJson) {
        ctx.output.success({ repo: registry.repo, plugins: data });
        return;
      }
      if (entries.length === 0) {
        ctx.log.warn('registry 为空');
        return;
      }
      ctx.log.info(`可用插件 (${registry.repo}):`);
      for (const e of data) {
        const tag = e.installed ? '[已装]' : '[可装]';
        console.log(`  ${tag} ${e.name}@${e.version}  ${e.description}`);
      }
    });
}
