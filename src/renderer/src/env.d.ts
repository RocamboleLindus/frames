/// <reference types="vite/client" />

import type { FramesApi } from '@shared/types'

declare global {
  interface Window {
    framesApp: FramesApi
  }
}

export {}
