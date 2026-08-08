<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 똑똑 TokTok — project rules

This is a real service for social workers at day-care centres, used alongside
elderly people. Two documents govern it; when they disagree with convenience,
they win.

1. **`똑똑 2차.pdf`** — the design. Screens are built to match it. Each page
   component names its source frame (`deck p.N`). Don't redesign a screen
   without saying so.
2. **`생애여정_음악지도_전체기능명세서_v1.6.xlsx`** — the functional spec. Its
   P0 items are invariants, not preferences.

## Non-negotiables

- **No fact without a source.** `StoryItem.sources` is never empty. Text only
  becomes lyrics through `lyricInputs()` / `assertOnlyVerified()`.
- **AI output is a draft.** Lyrics and activity logs need a human approval step
  before they are final. Never auto-confirm.
- **Consent is per-purpose.** Five independent switches. Refusing one must
  offer an alternative path, never a dead end. Withdrawing 녹음 really does
  disable the microphone.
- **No clinical claims.** Record observed behaviour only. No mood inference, no
  diagnosis, no "therapeutic effect" language anywhere in copy.
- **No infantilising.** No levels, quests, characters, or mascots. Achievement
  is shown as an album and a record.
- **No impersonation.** Music styles describe moods, never real singers.

## The console is a management surface, not a reading surface

`/center` (센터장 콘솔) shows counts, states and deadlines. The spec's
permission matrix gives the director "기본 미열람" on 원음성 and only
"진행상태" on 전사·스토리, so **never add a screen there that renders an
elder's story, transcript, or lyrics**. Opening anything sensitive goes
through `validateAccessReason()` and lands in the audit log.

Other console rules that are code, not copy: `blockApproval()` (two-person
deletion), `canRequireConsent()` (홍보 동의 필수화 금지), `RETENTION_BOUNDS`
(무기한 금지), `safetyCritical` usage metrics (쿼터가 안전 기능을 막지 않음).
Staff workload is counts only — no scores, grades, or rankings.

## Accessibility is a build requirement

- All type sizes are in `rem`; the root font size follows `--text-scale` so the
  in-app 글자 크기 control scales the whole app. **Never hardcode `text-[Npx]`.**
- Box metrics stay in px so layout keeps its proportions.
- Contrast: 4.5:1 body, 3:1 large. Orange fills carrying text under 18.66px
  must use `brand-700`, not `brand-500`.
- Interactive targets ≥ 24px; primary CTAs ≥ 60px.
- Don't disable pinch zoom.

## Verifying

The design is mobile at 390px. Check work in a browser at that width before
calling it done — screens are compared against the deck, not against intent.
