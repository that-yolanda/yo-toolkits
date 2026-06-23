import type { Context } from './core/index.js';
import { createContext, loadPlugins, YoError } from './core/index.js';
import { registerManagementCommands } from './commands/index.js';

type Format = 'json' | 'text';

/** 内置管理命令名(用于 help 分组:管理 vs 插件) */
const MANAGEMENT_NAMES = new Set(['version', 'list', 'browser', 'add', 'remove', 'update']);

/** 从 argv 提取并剥离 -f/--format/--json(默认 'json') */
function extractFormat(argv: string[]): { format: Format; rest: string[] } {
  let format: Format = 'json';
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') {
      format = 'json';
      continue;
    }
    if (a === '-f' || a === '--format') {
      const v = argv[i + 1];
      if (v === 'text' || v === 'json') {
        format = v;
        i++;
      }
      continue;
    }
    if (a.startsWith('--format=')) {
      format = a.slice(9) === 'text' ? 'text' : 'json';
      continue;
    }
    if (a.startsWith('-f=')) {
      format = a.slice(3) === 'text' ? 'text' : 'json';
      continue;
    }
    rest.push(a);
  }
  return { format, rest };
}

/** 自定义 help:管理命令 / 插件命令分组,去掉 cac 默认的 "For more info" 罗列 */
function buildHelpSections(ctx: Context): Array<{ title?: string; body: string }> {
  const cmds = ctx.cli.commands as unknown as Array<{
    name: string;
    rawName: string;
    description: string;
  }>;
  const mgmt = cmds.filter((c) => MANAGEMENT_NAMES.has(c.name));
  const plugins = cmds.filter((c) => !MANAGEMENT_NAMES.has(c.name));

  const render = (cs: typeof cmds): string => {
    if (cs.length === 0) return '  (无)';
    const w = cs.reduce((m, c) => Math.max(m, c.rawName.length), 0);
    return cs.map((c) => `  ${c.rawName.padEnd(w + 2)}${c.description}`).join('\n');
  };

  const sections: Array<{ title?: string; body: string }> = [
    { body: 'yo — 个人 CLI 工具集合' },
    { title: 'Usage', body: '  $ yo <command> [options]' },
  ];
  if (mgmt.length) sections.push({ title: 'Commands', body: render(mgmt) });
  if (plugins.length) sections.push({ title: 'Plugins', body: render(plugins) });
  sections.push({
    title: 'Options',
    body: '  -f, --format <json|text>  输出格式(默认 json)\n  -h, --help                显示帮助',
  });
  return sections;
}

/**
 * CLI 装配入口:
 * 1. 构造 Context(按 -f/--format 决定输出模式,默认 json)
 * 2. 注册管理命令(version/list/add/remove/browser/update)
 * 3. 加载并注册插件命令(workspace 优先,store 次之)
 * 4. 交给 cac 解析 argv
 */
export async function bootstrap(argv: string[]): Promise<void> {
  const { format, rest: cleanedArgv } = extractFormat(argv);

  const ctx = createContext({ format });
  // 自定义 help(分组 + 去 "For more info");callback 延迟执行,届时插件已加载
  // 全局 --help 自定义分组;子命令 --help 用 cac 默认(该命令自身 options)
  ctx.cli.help((sections) => {
    // 全局 --help 自定义分组;子命令 --help 透传 cac(含 .usage() 设的 Usage),仅把首行 name 换成 description
    const cmd = ctx.cli.matchedCommand;
    if (cmd) {
      if (cmd.description && sections[0]) sections[0] = { body: cmd.description };
      return sections;
    }
    return buildHelpSections(ctx);
  });

  // 兜底 async action 内抛出的错误(统一渲染为 error)
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
