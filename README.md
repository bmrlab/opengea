# OpenGEA

Small, independent examples for building applications with [GEA](https://musegea.com/developers).
Each example owns its dependencies and lockfile. There is no root workspace or shared runtime to install.

| Example                        | What you build                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| [basic](examples/basic/)       | A real Hacker News research Agent, a Benchmark, and a self-hosted Next.js chat application using AI SDK and AI Elements. |
| [ask-muse](examples/ask-muse/) | An Agent that searches user-authorized MuseDAM assets through OAuth MCP, with no UI or custom Tool wrapper.              |

Start with the example README. You need Node.js, pnpm, and a Creative Reasoning API key for local model calls. Agent development additionally requires a supported GEA CLI platform. Building the Next.js application works independently of the CLI, including on Linux.

[Developer documentation](https://musegea.com/developers) · [Agent + Next.js guide](https://musegea.com/developers/agent-nextjs) · [Agent Studio configuration](https://musegea.com/developers/agent-studio-configuration)

## Contributing

Put each example under `examples/<name>/`, with its own installation, configuration, verification and deployment instructions. Use published public packages; never add dependencies on a private repository or cross-repository workspace links. Keep credentials and generated Agent artifacts out of Git.

Licensed under Apache-2.0. Vendored AI Elements and shadcn components retain their upstream licenses; see each example's third-party notices.
