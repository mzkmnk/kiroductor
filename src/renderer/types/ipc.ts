import type { KiroductorAPI } from "../../preload/preload.js";

declare global {
  interface Window {
    kiroductor: KiroductorAPI;
  }
}
