import { describe, it, expect, vi } from 'vitest';
import { WriteTextFileMethod } from '../write-text-file.method';
import type { WriteTextFileRequest } from '@agentclientprotocol/sdk/dist/schema/index';

describe('WriteTextFileMethod', () => {
  const makeFs = (
    overrides?: Partial<{
      writeFile: (path: string, content: string, encoding: string) => Promise<void>;
    }>,
  ) => ({
    writeFile: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  });

  const makeParams = (path: string, content: string): WriteTextFileRequest => ({
    path,
    content,
    sessionId: 'session-1',
  });

  it('ファイルが正しく書き込まれること', async () => {
    const fs = makeFs();
    const method = new WriteTextFileMethod(fs);

    const result = await method.handle(makeParams('/path/to/file.txt', 'hello world'));

    expect(fs.writeFile).toHaveBeenCalledWith('/path/to/file.txt', 'hello world', 'utf-8');
    expect(result).toEqual({});
  });

  it('書き込みに失敗した場合エラーが投げられること', async () => {
    const writeError = new Error('EACCES: permission denied');
    const fs = makeFs({ writeFile: vi.fn().mockRejectedValue(writeError) });
    const method = new WriteTextFileMethod(fs);

    await expect(method.handle(makeParams('/path/to/file.txt', 'content'))).rejects.toThrow(
      writeError,
    );
  });
});
