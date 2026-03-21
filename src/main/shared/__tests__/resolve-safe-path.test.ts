import path from 'path';
import { describe, it, expect } from 'vitest';
import { resolveSafePath } from '../resolve-safe-path';

describe('resolveSafePath()', () => {
  const BASE = '/home/user/project';

  it('安全な相対パスに対して解決済み絶対パスを返す', () => {
    expect(resolveSafePath(BASE, 'src/index.ts')).toBe(path.join(BASE, 'src/index.ts'));
  });

  it('空文字列の場合、ベースディレクトリ自体を返す', () => {
    expect(resolveSafePath(BASE, '')).toBe(BASE);
  });

  it('"." の場合、ベースディレクトリ自体を返す', () => {
    expect(resolveSafePath(BASE, '.')).toBe(BASE);
  });

  it('パストラバーサル（../../etc/passwd）を拒否する', () => {
    expect(() => resolveSafePath(BASE, '../../etc/passwd')).toThrow(
      'Path is outside the base directory',
    );
  });

  it('プレフィックス一致の偽陽性（../project-evil/file）を拒否する', () => {
    expect(() => resolveSafePath(BASE, '../project-evil/file')).toThrow(
      'Path is outside the base directory',
    );
  });

  it('ネストしたサブディレクトリを正常に返す', () => {
    expect(resolveSafePath(BASE, 'a/b/c')).toBe(path.join(BASE, 'a/b/c'));
  });

  it('絶対パス（/etc/passwd）を拒否する', () => {
    expect(() => resolveSafePath(BASE, '/etc/passwd')).toThrow(
      'Path is outside the base directory',
    );
  });
});
