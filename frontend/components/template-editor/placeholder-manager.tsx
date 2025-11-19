"use client"

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import type { JSONContent } from "@tiptap/core"
import { templateApi } from "@/lib/template-api"

export type PlaceholderStatus = "bound" | "unbound" | "error" | "pending"

export interface PlaceholderPosition {
  from: number
  to: number
  path: number[]
}

export interface BackendPlaceholderMeta {
  id: number
  placeholder_name: string
  label?: string | null
  type: string
  required: boolean
  hint?: string | null
  default_value?: string | null
  options?: Array<{ label: string; value: string }>
  created_at?: string
  updated_at?: string
}

export interface PlaceholderMeta {
  id: string
  fieldKey: string
  label: string
  description?: string
  defaultValue?: string
  dataType?: string
  status: PlaceholderStatus
  position?: PlaceholderPosition
  source: "document" | "backend"
  backendMeta?: BackendPlaceholderMeta
  dirty?: boolean
}

export interface PlaceholderPayload {
  placeholder_name: string
  label?: string
  type: string
  required?: boolean
  hint?: string
  default_value?: string
  options?: Array<{ label: string; value: string }>
}

interface PlaceholderDocumentBridge {
  insert?: (payload: PlaceholderPayload) => Promise<void> | void
  rename?: (fieldKey: string, payload: PlaceholderPayload) => Promise<void> | void
  remove?: (fieldKey: string) => Promise<void> | void
}

interface PlaceholderContextValue {
  placeholders: Record<string, PlaceholderMeta>
  orderedPlaceholders: PlaceholderMeta[]
  selectedId: string | null
  highlightedId: string | null
  editingId: string | null
  isSyncing: boolean
  isMutating: boolean
  syncFromDoc: (doc?: JSONContent | null) => void
  loadBackendPlaceholders: (templateIdOverride?: number) => Promise<void>
  createPlaceholder: (payload: PlaceholderPayload, options?: { insertIntoDocument?: boolean }) => Promise<void>
  updatePlaceholder: (
    fieldKey: string,
    payload: PlaceholderPayload
  ) => Promise<void>
  deletePlaceholder: (fieldKey: string) => Promise<void>
  detachPlaceholder: (fieldKey: string) => Promise<void>
  ensureAssociation: (fieldKey: string) => Promise<void>
  registerDocumentBridge: (bridge: PlaceholderDocumentBridge | null) => void
  selectPlaceholder: (id: string | null) => void
  highlightPlaceholder: (id: string | null) => void
  openEditor: (id: string | null) => void
  reset: () => void
}

const PlaceholderContext = createContext<PlaceholderContextValue | undefined>(undefined)

export const PLACEHOLDER_REGEX = /{{\s*([\w\d_.-]+)\s*}}/g

interface ExtractedPlaceholder {
  placeholderId: string
  fieldKey: string
  from: number
  to: number
  path: number[]
}

interface PlaceholderProviderProps {
  templateId?: number
  children: ReactNode
}

export const PlaceholderProvider = ({ children, templateId }: PlaceholderProviderProps) => {
  const [docPlaceholderMap, setDocPlaceholderMap] = useState<Record<string, PlaceholderMeta>>({})
  const [docOrderedIds, setDocOrderedIds] = useState<string[]>([])
  const [backendMap, setBackendMap] = useState<Record<string, BackendPlaceholderMeta>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isMutating, setIsMutating] = useState(false)
  const [currentTemplateId, setCurrentTemplateId] = useState<number | null>(templateId ?? null)

  const documentBridgeRef = useRef<PlaceholderDocumentBridge | null>(null)

  useEffect(() => {
    setCurrentTemplateId(templateId ?? null)
  }, [templateId])

  const reset = useCallback(() => {
    setDocPlaceholderMap({})
    setDocOrderedIds([])
    setBackendMap({})
    setSelectedId(null)
    setHighlightedId(null)
    setEditingId(null)
  }, [])

  const syncFromDoc = useCallback((doc?: JSONContent | null) => {
    if (!doc) {
      setDocPlaceholderMap({})
      setDocOrderedIds([])
      return
    }

    const extracted = extractPlaceholdersFromDoc(doc)
    setDocPlaceholderMap((prev) => {
      const next: Record<string, PlaceholderMeta> = {}
      for (const item of extracted) {
        const existing = prev[item.placeholderId]
        next[item.placeholderId] = {
          id: item.placeholderId,
          fieldKey: item.fieldKey,
          label: existing?.label ?? item.fieldKey,
          description: existing?.description,
          defaultValue: existing?.defaultValue,
          dataType: existing?.dataType,
          status: existing?.status ?? "unbound",
          position: {
            from: item.from,
            to: item.to,
            path: item.path,
          },
          source: "document",
          dirty: existing?.dirty ?? false,
        }
      }
      return next
    })
    setDocOrderedIds(extracted.map((item) => item.placeholderId))
  }, [])

  const registerDocumentBridge = useCallback((bridge: PlaceholderDocumentBridge | null) => {
    documentBridgeRef.current = bridge
  }, [])

  const invokeBridge = async <K extends keyof PlaceholderDocumentBridge>(
    action: K,
    ...args: Parameters<NonNullable<PlaceholderDocumentBridge[K]>>
  ) => {
    const handler = documentBridgeRef.current?.[action]
    if (handler) {
      await handler(...args)
    }
  }

  const loadBackendPlaceholders = useCallback(
    async (templateIdOverride?: number) => {
      const targetId = templateIdOverride ?? currentTemplateId
      if (!targetId) return

      setIsSyncing(true)
      try {
        const response = await templateApi.getPlaceholders({ template_id: targetId })
        const items: BackendPlaceholderMeta[] = response.data || []
        const map: Record<string, BackendPlaceholderMeta> = {}
        items.forEach((item) => {
          map[item.placeholder_name] = {
            ...item,
            options: item.options ?? undefined,
          }
        })
        setBackendMap(map)
      } catch (error) {
        console.error("Failed to load placeholders:", error)
      } finally {
        setIsSyncing(false)
      }
    },
    [currentTemplateId]
  )

  useEffect(() => {
    if (templateId) {
      loadBackendPlaceholders(templateId)
    } else {
      setBackendMap({})
    }
  }, [templateId, loadBackendPlaceholders])

  const selectPlaceholder = useCallback((id: string | null) => {
    setSelectedId(id)
  }, [])

  const highlightPlaceholder = useCallback((id: string | null) => {
    setHighlightedId(id)
  }, [])

  const openEditor = useCallback((id: string | null) => {
    setEditingId(id)
    if (id) {
      setSelectedId(id)
    }
  }, [])

  const ensureTemplateId = useCallback(() => {
    if (!currentTemplateId) {
      throw new Error("templateId is required for placeholder operations")
    }
    return currentTemplateId
  }, [currentTemplateId])

  const createPlaceholder = useCallback(
    async (payload: PlaceholderPayload, options?: { insertIntoDocument?: boolean }) => {
      const targetTemplateId = ensureTemplateId()
      const snapshot = deepClone(backendMap)
      const shouldInsert = options?.insertIntoDocument ?? false
      setIsMutating(true)
      setBackendMap((prev) => ({
        ...prev,
        [payload.placeholder_name]: {
          id: prev[payload.placeholder_name]?.id ?? Date.now(),
          placeholder_name: payload.placeholder_name,
        label: payload.label ?? prev[payload.placeholder_name]?.label ?? payload.placeholder_name,
          type: payload.type,
          required: Boolean(payload.required),
        hint: payload.hint,
        default_value: payload.default_value,
          options: payload.options,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      }))
      try {
        await templateApi.createOrUpdatePlaceholder(payload)
        await templateApi.associatePlaceholderToTemplate(
          targetTemplateId,
          payload.placeholder_name
        )
        if (shouldInsert) {
          await invokeBridge("insert", payload)
        }
        await loadBackendPlaceholders(targetTemplateId)
      } catch (error) {
        setBackendMap(snapshot)
        throw error
      } finally {
        setIsMutating(false)
      }
    },
    [backendMap, ensureTemplateId, loadBackendPlaceholders]
  )

  const updatePlaceholder = useCallback(
    async (fieldKey: string, payload: PlaceholderPayload) => {
      const snapshot = deepClone(backendMap)
      setIsMutating(true)
      setBackendMap((prev) => ({
        ...prev,
        [fieldKey]: {
          ...(prev[fieldKey] ?? {
            id: Date.now(),
            placeholder_name: fieldKey,
            required: Boolean(payload.required),
            type: payload.type,
          }),
          label: payload.label ?? prev[fieldKey]?.label,
          placeholder_name: payload.placeholder_name || fieldKey,
          type: payload.type,
          required: Boolean(payload.required),
          hint: payload.hint,
          default_value: payload.default_value ?? prev[fieldKey]?.default_value,
          options: payload.options,
          updated_at: new Date().toISOString(),
        },
      }))
      try {
        await templateApi.updatePlaceholder(fieldKey, payload)
        await loadBackendPlaceholders()
        if (
          payload.placeholder_name &&
          payload.placeholder_name.trim() &&
          payload.placeholder_name.trim() !== fieldKey
        ) {
          await invokeBridge("rename", fieldKey, payload)
        }
      } catch (error) {
        setBackendMap(snapshot)
        throw error
      } finally {
        setIsMutating(false)
      }
    },
    [backendMap, loadBackendPlaceholders]
  )

  const deletePlaceholder = useCallback(
    async (fieldKey: string) => {
      const snapshot = deepClone(backendMap)
      setIsMutating(true)
      setBackendMap((prev) => {
        const next = { ...prev }
        delete next[fieldKey]
        return next
      })
      try {
        await templateApi.deletePlaceholder(fieldKey)
        await loadBackendPlaceholders()
        await invokeBridge("remove", fieldKey)
      } catch (error) {
        setBackendMap(snapshot)
        throw error
      } finally {
        setIsMutating(false)
      }
    },
    [backendMap, loadBackendPlaceholders]
  )

  const detachPlaceholder = useCallback(
    async (fieldKey: string) => {
      const targetTemplateId = ensureTemplateId()
      setIsMutating(true)
      try {
        const hasAssociation = Boolean(backendMap[fieldKey])
        if (hasAssociation) {
          let shouldReload = false
          try {
            await templateApi.disassociatePlaceholderFromTemplate(targetTemplateId, fieldKey)
            shouldReload = true
          } catch (error: any) {
            const status = error?.response?.status
            if (status === 404) {
              shouldReload = false
            } else {
              throw error
            }
          }
          if (shouldReload) {
            await loadBackendPlaceholders(targetTemplateId)
          }
        }
        await invokeBridge("remove", fieldKey)
      } finally {
        setIsMutating(false)
      }
    },
    [backendMap, ensureTemplateId, loadBackendPlaceholders, invokeBridge]
  )

  const ensureAssociation = useCallback(
    async (fieldKey: string) => {
      const targetTemplateId = ensureTemplateId()
      // 如果已经存在于当前模板，直接返回
      if (backendMap[fieldKey]) {
        return
      }
      setIsMutating(true)
      try {
        await templateApi.associatePlaceholderToTemplate(targetTemplateId, fieldKey)
        await loadBackendPlaceholders(targetTemplateId)
      } finally {
        setIsMutating(false)
      }
    },
    [backendMap, ensureTemplateId, loadBackendPlaceholders]
  )

  const combined = useMemo(() => {
    const docItems = docOrderedIds
      .map((id) => {
        const docMeta = docPlaceholderMap[id]
        if (!docMeta) return null
        const backend = backendMap[docMeta.fieldKey]
        const mergedLabel = backend?.label ?? docMeta.label ?? docMeta.fieldKey
        const mergedDescription = backend?.hint ?? docMeta.description
        const mergedDefault = backend?.default_value ?? docMeta.defaultValue
        const mergedDataType = backend?.type ?? docMeta.dataType
        return {
          ...docMeta,
          label: mergedLabel,
          description: mergedDescription ?? undefined,
          defaultValue: mergedDefault ?? undefined,
          dataType: mergedDataType,
          backendMeta: backend,
          status: backend ? "bound" : "unbound",
        } as PlaceholderMeta
      })
      .filter((item): item is PlaceholderMeta => Boolean(item))

    const backendOnly = Object.keys(backendMap)
      .filter(
        (fieldKey) => !docItems.some((doc) => doc.fieldKey === fieldKey)
      )
      .map((fieldKey) => {
        const backend = backendMap[fieldKey]
        return {
          id: `backend-${fieldKey}`,
          fieldKey,
          label: backend.label ?? backend.placeholder_name ?? fieldKey,
          description: backend.hint ?? undefined,
          defaultValue: backend.default_value ?? undefined,
          dataType: backend.type,
          status: "pending" as PlaceholderStatus,
          source: "backend" as const,
          backendMeta: backend,
        } as PlaceholderMeta
      })

    const ordered = [...docItems, ...backendOnly]
    const map = ordered.reduce<Record<string, PlaceholderMeta>>((acc, item) => {
      acc[item.id] = item
      return acc
    }, {})

    return { ordered, map }
  }, [docOrderedIds, docPlaceholderMap, backendMap])

  const value: PlaceholderContextValue = {
    placeholders: combined.map,
    orderedPlaceholders: combined.ordered,
    selectedId,
    highlightedId,
    editingId,
    isSyncing,
    isMutating,
    syncFromDoc,
    loadBackendPlaceholders,
    createPlaceholder,
    updatePlaceholder,
    deletePlaceholder,
    detachPlaceholder,
    ensureAssociation,
    registerDocumentBridge,
    selectPlaceholder,
    highlightPlaceholder,
    openEditor,
    reset,
  }

  return (
    <PlaceholderContext.Provider value={value}>
      {children}
    </PlaceholderContext.Provider>
  )
}

export const usePlaceholderManager = () => {
  const ctx = useContext(PlaceholderContext)
  if (!ctx) {
    throw new Error("usePlaceholderManager must be used within PlaceholderProvider")
  }
  return ctx
}

export function extractPlaceholdersFromDoc(doc: JSONContent): ExtractedPlaceholder[] {
  const results: ExtractedPlaceholder[] = []

  const walk = (node: JSONContent, cursor: number, path: number[]): number => {
    if (!node) return cursor

    if (typeof node.text === "string") {
      const text = node.text
      let match: RegExpExecArray | null
      PLACEHOLDER_REGEX.lastIndex = 0
      while ((match = PLACEHOLDER_REGEX.exec(text)) !== null) {
        const fieldKey = match[1]
        const matchLength = match[0].length
        const from = cursor + (match.index ?? 0)
        const to = from + matchLength
        results.push({
          placeholderId: createPlaceholderId(fieldKey, results.length),
          fieldKey,
          from,
          to,
          path,
        })
      }
      return cursor + text.length
    }

    if (node.type === "hardBreak") {
      return cursor + 1
    }

    if (Array.isArray(node.content)) {
      let nextCursor = cursor
      node.content.forEach((child, index) => {
        nextCursor = walk(child, nextCursor, [...path, index])
      })
      return nextCursor
    }

    return cursor
  }

  walk(doc, 0, [])
  return results
}

export const createPlaceholderId = (fieldKey: string, index: number) => {
  return `ph-${fieldKey}-${index}`
}

const deepClone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))

export const usePlaceholderDocumentBridge = (bridge: PlaceholderDocumentBridge | null) => {
  const manager = usePlaceholderManager()
  useEffect(() => {
    manager.registerDocumentBridge(bridge)
    return () => manager.registerDocumentBridge(null)
  }, [bridge, manager])
}

