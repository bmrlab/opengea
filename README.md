# OpenGEA

Independent examples for building applications with [GEA](https://musegea.com/developers).
Each example owns its dependencies and lockfile. There is no root workspace or shared runtime to install.

| Example                                                | What you build                                                                                                                                 |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| [basic](examples/basic/)                               | A real Hacker News research Agent, a Benchmark, and a self-hosted Next.js chat application using AI SDK and AI Elements.                       |
| [oauth-app](examples/oauth-app/)                       | Complete single-Worker app: TanStack Start, GEA OAuth, embedded MuseDAM Agent, user connections, attachments and SQLite sessions.              |
| [agents-api](examples/agents-api/)                     | One HTTP flow for Local and Preview: prepare a Session, upload files, edit Computer, run an Agent and reuse its outputs.                       |
| [observational-memory](examples/observational-memory/) | Configurable context management: raw history, default summaries and a chat DO observations strategy, with recall and prompt-cache comparisons. |
| [feishu-channel](examples/feishu-channel/)             | A Feishu bot backed by an Agent, with WebSocket message delivery, typed runtime credentials and sender isolation.                              |
| [subagents](examples/subagents/)                       | Private nested Agents, explicit same-Worker references and self copies, with automatic parent continuation and isolated child history.         |

Start with [oauth-app](examples/oauth-app/) for the complete deployable application; the other examples focus on specific APIs and Agent patterns. Read each example README. You need Node.js and pnpm. Agent examples need a Creative Reasoning API key for local model calls; The complete OAuth Worker app uses a GEA application registration and built-in SQLite; no external database is needed. Agent development additionally requires a supported GEA CLI platform. Building the Next.js application works independently of the CLI, including on Linux.

[Developer documentation](https://musegea.com/developers) · [Agent + Next.js guide](https://musegea.com/developers/agent-nextjs) · [Agent Studio configuration](https://musegea.com/developers/agent-studio-configuration)

## Contributing

Put each example under `examples/<name>/`, with its own installation, configuration, verification and deployment instructions. Use published public packages; never add dependencies on a private repository or cross-repository workspace links. Keep credentials and generated Agent artifacts out of Git.

Licensed under Apache-2.0. Vendored AI Elements and shadcn components retain their upstream licenses; see each example's third-party notices.
