import chalk from 'chalk';
import type { Logger } from './types.js';

/** 控制台彩色日志,对齐原 bash 工具的 [INFO]/[OK]/[WARN]/[ERROR] 风格 */
export class ConsoleLogger implements Logger {
  info(message: string): void {
    console.log(chalk.cyan('[INFO]') + '  ' + message);
  }

  ok(message: string): void {
    console.log(chalk.green('[OK]') + '    ' + message);
  }

  warn(message: string): void {
    console.log(chalk.yellow('[WARN]') + '  ' + message);
  }

  error(message: string): void {
    console.error(chalk.red('[ERROR]') + ' ' + message);
  }
}
