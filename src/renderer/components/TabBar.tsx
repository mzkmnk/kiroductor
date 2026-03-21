import { MessageSquare, FileCode, X } from 'lucide-react';
import { cn } from '../lib/utils';
import type { Tab } from '../types/tab';

/**
 * {@link TabBar} のプロパティ。
 */
interface TabBarProps {
  /** 表示するタブ一覧。 */
  tabs: Tab[];
  /** 現在アクティブなタブの ID。 */
  activeTabId: string;
  /** タブクリック時のコールバック。 */
  onTabClick: (tabId: string) => void;
  /** タブの閉じるボタンクリック時のコールバック。 */
  onTabClose: (tabId: string) => void;
}

/**
 * VSCode 風のタブバーコンポーネント。
 *
 * エージェントチャットタブは常に表示され閉じることができない。
 * ファイルタブは閉じるボタン（X）で閉じることができる。
 */
export function TabBar({ tabs, activeTabId, onTabClick, onTabClose }: TabBarProps) {
  return (
    <div className="flex h-9 shrink-0 items-end gap-0 border-b bg-muted/30 [-webkit-app-region:drag]">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        const isClosable = tab.type !== 'chat';

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabClick(tab.id)}
            className={cn(
              'group relative flex h-8 items-center gap-1.5 border-r px-3 text-xs transition-colors [-webkit-app-region:no-drag]',
              isActive
                ? 'bg-background text-foreground'
                : 'text-muted-foreground hover:bg-background/50 hover:text-foreground',
            )}
          >
            <TabIcon type={tab.type} className="h-3.5 w-3.5 shrink-0" />
            <span className="max-w-32 truncate">{tab.label}</span>
            {isClosable && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose(tab.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation();
                    onTabClose(tab.id);
                  }
                }}
                className="ml-0.5 flex h-4 w-4 items-center justify-center rounded opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
                aria-label={`Close ${tab.label}`}
              >
                <X className="h-3 w-3" />
              </span>
            )}
            {isActive && <span className="absolute bottom-0 left-0 right-0 h-px bg-primary" />}
          </button>
        );
      })}
    </div>
  );
}

/**
 * タブの種別に応じたアイコンを返す。
 */
function TabIcon({ type, className }: { type: Tab['type']; className?: string }) {
  switch (type) {
    case 'chat':
      return <MessageSquare className={className} />;
    case 'file':
      return <FileCode className={className} />;
  }
}
