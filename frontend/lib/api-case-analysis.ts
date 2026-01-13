import { buildApiUrl, getAuthHeader } from './api'
import { Case } from './types'

export interface CaseInfoCommit {
    id: number
    case_id: number
    statement?: string
    materials: {
        name: string
        url: string
        type: string
    }[]
    created_at: string
}

// Report Content Interfaces
export interface SystemResource {
    skills: string[]
    assets: string[]
}

export interface CaseResources {
    statement?: string
    materials?: string[]
}

export interface LegalBasisResource {
    source_channel: string
    basis: string
    source_from?: string
    priority: number
}

export interface DimensionResult {
    question: string
    answer: string
    reason: string
    refs_case_resources?: CaseResources
}

export interface LegalDimensionResult {
    question: string
    answer: string
    reason: string
    refs_legal_resources: LegalBasisResource[]
}

export interface ConclusionDimensionResult {
    answer: string
    probability_info: {
        positive: string
        negative: string
        conflict: string
        confidence_score?: number
        confidence_level?: string
    }
}

export interface ReasoningSection {
    refs_system_resources: SystemResource
    results: DimensionResult[]
}

export interface LegalSection {
    refs_system_resources: SystemResource
    results: LegalDimensionResult
}

export interface ConclusionSection {
    refs_system_resources: SystemResource
    results: ConclusionDimensionResult[]
}

export interface ArgumentBlock {
    view_points: ReasoningSection
    evidences: ReasoningSection
    laws: LegalSection
    conclusion: ConclusionSection
}

export interface PartiesArgument {
    plaintiff: ArgumentBlock
    defendant: ArgumentBlock
}

export interface RightsObligationsArgument {
    formation: ArgumentBlock
    performance: ArgumentBlock
    breach: ArgumentBlock
}

export interface LegalReportContent {
    case_id: string
    case_title: string
    cause_of_action: ArgumentBlock
    parties: PartiesArgument
    jurisdiction: ArgumentBlock
    claims: ArgumentBlock
    rights_and_obligations_process: RightsObligationsArgument
    conclusion: {
        refs_system_resources: SystemResource
        summary: string
        probability_info: {
            positive: string
            negative: string
            conflict: string
            confidence_score?: number
            confidence_level?: string
        }
        pursuit_questions: {
            question: string
            type: string
        }[]
    }
}

export interface CaseAnalysisReport {
    id: number
    case_id: number
    content?: LegalReportContent
    // 触发元信息
    trigger_type: string  // commit_added, commit_updated, commit_removed, manual
    ref_commit_ids: number[]  // 引用的 commits ID 列表
    // 状态追踪
    status: string  // pending, processing, completed, failed
    error_message?: string
    created_at: string
    completed_at?: string
}

export interface TriggerAnalysisResponse {
    report_id: number
    task_id: string
    status: string
    message: string
}

export interface TaskStatus {
    task_id: string
    status: string  // PENDING, STARTED, PROCESSING, SUCCESS, FAILURE
    result?: any
    info?: {
        progress?: number
        message?: string
        case_id?: number
        report_id?: number
    }
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

    // Update a commit
    updateCommit: async (caseId: number, commitId: number, data: { statement?: string; materials?: any[] }) => {
        const url = buildApiUrl(`/cases/${caseId}/commits/${commitId}`)
        const resp = await fetch(url, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeader()
            },
            body: JSON.stringify(data)
        })
        const result = await resp.json()
        if (result.code === 200) return result.data as CaseInfoCommit
        throw new Error(result.message || "Failed to update commit")
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

    // Get latest completed report
    getLatestReport: async (caseId: number): Promise<CaseAnalysisReport | null> => {
        try {
            const url = buildApiUrl(`/cases/${caseId}/reports/latest`)
            const resp = await fetch(url, { headers: getAuthHeader() })
            if (!resp.ok) return null
            const result = await resp.json()
            if (result.code === 200) return result.data as CaseAnalysisReport
            return null
        } catch {
            return null
        }
    },

    // Get specific report by ID
    getReport: async (caseId: number, reportId: number): Promise<CaseAnalysisReport | null> => {
        try {
            const url = buildApiUrl(`/cases/${caseId}/reports/${reportId}`)
            const resp = await fetch(url, { headers: getAuthHeader() })
            if (!resp.ok) return null
            const result = await resp.json()
            if (result.code === 200) return result.data as CaseAnalysisReport
            return null
        } catch {
            return null
        }
    },

    // Trigger analysis manually
    triggerAnalysis: async (caseId: number, triggerType = "manual", commitIds?: number[]): Promise<TriggerAnalysisResponse> => {
        const url = buildApiUrl(`/cases/${caseId}/analyze`)
        const resp = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeader()
            },
            body: JSON.stringify({
                trigger_type: triggerType,
                commit_ids: commitIds || []
            })
        })
        const result = await resp.json()
        if (result.code === 200) return result.data as TriggerAnalysisResponse
        throw new Error(result.message || "Failed to trigger analysis")
    },

    // Get task status (for polling)
    getTaskStatus: async (taskId: string): Promise<TaskStatus> => {
        try {
            const url = buildApiUrl(`/tasks/status/${taskId}`)
            const resp = await fetch(url, { headers: getAuthHeader() })
            if (!resp.ok) throw new Error("Failed to get task status")
            const result = await resp.json()
            return result as TaskStatus
        } catch (e) {
            throw e
        }
    },

    // Get pending/processing reports for a case (to check if analysis is in progress)
    getPendingReports: async (caseId: number): Promise<CaseAnalysisReport[]> => {
        try {
            const reports = await caseAnalysisApi.getReports(caseId)
            return reports.filter(r => r.status === 'pending' || r.status === 'processing')
        } catch {
            return []
        }
    }
}

