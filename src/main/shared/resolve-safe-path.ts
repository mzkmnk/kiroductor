import path from 'path';

/**
 * 相対パスをベースディレクトリに対して解決し、パストラバーサルを防止する。
 *
 * 解決後のパスがベースディレクトリの外にある場合はエラーを投げる。
 *
 * @param baseDir - ベースディレクトリ（作業ディレクトリ等）
 * @param relativePath - baseDir からの相対パス
 * @returns 解決済みの絶対パス
 * @throws 解決後のパスが baseDir の外にある場合
 */
export function resolveSafePath(baseDir: string, relativePath: string): string {
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(baseDir, relativePath);
  if (resolvedTarget !== resolvedBase && !resolvedTarget.startsWith(resolvedBase + path.sep)) {
    throw new Error('Path is outside the base directory');
  }
  return resolvedTarget;
}
