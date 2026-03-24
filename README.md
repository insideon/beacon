<p align="center">
  <h1 align="center">Beacon</h1>
  <p align="center">Your codebase has a purpose. Beacon finds it.</p>
  <p align="center">
    <a href="https://github.com/insideon/beacon/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License"></a>
    <a href="https://www.npmjs.com/package/beacon-ai"><img src="https://img.shields.io/npm/v/beacon-ai.svg" alt="npm version"></a>
    <a href="https://github.com/insideon/beacon/actions"><img src="https://img.shields.io/github/actions/workflow/status/insideon/beacon/ci.yml?branch=main" alt="CI"></a>
  </p>
</p>

---

Beacon is an AI-powered CLI tool that analyzes your codebase and tells you what to work on next. It reads your git history, code structure, project config, and documentation to generate prioritized task lists and strategic recommendations.

## Features

- **Smart Analysis** — Understands your project's purpose, tech stack, and current state
- **Prioritized Todo Lists** — AI-generated tasks ranked by urgency and impact
- **Strategic Recommendations** — High-level direction for your project's growth
- **Multiple Data Sources** — Git history, code quality, dependencies, documentation
- **Pluggable LLM Backend** — Claude (default), with OpenAI and Ollama support planned
- **JSON Output** — Machine-readable output for CI/CD integration

## Quick Start

```bash
# Install globally
npm install -g beacon-ai

# Initialize configuration
beacon init

# Set your API key
export ANTHROPIC_API_KEY=your-key-here

# Analyze your project
beacon
```

## Usage

```bash
# Full analysis with today's tasks (default)
beacon

# Analyze project health
beacon analyze

# Get prioritized todo list
beacon todo
beacon todo --today    # Focus on today's tasks

# Quick status without LLM (no API key needed)
beacon status

# JSON output for automation
beacon analyze --json
beacon todo --json
```

### Example Output

```
🔍 Beacon - my-awesome-app

📊 Project Status: Active development, v0.3.2
   Last commit: 2h ago | This week: 12 commits | Active branches: 3

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Today's Tasks (by priority)

 1. 🔴 [critical] Fix token expiry validation in auth module
    → src/auth/session.ts:42 — missing expiry check
    Effort: small

 2. 🟡 [high] Review and merge PR #23
    → feature/user-profile branch, created 3 days ago
    Effort: small

 3. 🔵 [medium] Update lodash to 4.17.21
    → Security patch available
    Effort: small

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 Strategic Suggestions: Test coverage is at 23%.
   Consider adding tests for core modules (auth, payment).
```

## Configuration

Beacon uses a `.beaconrc.json` file in your project root:

```json
{
  "llm": {
    "provider": "claude",
    "model": "claude-sonnet-4-6",
    "apiKey": "$ANTHROPIC_API_KEY"
  },
  "analyze": {
    "include": ["src/**", "lib/**"],
    "exclude": ["node_modules", "dist", ".git"],
    "maxDepth": 5
  }
}
```

Run `beacon init` to generate this file with sensible defaults.

## Architecture

Beacon uses a pipeline architecture:

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
| **Presenter** | Formats output for terminal or JSON |

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

- [ ] OpenAI provider
- [ ] Ollama provider (local LLM)
- [ ] GitHub Action integration
- [ ] Web dashboard
- [ ] Analysis result caching
- [ ] Custom prompt templates

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
