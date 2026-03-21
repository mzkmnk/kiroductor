import { useEffect, useRef, useState, useCallback } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { python } from '@codemirror/lang-python';
import { rust } from '@codemirror/lang-rust';
import { java } from '@codemirror/lang-java';
import { cpp } from '@codemirror/lang-cpp';
import { xml } from '@codemirror/lang-xml';
import { sql } from '@codemirror/lang-sql';
import { yaml } from '@codemirror/lang-yaml';
import type { Extension } from '@codemirror/state';

/**
 * ファイルエディタコンポーネントの Props。
 */
interface FileEditorProps {
  /** 対象セッション ID。 */
  sessionId: string;
  /** 表示対象のファイルパス（cwd からの相対パス）。 */
  filePath: string;
  /** ファイルの変更状態が変わったときのコールバック。 */
  onModifiedChange?: (filePath: string, isModified: boolean) => void;
}

/**
 * ファイル拡張子から CodeMirror の言語拡張を返す。
 *
 * @param ext - 小文字の拡張子（例: `"ts"`, `"py"`）
 * @returns 対応する CodeMirror 言語拡張。該当なしの場合は空配列。
 */
function getLanguageExtension(ext: string): Extension[] {
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'mts':
    case 'cts':
      return [javascript({ typescript: true, jsx: ext === 'tsx' })];
    case 'js':
    case 'mjs':
    case 'cjs':
      return [javascript()];
    case 'jsx':
      return [javascript({ jsx: true })];
    case 'html':
      return [html()];
    case 'css':
      return [css()];
    case 'json':
      return [json()];
    case 'md':
    case 'mdx':
      return [markdown()];
    case 'py':
      return [python()];
    case 'rs':
      return [rust()];
    case 'java':
      return [java()];
    case 'c':
    case 'cpp':
    case 'cc':
    case 'cxx':
    case 'h':
    case 'hpp':
      return [cpp()];
    case 'xml':
    case 'svg':
      return [xml()];
    case 'sql':
      return [sql()];
    case 'yaml':
    case 'yml':
      return [yaml()];
    default:
      return [];
  }
}

/**
 * ファイル名から拡張子を取得する。
 *
 * @param filePath - ファイルパス
 * @returns 小文字の拡張子。拡張子なしの場合は空文字列。
 */
function getExtension(filePath: string): string {
  const name = filePath.split('/').pop() ?? '';
  const dotIndex = name.lastIndexOf('.');
  return dotIndex !== -1 ? name.slice(dotIndex + 1).toLowerCase() : '';
}

/**
 * CodeMirror 6 ベースのファイルエディタ。
 *
 * 指定されたセッションとファイルパスからファイル内容を読み込み、
 * シンタックスハイライト付きで表示・編集できる。
 * `Cmd+S` / `Ctrl+S` でファイルを保存する。
 *
 * @param sessionId - 対象セッション ID
 * @param filePath - 表示対象のファイルパス
 * @param onModifiedChange - 変更状態通知コールバック
 */
export function FileEditor({ sessionId, filePath, onModifiedChange }: FileEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** 読み込み時の原文。変更検出の基準。 */
  const originalContentRef = useRef<string>('');
  /** 最新の modified 状態。重複通知を防ぐ。 */
  const isModifiedRef = useRef(false);

  /** ファイルを保存する。 */
  const saveFile = useCallback(async () => {
    const view = viewRef.current;
    if (!view) return;
    setSaving(true);
    try {
      const content = view.state.doc.toString();
      await window.kiroductor.repo.writeFile(sessionId, filePath, content);
      originalContentRef.current = content;
      isModifiedRef.current = false;
      onModifiedChange?.(filePath, false);
    } catch (err) {
      console.error('Failed to save file:', err);
    } finally {
      setSaving(false);
    }
  }, [sessionId, filePath, onModifiedChange]);

  useEffect(() => {
    let disposed = false;

    async function loadFile() {
      setLoading(true);
      setError(null);

      try {
        const content = await window.kiroductor.repo.readFile(sessionId, filePath);

        if (disposed || !containerRef.current) return;

        // 既存のエディタがあれば破棄
        if (viewRef.current) {
          viewRef.current.destroy();
          viewRef.current = null;
        }

        originalContentRef.current = content;
        isModifiedRef.current = false;

        const ext = getExtension(filePath);
        const langExtension = getLanguageExtension(ext);

        // saveFile を ref 経由で参照（クロージャ内で最新値を使うため）
        const saveKeymap = keymap.of([
          {
            key: 'Mod-s',
            run: () => {
              void saveFile();
              return true;
            },
          },
        ]);

        const updateListener = EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const currentContent = update.state.doc.toString();
            const modified = currentContent !== originalContentRef.current;
            if (modified !== isModifiedRef.current) {
              isModifiedRef.current = modified;
              onModifiedChange?.(filePath, modified);
            }
          }
        });

        const state = EditorState.create({
          doc: content,
          extensions: [
            basicSetup,
            saveKeymap,
            updateListener,
            oneDark,
            EditorView.theme({
              '&': { height: '100%', fontSize: '13px' },
              '.cm-scroller': { overflow: 'auto' },
              '.cm-gutters': { minWidth: '40px' },
            }),
            ...langExtension,
          ],
        });

        const view = new EditorView({
          state,
          parent: containerRef.current,
        });

        viewRef.current = view;
      } catch (err) {
        if (!disposed) {
          setError(err instanceof Error ? err.message : 'ファイルの読み込みに失敗しました');
        }
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    }

    void loadFile();

    return () => {
      disposed = true;
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, [sessionId, filePath, saveFile, onModifiedChange]);

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
          <span className="text-xs text-muted-foreground">Loading...</span>
        </div>
      )}
      {saving && (
        <div className="absolute right-2 top-2 z-10 rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
          Saving...
        </div>
      )}
      <div ref={containerRef} className="flex-1 overflow-hidden" />
    </div>
  );
}
