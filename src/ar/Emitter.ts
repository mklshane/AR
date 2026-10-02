type Handler<T> = (payload: T) => void

/** Tiny typed event emitter — the only bridge between AR logic and React. */
export class Emitter<Events extends Record<string, unknown>> {
  private handlers: { [K in keyof Events]?: Set<Handler<Events[K]>> } = {}

  on<K extends keyof Events>(event: K, fn: Handler<Events[K]>): () => void {
    ;(this.handlers[event] ??= new Set()).add(fn)
    return () => this.handlers[event]?.delete(fn)
  }

  protected emit<K extends keyof Events>(event: K, payload: Events[K]) {
    this.handlers[event]?.forEach((fn) => fn(payload))
  }
}
