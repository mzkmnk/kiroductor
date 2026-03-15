import { useState, useEffect, useCallback } from 'react';
import { PlusIcon, Settings2Icon, TerminalIcon } from 'lucide-react';
import type { SessionMapping } from '../../main/repositories/config.repository';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
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
  onSwitchSession: (sessionId: string, cwd: string) => void;
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

  function handleSessionCreated() {
    onSessionCreated();
    refresh();
  }

  return (
    <>
      <Sidebar>
        {/* ヘッダー */}
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <div className="flex items-center justify-between px-1 py-0.5">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                    <TerminalIcon className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-sm font-semibold tracking-tight">Kiroductor</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  onClick={() => setIsDialogOpen(true)}
                  title="New Session"
                >
                  <PlusIcon className="h-4 w-4" />
                </Button>
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        {/* セッションリスト */}
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Sessions</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {sessions.length === 0 ? (
                  <div className="px-2 py-8 text-center text-xs text-sidebar-foreground/40">
                    No sessions yet
                  </div>
                ) : (
                  sessions.map((session) => {
                    const isActive = session.acpSessionId === activeSessionId;
                    const status: SessionStatus = connectedIds.has(session.acpSessionId)
                      ? 'connected'
                      : 'disconnected';

                    return (
                      <SidebarMenuItem key={session.acpSessionId}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => onSwitchSession(session.acpSessionId, session.cwd)}
                          className="h-auto items-start py-2"
                        >
                          {/* ステータスドット */}
                          <span
                            className={cn(
                              'mt-1 h-2 w-2 shrink-0 rounded-full',
                              status === 'connected' ? 'bg-blue-400' : 'bg-sidebar-foreground/20',
                            )}
                          />
                          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="truncate text-sm font-medium leading-none">
                              {session.title ?? 'New Session'}
                            </span>
                            <span className="truncate text-xs leading-none text-sidebar-foreground/50">
                              {extractRepoName(session.cwd)}
                            </span>
                          </div>
                        </SidebarMenuButton>
                        <SidebarMenuBadge className="text-[10px] text-sidebar-foreground/40">
                          {formatRelativeTime(session.updatedAt, now)}
                        </SidebarMenuBadge>
                      </SidebarMenuItem>
                    );
                  })
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* フッター */}
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton title="Settings">
                <Settings2Icon />
                <span>Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
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
