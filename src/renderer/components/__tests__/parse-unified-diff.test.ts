import { describe, it, expect } from 'vitest';
import { parseUnifiedDiff } from '../parse-unified-diff';

describe('parseUnifiedDiff', () => {
  it('空文字列を渡した場合は空配列を返すこと', () => {
    expect(parseUnifiedDiff('')).toEqual([]);
  });

  it('単一ファイルの diff を正しくパースすること', () => {
    const diff = [
      'diff --git a/src/main.ts b/src/main.ts',
      'index abc1234..def5678 100644',
      '--- a/src/main.ts',
      '+++ b/src/main.ts',
      '@@ -1,3 +1,4 @@',
      ' import { app } from "electron";',
      '+import { something } from "somewhere";',
      ' ',
      ' app.start();',
    ].join('\n');

    const result = parseUnifiedDiff(diff);

    expect(result).toHaveLength(1);
    expect(result[0].oldFileName).toBe('src/main.ts');
    expect(result[0].newFileName).toBe('src/main.ts');
    expect(result[0].hunks).toHaveLength(1);
    expect(result[0].hunks[0]).toContain('@@ -1,3 +1,4 @@');
  });

  it('複数ファイルの diff をファイルごとに分割すること', () => {
    const diff = [
      'diff --git a/file1.ts b/file1.ts',
      '--- a/file1.ts',
      '+++ b/file1.ts',
      '@@ -1,2 +1,3 @@',
      ' line1',
      '+line2',
      'diff --git a/file2.ts b/file2.ts',
      '--- a/file2.ts',
      '+++ b/file2.ts',
      '@@ -1,3 +1,2 @@',
      ' line1',
      '-line2',
    ].join('\n');

    const result = parseUnifiedDiff(diff);

    expect(result).toHaveLength(2);
    expect(result[0].oldFileName).toBe('file1.ts');
    expect(result[0].newFileName).toBe('file1.ts');
    expect(result[1].oldFileName).toBe('file2.ts');
    expect(result[1].newFileName).toBe('file2.ts');
  });

  it('新規ファイル（/dev/null → newFile）を正しく扱うこと', () => {
    const diff = [
      'diff --git a/newfile.ts b/newfile.ts',
      'new file mode 100644',
      'index 0000000..abc1234',
      '--- /dev/null',
      '+++ b/newfile.ts',
      '@@ -0,0 +1,3 @@',
      '+const x = 1;',
      '+const y = 2;',
      '+export { x, y };',
    ].join('\n');

    const result = parseUnifiedDiff(diff);

    expect(result).toHaveLength(1);
    expect(result[0].oldFileName).toBe('/dev/null');
    expect(result[0].newFileName).toBe('newfile.ts');
    expect(result[0].hunks).toHaveLength(1);
  });

  it('複数ハンクを持つファイルを正しくパースすること', () => {
    const diff = [
      'diff --git a/large.ts b/large.ts',
      '--- a/large.ts',
      '+++ b/large.ts',
      '@@ -1,3 +1,4 @@',
      ' first section',
      '+added line',
      ' end first',
      '@@ -10,3 +11,4 @@',
      ' second section',
      '+another added line',
      ' end second',
    ].join('\n');

    const result = parseUnifiedDiff(diff);

    expect(result).toHaveLength(1);
    expect(result[0].hunks).toHaveLength(2);
    expect(result[0].hunks[0]).toContain('@@ -1,3 +1,4 @@');
    expect(result[0].hunks[1]).toContain('@@ -10,3 +11,4 @@');
  });

  it('rawBlock にファイルの完全な diff ブロックが含まれること', () => {
    const diff = [
      'diff --git a/src/main.ts b/src/main.ts',
      'index abc1234..def5678 100644',
      '--- a/src/main.ts',
      '+++ b/src/main.ts',
      '@@ -1,3 +1,4 @@',
      ' import { app } from "electron";',
      '+import { something } from "somewhere";',
      ' ',
      ' app.start();',
    ].join('\n');

    const result = parseUnifiedDiff(diff);

    expect(result[0].rawBlock).toBe(diff);
  });

  it('複数ファイルの rawBlock がそれぞれの diff ブロックを含むこと', () => {
    const block1 = [
      'diff --git a/file1.ts b/file1.ts',
      '--- a/file1.ts',
      '+++ b/file1.ts',
      '@@ -1,2 +1,3 @@',
      ' line1',
      '+line2',
    ].join('\n');

    const block2 = [
      'diff --git a/file2.ts b/file2.ts',
      '--- a/file2.ts',
      '+++ b/file2.ts',
      '@@ -1,3 +1,2 @@',
      ' line1',
      '-line2',
    ].join('\n');

    const result = parseUnifiedDiff(block1 + '\n' + block2);

    expect(result[0].rawBlock).toBe(block1);
    expect(result[1].rawBlock).toBe(block2);
  });
});
