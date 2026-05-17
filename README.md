# Fasting Timer

A small frontend-only intermittent fasting tracker. Set a fasting window, tap to start, tap to end. The dial is your window — a full revolution equals your target duration, and over-fasting renders as a second arc layered over the completed ring.

**Live:** [nokki34.github.io/fasting-timer](https://nokki34.github.io/fasting-timer/)

## Features

- Set a fasting window (e.g. 9pm–9am), wraps midnight
- One-tap start, confirm-on-end with editable end time
- Edit the start time if you forgot to tap (native datetime picker)
- Dial visualization with three states: in-progress, goal reached, over-fasting (overlap arc)
- State persisted in `localStorage`; reload mid-fast resumes
- Dark mode only

## Stack

Vite + TypeScript (no framework), Vitest for tests, deployed to GitHub Pages.

## Local development

```bash
npm install
npm run dev      # http://localhost:5173/fasting-timer/
npm test         # 38 unit tests
npm run build    # tsc + vite build → dist/
```

## Design

- Spec: [`docs/superpowers/specs/2026-05-17-fasting-timer-design.md`](docs/superpowers/specs/2026-05-17-fasting-timer-design.md)
- Implementation plan: [`docs/superpowers/plans/2026-05-17-fasting-timer.md`](docs/superpowers/plans/2026-05-17-fasting-timer.md)

## Deploy

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds and publishes via the official GitHub Pages Actions flow.
