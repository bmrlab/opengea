# OpenGEA

Build, evaluate and improve an Agent with [GEA Agent Builder](https://musegea.com/developers).

The repository focuses on one complete example: **[Desk Research](examples/desk-research/)**, a product innovation assistant researching breakfast opportunities for commuting office workers.

- [Quick Start（中文）](examples/desk-research/QUICKSTART.md) / [English](examples/desk-research/QUICKSTART.en.md): follow the canonical developer walkthrough, from Project creation to evaluation-driven development.
- [Exa quality iterations](examples/desk-research/iterations/README.md): fixed tools and cases, actual trajectories, focused changes and regression results.
- [Validation](examples/desk-research/VALIDATION.md): local checks and remaining live acceptance.

Start in `examples/desk-research`. Use Node 24.16.0, pnpm 12.8.1 and a compatible GEA CLI/Runtime. Dependencies and lockfile are independent of any private repository. Real research requires model access and an authorized Exa research-search Connection; Feishu additionally requires a test bot. No research findings or Eval scores are fabricated.

The workbench is a complete local development frontend, not a multi-user public deployment. Follow its README for credentials and data boundaries.

Older examples are retained in Git history. Do not copy their retired SDK or private Worker invocation patterns into new applications.

## Contributing

Keep the example reproducible using public packages. Maintain both tutorials and the runnable stages together. Run type checks, tests, Agent validation and packaging; separately record live model, evaluation and channel acceptance. Keep credentials, `.gea/`, dependencies and generated Agent artifacts out of Git.

Licensed under Apache-2.0.

## Repository consolidation

The previous 11 examples and their workflows were retired in favor of this complete research workflow; their source remains in Git history. The separate [Eval Simulator proposal #32](https://github.com/bmrlab/opengea/pull/32) is superseded by the multi-turn benchmark here. Its backpack scenario and historical evidence remain on that PR branch; they are not presented as Desk Research results.
