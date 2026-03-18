import { useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { AtomIcon } from 'lucide-animated';
import type { AtomIconHandle } from 'lucide-animated';

/** AtomIcon のパスアニメーション総時間（ms）。delay 0.6s + duration 0.4s + 余白。 */
const ATOM_ANIMATION_INTERVAL = 1200;

/**
 * AI が思考中であることを示すアニメーションインジケーター。
 *
 * `AtomIcon` を一定間隔で `startAnimation()` し繰り返し再生する。
 * スライドイン／フェードアウトで処理中状態を視覚的に表現する。
 */
export function ThinkingIndicator() {
  const iconRef = useRef<AtomIconHandle>(null);

  useEffect(() => {
    iconRef.current?.startAnimation();
    const id = setInterval(() => {
      iconRef.current?.startAnimation();
    }, ATOM_ANIMATION_INTERVAL);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="flex items-center text-muted-foreground"
    >
      <AtomIcon ref={iconRef} size={16} className="text-primary/70" />
    </motion.div>
  );
}
