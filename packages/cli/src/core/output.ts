import chalk from 'chalk';
import type { Output } from './types.js';

type JsonResult =
  | { ok: true; data: unknown; error: null }
  | { ok: false; data: null; error: { code: string; message: string; suggestion?: string } };

/**
 * 统一输出:
 * - format 'json'(默认):stdout 输出 {ok,data,error},供 agent / 脚本消费
 * - format 'text':彩色人类可读,结果走 stdout、错误走 stderr
 *
 * 进度类信息请用 ctx.log(走 stderr),避免污染 json 模式的 stdout。
 */
export class ConsoleOutput implements Output {
  format: 'json' | 'text';

  constructor(format: 'json' | 'text' = 'json') {
    this.format = format;
  }

  success(data: unknown, message?: string): void {
    if (this.format === 'json') {
      const result: JsonResult = { ok: true, data, error: null };
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
      return;
    }
    if (message) console.log(chalk.green('[OK]') + '    ' + message);
  }

  fail(code: string, message: string, suggestion?: string): never {
    if (this.format === 'json') {
      const result: JsonResult = {
        ok: false,
        data: null,
        error: { code, message, ...(suggestion ? { suggestion } : {}) },
      };
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    } else {
      console.error(chalk.red('[ERROR]') + ' ' + message);
      console.error(chalk.gray('  code: ' + code));
      if (suggestion) console.error(chalk.gray('  → ' + suggestion));
    }
    process.exit(1);
  }
}
