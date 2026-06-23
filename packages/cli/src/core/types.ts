import type { CAC } from 'cac';
import type { HelpSpec } from './help.js';

/**
 * 插件契约:每个插件 default export 一个此对象。
 * register() 内用 ctx.cli 注册子命令,用 ctx.* 调用框架能力。
 */
export interface Command {
  /** 插件名,即子命令名(如 wiki / gif);同时作 registry key 与 loader 去重依据 */
  name: string;
  /** 版本号;registry.json / list / browser 展示的唯一来源 */
  version: string;
  /** 一句话描述;子命令 help 首行 + registry / list / browser 展示 */
  description: string;
  /** 外部系统依赖(如 ffmpeg / rg);生成 registry.json 的 deps,运行时由 ctx.spawn.assertDeps 检查 */
  deps?: string[];
  /** 所需环境变量 / 配置项(如 WIKI_DIR);生成 registry.json 的 env,供 config.env.example 参考 */
  env?: string[];
  register(ctx: Context): void | Promise<void>;
}

/** 注入给插件 register() 的运行时上下文 */
export interface Context {
  /** 共享 cac 实例,插件用它注册子命令 */
  cli: CAC;
  /** 统一输出(彩色 / JSON) */
  output: Output;
  /** 彩色日志 */
  log: Logger;
  /** 跨平台外部命令调用 */
  spawn: Spawner;
  /** 环境变量 / 配置读写 */
  config: Config;
  /** 插件数据目录 */
  store: Store;
  /** 当前工作目录 */
  cwd: string;
  /** 渲染标准帮助(插件覆写 command.outputHelp 时用;走 ctx 而非 import 框架,保证 store 加载零依赖) */
  renderHelp(spec: HelpSpec): string;
}

export interface Output {
  /** 输出格式:json(默认,机器可读) 或 text(彩色人类可读) */
  format: 'json' | 'text';
  /** 成功输出 */
  success(data: unknown, message?: string): void;
  /** 失败输出并退出(退出码 1) */
  fail(code: string, message: string, suggestion?: string): never;
}

export interface Logger {
  info(message: string): void;
  ok(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export interface SpawnOptions {
  cwd?: string;
  env?: Record<string, string>;
  /** 静默:不打印 "执行: ..." 日志 */
  silent?: boolean;
}

export interface SpawnResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface Spawner {
  /** 执行外部命令;命令不存在时抛 COMMAND_NOT_FOUND */
  run(cmd: string, args: string[], opts?: SpawnOptions): Promise<SpawnResult>;
  /** 同步检查命令是否在 PATH 中 */
  exists(cmd: string): boolean;
  /** 批量检查依赖,缺失则抛 DEPENDENCY_MISSING(带安装建议) */
  assertDeps(cmds: string[]): void;
}

export interface Config {
  /** 读取:优先 process.env(兼容旧脚本 WIKI_DIR 等),再 ~/.yo/config.json */
  get(key: string, fallback?: string): string | undefined;
  /** 写入 ~/.yo/config.json */
  set(key: string, value: string): void;
}

export interface Store {
  /** 插件数据目录: ~/.yo/store/<plugin>/... */
  dataDir(...segments: string[]): string;
  /** 临时目录: ~/.yo/tmp/... */
  tmpDir(...segments: string[]): string;
  /** 确保目录存在(recursive) */
  ensureDir(dir: string): void;
}

/** registry.json(远程, 仓库根) 条目 */
export interface RegistryEntry {
  name: string;
  version: string;
  description: string;
  /** 仓库内子目录,如 packages/plugins/wiki */
  subdir: string;
  /** 外部系统依赖,如 ffmpeg / rg */
  deps?: string[];
  /** 需要的配置项,如 WIKI_DIR */
  env?: string[];
}

/** registry.local.json(本地已安装记录) 条目 */
export interface LocalEntry extends RegistryEntry {
  installedAt: string;
  /** 来源 git ref / sha */
  source: string;
}

/** 远程 registry.json 文件结构 */
export interface RegistryFile {
  version: string;
  repo: string;
  plugins: Record<string, RegistryEntry>;
}

/** 本地 registry.local.json 文件结构 */
export interface LocalRegistryFile {
  plugins: Record<string, LocalEntry>;
}

/** loader 加载结果 */
export interface LoadedPlugin {
  plugin: Command;
  source: 'workspace' | 'store';
  path: string;
}

/** 自定义错误:携带 code / suggestion,供 Output 渲染为 JSON error */
export class YoError extends Error {
  code: string;
  suggestion?: string;
  constructor(code: string, message: string, suggestion?: string) {
    super(message);
    this.name = 'YoError';
    this.code = code;
    this.suggestion = suggestion;
  }
}
