/**
 * ファイルごとの diff データ。
 *
 * `@git-diff-view/react` の `DiffView` コンポーネントへ渡すために使用する。
 */
export interface FileDiffData {
  /** 変更前のファイル名。新規ファイルの場合は `/dev/null`。 */
  oldFileName: string;
  /** 変更後のファイル名。削除ファイルの場合は `/dev/null`。 */
  newFileName: string;
  /** unified diff 形式のハンク文字列の配列。 */
  hunks: string[];
  /** `diff --git` から始まるファイルの完全な diff ブロック。DiffView の hunks prop に渡す。 */
  rawBlock: string;
}

/**
 * `git diff` の unified diff 出力をファイルごとに分割してパースする。
 *
 * @param diffText - `git diff` コマンドの出力文字列
 * @returns ファイルごとの {@link FileDiffData} 配列
 */
export function parseUnifiedDiff(diffText: string): FileDiffData[] {
  if (!diffText.trim()) return [];

  const files: FileDiffData[] = [];
  // `diff --git` 行で分割
  const fileBlocks = diffText.split(/^(?=diff --git )/m);

  for (const block of fileBlocks) {
    if (!block.trim()) continue;

    let oldFileName = '';
    let newFileName = '';
    const hunks: string[] = [];
    let currentHunk = '';

    const lines = block.split('\n');
    for (const line of lines) {
      if (line.startsWith('--- ')) {
        const name = line.slice(4);
        oldFileName = name === '/dev/null' ? '/dev/null' : name.replace(/^a\//, '');
      } else if (line.startsWith('+++ ')) {
        const name = line.slice(4);
        newFileName = name === '/dev/null' ? '/dev/null' : name.replace(/^b\//, '');
      } else if (line.startsWith('@@')) {
        if (currentHunk) {
          hunks.push(currentHunk);
        }
        currentHunk = line;
      } else if (currentHunk) {
        currentHunk += '\n' + line;
      }
    }

    if (currentHunk) {
      hunks.push(currentHunk);
    }

    // diff --git 行はあるが --- / +++ が無い場合（バイナリ等）はスキップ
    if (!oldFileName && !newFileName) continue;

    files.push({ oldFileName, newFileName, hunks, rawBlock: block.trimEnd() });
  }

  return files;
}
