# BIOBUZZ FTC Scouting Prototype

BIOBUZZ is a Spanish-first FTC scouting prototype for the 2026–2027 season. It is intended for early workflow testing with scouts, coaches, and team members. The app starts empty and does not include example teams, matches, observations, scores, or performance data.

## Current functionality

- Dashboard with live counts and empty states.
- Registration and editing of teams, observed capabilities, and review status.
- Match creation with four distinct registered teams assigned to red and blue positions.
- Four independent robot scouting panels with draft and submitted observations.
- Browser-local persistence, JSON export, validated import preview, and reset confirmation.
- Empty analytics and alliance selection layouts.
- Scoring module remains unconfigured; it does not calculate estimated scores or Ranking Points.

Official event imports, shared workspaces, cloud sync, authentication, and quantitative analytics are not connected. Do not use this prototype as a secure multi-user database.

## Requirements

- Node.js 20.9 or newer.
- npm.
- Chromium for Playwright E2E tests.

The Node.js minimum follows the [Next.js installation requirements](https://nextjs.org/docs/app/getting-started/installation).

## Install and run locally

From the repository root:

```bash
npm install
npm run dev
```

Open the local URL printed by Next.js. No environment variables are required for the current application.

Run project checks with:

```bash
npm run lint
npm run typecheck
npm run build
```

Install the Playwright browser once, then run the browser workflow tests:

```bash
npx playwright install chromium
npm run test:e2e
```

E2E tests use temporary records in isolated browser contexts. They do not seed application data.

## Browser-local data

Teams, matches, and scouting observations are stored in the current browser's local storage. They do not sync between users, browsers, or devices. Clearing browser data can remove these records, so export a JSON backup from **Datos y ajustes** before resetting the app or clearing site storage. Imported records are validated and previewed before confirmation.

The app starts with empty local data. A blank observation field remains blank; it does not mean zero performance or a failed action. The scoring rules are unconfigured because no applicable official BIOBUZZ manual has been verified in this project. No score or Ranking Point formulas should be added until the official rules are confirmed.

## First GitHub commit

This workspace already has a local Git repository on branch `main`. Before creating the first commit, review the proposed file list and contents:

```bash
git status --short --branch
git add -A
git diff --cached --check
git diff --cached --stat
git diff --cached
```

Only commit after reviewing the staged diff:

```bash
git commit -m "Initial BIOBUZZ scouting prototype"
```

This workspace currently has no GitHub remote. Create an empty repository on GitHub, then connect and push the reviewed commit:

```bash
git remote add origin https://github.com/<OWNER>/<REPOSITORY>.git
git push -u origin main
```

Choose repository visibility deliberately. Nothing is pushed or published by the local preparation steps above.

## First Vercel deployment

After the reviewed repository has been pushed:

1. In Vercel, choose **Add New → Project** and import the GitHub repository.
2. Set the project root directory to the repository root (`./`).
3. Confirm Vercel detects **Next.js**. Keep the detected install, build, and output settings; the production build command is `npm run build`. Select Node.js `24.x` to match the [current Vercel default](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions) and the runtime used for local verification. Next.js requires Node.js 20.9 or newer.
4. Leave environment variables empty; this app does not need any.
5. Review the project and deploy. After the build completes, open the deployment URL and check navigation, empty states, team/match registration, and local persistence.

Vercel provides Preview and Production deployments. Use a non-production branch or pull request to review a Preview URL first; merging the approved change to the configured production branch publishes the production deployment. See [Vercel deployment environments](https://vercel.com/docs/deployments/environments) and [Next.js on Vercel](https://vercel.com/frameworks/nextjs).

## Future updates

1. Open this same project in VS Code and create a feature branch: `git switch -c <branch-name>`.
2. Make changes and run `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run test:e2e` locally.
3. Review `git diff`, stage intended files with `git add <paths>`, and inspect `git diff --cached`.
4. Commit and push the branch: `git commit -m "Describe the change"` and `git push -u origin <branch-name>`.
5. Review the Vercel Preview deployment from the pull request.
6. Merge the approved pull request into the production branch; Vercel then builds and deploys that revision.

The application remains in this repository and Vercel project for future updates. Do not commit local environment files, browser exports, credentials, or real scouting records.
