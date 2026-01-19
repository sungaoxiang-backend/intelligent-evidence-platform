import { API_CONFIG } from '@/lib/config'
import { Message, QuickAction } from '@/hooks/use-video-creation-sse'

interface Session {
    id: number
    title: string
    created_at: string
    updated_at: string
    last_message?: string
}

export const videoCreationApi = {
    createSession: async (initialMessage?: string): Promise<Session> => {
        const response = await fetch(`${API_CONFIG.BASE_URL}/video-creation/sessions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem(API_CONFIG.TOKEN_KEY)}`
            },
            body: JSON.stringify({ initial_message: initialMessage })
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.detail || '创建会话失败')
        }

        const data = await response.json()
        return data.data
    },

    getSessions: async (): Promise<Session[]> => {
        const response = await fetch(`${API_CONFIG.BASE_URL}/video-creation/sessions`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem(API_CONFIG.TOKEN_KEY)}`
            }
        })
        const data = await response.json()
        return data.data || []
    },

    getSessionMessages: async (sessionId: number): Promise<Message[]> => {
        const response = await fetch(
            `${API_CONFIG.BASE_URL}/video-creation/sessions/${sessionId}/messages`,
            {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem(API_CONFIG.TOKEN_KEY)}`
                }
            }
        )
        const data = await response.json()
        return data.data || []
    },

    deleteSession: async (sessionId: number): Promise<void> => {
        await fetch(`${API_CONFIG.BASE_URL}/video-creation/sessions/${sessionId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem(API_CONFIG.TOKEN_KEY)}`
            }
        })
    },

    getQuickActions: async (): Promise<QuickAction[]> => {
        const response = await fetch(`${API_CONFIG.BASE_URL}/video-creation/quick-actions`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem(API_CONFIG.TOKEN_KEY)}`
            }
        })
        const data = await response.json()
        return data.data || []
    }
}
