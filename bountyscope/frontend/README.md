# BountyScope frontend

A separate Next.js, TypeScript, and Tailwind application. It does not change the unrelated Pinterest bot at the repository root.

Requires Node.js 22 or later. From this directory:

```sh
npm ci
API_INTERNAL_URL=http://127.0.0.1:8000 npm run dev
```

The browser calls `/api/*` on the frontend origin. Next.js proxies those requests to `API_INTERNAL_URL`, which defaults to `http://api:8000` for Docker Compose. Set this variable before development startup or the production build; Next.js embeds rewrite destinations at build time. Docker builds accept `--build-arg API_INTERNAL_URL=http://api:8000`.

If server authentication is enabled, enter the configured API bearer token in Settings. It is stored in the current browser’s local storage. AI provider credentials are configured only on the backend.

Validation and production build:

```sh
npm run lint
npm run typecheck
npm run build
```

The Dockerfile runs the standalone production server as an unprivileged user. For a local standalone startup, copy the public files and static assets before launching:

```sh
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/
PORT=3000 HOSTNAME=0.0.0.0 node .next/standalone/server.js
```

Create a project with the six-step wizard, confirm authorization, then launch a scan from its detail page. The local fixture uses `http://example.test:8080`: add `allow_domain=example.test`, `allow_port=8080`, and explicitly opt in to private infrastructure. The project creation form explains these requirements. Scan details poll the API for progress and append-only events; inventories, finding triage, optional AI analysis, and Markdown/HTML reports use live API data.
