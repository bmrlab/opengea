import type { DurableObjectState } from "@cloudflare/workers-types";
import { DurableObject } from "cloudflare:workers";
import { z } from "zod";
import type { AuthConfig } from "./env";
import {
  revokeRefreshToken,
  tokenRequest,
  tokenSchema,
  userSchema,
} from "./gea";
import { seal, unseal } from "./store";

const payloadSchema = z.object({ token: tokenSchema, user: userSchema });
export type SessionPayload = z.infer<typeof payloadSchema>;
type SessionRow = {
  payload: string;
  token_expires_at: number;
  expires_at: number;
  status: "active" | "reauth_required" | "logout_pending";
};

export class LoginFlow extends DurableObject<unknown> {
  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env);
    ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS flow (
      id INTEGER PRIMARY KEY CHECK (id = 1), state_hash TEXT NOT NULL,
      payload TEXT NOT NULL, expires_at INTEGER NOT NULL
    )`);
  }
  async create(stateHash: string, verifier: string, secret: string) {
    const expiresAt = Date.now() + 5 * 60_000;
    const payload = await seal({ verifier }, this.ctx.id.toString(), secret);
    this.ctx.storage.sql.exec(
      "INSERT INTO flow VALUES (1, ?, ?, ?)",
      stateHash,
      payload,
      expiresAt,
    );
    await this.ctx.storage.setAlarm(expiresAt);
  }
  async consume(stateHash: string, secret: string) {
    const row = this.ctx.storage.sql
      .exec<{ payload: string }>(
        "DELETE FROM flow WHERE id = 1 AND state_hash = ? AND expires_at > ? RETURNING payload",
        stateHash,
        Date.now(),
      )
      .toArray()[0];
    if (!row) return null;
    // The caller cannot exchange the code until this RPC's deletion is durable.
    return z
      .object({ verifier: z.string() })
      .parse(await unseal(row.payload, this.ctx.id.toString(), secret));
  }
  async remove() {
    this.ctx.storage.sql.exec("DELETE FROM flow");
  }
  async alarm() {
    this.ctx.storage.sql.exec("DELETE FROM flow");
  }
}

export class OAuthSession extends DurableObject<unknown> {
  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env);
    ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS session (
      id INTEGER PRIMARY KEY CHECK (id = 1), payload TEXT NOT NULL,
      token_expires_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('active', 'reauth_required', 'logout_pending'))
    )`);
  }
  async create(payload: SessionPayload, config: AuthConfig) {
    const expiresAt = Date.now() + 7 * 86400_000;
    const encrypted = await seal(
      payload,
      this.ctx.id.toString(),
      config.TOKEN_ENCRYPTION_KEY,
    );
    this.ctx.storage.sql.exec(
      "INSERT INTO session VALUES (1, ?, ?, ?, 'active')",
      encrypted,
      Date.now() + payload.token.expires_in * 1000,
      expiresAt,
    );
    await this.ctx.storage.setAlarm(expiresAt);
  }
  async load(config: AuthConfig) {
    // Refresh and logout share the same input gate across HTTP callers and replicas.
    return this.ctx.blockConcurrencyWhile(async () => {
      const row = this.ctx.storage.sql
        .exec<SessionRow>("SELECT * FROM session WHERE id = 1")
        .toArray()[0];
      if (!row || row.status !== "active" || row.expires_at <= Date.now())
        return null;
      let payload = payloadSchema.parse(
        await unseal(
          row.payload,
          this.ctx.id.toString(),
          config.TOKEN_ENCRYPTION_KEY,
        ),
      );
      if (row.token_expires_at <= Date.now() + 60_000) {
        // Persist before the external exchange: a crash must never reuse a possibly rotated token.
        this.ctx.storage.sql.exec(
          "UPDATE session SET status = 'reauth_required' WHERE id = 1",
        );
        await this.ctx.storage.sync();
        try {
          const token = await tokenRequest(
            new URLSearchParams({
              grant_type: "refresh_token",
              refresh_token: payload.token.refresh_token,
            }),
            config,
          );
          if (
            token.application.id !== payload.token.application.id ||
            token.authorization.id !== payload.token.authorization.id ||
            token.organization.id !== payload.token.organization.id
          )
            throw new Error("Changed OAuth grant identity");
          payload = { ...payload, token };
          const encrypted = await seal(
            payload,
            this.ctx.id.toString(),
            config.TOKEN_ENCRYPTION_KEY,
          );
          this.ctx.storage.sql.exec(
            "UPDATE session SET payload = ?, token_expires_at = ?, status = 'active' WHERE id = 1",
            encrypted,
            Date.now() + token.expires_in * 1000,
          );
        } catch {
          // OAuth is an external protocol boundary; ambiguous exchanges require a new login.
          return null;
        }
      }
      return { ...payload, expiresAt: row.expires_at };
    });
  }
  async revoke(config: AuthConfig) {
    return this.ctx.blockConcurrencyWhile(async () => {
      const row = this.ctx.storage.sql
        .exec<SessionRow>("SELECT * FROM session WHERE id = 1")
        .toArray()[0];
      if (!row) return true;
      const { token } = payloadSchema.parse(
        await unseal(
          row.payload,
          this.ctx.id.toString(),
          config.TOKEN_ENCRYPTION_KEY,
        ),
      );
      this.ctx.storage.sql.exec(
        "UPDATE session SET status = 'logout_pending' WHERE id = 1",
      );
      await this.ctx.storage.sync();
      try {
        await revokeRefreshToken(token.refresh_token, config);
      } catch {
        return false;
      }
      this.ctx.storage.sql.exec("DELETE FROM session");
      return true;
    });
  }
  async alarm() {
    this.ctx.storage.sql.exec("DELETE FROM session");
  }
}

// One index per verified application/organization/user, so a new login can reconnect.
export class ConversationRuns extends DurableObject<unknown> {
  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env);
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS runs (session_id TEXT PRIMARY KEY, run_id TEXT NOT NULL)",
    );
  }
  getRun(sessionId: string) {
    return (
      this.ctx.storage.sql
        .exec<{ run_id: string }>(
          "SELECT run_id FROM runs WHERE session_id = ?",
          sessionId,
        )
        .toArray()[0]?.run_id ?? null
    );
  }
  remember(sessionId: string, runId: string) {
    this.ctx.storage.sql.exec(
      "INSERT INTO runs VALUES (?, ?) ON CONFLICT (session_id) DO UPDATE SET run_id = excluded.run_id",
      sessionId,
      runId,
    );
  }
}
