import type { Context } from '@that-yolanda/yo-core';
import { listLocal } from '@that-yolanda/yo-core';

export function registerList(ctx: Context): void {
  ctx.cli
    .command('list', '列出本地已安装的插件命令')
    .alias('ls')
    .action(() => {
      const installed = listLocal();
      const data = installed.map((p) => ({
        name: p.name,
        version: p.version,
        description: p.description,
        installedAt: p.installedAt,
      }));

      if (ctx.output.isJson) {
        ctx.output.success({ plugins: data });
        return;
      }
      if (data.length === 0) {
        ctx.log.warn('尚未安装任何插件,运行 yo browser 查看可用插件');
        return;
      }
      ctx.log.info('已安装插件:');
      for (const p of data) {
        console.log(`  ${p.name}@${p.version}  ${p.description}`);
      }
    });
}
