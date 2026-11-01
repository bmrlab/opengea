import { getAppEnv, workerEnv } from "./env";
import { HttpError } from "./gea";
import { loadSession } from "./session";
import { probeObjectName } from "../lib/namespace-probe";

export async function createNamespaceProbe(request: Request) {
  try {
    const app = getAppEnv();
    if (app.AGENT_ENVIRONMENT !== "preview")
      throw new HttpError(403, "preview_required", "Use the Preview application.");
    if (request.headers.get("origin") !== app.APP_ORIGIN)
      throw new HttpError(403, "invalid_origin", "Invalid request origin.");
    const current = await loadSession(request);
    const probeId = crypto.randomUUID();
    const record = {
      probeId,
      marker: `synthetic-${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
    };
    const objectName = probeObjectName(
      app.AGENT_ENVIRONMENT,
      current.token.organization.id,
      probeId,
    );
    const receipt = await workerEnv.NAMESPACE_PROBES.getByName(objectName).create(record);
    return Response.json(receipt, {
      status: 201,
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return Response.json(
      error instanceof HttpError
        ? { code: error.code, message: error.message }
        : { code: "probe_failed", message: "The synthetic record was not confirmed. Do not automatically retry." },
      {
        status: error instanceof HttpError ? error.status : 502,
        headers: { "cache-control": "no-store" },
      },
    );
  }
}
