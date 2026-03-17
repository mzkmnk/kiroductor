import { describe, it, expect } from 'vitest';
import { generateSessionTitle, ALL_TITLES } from '../session-title.generator';

describe('generateSessionTitle()', () => {
  it('文字列を返すこと', () => {
    const title = generateSessionTitle();
    expect(typeof title).toBe('string');
  });

  it('空文字列を返さないこと', () => {
    const title = generateSessionTitle();
    expect(title.length).toBeGreaterThan(0);
  });

  it('返す値は都市名またはコーヒー豆品種名のいずれかであること', () => {
    const title = generateSessionTitle();
    expect(ALL_TITLES).toContain(title);
  });

  it('複数回呼び出すと異なる値が返ることがあること（全件同一にはならない）', () => {
    const results = new Set(Array.from({ length: 20 }, () => generateSessionTitle()));
    expect(results.size).toBeGreaterThan(1);
  });
});
