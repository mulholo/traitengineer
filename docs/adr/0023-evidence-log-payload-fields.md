# 0023. Evidence-log payload fields

- Status: accepted
- Date: 2026-10-14

## Context

Section 1 of the v1 spec says an evidence-log entry should capture "What I expected", "What I did", "What
happened", "What this supports" and "What remains uncertain". Section 4 defines the payload as `summary`
(required, 1–280 chars), `details`, `difficulty` (1–5) and `tags` (≤ 10). The two lists disagree.

## Decision

Use the union, with `summary` as "What I did":

| Prompt                 | Field        | Rules                                                                              |
| ---------------------- | ------------ | ---------------------------------------------------------------------------------- |
| What I did             | `summary`    | required, 1–280 chars (the config `prompt`, default "What did you do?", labels it) |
| What I expected        | `expected`   | optional text                                                                      |
| What happened          | `happened`   | optional text                                                                      |
| What this supports     | `supports`   | optional text                                                                      |
| What remains uncertain | `uncertain`  | optional text                                                                      |
| Other notes            | `details`    | optional text                                                                      |
| Difficulty             | `difficulty` | optional integer 1–5 (shown when config `askDifficulty`)                           |
| Tags                   | `tags`       | ≤ 10 strings, default `[]`                                                         |

Only `summary` is required so an entry can still be logged in three taps; the reflection fields are shown on
the quick-log form but can be left blank.

## Alternatives considered

- Make all five reflection prompts required: slows quick capture, contradicts "log an entry quickly".
- Drop `details`: section 4 names it, and it costs nothing as an optional field.
