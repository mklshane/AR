// Minimal typings for the parts of MindAR we use. We use the core Controller directly instead of
// mind-ar's MindARThree wrapper, which imports `sRGBEncoding` (removed in three r152).
declare module 'mind-ar/dist/mindar-image.prod.js' {
  export interface ControllerUpdate {
    type: 'processDone' | 'updateMatrix'
    targetIndex?: number
    worldMatrix?: number[] | null
  }

  export interface ControllerOptions {
    inputWidth: number
    inputHeight: number
    onUpdate?: (data: ControllerUpdate) => void
    maxTrack?: number
    filterMinCF?: number | null
    filterBeta?: number | null
    warmupTolerance?: number | null
    missTolerance?: number | null
  }

  export class Controller {
    constructor(options: ControllerOptions)
    inputWidth: number
    inputHeight: number
    addImageTargets(url: string): Promise<{ dimensions: [number, number][] }>
    dummyRun(input: HTMLVideoElement): Promise<void>
    processVideo(input: HTMLVideoElement): void
    stopProcessVideo(): void
    getProjectionMatrix(): number[]
    dispose?(): void
  }

  export class Compiler {
    compileImageTargets(images: HTMLImageElement[], progress: (percent: number) => void): Promise<unknown>
    exportData(): Uint8Array
  }
}
