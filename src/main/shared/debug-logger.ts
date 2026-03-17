/**
 * デバッグログ用のロガーオブジェクト。
 *
 * @example
 * ```ts
 * const log = createDebugLogger('ACP');
 * log.info('接続開始');       // → [kiroductor][ACP] 接続開始
 * log.warn('警告メッセージ'); // → [kiroductor][ACP] 警告メッセージ
 * log.error('エラー発生');    // → [kiroductor][ACP] エラー発生
 * ```
 */
export interface DebugLogger {
  /** 情報ログを出力する。 */
  info: (...args: unknown[]) => void;
  /** 警告ログを出力する。 */
  warn: (...args: unknown[]) => void;
  /** エラーログを出力する。 */
  error: (...args: unknown[]) => void;
}

/**
 * 名前空間付きのデバッグロガーを生成する。
 *
 * すべてのログに `[kiroductor][<namespace>]` プレフィックスを付与する。
 * Electron のメインプロセスでは起動時のターミナルへ出力される。
 *
 * @param namespace - ログのカテゴリ名（例: `'ACP'`, `'Session'`）
 * @returns {@link DebugLogger} インスタンス
 */
export function createDebugLogger(namespace: string): DebugLogger {
  const prefix = `[kiroductor][${namespace}]`;
  return {
    info: (...args) => console.log(prefix, ...args),
    warn: (...args) => console.warn(prefix, ...args),
    error: (...args) => console.error(prefix, ...args),
  };
}
