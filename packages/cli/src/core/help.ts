/**
 * 统一帮助渲染:所有插件覆写 command.outputHelp = () => renderHelp(spec),
 * 得到一致的 description / Usage / Commands / Options / ENV 格式。
 *
 * 通用选项 -f / -h 由 COMMON_OPTIONS 自动追加到每个命令的 Options 末尾。
 */

export interface HelpOption {
  /** 选项标志,如 '-l, --limit <n>' */
  flags: string;
  /** 说明 */
  desc: string;
}

export interface HelpCommand {
  /** 子命令名(含参数占位),如 'search [keywords...]' */
  name: string;
  desc: string;
}

export interface HelpEnv {
  /** 环境变量名,如 'WIKI_DIR' */
  name: string;
  desc: string;
}

export interface HelpSpec {
  /** 命令描述(help 首行,必须) */
  description: string;
  /** 用法(不含 bin 前缀,渲染器自动加 '$ yo ',必须) */
  usage: string;
  /** 业务选项(通用 -f/-h 自动追加在末尾) */
  options?: HelpOption[];
  /** 子命令列表(有子命令时用,如 wiki) */
  commands?: HelpCommand[];
  /** 依赖的环境变量 */
  env?: HelpEnv[];
}

/** 通用选项,自动追加到每个命令的 Options 末尾 */
export const COMMON_OPTIONS: HelpOption[] = [
  { flags: '-f, --format <json|text>', desc: '输出格式(默认 json)' },
  { flags: '-h, --help', desc: '显示帮助' },
];

function padEnd(str: string, len: number): string {
  return str + ' '.repeat(Math.max(0, len - str.length));
}

/** 渲染标准帮助文本(无尾随换行,调用方按需补 \n) */
export function renderHelp(spec: HelpSpec): string {
  const lines: string[] = [spec.description, '', 'Usage:', `  $ yo ${spec.usage}`];

  if (spec.commands?.length) {
    const w = Math.max(...spec.commands.map((c) => c.name.length));
    lines.push('', 'Commands:');
    for (const c of spec.commands) lines.push(`  ${padEnd(c.name, w)}  ${c.desc}`);
  }

  const allOpts = [...(spec.options ?? []), ...COMMON_OPTIONS];
  const w = Math.max(...allOpts.map((o) => o.flags.length));
  lines.push('', 'Options:');
  for (const o of allOpts) lines.push(`  ${padEnd(o.flags, w)}  ${o.desc}`);

  if (spec.env?.length) {
    const ew = Math.max(...spec.env.map((e) => e.name.length));
    lines.push('', 'ENV:');
    for (const e of spec.env) lines.push(`  ${padEnd(e.name, ew)}  ${e.desc}`);
  }

  return lines.join('\n');
}
