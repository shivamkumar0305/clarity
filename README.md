# Idea Roadmap Generator

Ideas — startup ideas, side projects, things you want to learn — usually get lost in a "blackhole" of inactivity. This app takes a raw idea (a one-liner or a detailed brief) and turns it into a structured, actionable roadmap: phases, implementation steps, a milestone per phase, and the specific skills + learning resources needed to get there.

## How it works

1. You submit an idea as plain text.
2. The backend runs a two-stage LLM pipeline via Groq:
   - **Researcher** — plans the roadmap, fires live web searches (DuckDuckGo) to ground resource links in real, current documentation/tutorials, and synthesizes a full text roadmap.
   - **Formatter** — takes that text and locks it into strict, schema-validated JSON (Groq's structured outputs) so the shape is always predictable.
3. The result is saved and returned as an `Idea` — a title, and a list of phases, each with steps, a milestone, and required skills (with resource links where the researcher found them).

## Tech stack

| Layer | Choice |
|---|---|
| Backend | Django + Django REST Framework |
| Auth | SimpleJWT (access/refresh tokens) |
| LLM | Groq API (`openai/gpt-oss-120b`), structured outputs (`json_schema`, strict mode) |
| Web search | `ddgs` (DuckDuckGo search, no API key required) |
| Database | SQLite (dev) — swap for Postgres before any real deployment |
| Frontend | Next.js (App Router) + TypeScript + Tailwind, scaffolded with v0 |
| Async jobs | None yet — generation runs synchronously in the request (see Known limitations) |

## Project structure

```
core/                  # Django project (settings, root urls)
accounts/              # registration + JWT auth endpoints
ideas/
  models.py            # Idea model
  services.py          # the two-stage Groq pipeline (researcher -> formatter)
  serializers.py
  views.py
  urls.py
frontend/               # Next.js app (v0-generated, wired to the API below)
```

## Setup

### Backend

```bash
python -m venv venv
source venv/bin/activate        # or venv\Scripts\activate on Windows

pip install django djangorestframework djangorestframework-simplejwt \
            django-cors-headers groq ddgs python-dotenv

# .env (project root, same level as manage.py)
echo "GROQ_API_KEY=your_key_here" > .env

python manage.py makemigrations
python manage.py migrate
python manage.py runserver
```

Backend runs at `http://localhost:8000`.

### Frontend

```bash
cd frontend
npm install

# .env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

npm run dev
```

Frontend runs at `http://localhost:3000`.

> CORS must be configured on the backend (`django-cors-headers`, `CORS_ALLOWED_ORIGINS` including `http://localhost:3000`) for these two to talk to each other in dev.

## API reference

All `/api/ideas/*` endpoints require `Authorization: Bearer <access_token>`.

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/auth/register/` | `{ username, password, email }` | `201` created user |
| POST | `/api/auth/login/` | `{ username, password }` | `200 { access, refresh }` |
| POST | `/api/auth/login/refresh/` | `{ refresh }` | `200 { access }` |
| POST | `/api/ideas/` | `{ input_text }` | `201 Idea` on success, `502 Idea` (`status: "failed"`) on generation failure — **synchronous, typically 15–30s+** |
| GET | `/api/ideas/list/` | — | `200 Idea[]`, scoped to the current user, newest first |
| GET | `/api/ideas/:id/` | — | `200 Idea`, `404` if not owned by the current user |

### `Idea` object

```json
{
  "id": 1,
  "idea_title": "string",
  "input_text": "string",
  "phases": [
    {
      "phase_name": "string",
      "steps": ["string"],
      "milestone": "string",
      "skills_required": [
        { "skill_name": "string", "resources": [{ "title": "string", "url": "string" }] }
      ]
    }
  ],
  "status": "pending | done | failed",
  "error_message": "string | null",
  "created_at": "ISO 8601 timestamp"
}
```

`resources` is often an empty array for a given skill — the researcher stage only searches for links, not every skill mentioned; this is expected.

## Known limitations (current MVP state)

- **No async task queue.** `POST /api/ideas/` blocks the request for the full duration of the LLM pipeline (~15–30s+). Celery + Redis + status polling is planned but deliberately deferred to keep the MVP simple.
- **No clarifying-questions flow yet.** A one-line input goes straight into generation rather than prompting follow-up questions first, even though the original spec calls for this on vague input.
- **`ddgs` has no official API key/SLA** — it scrapes DuckDuckGo, so search calls can occasionally fail or rate-limit. Failures are caught and passed back to the LLM as a "no results" string rather than crashing the pipeline.
- **SQLite in dev** — fine for now, not suitable for concurrent production use.

## Roadmap

- [ ] Celery + Redis for async generation with status polling
- [ ] Clarifying-questions branch for vague one-line inputs
- [ ] Postgres for production
- [ ] Rate limiting on `/api/ideas/` (LLM + search calls aren't free at scale)
- [ ] Deploy (backend: Render/Railway free tier; frontend: Vercel)