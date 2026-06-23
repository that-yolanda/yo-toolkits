import { execa } from 'execa';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface FetchOptions {
  /** 强制覆盖已存在的目标目录(默认 true) */
  force?: boolean;
  /** git ref / branch / tag,默认仓库默认分支 */
  ref?: string;
}

/**
 * 从 GitHub 仓库浅克隆并提取子目录到本地。
 * 用 `git clone --depth 1`(借鉴 vercel-labs/skills),零额外 npm 依赖,不引入 deprecated 包。
 *
 * @param repo   仓库全名,如 'that-yolanda/yo-toolkits'
 * @param subdir 仓库内子目录,如 'packages/plugins/wiki'
 * @param dest   本地目标目录(绝对路径)
 */
export async function fetchSubdir(
  repo: string,
  subdir: string,
  dest: string,
  opts: FetchOptions = {},
): Promise<void> {
  const temp = await mkdtemp(join(tmpdir(), 'yo-fetch-'));
  const url = `https://github.com/${repo}.git`;
  const args = ['clone', '--depth', '1'];
  if (opts.ref) args.push('--branch', opts.ref);
  args.push(url, temp);

  try {
    // GIT_TERMINAL_PROMPT=0:公开仓库无需鉴权,避免卡在凭据提示
    await execa('git', args, {
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });
    if (opts.force !== false) {
      await rm(dest, { recursive: true, force: true });
    }
    await cp(join(temp, subdir), dest, { recursive: true });
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}
