# Flow Research For Graph UI

This is the current working recommendation for mapping software-development
flow into the TZ graph.

## Recommended Default: Graph-Superpowers Hybrid

Use `obra/superpowers` as the agent-workflow backbone and render every step as
graph nodes:

1. Brainstorm/spec: owner question becomes a short readable design node.
2. Plan: design is split into small task nodes with exact files and checks.
3. Subagent development: each task gets an agent-branch subtree.
4. Test-driven/verification: test nodes and comments attach to the feature.
5. Review: findings become blocking or follow-up graph nodes.
6. Finish branch: release/merge/handoff node closes the branch.

Why this fits this project:

- The owner wants short chunks instead of long TZ text.
- The graph already supports agent-branch overlays, visual keys, status filters,
  and testing comments.
- The methodology explicitly supports subagent-driven development, review, and
  verification before completion.

## Alternatives

### GitHub Flow

Best for small continuous-delivery teams. Model it as:

`idea -> branch -> commit -> PR -> CI/review -> merge -> deploy`

Strengths: simple, low ceremony, good for quick local graph-ui iteration.
Weakness: does not define product discovery or agent replacement rules.

### Git Feature Branch Workflow

Best when each feature needs isolation but release flow is simple. Model it as:

`feature node -> branch node -> implementation -> tests -> review -> merge`

Strengths: maps cleanly to agent branch subtrees.
Weakness: can become a task tracker without good discovery/review discipline.

### Gitflow

Best for release-based products with hotfix channels. Model it as:

`develop -> feature branches -> release branch -> main -> hotfix branch`

Strengths: explicit release and hotfix structure.
Weakness: heavier than this sidecar currently needs; likely too much cognitive
load for the owner's graph-first workflow.

### Shape Up

Best for product shaping and appetite-limited bets. Model it as:

`raw idea -> shaped pitch -> bet -> build cycle -> hill chart progress -> ship`

Strengths: excellent for reducing vague text into shaped work and showing
uncertainty/progress visually.
Weakness: less prescriptive about code review/TDD and agent replacement.

### SAFe

Best for many teams and program-level coordination. Model it as:

`portfolio/epic -> ART/program increment -> team feature -> iteration -> release`

Strengths: scales across teams and planning layers.
Weakness: too heavy for this local single-owner graph-ui sidecar right now.

## Practical Decision

Use the Graph-Superpowers Hybrid now:

- Superpowers gives the agent operating rules.
- GitHub Flow gives the branch/review/release lane.
- Shape Up concepts can be used for larger fuzzy features before implementation.
- Avoid Gitflow/SAFe unless this project grows into release trains or many
  coordinated teams.

## Sources

- https://github.com/obra/superpowers
- https://docs.github.com/get-started/quickstart/github-flow
- https://www.atlassian.com/git/tutorials/comparing-workflows/feature-branch-workflow
- https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow
- https://basecamp.com/shapeup
- https://framework.scaledagile.com/
