/// <reference types="node" />

declare global {
  interface Window {
    Buffer: typeof Buffer;
  }
}

export {};