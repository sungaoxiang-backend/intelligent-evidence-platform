import { buildApiUrl, getAuthHeader } from './api'
import { Case } from './types'

export interface CaseInfoCommit {
    id: number
    case_id: number
    statement?: string
    materials: {
        name: string
        url: string
        type?: string
    }[]
    created_at: string
}

export interface CaseAnalysisReport {
    id: number
    case_id: number
    content: {
        cause?: string
        party_info?: string
        court?: string
        claims?: string
        rights_obligations?: string
        conclusion?: string
        follow_up?: string
        [key: string]: any
    }
    created_at: string
}

async function fetchWrapper<T>(url: string, options: RequestInit = {}): Promise<T> {
    const resp = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...getAuthHeader(),
            ...options.headers,
        }
    })

    // Determine response type based on status or content type?
    // Assuming JSON for now
    if (resp.status === 204) {
        return {} as T
    }

    const data = await resp.json()
    // Check for backend standard response wrapper { code: 200, data: T }
    // Based on api.ts, it seems to return { code: 200, data: ... } or { items: ..., total: ... }
    // But api.ts logic is inconsistent:
    // getCases returns { data: ..., pagination: ... }
    // createCase returns { data: ... }
    // Let's assume standard response and return 'data' if present, or the body itself if loosely typed.

    if (data.code && (data.code === 200 || data.code === 201)) {
        return data.data as T
    } else if (data.code) { // Error from backend
        throw new Error(data.message || "请求失败")
    }

    // If no code, maybe it returns direct data? Or it's paginated wrapper?
    // Replicating api.ts behavior for getCases:
    // return { data: result.data, pagination: result.pagination }
    // But here we expect T.

    return data as T
}

export const caseAnalysisApi = {
    // Get all cases (simplified list for analysis dashboard)
    getCases: async (skip = 0, limit = 100) => {
        const url = buildApiUrl(`/cases?skip=${skip}&limit=${limit}`)
        const resp = await fetch(url, { headers: getAuthHeader() }) // GET doesn't need Content-Type usually
        const result = await resp.json()
        if (result.code === 200) {
            // Return matching format for our usage: { items: Case[], total: number }
            // api.ts getCases returns { data: Case[], pagination: ... }
            // We need to map it.
            return { items: result.data as Case[], total: result.pagination?.total || 0 }
        }
        throw new Error(result.message || "Failed to fetch cases")
    },

    // Get single case details
    getCase: async (id: number) => {
        const url = buildApiUrl(`/cases/${id}`)
        const resp = await fetch(url, { headers: getAuthHeader() })
        const result = await resp.json()
        if (result.code === 200) return result.data as Case
        throw new Error(result.message || "Failed to fetch case")
    },

    // Get commits for a case
    getCommits: async (caseId: number) => {
        // Mock or calling endpoint
        // Assuming backend endpoint /cases/{id}/commits exists or similar
        // For now, since backend IS NOT implemented for commits, return []
        // to avoid 404s breaking the UI unless we are testing that SPECIFIC part
        // But wait, the user wants "graceful degradation", so let's try fetch and catch 404
        try {
            const url = buildApiUrl(`/cases/${caseId}/commits`)
            const resp = await fetch(url, { headers: getAuthHeader() })
            if (!resp.ok) return []
            const result = await resp.json()
            if (result.code === 200) return result.data as CaseInfoCommit[]
            return []
        } catch {
            return []
        }
    },

    // Create a commit
    createCommit: async (caseId: number, data: { statement?: string; materials?: any[] }) => {
        const url = buildApiUrl(`/cases/${caseId}/commits`)
        const resp = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeader()
            },
            body: JSON.stringify(data)
        })
        const result = await resp.json()
        if (result.code === 200 || result.code === 201) return result.data as CaseInfoCommit
        throw new Error(result.message || "Failed to create commit")
    },

    // Delete commits
    deleteCommits: async (caseId: number, commitIds: number[]) => {
        const url = buildApiUrl(`/cases/${caseId}/commits/batch-delete`)
        const resp = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeader()
            },
            body: JSON.stringify({ ids: commitIds })
        })
        const result = await resp.json()
        if (result.code === 200) return true
        throw new Error(result.message || "Failed to delete commits")
    },

    // Get analysis reports
    getReports: async (caseId: number) => {
        try {
            const url = buildApiUrl(`/cases/${caseId}/reports`)
            const resp = await fetch(url, { headers: getAuthHeader() })
            if (!resp.ok) return []
            const result = await resp.json()
            if (result.code === 200) return result.data as CaseAnalysisReport[]
            return []
        } catch {
            return []
        }
    },
}
