// Keep Worker types module-scoped so they do not override browser DOM types.
declare module "cloudflare:workers" {
  export const DurableObject: typeof import("@cloudflare/workers-types").CloudflareWorkersModule.DurableObject;
  export const env: import("./server/env").WorkerBindings;
}

declare module "*.md" {
  const content: string;
  export default content;
}
