import { cac } from 'cac';
import type { CAC } from 'cac';
import type { Context } from './types.js';
import { ConsoleLogger } from './logger.js';
import { ConsoleOutput } from './output.js';
import { ProcessSpawner } from './spawn.js';
import { FileConfig } from './config.js';
import { FileSystemStore } from './store.js';
import { renderHelp } from './help.js';

export interface CreateContextOptions {
  /** 输出格式,默认 'json' */
  format?: 'json' | 'text';
  cwd?: string;
  /** 注入自定义 cac 实例(测试用) */
  cli?: CAC;
}

/** 装配 Context:把各子系统组合成注入给插件的运行时上下文 */
export function createContext(opts: CreateContextOptions = {}): Context {
  const log = new ConsoleLogger();
  return {
    cli: opts.cli ?? cac('yo'),
    output: new ConsoleOutput(opts.format ?? 'json'),
    log,
    spawn: new ProcessSpawner(log),
    config: new FileConfig(),
    store: new FileSystemStore(),
    cwd: opts.cwd ?? process.cwd(),
    renderHelp,
  };
}
