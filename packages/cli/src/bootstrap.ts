import type { Context } from './core/index.js';
import { createContext, loadPlugins, YoError } from './core/index.js';
import { registerManagementCommands } from './commands/index.js';

/**
 * CLI 装配入口:
 * 1. 构造 Context(按 --json 决定输出模式)
 * 2. 注册管理命令(version/list/add/remove/browser/update)
 * 3. 加载并注册插件命令(workspace 优先,store 次之)
 * 4. 交给 cac 解析 argv
 */
export async function bootstrap(argv: string[]): Promise<void> {
  // --json 可出现在任意位置,预先剥离以免 cac 报未知选项
  const isJson = argv.includes('--json');
  const cleanedArgv = argv.filter((a) => a !== '--json');

  const ctx = createContext({ isJson });
  // cac 默认 showHelpOnExit=false,需显式 help() 才输出 --help;
  // 同时把 --help 注册为全局选项,使各子命令也支持 `yo <cmd> --help`
  ctx.cli.help();

  // 兜底 async action 内抛出的错误(统一渲染为 JSON error)
  process.on('unhandledRejection', (err) => handleError(err, ctx));
  process.on('uncaughtException', (err) => handleError(err, ctx));

  registerManagementCommands(ctx);

  const plugins = await loadPlugins();
  for (const { plugin } of plugins) {
    try {
      await plugin.register(ctx);
    } catch (err) {
      ctx.log.error(`插件 ${plugin.name} 注册失败: ${(err as Error).message}`);
    }
  }

  try {
    ctx.cli.parse(cleanedArgv);
  } catch (err) {
    handleError(err, ctx);
  }
}

function handleError(err: unknown, ctx: Context): never {
  if (err instanceof YoError) {
    ctx.output.fail(err.code, err.message, err.suggestion);
  }
  const message = err instanceof Error ? err.message : '发生未知错误';
  ctx.output.fail('UNKNOWN_ERROR', message);
}
