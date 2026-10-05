// Minimal typings for StPageFlip (page-flip ships no .d.ts). We import its ES module build directly
// because package.json only points `main`/`browser` at the UMD bundle.
declare module 'page-flip/dist/js/page-flip.module.js' {
  export interface FlipSettings {
    width: number
    height: number
    size?: 'fixed' | 'stretch'
    minWidth?: number
    maxWidth?: number
    minHeight?: number
    maxHeight?: number
    startPage?: number
    drawShadow?: boolean
    flippingTime?: number
    usePortrait?: boolean
    autoSize?: boolean
    maxShadowOpacity?: number
    showCover?: boolean
    mobileScrollSupport?: boolean
    swipeDistance?: number
    showPageCorners?: boolean
    disableFlipByClick?: boolean
  }

  export interface FlipEvent<T> {
    data: T
  }

  export class PageFlip {
    constructor(root: HTMLElement, settings: FlipSettings)
    loadFromHTML(items: HTMLElement[]): void
    loadFromImages(hrefs: string[]): void
    flipNext(corner?: 'top' | 'bottom'): void
    flipPrev(corner?: 'top' | 'bottom'): void
    flip(page: number, corner?: 'top' | 'bottom'): void
    update(): void
    turnToPage(page: number): void
    getCurrentPageIndex(): number
    getPageCount(): number
    getOrientation(): 'portrait' | 'landscape'
    /** Internal flip controller; typed where it's used. */
    getFlipController(): unknown
    on(event: 'flip', cb: (e: FlipEvent<number>) => void): this
    on(event: 'changeOrientation', cb: (e: FlipEvent<'portrait' | 'landscape'>) => void): this
    on(event: 'changeState', cb: (e: FlipEvent<'user_fold' | 'fold_corner' | 'flipping' | 'read'>) => void): this
    on(event: 'init', cb: (e: FlipEvent<unknown>) => void): this
    destroy(): void
  }
}
