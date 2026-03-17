import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import type { IpcInvokeChannels } from '../../shared/ipc';

/**
 * 型付き `ipcMain.handle` ラッパー。
 *
 * チャネル名・引数・戻り値を {@link IpcInvokeChannels} で制約することで、
 * ハンドラーの型をコンパイル時に検証する。
 *
 * @param channel - IPC チャネル名（{@link IpcInvokeChannels} のキー）
 * @param handler - チャネルを処理するハンドラー関数
 */
export function handle<K extends keyof IpcInvokeChannels>(
  channel: K,
  handler: (
    event: IpcMainInvokeEvent,
    ...args: IpcInvokeChannels[K]['args']
  ) => Promise<IpcInvokeChannels[K]['return']> | IpcInvokeChannels[K]['return'],
): void {
  ipcMain.handle(channel, handler as (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown);
}
