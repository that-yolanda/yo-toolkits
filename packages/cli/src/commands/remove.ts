import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import type { Context } from '../core/index.js';
import { removeLocal } from '../core/index.js';

export function registerRemove(ctx: Context): void {
  ctx.cli
    .command('remove <name>', '删除本地已安装的插件命令')
    .alias('rm')
    .action((name: string) => {
      const dest = path.join(os.homedir(), '.yo', 'store', name);
      const removed = removeLocal(name);
      let removedFiles = false;
      if (fs.existsSync(dest)) {
        fs.rmSync(dest, { recursive: true, force: true });
        removedFiles = true;
      }
      if (!removed && !removedFiles) {
        ctx.output.fail('PLUGIN_NOT_INSTALLED', `未安装的插件: ${name}`);
      }
      ctx.output.success({ name }, `已删除 ${name}`);
    });
}
