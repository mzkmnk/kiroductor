/**
 * タブの共通プロパティ。
 */
interface TabBase {
  /** タブの一意識別子。 */
  id: string;
  /** タブに表示するラベル。 */
  label: string;
}

/**
 * エージェントとの会話タブ。常に存在し、閉じることはできない。
 */
export interface ChatTab extends TabBase {
  type: 'chat';
}

/**
 * ファイル表示タブ。閉じることができる。
 */
export interface FileTab extends TabBase {
  type: 'file';
  /** 表示対象のファイルパス。 */
  filePath: string;
  /** 未保存の変更があるかどうか。 */
  isModified?: boolean;
}

/**
 * アプリ内のタブを表す判別共用体。
 *
 * `type` フィールドで種別を判定し、`'chat'` タブは閉じ不可、
 * `'file'` タブは閉じ可能。
 */
export type Tab = ChatTab | FileTab;

/** エージェントチャットタブの固定 ID。 */
export const AGENT_CHAT_TAB_ID = 'agent-chat';
