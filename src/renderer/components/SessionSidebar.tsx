import { useState, useEffect, useCallback } from 'react';
import { PlusIcon, SettingsIcon } from 'lucide-react';
import type { SessionMapping } from '../../main/repositories/config.repository';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from './ui/sidebar';
import { Button } from './ui/button';
import { NewSessionDialog } from './NewSessionDialog';
import { cn } from '../lib/utils';

/** セッションの接続状態。 */
type SessionStatus = 'connected' | 'disconnected';

/** {@link SessionSidebar} のプロパティ。 */
interface SessionSidebarProps {
  /** 現在のアクティブセッション ID。 */
  activeSessionId: string | null;
  /** セッションを切り替える際に呼ばれるコールバック。 */
  onSwitchSession: (sessionId: string) => void;
  /** 新規セッション作成後に呼ばれるコールバック。 */
  onSessionCreated: () => void;
}

/**
 * ISO 8601 の日時文字列を相対時刻文字列（"2m ago" など）に変換する。
 *
 * @param isoString - ISO 8601 形式の日時文字列
 * @param now - 現在時刻（ミリ秒）
 * @returns 相対時刻の文字列
 */
function formatRelativeTime(isoString: string, now: number): string {
  const diffMs = now - new Date(isoString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${Math.floor(diffHour / 24)}d ago`;
}

/**
 * セッションの CWD パスからリポジトリ名を抽出する。
 *
 * @param cwd - セッションの作業ディレクトリパス
 * @returns リポジトリ名
 */
function extractRepoName(cwd: string): string {
  const parts = cwd.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? cwd;
}

/**
 * セッション一覧とセッション作成を提供するサイドバー。
 *
 * shadcn/ui の `Sidebar` コンポーネントを使用し、
 * ヘッダー（アプリ名 + New Session ボタン）・セッションリスト・フッター（設定）で構成される。
 */
export function SessionSidebar({
  activeSessionId,
  onSwitchSession,
  onSessionCreated,
}: SessionSidebarProps) {
  const [sessions, setSessions] = useState<SessionMapping[]>([]);
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  /** セッション一覧と接続状態を最新化する。 */
  const refresh = useCallback(() => {
    Promise.all([window.kiroductor.session.getAll(), window.kiroductor.session.list()]).then(
      ([all, list]) => {
        setConnectedIds(new Set(all));
        setSessions(list);
      },
    );
  }, []);

  useEffect(() => {
    refresh();

    // セッション切り替え・更新時にリストを再取得する
    const unsubSwitched = window.kiroductor.session.onSessionSwitched(() => refresh());
    const unsubUpdate = window.kiroductor.session.onUpdate(() => refresh());

    // 1分ごとに相対タイムスタンプを更新する
    const timer = setInterval(() => setNow(Date.now()), 60_000);

    return () => {
      unsubSwitched();
      unsubUpdate();
      clearInterval(timer);
    };
  }, [refresh]);

  /** 接続状態を返す。 */
  function getStatus(sessionId: string): SessionStatus {
    return connectedIds.has(sessionId) ? 'connected' : 'disconnected';
  }

  function handleSessionCreated() {
    onSessionCreated();
    refresh();
  }

  return (
    <>
      <Sidebar>
        {/* ヘッダー: アプリ名 + New Session ボタン */}
        <SidebarHeader className="flex flex-row items-center justify-between px-4 py-3">
          <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">
            Kiroductor
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={() => setIsDialogOpen(true)}
            title="New Session"
          >
            <PlusIcon className="h-4 w-4" />
          </Button>
        </SidebarHeader>

        {/* セッションリスト */}
        <SidebarContent>
          <SidebarMenu>
            {sessions.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                セッションがありません
              </div>
            ) : (
              sessions.map((session) => {
                const isActive = session.acpSessionId === activeSessionId;
                const status = getStatus(session.acpSessionId);

                return (
                  <SidebarMenuItem key={session.acpSessionId}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      onClick={() => onSwitchSession(session.acpSessionId)}
                    >
                      <button
                        className={cn(
                          'flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left',
                          isActive && 'border-l-2 border-sidebar-primary',
                        )}
                      >
                        <div className="flex w-full items-center justify-between">
                          <span className="truncate text-sm font-medium">
                            {session.title ?? 'New Session'}
                          </span>
                          {/* ステータスドット */}
                          <StatusDot status={status} />
                        </div>
                        <div className="flex w-full items-center justify-between">
                          <span className="truncate text-xs text-muted-foreground">
                            {extractRepoName(session.cwd)}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {formatRelativeTime(session.updatedAt, now)}
                          </span>
                        </div>
                      </button>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })
            )}
          </SidebarMenu>
        </SidebarContent>

        {/* フッター: 設定ボタン */}
        <SidebarFooter className="px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
            title="Settings"
          >
            <SettingsIcon className="h-4 w-4" />
          </Button>
        </SidebarFooter>
      </Sidebar>

      <NewSessionDialog
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSessionCreated={handleSessionCreated}
      />
    </>
  );
}

/** ステータスドットコンポーネント。 */
function StatusDot({ status }: { status: SessionStatus }) {
  return (
    <span
      className={cn(
        'inline-block h-2 w-2 shrink-0 rounded-full',
        status === 'connected' && 'bg-blue-400',
        status === 'disconnected' && 'bg-zinc-500',
      )}
      aria-label={status}
    />
  );
}
