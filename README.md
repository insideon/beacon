<p align="center">
  <h1 align="center">Beacon</h1>
  <p align="center">AI coding tools see the moment. Beacon sees the trajectory.</p>
  <p align="center">
    <a href="https://github.com/insideon/beacon/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License"></a>
    <a href="https://www.npmjs.com/package/beacon-ai"><img src="https://img.shields.io/npm/v/beacon-ai.svg" alt="npm version"></a>
    <a href="https://github.com/insideon/beacon/actions"><img src="https://img.shields.io/github/actions/workflow/status/insideon/beacon/ci.yml?branch=main" alt="CI"></a>
  </p>
</p>

---

Beacon is the persistent monitoring layer for your codebase. While AI coding tools like Claude Code are powerful in the moment, they start fresh every session. Beacon runs continuously — in CI, on a schedule, or from the terminal — accumulating structured insights over time so you always know where your project stands and where it's heading.

It reads your git history, code structure, dependencies, and documentation to generate prioritized task lists, health metrics, and strategic recommendations that persist across sessions and are shared across your team.

## Why Beacon?

AI coding tools are powerful in the moment but ephemeral — each session starts from scratch. Beacon fills the gap:

| | AI Coding Tools | Beacon |
|---|---|---|
| **Duration** | Session-based | Persistent across sessions |
| **Trigger** | Human prompts | Runs unattended (CI, cron, CLI) |
| **Output** | Free-form text | Structured, comparable metrics |
| **Scope** | One conversation | Team-wide shared state |
| **Time axis** | Snapshot | Trends over time |

## Features

- **Persistent Analysis** — Structured results cached per commit, accumulating over time
- **Unattended Operation** — Runs in CI, cron, or terminal without human prompting
- **Prioritized Todo Lists** — AI-generated tasks ranked by urgency and impact
- **Strategic Recommendations** — High-level direction for your project's growth
- **Multiple Data Sources** — Git history, code quality, dependencies, documentation
- **5 LLM Providers** — Claude, OpenAI, Google Gemini, GitHub Copilot, OpenRouter
- **GitHub Action** — Automatic PR analysis with comment posting
- **JSON Output** — Machine-readable output for CI/CD and dashboards

## Quick Start

```bash
# Install globally
npm install -g beacon-ai

# Set up your LLM provider (opens browser for API key)
beacon login

# Analyze your project
beacon
```

`beacon login` will guide you through provider selection:

```
? Select LLM provider:
  > Claude (Anthropic)
    OpenAI
    Google (Gemini)
    GitHub Copilot
    OpenRouter

Get your API key here: https://console.anthropic.com/settings/keys
? Paste your API key: ****
✓ Saved! Run 'beacon analyze' to get started.
```

## Usage

### Commands

| Command | Description |
|---------|-------------|
| `beacon` | Run full analysis (default) |
| `beacon analyze` | Run project analysis with AI recommendations |
| `beacon todo` | Get a prioritized task list |
| `beacon todo --today` | Show only today's top tasks |
| `beacon status` | Quick project overview without AI (no API key needed) |
| `beacon trend` | Show project health trends over time |
| `beacon gate` | CI quality gate — check health against thresholds |
| `beacon diff [base]` | Compare current branch health against a base branch |
| `beacon sprint` | Generate a sprint/standup report from git activity |
| `beacon report` | Stakeholder-friendly project health report |
| `beacon webhook <url>` | Send analysis results to Slack or Discord |
| `beacon onboard` | Generate a getting-started guide for new developers |
| `beacon monorepo` | Analyze all packages in a monorepo |
| `beacon issues` | Create GitHub Issues from recommendations |
| `beacon analyze --consensus` | Multi-model consensus analysis |
| `beacon schedule set HH:MM` | Schedule daily reminder notifications |
| `beacon init` | Create a `.beaconrc.json` config file |
| `beacon login` | Set up your LLM provider and API key |

### Global Options

| Option | Description |
|--------|-------------|
| `--json` | Output results as JSON |
| `--verbose` | Show detailed progress logs |
| `--no-cache` | Skip cache and force fresh analysis |
| `-V, --version` | Show version number |
| `-h, --help` | Show help information |

### Example Output

```
🔍 Beacon - my-project

📊 Project Status: Active TypeScript project with 45 files across 8 modules.
   Recent activity shows focus on API endpoints and auth improvements.
   3 TODO items and 1 FIXME found in source code.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Today's Tasks (by priority)

 1. 🟠 [high] Add input validation to API endpoints
    → Missing validation on user-facing routes
    Effort: small

 2. 🟠 [high] Resolve FIXME in payment processing
    → Edge case in refund calculation
    Effort: small

 3. 🟡 [medium] Add error handling for external API calls
    → Network failures not gracefully handled
    Effort: medium

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 Strategic Suggestions: Consider adding integration tests
   for critical paths before scaling the API layer.
```

## Configuration

Beacon stores API keys securely in `~/.beacon/credentials.json` via `beacon login`. For project-specific settings, create a `.beaconrc.json`:

```json
{
  "llm": {
    "provider": "claude",
    "model": "claude-sonnet-4-6"
  },
  "analyze": {
    "include": ["src/**", "lib/**"],
    "exclude": ["node_modules", "dist", ".git"],
    "maxDepth": 5
  }
}
```

Run `beacon init` to generate this file with defaults.

### Config Resolution Order

1. `.beaconrc.json` in project root (highest priority)
2. `~/.beacon/credentials.json` (set by `beacon login`)
3. Environment variables (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc.)

## Architecture

```
Collectors (parallel) → Context Builder → LLM Analyzer → Presenter
```

| Component | Role |
|-----------|------|
| **GitCollector** | Commit history, branches, uncommitted changes |
| **CodeCollector** | File structure, TODO/FIXME comments, line counts |
| **ConfigCollector** | Dependencies, scripts, project metadata |
| **DocsCollector** | README, CHANGELOG, LICENSE presence and content |
| **ContextBuilder** | Assembles collector data into structured context |
| **LLM Analyzer** | Sends context to LLM, validates structured response |
| **Cache** | Stores results by git commit hash in `.beacon/cache/` |
| **Presenter** | Formats output for terminal or JSON |

## Supported Providers

| Provider | Default Model |
|----------|--------------|
| Claude (Anthropic) | claude-sonnet-4-6 |
| OpenAI | gpt-4o |
| Google Gemini | gemini-2.5-flash |
| GitHub Copilot | gpt-4o |
| OpenRouter | anthropic/claude-sonnet-4 |
| Ollama (local) | llama3.1 |

## GitHub Action

Automatically analyze your codebase on every pull request:

```yaml
name: Beacon Analysis
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  analyze:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: insideon/beacon@v1
        with:
          provider: claude
          api-key: ${{ secrets.ANTHROPIC_API_KEY }}
```

### Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `provider` | no | `claude` | LLM provider name |
| `api-key` | yes | — | API key for the provider |
| `model` | no | provider default | LLM model override |

## Development

```bash
# Clone the repository
git clone https://github.com/insideon/beacon.git
cd beacon

# Install dependencies
npm install

# Run tests
npm test

# Type check
npm run typecheck

# Build
npm run build
```

## Roadmap

### Continuous Monitoring — "always watching, even when you're not"
- [x] Trend tracking — Accumulate analysis per commit to visualize tech debt and health over time
- [x] Scheduled reminders — Daily task notifications at your preferred time
- [x] Dependency alerts — Proactive notifications for vulnerabilities and outdated packages
- [x] CI quality gate — Block PRs that fall below configurable health thresholds
- [x] Branch impact analysis — `beacon diff main..feature` to assess how a branch affects project health

### Team Visibility — "shared context, not private conversations"
- [ ] Team dashboard — Aggregate project health across repositories
- [ ] Multi-repo analysis — Organization-level insights across multiple repositories
- [x] Slack/Discord webhook — Automatically push analysis results to team channels
- [x] Sprint reports — Auto-generate standup/retrospective summaries from git activity
- [x] Non-developer reports — Structured project summaries for PMs and stakeholders
- [x] Issue tracker integration — Auto-create GitHub Issues from detected problems

### AI Tool Integration — "make your AI coding tools smarter"
- [ ] Auto-pilot mode — Dispatch detected tasks to AI coding agents for execution
- [x] Project onboarding — `beacon onboard` generates a getting-started guide for new developers

### Extensibility
- [x] Custom prompt templates — User-defined analysis prompts
- [x] Multi-model consensus — Run multiple LLMs and synthesize a unified analysis
- [x] Local LLM support — Run analysis with Ollama for security-sensitive codebases
- [ ] Plugin system — Custom collectors and analysis rules per team
- [x] Monorepo support — Per-package analysis and dependency mapping within monorepos

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
