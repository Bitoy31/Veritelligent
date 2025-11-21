# Grid Quest — Design Brief

## Overview

- Name: Grid Quest
- Purpose: Team-based, turn-driven classroom game using a category grid of customizable point-valued clues. Built for projection (teacher) and responsive mobile (students). Maintain unified layouts across views; avoid external game branding/themes.

## Players, Teams, and Representatives

- Teams: 2–8. If present students < selected groups, cap groups to present.
- Balanced distribution:
  - p = min(selectedGroups, presentCount)
  - base = floor(n / p), r = n % p
  - group[i].size = base + (i < r ? 1 : 0)
- Representatives: One active player per team; rotate the representative each turn within a team (queue semantics; skip absent).

## Board Configuration

- Categories: 3–7 (default 5).
- Levels per category: 3–5 (default 5).
- Per-clue custom: each tile defines its own `points`, `prompt`, `acceptedAnswers[]` (synonyms), optional `timeLimitSec`, and optional media.

## Answer Rules

- Input: Text.
- Matching: Case-insensitive, spelling-sensitive; trim and collapse spaces; must exactly match one of `acceptedAnswers[]` after normalization. No fuzzy/partial in v1.

## Scoring

- Correct: add the clue’s points.
- Wrong: deduct the clue’s points if setting is ON (default ON); if OFF, wrong yields 0.

## Timing and Reveal

- Pre-timer delay: 3 seconds after clue reveal.
- Answer timer: from each clue’s `timeLimitSec` (default 20s).
- Auto-submit: on timeout, submit whatever text was typed (can be empty); ignore late submissions.
- Suspense: ~2 seconds delay; then reveal correctness; update scoreboard.

## Turn Engine (No Buzz-In)

- Randomly select starting team; show “Next: Team X” indicator (current team and who’s next).
- Current team selects a tile (category + level) → reveal clue to both views → 3s delay → timer starts.
- Only the current team’s representative sees an answer input; others are spectators.
- After reveal/scoring, teacher presses Next/Play to proceed; representatives rotate within the team that just played; turn advances to next team. Tile becomes disabled.
- End when board exhausted or teacher presses End.

## End Conditions

- End when all tiles are taken or teacher ends; persist session end and standings.

## Data Model Snapshot

- Task (GridQuestTask):
  - subjectId, title, description, status: draft|published|closed
  - settings: { allowNegativeOnWrong (default true), preTimerSec: 3, suspenseRevealSec: 2 }
  - categories: [{ name, clues: [{ points, timeLimitSec?, prompt, acceptedAnswers: string[], media?: { type, url } }] }]
- Session (reuse GameSession):
  - category: 'party', gameType: 'grid_quest', isTeamBased: true
  - roomCode, teams: [{ teamId, name, memberIds[] }], representatives: { [teamId]: studentId }
  - status, startedAt, endedAt
- Logs (for analytics): per-turn entries: { teamId, repId, catIdx, clueIdx, submittedText, correct, pointsDelta, timeTakenSec }

## Socket Events

- Reuse: host_register, join_room, lobby_update, countdown_update, timer_tick, pause_timer, resume_timer, finish_game, restart_game.
- Grid Quest specific (prefix gq\_\*):
  - gq_team_setup { teams[], representatives }
  - gq_board_state { tiles: [{ catIdx, clueIdx, status: 'available'|'taken'|'disabled' }] }
  - gq_select_clue → gq_clue_reveal { catIdx, clueIdx, prompt, points, timeLimitSec }
  - gq_answer_submit (from active rep), gq_answers_locked (on timeout)
  - gq_answer_result { teamId, correct, pointsAwarded }
  - gq_score_update { scores: [{ teamId, score }] }
  - gq_next_turn { teamId }

## Implementation Phases

- Phase A: UI harness + sockets (in-memory loop to test the flow in two tabs).
- Phase B: Task CRUD + board data from DB; teacher management page.
- Phase C: Persistence of per-turn logs + session analytics/leaderboards.
