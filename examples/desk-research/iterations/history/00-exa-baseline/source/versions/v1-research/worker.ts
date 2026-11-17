import { defineWorker } from "@gea-ai/agent-sdk/worker";
import agent from "./agent";

export default defineWorker({ agents: { "product-research": agent } });
