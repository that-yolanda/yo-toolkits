// tiged 无官方类型声明,此处最小化声明所用 API
declare module 'tiged' {
  interface TigedEmitter {
    clone(dest: string): Promise<void>;
    on(event: string, cb: (...args: unknown[]) => void): this;
  }
  interface TigedOptions {
    force?: boolean;
    cache?: boolean;
    verbose?: boolean;
  }
  function tiged(src: string, opts?: TigedOptions): TigedEmitter;
  export default tiged;
}
