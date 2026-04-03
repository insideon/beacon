# Continuous Monitoring — Design Spec

## Overview

Add persistent health tracking to Beacon so it accumulates structured metrics over time. This is the core differentiator: AI coding tools see the moment, Beacon sees the trajectory.

## Core Concept: Health Snapshot

Every analysis run automatically records a **HealthSnapshot** — a quantified point-in-time measurement of project health.

### HealthSnapshot Schema

```typescript
interface HealthSnapshot {
  timestamp: string;        // ISO 8601
  commitHash: string;       // git HEAD at time of snapshot
  branch: string;           // current branch
  version?: string;         // package.json version if available
  metrics: HealthMetrics;
}

interface HealthMetrics {
  totalFiles: number;
  totalLines: number;
  todoCount: number;        // TODO + FIXME + HACK + XXX
  outdatedDeps: number;
  testCoverage?: number;    // percentage, if available
  vulnerabilities?: number; // from npm audit (new)
  recommendations: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  healthScore: number;      // 0-100, computed
}
```

### Health Score Calculation

Start at 100, deduct points:

| Condition | Deduction |
|-----------|-----------|
| Each critical recommendation | -15 |
| Each high recommendation | -8 |
| Each medium recommendation | -3 |
| Each low recommendation | -1 |
| Each TODO/FIXME in code | -0.5 (max -10) |
| Each outdated dependency | -1 (max -10) |
| Each vulnerability | -5 (max -20) |
| No test coverage data | -5 |
| Test coverage < 50% | -10 |
| Test coverage 50-79% | -5 |

Floor at 0. The formula is intentionally simple and deterministic — same inputs always produce the same score.

### Storage

- **Location**: `.beacon/history/` directory (project-local)
- **File naming**: `{YYYY-MM-DDTHH-mm-ss}-{shortHash}.json`
- **Example**: `.beacon/history/2026-04-03T14-30-00-abc1234.json`
- **Deduplication**: Skip recording if the most recent snapshot has the same commit hash
- One file per snapshot. Git-friendly, no merge conflicts, scalable.

## Feature 1: Trend Tracking

### Command: `beacon trend`

Reads all snapshots from `.beacon/history/`, sorts by timestamp, and displays health trends.

**Terminal output:**

```
📈 Beacon Trend — beacon-ai (last 10 snapshots)

Score  100 ┤
        90 ┤          ╭──
        80 ┤     ╭────╯
        70 ┤─────╯
        60 ┤
            └──────────────────
             Mar 28  Mar 30  Apr 2

  Date       Commit   Score  TODOs  Issues  Deps
  Mar 28     a1b2c3d  71     12     8       3
  Mar 30     d4e5f6g  78     8      5       3
  Apr 02     h7i8j9k  82     6      4       1
  Apr 03     l0m1n2o  91     3      2       0

  Trend: ▲ +20 points over 6 days
```

**Options:**
- `--limit N` — show last N snapshots (default: 10)
- `--json` — output raw snapshot array
- `--metric <name>` — focus on specific metric (score, todos, deps, issues)

**No API key required.** This reads local history files only.

### Auto-recording

`beacon analyze` and `beacon todo` automatically call `recordSnapshot()` after a successful analysis. This happens alongside existing cache writes — no extra user action needed.

The snapshot is derived from:
- `ProjectContext` (totalFiles, totalLines, todoCount, outdatedDeps, testCoverage)
- `AnalysisResult` (recommendation counts by priority)
- Computed healthScore

## Feature 2: CI Quality Gate

### Command: `beacon gate`

Runs a full analysis, records a snapshot, then checks metrics against configured thresholds.

**Exit codes:**
- `0` — all checks pass
- `1` — one or more checks fail

**Terminal output (pass):**
```
✔ Health score: 85 (min: 70)
✔ Critical issues: 0 (max: 0)
✔ Vulnerabilities: 0 (max: 5)
All checks passed.
```

**Terminal output (fail):**
```
✔ Health score: 85 (min: 70)
✗ Critical issues: 2 (max: 0)
✔ Vulnerabilities: 0 (max: 5)
Gate failed: 1 check(s) did not pass.
```

### Configuration

In `.beaconrc.json`:

```json
{
  "gate": {
    "minScore": 70,
    "maxCritical": 0,
    "maxHigh": 5,
    "maxVulnerabilities": 5
  }
}
```

All thresholds are optional. Unconfigured checks are skipped.

### GitHub Action Integration

```yaml
- uses: insideon/beacon@v1
  with:
    provider: claude
    api-key: ${{ secrets.ANTHROPIC_API_KEY }}
    command: gate
```

## Feature 3: Dependency Alerts

### Changes to ConfigCollector

Add two new data gathering steps:

1. **`npm audit --json`** — parse vulnerability counts by severity
2. **`npm outdated --json`** — parse outdated packages with current/wanted/latest versions

Both run via `execSync` with try/catch (graceful failure if npm not available).

### New fields in ProjectContext

```typescript
// Add to health in ProjectContext
health: {
  todos: TodoItem[];
  outdatedDeps: Dependency[];  // already exists, enhance with wanted/latest
  testCoverage?: number;
  vulnerabilities?: {          // NEW
    total: number;
    critical: number;
    high: number;
    moderate: number;
    low: number;
  };
}
```

### Output

Vulnerability info is included in:
- `beacon status` — shows vulnerability summary
- `beacon analyze`/`beacon todo` — fed to LLM as context, reflected in recommendations
- `beacon gate` — checked against thresholds
- `beacon trend` — tracked over time

## Feature 4: Branch Impact Analysis

### Command: `beacon diff [base]`

Compares the current branch's health against a base branch (default: `main`).

**How it works:**
1. Look up the most recent snapshot for the current branch
2. Look up the most recent snapshot for the base branch
3. If either is missing, run analysis to generate it
4. Compute and display deltas

**Terminal output:**

```
📊 Branch Impact — feature/auth vs main

  Metric          main    feature/auth    Delta
  Health Score    85      78              ▼ -7
  TODOs           3       6              ▼ +3
  Critical        0       1              ▼ +1
  High            2       3              ▼ +1
  Outdated Deps   1       1              — 0

  Impact: This branch decreases health score by 7 points.
  New issues: 1 critical, 1 high
```

**Options:**
- `--json` — output as JSON
- `--verbose` — show full recommendation diff

## Feature 5: Scheduled Reminders

### Command: `beacon schedule`

Sets up recurring analysis notifications using system scheduling.

**Subcommands:**
- `beacon schedule set <time>` — schedule daily at HH:MM (e.g., `09:00`)
- `beacon schedule off` — remove schedule
- `beacon schedule status` — show current schedule

**Implementation (macOS):**
- Uses `launchd` plist in `~/Library/LaunchAgents/com.beacon.reminder.plist`
- Runs `beacon todo --today` and pipes to `osascript` for native notification
- Fallback: `terminal-notifier` if available

**Implementation (Linux):**
- Uses user crontab (`crontab -e`)
- Runs `beacon todo --today` and pipes to `notify-send`

**Implementation (CI/server):**
- Not applicable — this is a local developer feature

## New Files

```
src/
├── history/
│   ├── types.ts          # HealthSnapshot, HealthMetrics interfaces
│   ├── store.ts          # recordSnapshot(), getSnapshots(), getLatestSnapshot()
│   └── score.ts          # calculateHealthScore()
│   └── __tests__/
│       ├── store.test.ts
│       └── score.test.ts
├── cli/commands/
│   ├── trend.ts          # beacon trend
│   ├── gate.ts           # beacon gate
│   ├── diff.ts           # beacon diff
│   └── schedule.ts       # beacon schedule
```

## Modified Files

| File | Change |
|------|--------|
| `src/cli/index.ts` | Register 4 new commands |
| `src/cli/commands/analyze.ts` | Add `recordSnapshot()` call after analysis |
| `src/cli/commands/todo.ts` | Add `recordSnapshot()` call after analysis |
| `src/collectors/config.ts` | Add npm audit + npm outdated data gathering |
| `src/context/types.ts` | Add `vulnerabilities` to health |
| `src/context/builder.ts` | Wire vulnerability data into ProjectContext |
| `src/config/types.ts` | Add `GateConfig` to `BeaconConfig` |
| `src/config/loader.ts` | Add gate config defaults |
| `.beaconrc.json` | Add gate config example |

## Implementation Order

1. **History module** (`history/types.ts`, `score.ts`, `store.ts` + tests)
2. **Auto-recording** (integrate into analyze.ts, todo.ts)
3. **`beacon trend`** command + tests
4. **`beacon gate`** command + config + tests
5. **Dependency alerts** (collector extension + context type changes)
6. **`beacon diff`** command + tests
7. **`beacon schedule`** command (macOS + Linux)

Each step is independently shippable. Steps 1-3 form the MVP.

## Out of Scope

- Web dashboard UI (Team Visibility roadmap category)
- Multi-repo aggregation (Team Visibility roadmap category)
- Slack/Discord webhooks (Team Visibility roadmap category)
- Historical data migration from existing cache files
