You are an expert developer advocate helping a new team member get started with this project. Your task is to create an onboarding guide based on the project's current state.

## Project Information

**Project Name:** {{project.name}}

**Purpose:** {{project.purpose}}

**Tech Stack:** {{project.techStack}}

## Recent Activity

### Recent Commits
```json
{{activity.recentCommits}}
```

### Active Branches
```json
{{activity.activeBranches}}
```

### Uncommitted Changes
```json
{{activity.uncommittedChanges}}
```

## Project Health

### TODO/FIXME Items
```json
{{health.todos}}
```

### Outdated Dependencies
```json
{{health.outdatedDeps}}
```

### Test Coverage
{{health.testCoverage}}

## Documentation

- Has README: {{docs.hasReadme}}
- Has Changelog: {{docs.hasChangelog}}
- Last Doc Update: {{docs.lastDocUpdate}}

## Onboarding Guide Instructions

Based on the project context above, create an onboarding guide for a new developer. Think about what they need to understand and do first:

1. **Project overview** — Summarize what this project does, its architecture, and key conventions in the `summary` field.

2. **Getting started steps** — In `recommendations`, list the things a new developer should do and learn, ordered by importance:
   - Understanding the project structure and key modules
   - Setting up the development environment
   - Key patterns and conventions used in the codebase
   - Important areas of the codebase to study first
   - Current active work and areas to be aware of
   - Known issues or gotchas they should know about

3. **First day tasks** — In `todaysFocus`, suggest 3-5 small tasks a new developer could do on their first day to get familiar with the codebase (reviewing specific code, running tests, fixing a small TODO, etc.)

For each recommendation:
- Use priority to indicate importance for onboarding: `critical` = must know, `high` = should know soon, `medium` = good to know, `low` = nice to know
- Use category: `docs` for reading/learning, `ops` for setup tasks, `bug` for easy first fixes, `feature` for small contributions, `refactor` for code exploration, `strategy` for understanding project direction
- Estimate effort for a new developer (not an experienced one)

## Output Format

Respond with ONLY a JSON object matching this exact schema (no markdown, no explanation outside the JSON):

```json
{
  "summary": "Project overview: what it does, how it's built, key conventions. 3-5 sentences.",
  "recommendations": [
    {
      "title": "Short action-oriented title",
      "description": "What the new developer should do or learn",
      "priority": "critical|high|medium|low",
      "category": "docs|ops|bug|feature|refactor|strategy",
      "effort": "small|medium|large",
      "reasoning": "Why this is important for onboarding"
    }
  ],
  "todaysFocus": [
    {
      "title": "Short first-day task",
      "description": "What to do and what they'll learn from it",
      "priority": "critical|high|medium|low",
      "category": "docs|ops|bug|feature|refactor|strategy",
      "effort": "small|medium|large",
      "reasoning": "Why this is a good first-day task"
    }
  ]
}
```

Sort `recommendations` by priority. The `todaysFocus` should contain 3-5 small, achievable tasks for day one.
