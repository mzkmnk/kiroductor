import { describe, it, expect, vi } from 'vitest';
import { ReadTextFileMethod } from '../read-text-file.method';
import type { ReadTextFileRequest } from '@agentclientprotocol/sdk/dist/schema/index';

describe('ReadTextFileMethod', () => {
  const makeFs = (
    overrides?: Partial<{ readFile: (path: string, encoding: string) => Promise<string> }>,
  ) => ({
    readFile: vi.fn().mockResolvedValue('file content'),
    ...overrides,
  });

  const makeParams = (path: string): ReadTextFileRequest => ({
    path,
    sessionId: 'session-1',
  });

  it('存在するファイルを指定すると内容が返ること', async () => {
    const fs = makeFs();
    const method = new ReadTextFileMethod(fs);

    const result = await method.handle(makeParams('/path/to/file.txt'));

    expect(fs.readFile).toHaveBeenCalledWith('/path/to/file.txt', 'utf-8');
    expect(result).toEqual({ content: 'file content' });
  });

  it('存在しないファイルを指定するとエラーが投げられること', async () => {
    const enoentError = Object.assign(new Error('ENOENT: no such file or directory'), {
      code: 'ENOENT',
    });
    const fs = makeFs({ readFile: vi.fn().mockRejectedValue(enoentError) });
    const method = new ReadTextFileMethod(fs);

    await expect(method.handle(makeParams('/nonexistent/file.txt'))).rejects.toThrow(enoentError);
  });
});
