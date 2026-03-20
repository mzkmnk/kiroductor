import { useState } from 'react';
import { GitBranchIcon, MessageSquareIcon, TerminalIcon, PlusIcon } from 'lucide-react';
import { Button } from './ui/button';
import { NewSessionDialog } from './NewSessionDialog';
import appIcon from '../assets/icon.png';

/** {@link WelcomeScreen} のプロパティ。 */
interface WelcomeScreenProps {
  /** 新しいセッションが作成された際に呼ばれるコールバック。 */
  onSessionCreated: () => void;
}

/** 機能カードのデータ。 */
const FEATURES = [
  {
    icon: MessageSquareIcon,
    title: 'AI Coding',
    description: 'Write code through interactive AI conversations via kiro-cli',
  },
  {
    icon: GitBranchIcon,
    title: 'Worktree Management',
    description: 'Safely manage multiple work branches in parallel',
  },
  {
    icon: TerminalIcon,
    title: 'Multi-Session',
    description: 'Manage multiple repositories and sessions from the sidebar',
  },
] as const;

/**
 * セッションが存在しない場合のウェルカム画面。
 *
 * アプリ概要・機能カード・セッション作成ボタンを表示する。
 */
export function WelcomeScreen({ onSessionCreated }: WelcomeScreenProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
      <div className="flex h-full flex-col items-center justify-center px-8">
        <div className="w-full max-w-lg space-y-10">
          {/* ロゴ + タイトル */}
          <div className="flex flex-col items-center gap-4 text-center">
            <img src={appIcon} alt="Kiroductor" className="h-14 w-14 rounded-2xl shadow-lg" />
            <div className="space-y-1.5">
              <h1 className="text-3xl font-bold tracking-tight">Kiroductor</h1>
              <p className="text-sm text-muted-foreground">
                AI coding assistant powered by kiro-cli
              </p>
            </div>
          </div>

          {/* 機能カード */}
          <div className="grid grid-cols-3 gap-3">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="rounded-xl border bg-card p-4 text-card-foreground shadow-sm"
              >
                <Icon className="mb-2 h-4 w-4 text-muted-foreground" />
                <p className="mb-1 text-xs font-semibold">{title}</p>
                <p className="text-[11px] leading-relaxed text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>

          {/* CTA ボタン */}
          <div className="flex justify-center">
            <Button onClick={() => setIsDialogOpen(true)} className="gap-2 px-6">
              <PlusIcon className="h-4 w-4" />
              New Session
            </Button>
          </div>
        </div>
      </div>

      <NewSessionDialog
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSessionCreated={onSessionCreated}
      />
    </>
  );
}
