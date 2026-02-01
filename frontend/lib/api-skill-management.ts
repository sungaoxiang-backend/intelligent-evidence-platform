import { buildApiUrl, getAuthHeader } from "@/lib/api"

type ApiEnvelope<T> = {
  code: number
  message: string
  data: T
}

function extractDetailMessage(detail: any): string {
  if (!detail) return "请求失败"
  if (typeof detail === "string") return detail
  if (typeof detail?.message === "string") return detail.message
  if (typeof detail?.error === "string" && typeof detail?.message === "string") {
    return `${detail.error}: ${detail.message}`
  }
  try {
    return JSON.stringify(detail)
  } catch {
    return "请求失败"
  }
}

export type SkillSummary = {
  id: string
  name: string
  description: string
}

export type SkillFileNode = {
  path: string
  type: "file" | "dir"
  size?: number | null
  updated_at?: string | null
  children?: SkillFileNode[] | null
}

export type SkillFileContent = {
  path: string
  is_binary: boolean
  content?: string | null
  content_base64?: string | null
}

export type AgentSummary = { id: string }

export type AgentPromptVersionSummary = {
  agent_id: string
  version: string
  lang: string
  active_skill_ids: string[]
  created_at: string
  updated_at: string
}

export type AgentPromptVersionDetail = AgentPromptVersionSummary & {
  content: string
}

export type PlaygroundRunResponse = {
  output: string
  session_id?: string | null
  total_cost_usd?: number | null
  raw?: any
}

async function parseJsonOrThrow(resp: Response) {
  const contentType = resp.headers.get("content-type") || ""
  const rawText = await resp.text()

  let json: any = null
  if (rawText) {
    try {
      json = JSON.parse(rawText)
    } catch {
      json = null
    }
  }

  if (!json) {
    const prefix = contentType ? `[${contentType}] ` : ""
    const snippet = rawText ? rawText.slice(0, 240) : ""
    throw new Error(`${prefix}HTTP ${resp.status}: ${snippet || "请求失败"}`)
  }

  if (typeof json?.code === "number") {
    const result = json as ApiEnvelope<any>
    if (result.code !== 200) throw new Error(result.message || "请求失败")
    return result
  }

  if (!resp.ok) {
    throw new Error(extractDetailMessage(json?.detail))
  }

  return json
}

export const skillManagementApi = {
  async listSkills(q?: string) {
    const url = buildApiUrl(`/skill-management/skills${q ? `?q=${encodeURIComponent(q)}` : ""}`)
    const resp = await fetch(url, { headers: getAuthHeader() })
    const result = await parseJsonOrThrow(resp)
    return result.data as SkillSummary[]
  },

  async getSkillTree(skillId: string) {
    const url = buildApiUrl(`/skill-management/skills/${encodeURIComponent(skillId)}/tree`)
    const resp = await fetch(url, { headers: getAuthHeader() })
    const result = await parseJsonOrThrow(resp)
    return result.data as SkillFileNode
  },

  async getSkillFile(skillId: string, path: string) {
    const url = buildApiUrl(
      `/skill-management/skills/${encodeURIComponent(skillId)}/file?path=${encodeURIComponent(path)}`
    )
    const resp = await fetch(url, { headers: getAuthHeader() })
    const result = await parseJsonOrThrow(resp)
    return result.data as SkillFileContent
  },

  async saveSkillFile(skillId: string, path: string, body: { is_binary: boolean; content?: string }) {
    const url = buildApiUrl(
      `/skill-management/skills/${encodeURIComponent(skillId)}/file?path=${encodeURIComponent(path)}`
    )
    const resp = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(body),
    })
    await parseJsonOrThrow(resp)
  },

  async listAgents() {
    const url = buildApiUrl(`/skill-management/agents`)
    const resp = await fetch(url, { headers: getAuthHeader() })
    const result = await parseJsonOrThrow(resp)
    return result.data as AgentSummary[]
  },

  async listPromptVersions(agentId: string) {
    const url = buildApiUrl(`/skill-management/agents/${encodeURIComponent(agentId)}/prompts`)
    const resp = await fetch(url, { headers: getAuthHeader() })
    const result = await parseJsonOrThrow(resp)
    return result.data as AgentPromptVersionSummary[]
  },

  async getPromptVersion(agentId: string, version: string) {
    const url = buildApiUrl(
      `/skill-management/agents/${encodeURIComponent(agentId)}/prompts/${encodeURIComponent(version)}`
    )
    const resp = await fetch(url, { headers: getAuthHeader() })
    const result = await parseJsonOrThrow(resp)
    return result.data as AgentPromptVersionDetail
  },

  async createPromptVersion(
    agentId: string,
    body: { version: string; lang: string; content: string; active_skill_ids?: string[] }
  ) {
    const url = buildApiUrl(`/skill-management/agents/${encodeURIComponent(agentId)}/prompts`)
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(body),
    })
    const result = await parseJsonOrThrow(resp)
    return result.data as AgentPromptVersionDetail
  },

  async updatePromptVersion(
    agentId: string,
    version: string,
    body: { lang?: string; content?: string; active_skill_ids?: string[] }
  ) {
    const url = buildApiUrl(
      `/skill-management/agents/${encodeURIComponent(agentId)}/prompts/${encodeURIComponent(version)}`
    )
    const resp = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(body),
    })
    const result = await parseJsonOrThrow(resp)
    return result.data as AgentPromptVersionDetail
  },

  async runPlayground(body: {
    agent_id: string
    prompt_version: string
    skill_ids: string[]
    message: string
    model?: string
    max_turns?: number
  }) {
    const url = buildApiUrl(`/skill-management/playground/run`)
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(body),
    })
    const result = await parseJsonOrThrow(resp)
    return result.data as PlaygroundRunResponse
  },
}
