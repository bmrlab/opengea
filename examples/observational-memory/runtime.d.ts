// Minimal types for the Runtime APIs used by this standalone example.
declare module "cloudflare:workers" {
  interface Storage {
    get<T>(key: string): Promise<T | undefined>;
    put(key: string, value: unknown): Promise<void>;
    transaction<T>(operation: (storage: Storage) => Promise<T>): Promise<T>;
  }
  export class DurableObject {
    protected ctx: { storage: Storage };
    constructor(ctx: { storage: Storage });
  }
}
