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

export type SkillStatus = "draft" | "pending_review" | "approved" | "rejected"

export type SkillSummary = {
  id: string
  name: string
  description: string
  status: SkillStatus
  updated_at?: string | null
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

export type SkillVersionSummary = {
  version: string
  message: string
  created_at: string
}

export type SkillMeta = {
  status: SkillStatus
  versions: SkillVersionSummary[]
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

  async saveSkillFile(skillId: string, path: string, body: { is_binary: boolean; content?: string; content_base64?: string }) {
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

  async batchOps(skillId: string, ops: any[]) {
    const url = buildApiUrl(`/skill-management/skills/${encodeURIComponent(skillId)}/ops`)
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ ops }),
    })
    await parseJsonOrThrow(resp)
  },

  // Meta & Versioning
  async getSkillMeta(skillId: string) {
    const url = buildApiUrl(`/skill-management/skills/${encodeURIComponent(skillId)}/meta`)
    const resp = await fetch(url, { headers: getAuthHeader() })
    const result = await parseJsonOrThrow(resp)
    return result.data as SkillMeta
  },

  async updateSkillStatus(skillId: string, status: SkillStatus) {
    const url = buildApiUrl(`/skill-management/skills/${encodeURIComponent(skillId)}/status`)
    const resp = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ status }),
    })
    const result = await parseJsonOrThrow(resp)
    return result.data as SkillMeta
  },

  async listVersions(skillId: string) {
    const url = buildApiUrl(`/skill-management/skills/${encodeURIComponent(skillId)}/versions`)
    const resp = await fetch(url, { headers: getAuthHeader() })
    const result = await parseJsonOrThrow(resp)
    return result.data as SkillVersionSummary[]
  },

  async createVersion(skillId: string, message: string) {
    const url = buildApiUrl(`/skill-management/skills/${encodeURIComponent(skillId)}/versions`)
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ message }),
    })
    const result = await parseJsonOrThrow(resp)
    return result.data as SkillVersionSummary
  },

  async restoreVersion(skillId: string, versionId: string) {
    const url = buildApiUrl(`/skill-management/skills/${encodeURIComponent(skillId)}/versions/${encodeURIComponent(versionId)}/restore`)
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({}),
    })
    await parseJsonOrThrow(resp)
  },
}

