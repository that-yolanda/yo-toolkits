import tiged from 'tiged';

export interface FetchOptions {
  /** 强制覆盖已存在目录 */
  force?: boolean;
  /** git ref / branch / tag,默认仓库默认分支 */
  ref?: string;
}

/**
 * 从 GitHub 仓库拉取子目录到本地(degit 语义:不拉 .git,只取文件快照)。
 * @param repo  仓库全名,如 'that-yolanda/yo-toolkits'
 * @param subdir 仓库内子目录,如 'packages/plugins/wiki'
 * @param dest  本地目标目录(绝对路径)
 */
export async function fetchSubdir(
  repo: string,
  subdir: string,
  dest: string,
  opts: FetchOptions = {},
): Promise<void> {
  const refSuffix = opts.ref ? `#${opts.ref}` : '';
  const source = `${repo}/${subdir}${refSuffix}`;
  const emitter = tiged(source, {
    force: opts.force ?? true,
    cache: false,
  });
  await emitter.clone(dest);
}
