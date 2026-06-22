import type { Context } from '@that-yolanda/yo-core';
import { registerVersion } from './version.js';
import { registerList } from './list.js';
import { registerBrowser } from './browser.js';
import { registerAdd } from './add.js';
import { registerRemove } from './remove.js';
import { registerUpdate } from './update.js';

/** 注册所有内置管理命令到共享 cac 实例 */
export function registerManagementCommands(ctx: Context): void {
  registerVersion(ctx);
  registerList(ctx);
  registerBrowser(ctx);
  registerAdd(ctx);
  registerRemove(ctx);
  registerUpdate(ctx);
}
