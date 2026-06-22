import type { Context } from '@that-yolanda/yo-core';
import pkg from '../../package.json';

export function registerVersion(ctx: Context): void {
  ctx.cli
    .command('version', '显示 yo 版本')
    .action(() => {
      ctx.output.success({ version: pkg.version }, `yo v${pkg.version}`);
    });
}
