import type { Bureau } from "./index";

declare global {
  interface Window {
    bureau: Bureau;
  }
}

export {};
