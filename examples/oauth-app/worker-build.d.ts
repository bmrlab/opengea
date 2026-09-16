declare module "*/dist/server/index.js" {
  const worker: {
    fetch(request: Request, env: unknown, ctx: unknown): Promise<Response>;
  };
  export default worker;
  export {
    LoginFlow,
    OAuthSession,
    ConversationRuns,
  } from "./server/session-objects";
}
