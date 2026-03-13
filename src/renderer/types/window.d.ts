import type { KiroductorAPI } from '../../preload/preload';

declare global {
  interface Window {
    /** Electron の contextBridge を通じて公開される型付き API。 */
    kiroductor: KiroductorAPI;
  }
}
