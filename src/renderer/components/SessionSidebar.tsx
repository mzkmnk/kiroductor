import { useState, useEffect, useCallback } from 'react';
import { FolderGit2Icon, PlusIcon, SettingsIcon } from 'lucide-react';
import type { SessionMapping } from '../../main/features/config/config.repository';
import type { DiffStats } from '../../shared/ipc';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from './ui/sidebar';
import { Button } from './ui/button';
import { NewSessionDialog } from './NewSessionDialog';
import { RepoDialog } from './RepoDialog';
/** {@link SessionSidebar} のプロパティ。 */
interface SessionSidebarProps {
  /** 現在のアクティブセッション ID。 */
  activeSessionId: string | null;
  /** プロンプト完了回数。変化時に diff stats を再取得する。 */
  promptCompletedCount: number;
  /** 処理中のセッション ID のセット。 */
  processingSessionIds: Set<string>;
  /** セッションを切り替える際に呼ばれるコールバック。 */
  onSwitchSession: (sessionId: string, cwd: string) => void;
  /** 新規セッション作成後に呼ばれるコールバック。 */
  onSessionCreated: () => void;
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
  promptCompletedCount,
  processingSessionIds,
  onSwitchSession,
  onSessionCreated,
}: SessionSidebarProps) {
  const [sessions, setSessions] = useState<SessionMapping[]>([]);
  const [diffStatsMap, setDiffStatsMap] = useState<Record<string, DiffStats | null>>({});
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isRepoDialogOpen, setIsRepoDialogOpen] = useState(false);

  /** 全セッションの diff stats を取得する。 */
  const refreshDiffStats = useCallback((sessionList: SessionMapping[]) => {
    Promise.all(
      sessionList.map((s) =>
        window.kiroductor.repo
          .getDiffStats(s.acpSessionId)
          .then((stats) => [s.acpSessionId, stats] as const),
      ),
    ).then((entries) => {
      setDiffStatsMap(Object.fromEntries(entries));
    });
  }, []);

  /** セッション一覧と接続状態を最新化する。 */
  const refresh = useCallback(
    (opts?: { withDiffStats?: boolean }) => {
      window.kiroductor.session.list().then((list) => {
        const sorted = [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        setSessions(sorted);

        if (opts?.withDiffStats) {
          refreshDiffStats(sorted);
        }
      });
    },
    [refreshDiffStats],
  );

  useEffect(() => {
    refresh({ withDiffStats: true });

    const unsubSwitched = window.kiroductor.session.onSessionSwitched(() =>
      refresh({ withDiffStats: true }),
    );
    const unsubUpdate = window.kiroductor.session.onUpdate(() => refresh());

    return () => {
      unsubSwitched();
      unsubUpdate();
    };
  }, [refresh]);

  // プロンプト完了時に diff stats を再取得する
  useEffect(() => {
    if (promptCompletedCount > 0) {
      refreshDiffStats(sessions);
    }
  }, [promptCompletedCount]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSessionCreated() {
    onSessionCreated();
    refresh({ withDiffStats: true });
  }

  return (
    <>
      <Sidebar>
        {/* macOS トラフィックライト用のドラッグ領域 */}
        <div className="h-10 shrink-0 [-webkit-app-region:drag]" />

        {/* セッションリスト */}
        <SidebarContent>
          <SidebarGroup>
            <div className="flex items-center justify-between pr-1">
              <SidebarGroupLabel>Sessions</SidebarGroupLabel>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                onClick={() => setIsDialogOpen(true)}
                title="New Session"
              >
                <PlusIcon className="h-3.5 w-3.5" />
              </Button>
            </div>
            <SidebarGroupContent>
              <SidebarMenu>
                {sessions.length === 0 ? (
                  <div className="px-2 py-8 text-center text-xs text-sidebar-foreground/40">
                    No sessions yet
                  </div>
                ) : (
                  sessions.map((session) => {
                    const isActive = session.acpSessionId === activeSessionId;
                    const isSessionProcessing = processingSessionIds.has(session.acpSessionId);
                    const stats = diffStatsMap[session.acpSessionId];
                    const hasDiff = stats && (stats.insertions > 0 || stats.deletions > 0);

                    return (
                      <SidebarMenuItem key={session.acpSessionId}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => onSwitchSession(session.acpSessionId, session.cwd)}
                          className="relative h-auto items-start overflow-hidden py-2"
                        >
                          {isSessionProcessing && (
                            <div className="pointer-events-none absolute inset-0 animate-shimmer rounded-md" />
                          )}
                          <div className="flex min-w-0 flex-1 items-center gap-1">
                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                              <span className="truncate text-sm font-medium leading-none">
                                {session.title ?? 'New Session'}
                              </span>
                              <span className="truncate text-xs leading-none text-sidebar-foreground/50">
                                {extractRepoName(session.cwd)}
                              </span>
                            </div>
                            {hasDiff && (
                              <span className="shrink-0 text-[10px] font-medium leading-none">
                                <span className="text-green-500">+{stats.insertions}</span>{' '}
                                <span className="text-red-500">-{stats.deletions}</span>
                              </span>
                            )}
                          </div>
                        </SidebarMenuButton>
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
          <div className="flex items-center justify-end gap-1 px-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              title="Repositories"
              onClick={() => setIsRepoDialogOpen(true)}
            >
              <FolderGit2Icon className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              title="Settings"
            >
              <SettingsIcon className="h-4 w-4" />
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>

      <NewSessionDialog
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSessionCreated={handleSessionCreated}
      />

      <RepoDialog open={isRepoDialogOpen} onOpenChange={setIsRepoDialogOpen} />
    </>
  );
}
