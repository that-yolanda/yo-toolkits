import chalk from 'chalk';
import type { Output } from './types.js';

type JsonResult =
  | { ok: true; data: unknown; error: null }
  | { ok: false; data: null; error: { code: string; message: string; suggestion?: string } };

/** 统一输出:默认彩色人类可读,--json 时输出结构化 {ok,data,error} */
export class ConsoleOutput implements Output {
  isJson: boolean;

  constructor(isJson = false) {
    this.isJson = isJson;
  }

  success(data: unknown, message?: string): void {
    if (this.isJson) {
      const result: JsonResult = { ok: true, data, error: null };
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    if (message) console.log(chalk.green('[OK]') + '    ' + message);
    if (data !== undefined && data !== null) console.log(data);
  }

  fail(code: string, message: string, suggestion?: string): never {
    if (this.isJson) {
      const result: JsonResult = {
        ok: false,
        data: null,
        error: { code, message, ...(suggestion ? { suggestion } : {}) },
      };
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.error(chalk.red('[ERROR]') + ' ' + message);
      console.error(chalk.gray('  code: ' + code));
      if (suggestion) console.error(chalk.gray('  → ' + suggestion));
    }
    process.exit(1);
  }
}
