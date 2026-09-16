export type IdeaStatus = "pending" | "done" | "failed"

export interface Resource {
  title: string
  url: string
}

export interface Skill {
  skill_name: string
  resources: Resource[]
}

export interface Phase {
  phase_name: string
  steps: string[]
  milestone: string
  skills_required: Skill[]
}

export interface Idea {
  id: number
  idea_title: string
  input_text: string
  phases: Phase[] | string | null
  status: IdeaStatus
  error_message: string | null
  created_at: string
}

export function getIdeaPhases(idea: Idea | null | undefined): Phase[] {
  if (!idea || !idea.phases) return []
  if (Array.isArray(idea.phases)) return idea.phases
  if (typeof idea.phases === "string") {
    try {
      const parsed = JSON.parse(idea.phases)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}
