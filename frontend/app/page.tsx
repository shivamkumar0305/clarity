"use client"

import { useEffect, useMemo, useState } from "react"
import {
  login,
  register,
  createIdea,
  getIdeas,
  getIdea,
  isAuthenticated,
  clearTokens,
  ApiError,
} from "@/lib/api"
import { getIdeaPhases, type Idea } from "@/lib/roadmap"

type View = "landing" | "login" | "register" | "dashboard" | "new" | "loading" | "detail"

function Header({
  onHome,
  onIdeas,
  onAuth,
  isLoggedIn,
  onSignOut,
}: {
  onHome: () => void
  onIdeas: () => void
  onAuth: () => void
  isLoggedIn: boolean
  onSignOut: () => void
}) {
  return (
    <header className="topbar">
      <div
        className="container"
        style={{
          display: "flex",
          width: "100%",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <button className="wordmark" onClick={onHome}>
          idea / roadmap
        </button>
        <nav style={{ display: "flex", gap: 20 }}>
          <button className="nav-link" onClick={onIdeas}>
            Your ideas
          </button>
          {isLoggedIn ? (
            <button className="nav-link" onClick={onSignOut}>
              Sign out
            </button>
          ) : (
            <button className="nav-link" onClick={onAuth}>
              Sign in
            </button>
          )}
        </nav>
      </div>
    </header>
  )
}

function Landing({ go, isLoggedIn }: { go: (v: View) => void; isLoggedIn: boolean }) {
  return (
    <>
      <Header
        onHome={() => go("landing")}
        onIdeas={() => go(isLoggedIn ? "dashboard" : "login")}
        onAuth={() => go("login")}
        isLoggedIn={isLoggedIn}
        onSignOut={() => {
          clearTokens()
          go("login")
        }}
      />
      <main className="container hero">
        <div className="hero-inner">
          <div className="eyebrow">From thought to next step</div>
          <h1>Don&apos;t let good ideas become background noise.</h1>
          <p className="hero-copy">
            Give a raw idea some structure. Get a practical roadmap with phases, milestones, skills,
            and the resources to start building.
          </p>
          <div className="hero-actions">
            <button className="button" onClick={() => go(isLoggedIn ? "new" : "login")}>
              Build a roadmap <span aria-hidden="true">→</span>
            </button>
            {!isLoggedIn && (
              <button className="button ghost" onClick={() => go("login")}>
                Sign in
              </button>
            )}
          </div>
          <div className="feature-row">
            <div className="feature">
              <i className="dot" />
              Clear phases
            </div>
            <div className="feature">
              <i className="dot" />
              Concrete milestones
            </div>
            <div className="feature">
              <i className="dot" />
              Useful resources
            </div>
          </div>
        </div>
      </main>
    </>
  )
}

function Auth({
  mode,
  go,
  onAuthSuccess,
}: {
  mode: "login" | "register"
  go: (v: View) => void
  onAuthSuccess: () => void
}) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!username.trim() || !password.trim()) {
      setError("Please fill in all required fields")
      return
    }
    setError(null)
    setLoading(true)

    try {
      if (mode === "register") {
        await register(username.trim(), password.trim(), email.trim())
        // Auto login after successful registration
        await login(username.trim(), password.trim())
      } else {
        await login(username.trim(), password.trim())
      }
      onAuthSuccess()
      go("dashboard")
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError("Authentication failed. Please check your credentials.")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Header
        onHome={() => go("landing")}
        onIdeas={() => go("login")}
        onAuth={() => go(mode)}
        isLoggedIn={false}
        onSignOut={() => {}}
      />
      <main className="container">
        <form className="form-wrap" onSubmit={handleSubmit}>
          <div className="eyebrow">{mode === "login" ? "Welcome back" : "Start building"}</div>
          <h1 style={{ marginTop: 14 }}>
            {mode === "login" ? "Sign in" : "Create your account"}
          </h1>

          {error && (
            <div
              className="error"
              style={{
                marginBottom: 16,
                padding: "10px 14px",
                fontSize: 14,
                borderRadius: 6,
              }}
            >
              {error}
            </div>
          )}

          <label className="label" htmlFor="username">
            Username
          </label>
          <input
            className="input"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="your username"
            disabled={loading}
            required
          />

          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            className="input"
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            disabled={loading}
            required
          />

          {mode === "register" && (
            <>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input
                className="input"
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={loading}
              />
            </>
          )}

          <div className="form-actions" style={{ marginTop: 24 }}>
            <button className="button" type="submit" disabled={loading}>
              {loading
                ? mode === "login"
                  ? "Signing in..."
                  : "Creating account..."
                : mode === "login"
                ? "Sign in"
                : "Create account"}{" "}
              <span aria-hidden="true">→</span>
            </button>
            <button
              className="link"
              type="button"
              onClick={() => {
                setError(null)
                go(mode === "login" ? "register" : "login")
              }}
            >
              {mode === "login"
                ? "Need an account? Register"
                : "Already have an account? Sign in"}
            </button>
          </div>
        </form>
      </main>
    </>
  )
}

function Dashboard({
  go,
  select,
  isLoggedIn,
  onSignOut,
}: {
  go: (v: View) => void
  select: (idea: Idea) => void
  isLoggedIn: boolean
  onSignOut: () => void
}) {
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated()) {
      go("login")
      return
    }

    let isMounted = true
    setLoading(true)

    getIdeas()
      .then((data) => {
        if (isMounted) {
          setIdeas(data)
          setError(null)
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || "Failed to load ideas")
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [go])

  const handleSelect = async (idea: Idea) => {
    select(idea)
    go("detail")
    // Optionally fetch full idea detail to be sure fresh content is rendered
    try {
      const fullIdea = await getIdea(idea.id)
      select(fullIdea)
    } catch {}
  }

  return (
    <>
      <Header
        onHome={() => go("landing")}
        onIdeas={() => go("dashboard")}
        onAuth={() => go("login")}
        isLoggedIn={isLoggedIn}
        onSignOut={onSignOut}
      />
      <main className="container page">
        <div className="page-header">
          <div>
            <div className="eyebrow">Workspace</div>
            <h1 className="page-title" style={{ marginTop: 12 }}>
              Your ideas
            </h1>
          </div>
          <button className="button" onClick={() => go("new")}>
            New idea <span aria-hidden="true">+</span>
          </button>
        </div>

        {loading ? (
          <div className="error" style={{ color: "var(--muted)", borderColor: "var(--line)" }}>
            Loading your ideas...
          </div>
        ) : error ? (
          <div className="error">{error}</div>
        ) : ideas.length ? (
          <div className="cards">
            {ideas.map((idea) => (
              <button
                className="idea-card"
                key={idea.id}
                onClick={() => handleSelect(idea)}
              >
                <div className="card-top">
                  <span className="card-title">{idea.idea_title || "Untitled idea"}</span>
                  <span className="badge">{idea.status}</span>
                </div>
                <p className="card-excerpt">{idea.input_text}</p>
                <div className="card-bottom">
                  <span className="muted small">
                    {new Date(idea.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <span className="muted small">
                    {getIdeaPhases(idea).length} phases →
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="error" style={{ color: "var(--muted)", borderColor: "var(--line)" }}>
            No roadmaps yet. Start with the idea that keeps coming back.
          </div>
        )}
      </main>
    </>
  )
}

function NewIdea({
  go,
  onCreated,
  onError,
  isLoggedIn,
  onSignOut,
}: {
  go: (v: View) => void
  onCreated: (idea: Idea) => void
  onError: (msg: string) => void
  isLoggedIn: boolean
  onSignOut: () => void
}) {
  const [text, setText] = useState("")

  useEffect(() => {
    if (!isAuthenticated()) {
      go("login")
    }
  }, [go])

  const submit = async () => {
    if (!text.trim()) return
    go("loading")
    try {
      const idea = await createIdea(text.trim())
      onCreated(idea)
      go("detail")
    } catch (err: any) {
      onError(err.message || "Failed to generate roadmap. Please try again.")
      go("new")
    }
  }

  return (
    <>
      <Header
        onHome={() => go("landing")}
        onIdeas={() => go("dashboard")}
        onAuth={() => go("login")}
        isLoggedIn={isLoggedIn}
        onSignOut={onSignOut}
      />
      <main className="container">
        <div className="form-wrap" style={{ maxWidth: 680 }}>
          <div className="eyebrow">New roadmap</div>
          <h1 style={{ marginTop: 14 }}>What are you thinking about?</h1>
          <p className="hero-copy" style={{ fontSize: 15, marginTop: 18 }}>
            Share a one-liner or write a detailed brief. The more context you give, the more useful
            the first steps will be.
          </p>

          <label className="label" htmlFor="idea">
            Your idea
          </label>
          <textarea
            className="textarea"
            id="idea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="I want to build..."
          />
          <div className="form-actions">
            <span className="muted small">{text.length} characters</span>
            <button className="button" disabled={!text.trim()} onClick={submit}>
              Generate roadmap <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </main>
    </>
  )
}

function Loading() {
  const messages = [
    "Reading between the lines…",
    "Mapping out the phases…",
    "Finding useful resources…",
    "Making the next step concrete…",
  ]
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % messages.length), 4200)
    return () => clearInterval(timer)
  }, [messages.length])

  return (
    <main className="container loading">
      <div>
        <div className="eyebrow">Generating roadmap</div>
        <h1 style={{ fontSize: 32, letterSpacing: "-.05em", marginTop: 18 }}>
          {messages[index]}
        </h1>
        <div className="loader-line" />
        <p className="muted small">This can take a little while (~15-30s). Keep this window open.</p>
      </div>
    </main>
  )
}

function Detail({
  idea,
  go,
  isLoggedIn,
  onSignOut,
}: {
  idea: Idea | null
  go: (v: View) => void
  isLoggedIn: boolean
  onSignOut: () => void
}) {
  const [open, setOpen] = useState(0)
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!isAuthenticated()) {
      go("login")
    }
  }, [go])

  const phases = useMemo(() => getIdeaPhases(idea), [idea])

  if (!idea) {
    return (
      <>
        <Header
          onHome={() => go("landing")}
          onIdeas={() => go("dashboard")}
          onAuth={() => go("login")}
          isLoggedIn={isLoggedIn}
          onSignOut={onSignOut}
        />
        <main className="container page">
          <div className="error">
            No roadmap selected.{" "}
            <button className="link" onClick={() => go("dashboard")}>
              Back to dashboard →
            </button>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <Header
        onHome={() => go("landing")}
        onIdeas={() => go("dashboard")}
        onAuth={() => go("login")}
        isLoggedIn={isLoggedIn}
        onSignOut={onSignOut}
      />
      <main className="container page">
        <div className="detail-header">
          <div className="eyebrow">Roadmap / {idea.status}</div>
          <h1>{idea.idea_title || "Idea Roadmap"}</h1>
          <p className="muted">{idea.input_text}</p>
        </div>

        {idea.status === "failed" ? (
          <div className="error">
            <p style={{ fontWeight: 500, marginBottom: 8 }}>Generation Failed</p>
            <p>{idea.error_message ?? "Something went wrong while generating this roadmap."}</p>
            <button className="link" onClick={() => go("new")} style={{ marginTop: 14 }}>
              Try another idea →
            </button>
          </div>
        ) : phases.length === 0 ? (
          <div className="error" style={{ color: "var(--muted)", borderColor: "var(--line)" }}>
            {idea.status === "pending"
              ? "Roadmap generation is in progress..."
              : "No phases available for this roadmap."}
          </div>
        ) : (
          phases.map((phase, phaseIndex) => {
            const steps = Array.isArray(phase.steps) ? phase.steps : []
            const skills = Array.isArray(phase.skills_required) ? phase.skills_required : []
            return (
              <section className="phase" key={phase.phase_name || phaseIndex}>
                <button
                  className="phase-button"
                  onClick={() => setOpen(open === phaseIndex ? -1 : phaseIndex)}
                  aria-expanded={open === phaseIndex}
                >
                  <span className="phase-number">0{phaseIndex + 1}</span>
                  <span className="phase-name">{phase.phase_name}</span>
                  <span className="chevron">{open === phaseIndex ? "−" : "+"}</span>
                </button>

                {open === phaseIndex && (
                  <div className="phase-content">
                    <div>
                      {steps.map((step, i) => {
                        const key = `${phaseIndex}-${i}`
                        return (
                          <label className="check" key={key}>
                            <input
                              type="checkbox"
                              checked={!!checked[key]}
                              onChange={() =>
                                setChecked((c) => ({ ...c, [key]: !c[key] }))
                              }
                            />{" "}
                            <span
                              style={{
                                textDecoration: checked[key] ? "line-through" : "none",
                                color: checked[key] ? "var(--dim)" : undefined,
                              }}
                            >
                              {step}
                            </span>
                          </label>
                        )
                      })}
                    </div>

                    <div className="milestone">
                      <span
                        className="small"
                        style={{
                          display: "block",
                          color: "var(--accent)",
                          marginBottom: 7,
                        }}
                      >
                        MILESTONE
                      </span>
                      {phase.milestone}
                    </div>

                    <div className="muted small">SKILLS &amp; RESOURCES</div>
                    <div className="skill-list">
                      {skills.map((skill, sIdx) => {
                        const resources = Array.isArray(skill.resources) ? skill.resources : []
                        const hasResources = resources.length > 0
                        return (
                          <div className="skill" key={skill.skill_name || sIdx}>
                            {skill.skill_name}
                            {hasResources &&
                              resources.map((resource, rIdx) => (
                                <a
                                  href={resource.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  key={resource.url || rIdx}
                                >
                                  {resource.title} ↗
                                </a>
                              ))}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </section>
            )
          })
        )}
      </main>
    </>
  )
}

export default function Home() {
  const [view, setView] = useState<View>("landing")
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null)
  const [loggedIn, setLoggedIn] = useState<boolean>(false)
  const [newIdeaError, setNewIdeaError] = useState<string | null>(null)

  useEffect(() => {
    setLoggedIn(isAuthenticated())

    const handleUnauthorized = () => {
      setLoggedIn(false)
      setView("login")
    }

    window.addEventListener("auth_unauthorized", handleUnauthorized)
    return () => {
      window.removeEventListener("auth_unauthorized", handleUnauthorized)
    }
  }, [])

  const go = (next: View) => {
    setLoggedIn(isAuthenticated())
    setView(next)
  }

  const handleSignOut = () => {
    clearTokens()
    setLoggedIn(false)
    setView("login")
  }

  const content = useMemo(() => {
    if (view === "landing") {
      return <Landing go={go} isLoggedIn={loggedIn} />
    }
    if (view === "login" || view === "register") {
      return (
        <Auth
          mode={view}
          go={go}
          onAuthSuccess={() => {
            setLoggedIn(true)
          }}
        />
      )
    }
    if (view === "dashboard") {
      return (
        <Dashboard
          go={go}
          select={setSelectedIdea}
          isLoggedIn={loggedIn}
          onSignOut={handleSignOut}
        />
      )
    }
    if (view === "new") {
      return (
        <div>
          {newIdeaError && (
            <div
              className="container"
              style={{ marginTop: 20, marginBottom: -10 }}
            >
              <div className="error">{newIdeaError}</div>
            </div>
          )}
          <NewIdea
            go={go}
            onCreated={(idea) => {
              setNewIdeaError(null)
              setSelectedIdea(idea)
            }}
            onError={(msg) => setNewIdeaError(msg)}
            isLoggedIn={loggedIn}
            onSignOut={handleSignOut}
          />
        </div>
      )
    }
    if (view === "loading") {
      return <Loading />
    }
    return (
      <Detail
        idea={selectedIdea}
        go={go}
        isLoggedIn={loggedIn}
        onSignOut={handleSignOut}
      />
    )
  }, [view, selectedIdea, loggedIn, newIdeaError])

  return <div className="app-shell">{content}</div>
}
