import { cn } from '../lib/utils';

/** 円形プログレスリングのサイズ設定。 */
const SIZE = 16;
const STROKE_WIDTH = 2;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** {@link ContextUsageRing} のプロパティ。 */
interface ContextUsageRingProps {
  /** コンテキスト使用率（0〜100）。 */
  percentage: number;
}

/**
 * コンテキスト使用率を円形プログレスリングで表示するコンポーネント。
 *
 * 80% 以上で警告色（赤）に切り替わる。
 */
export function ContextUsageRing({ percentage }: ContextUsageRingProps): React.JSX.Element {
  const rounded = Math.round(percentage);
  const clamped = Math.min(100, Math.max(0, rounded));
  const offset = CIRCUMFERENCE - (clamped / 100) * CIRCUMFERENCE;
  const isWarning = clamped >= 80;

  return (
    <div
      className="flex items-center gap-1"
      title={`Context: ${rounded}%`}
      aria-label={`Context usage ${rounded}%`}
    >
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        {/* 背景リング */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE_WIDTH}
          className="stroke-muted-foreground/20"
        />
        {/* プログレスリング */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE_WIDTH}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn(isWarning ? 'stroke-destructive' : 'stroke-muted-foreground/60')}
        />
      </svg>
      <span
        className={cn(
          'text-xs tabular-nums',
          isWarning ? 'text-destructive' : 'text-muted-foreground/60',
        )}
      >
        {rounded}%
      </span>
    </div>
  );
}
