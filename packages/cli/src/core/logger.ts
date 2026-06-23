import chalk from 'chalk';
import type { Logger } from './types.js';

/**
 * 控制台彩色日志,对齐原 bash 工具的 [INFO]/[OK]/[WARN]/[ERROR] 风格。
 * 全部走 stderr,避免在 json 模式下污染 stdout(结果)。
 */
export class ConsoleLogger implements Logger {
  info(message: string): void {
    console.error(chalk.cyan('[INFO]') + '  ' + message);
  }

  ok(message: string): void {
    console.error(chalk.green('[OK]') + '    ' + message);
  }

  warn(message: string): void {
    console.error(chalk.yellow('[WARN]') + '  ' + message);
  }

  error(message: string): void {
    console.error(chalk.red('[ERROR]') + ' ' + message);
  }
}
