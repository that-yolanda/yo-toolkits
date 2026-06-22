import { execa } from 'execa';
import which from 'which';
import type { Spawner, SpawnOptions, SpawnResult, Logger } from './types.js';
import { YoError } from './types.js';

/** 跨平台外部命令调用,封装 execa + which 依赖检查 */
export class ProcessSpawner implements Spawner {
  private log: Logger;

  constructor(log: Logger) {
    this.log = log;
  }

  exists(cmd: string): boolean {
    try {
      which.sync(cmd);
      return true;
    } catch {
      return false;
    }
  }

  assertDeps(cmds: string[]): void {
    const missing = cmds.filter((c) => !this.exists(c));
    if (missing.length > 0) {
      throw new YoError(
        'DEPENDENCY_MISSING',
        `缺少外部依赖: ${missing.join(', ')}`,
        `请先安装: brew install ${missing.join(' ')}`,
      );
    }
  }

  async run(cmd: string, args: string[], opts: SpawnOptions = {}): Promise<SpawnResult> {
    if (!this.exists(cmd)) {
      throw new YoError(
        'COMMAND_NOT_FOUND',
        `命令不存在: ${cmd}`,
        `请确认 ${cmd} 已安装并在 PATH 中`,
      );
    }
    if (!opts.silent) {
      this.log.info(`执行: ${cmd} ${args.join(' ')}`);
    }
    try {
      const result = await execa(cmd, args, {
        cwd: opts.cwd,
        env: opts.env ? { ...process.env, ...opts.env } : process.env,
      });
      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode ?? 0,
      };
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string; exitCode?: number };
      return {
        stdout: e.stdout ?? '',
        stderr: e.stderr ?? '',
        exitCode: e.exitCode ?? 1,
      };
    }
  }
}
