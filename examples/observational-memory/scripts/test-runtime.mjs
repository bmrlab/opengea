import { registerHooks } from "node:module";
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "cloudflare:workers")
      return {
        url:
          "data:text/javascript," +
          encodeURIComponent(
            "export class DurableObject { constructor(ctx) { this.ctx = ctx; } }",
          ),
        shortCircuit: true,
      };
    return next(specifier, context);
  },
});
