"use client"

import { useState } from "react"
import { OriginalEvidenceList } from "@/components/original-evidence-list"
import { ClassifiedEvidenceList } from "@/components/classified-evidence-list"
import { CardSlots } from "@/components/card-slots"
import { CaseInfoEditor } from "@/components/case-info-editor"
import { ForgeQueueButton } from "@/components/forge-queue-button"
import { ForgeQueuePanel } from "@/components/forge-queue-panel"
import { ForgeNotification } from "@/components/forge-notification"
import { Search, Filter, Bell, User, Shield } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export interface ForgeTask {
  id: string
  evidenceIds: string[]
  startTime: number
  progress: number
  status: "forging" | "completed" | "failed"
}

export interface OriginalEvidence {
  id: string
  name: string
  type: string
  size: string
  date: string
  forged: boolean
  thumbnail: string
}

export interface ClassifiedEvidence {
  id: string
  type: "independent" | "combined"
  category: string
  cardType: "classified" | "unclassified"
  referencedIds: string[]
  thumbnail: string
  features: Record<string, string>
}

const initialOriginalEvidences: OriginalEvidence[] = [
  {
    id: "12",
    name: "#12.jpg",
    type: "image",
    size: "2.3 MB",
    date: "2024-01-15",
    forged: true,
    thumbnail: "/generic-id-card-front.png",
  },
  {
    id: "14",
    name: "#14.png",
    type: "image",
    size: "1.8 MB",
    date: "2024-01-16",
    forged: true,
    thumbnail: "/wechat-chat-screenshot.jpg",
  },
  {
    id: "15",
    name: "#15.png",
    type: "image",
    size: "1.9 MB",
    date: "2024-01-16",
    forged: true,
    thumbnail: "/wechat-transfer-confirmation.jpg",
  },
  {
    id: "16",
    name: "#16.png",
    type: "image",
    size: "2.1 MB",
    date: "2024-01-16",
    forged: true,
    thumbnail: "/wechat-payment-reminder.jpg",
  },
  {
    id: "72",
    name: "工商银行流水_2023年.pdf",
    type: "document",
    size: "2.7 MB",
    date: "2024-01-22",
    forged: true,
    thumbnail: "/generic-bank-statement.png",
  },
  {
    id: "73",
    name: "通话记录截图.png",
    type: "image",
    size: "1.5 MB",
    date: "2024-01-23",
    forged: true,
    thumbnail: "/phone-call-log.jpg",
  },
  {
    id: "80",
    name: "#80.pdf",
    type: "document",
    size: "4.2 MB",
    date: "2024-01-10",
    forged: false,
    thumbnail: "/loan-contract-document.jpg",
  },
  {
    id: "81",
    name: "#81.jpg",
    type: "image",
    size: "3.1 MB",
    date: "2024-01-11",
    forged: false,
    thumbnail: "/iou-handwritten-note.jpg",
  },
  {
    id: "82",
    name: "#82.png",
    type: "image",
    size: "1.6 MB",
    date: "2024-01-18",
    forged: false,
    thumbnail: "/alipay-transfer-record.jpg",
  },
  {
    id: "83",
    name: "收据扫描件.jpg",
    type: "image",
    size: "2.8 MB",
    date: "2024-01-19",
    forged: false,
    thumbnail: "/receipt-scan.jpg",
  },
  {
    id: "84",
    name: "担保人身份证.jpg",
    type: "image",
    size: "2.4 MB",
    date: "2024-01-20",
    forged: false,
    thumbnail: "/guarantor-id-card.jpg",
  },
  {
    id: "85",
    name: "#85.pdf",
    type: "document",
    size: "5.8 MB",
    date: "2024-01-21",
    forged: true,
    thumbnail: "/business-license.jpg",
  },
]

const initialClassifiedEvidences: ClassifiedEvidence[] = [
  {
    id: "31",
    type: "independent",
    category: "身份证",
    cardType: "classified",
    referencedIds: ["12"],
    thumbnail: "/generic-id-card-front.png",
    features: {
      name: "张三",
      gender: "男",
      ethnicity: "汉",
      birthDate: "1993年3月3日",
      address: "浙江省杭州市西湖区湖创基地",
      idNumber: "330106199303030015",
    },
  },
  {
    id: "34",
    type: "independent",
    category: "身份证",
    cardType: "classified",
    referencedIds: ["13"],
    thumbnail: "/generic-id-card-front.png",
    features: {
      name: "李四",
      gender: "男",
      ethnicity: "汉",
      birthDate: "1990年6月15日",
      address: "浙江省杭州市滨江区江南大道",
      idNumber: "330108199006150023",
    },
  },
  {
    id: "32",
    type: "combined",
    category: "微信聊天记录",
    cardType: "classified",
    referencedIds: ["14", "15", "16"],
    thumbnail: "/wechat-chat-screenshot.jpg",
    features: {
      wechatName: "李四",
      debtAmount: "350000元",
      debtAgreement: "是",
    },
  },
  {
    id: "35",
    type: "independent",
    category: "营业执照",
    cardType: "classified",
    referencedIds: ["85"],
    thumbnail: "/business-license.jpg",
    features: {
      companyName: "杭州商贸有限公司",
      creditCode: "91330100MA27ABC123",
      legalRepresentative: "张三",
      companyType: "有限责任公司",
      registeredAddress: "浙江省杭州市西湖区文三路",
    },
  },
]

export default function Home() {
  const [selectedEvidence, setSelectedEvidence] = useState<any>(null)
  const [multiSelectMode, setMultiSelectMode] = useState(false)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [zoomImage, setZoomImage] = useState<{ src: string; alt: string } | null>(null)

  const [originalEvidences, setOriginalEvidences] = useState<OriginalEvidence[]>(initialOriginalEvidences)
  const [classifiedEvidences, setClassifiedEvidences] = useState<ClassifiedEvidence[]>(initialClassifiedEvidences)

  const [forgeTasks, setForgeTasks] = useState<ForgeTask[]>([])
  const [showForgeNotification, setShowForgeNotification] = useState(false)
  const [showForgeQueue, setShowForgeQueue] = useState(false)

  const [expandedCombinedCards, setExpandedCombinedCards] = useState<Set<string>>(new Set())

  const updateForgedStatus = (cards: ClassifiedEvidence[]) => {
    setOriginalEvidences((prev) =>
      prev.map((evidence) => {
        const isReferenced = cards.some((card) => card.referencedIds.includes(evidence.id))
        return { ...evidence, forged: isReferenced }
      }),
    )
  }

  const handleForgeComplete = (taskId: string, evidenceIds: string[]) => {
    console.log("[v0] Forge completed for task", taskId, "with evidence IDs", evidenceIds)

    const random = Math.random()
    const newCards: ClassifiedEvidence[] = []
    const nextIdBase = Math.max(...classifiedEvidences.map((e) => Number.parseInt(e.id)), 0) + 1

    if (evidenceIds.length === 1) {
      const categories = ["身份证", "营业执照", "银行流水", "通话记录", "未识别分类"]
      const randomCategory = categories[Math.floor(Math.random() * categories.length)]
      const originalEvidence = originalEvidences.find((e) => e.id === evidenceIds[0])

      newCards.push({
        id: nextIdBase.toString(),
        type: "independent",
        category: randomCategory,
        cardType: randomCategory === "未识别分类" ? "unclassified" : "classified",
        referencedIds: [evidenceIds[0]],
        thumbnail: originalEvidence?.thumbnail || "/placeholder.svg",
        features: getDefaultFeatures(randomCategory),
      })
    } else if (random < 0.3) {
      evidenceIds.forEach((id, index) => {
        const categories = ["身份证", "营业执照", "银行流水", "通话记录", "未识别分类"]
        const randomCategory = categories[Math.floor(Math.random() * categories.length)]
        const originalEvidence = originalEvidences.find((e) => e.id === id)

        newCards.push({
          id: (nextIdBase + index).toString(),
          type: "independent",
          category: randomCategory,
          cardType: randomCategory === "未识别分类" ? "unclassified" : "classified",
          referencedIds: [id],
          thumbnail: originalEvidence?.thumbnail || "/placeholder.svg",
          features: getDefaultFeatures(randomCategory),
        })
      })
    } else if (random < 0.7) {
      const firstEvidence = originalEvidences.find((e) => e.id === evidenceIds[0])

      newCards.push({
        id: nextIdBase.toString(),
        type: evidenceIds.length > 1 ? "combined" : "independent",
        category: "微信聊天记录",
        cardType: "classified",
        referencedIds: evidenceIds,
        thumbnail: firstEvidence?.thumbnail || "/placeholder.svg",
        features: getDefaultFeatures("微信聊天记录"),
      })
    } else {
      const splitPoint = Math.floor(evidenceIds.length / 2)
      const firstGroup = evidenceIds.slice(0, splitPoint)
      const secondGroup = evidenceIds.slice(splitPoint)

      if (firstGroup.length > 0) {
        const firstEvidence = originalEvidences.find((e) => e.id === firstGroup[0])

        newCards.push({
          id: nextIdBase.toString(),
          type: firstGroup.length > 1 ? "combined" : "independent",
          category: "微信聊天记录",
          cardType: "classified",
          referencedIds: firstGroup,
          thumbnail: firstEvidence?.thumbnail || "/placeholder.svg",
          features: getDefaultFeatures("微信聊天记录"),
        })
      }

      secondGroup.forEach((id, index) => {
        const categories = ["身份证", "营业执照", "银行流水", "通话记录", "未识别分类"]
        const randomCategory = categories[Math.floor(Math.random() * categories.length)]
        const originalEvidence = originalEvidences.find((e) => e.id === id)

        newCards.push({
          id: (nextIdBase + 1 + index).toString(),
          type: "independent",
          category: randomCategory,
          cardType: randomCategory === "未识别分类" ? "unclassified" : "classified",
          referencedIds: [id],
          thumbnail: originalEvidence?.thumbnail || "/placeholder.svg",
          features: getDefaultFeatures(randomCategory),
        })
      })
    }

    setClassifiedEvidences((prev) => {
      const updatedCards = [...prev, ...newCards]
      updateForgedStatus(updatedCards)
      return updatedCards
    })
  }

  const handleForge = () => {
    if (selectedItems.size === 0) return

    const newTask: ForgeTask = {
      id: `task-${Date.now()}`,
      evidenceIds: Array.from(selectedItems),
      startTime: Date.now(),
      progress: 0,
      status: "forging",
    }

    setForgeTasks((prev) => [...prev, newTask])
    setShowForgeNotification(true)

    const progressInterval = setInterval(() => {
      setForgeTasks((prev) =>
        prev.map((task) => {
          if (task.id === newTask.id && task.status === "forging") {
            const elapsed = Date.now() - task.startTime
            const newProgress = Math.min((elapsed / 10000) * 100, 100)

            if (newProgress >= 100) {
              clearInterval(progressInterval)
              handleForgeComplete(task.id, task.evidenceIds)
              return { ...task, progress: 100, status: "completed" as const }
            }

            return { ...task, progress: newProgress }
          }
          return task
        }),
      )
    }, 100)

    setTimeout(() => setShowForgeNotification(false), 3000)

    setSelectedItems(new Set())
    setMultiSelectMode(false)
  }

  const handleDeleteCard = (cardId: string) => {
    setClassifiedEvidences((prev) => {
      const updatedCards = prev.filter((c) => c.id !== cardId)
      updateForgedStatus(updatedCards)
      return updatedCards
    })
  }

  const handleUpdateCardReferences = (cardId: string, newReferences: string[]) => {
    console.log("[v0] Updating card", cardId, "references to:", newReferences)
    setClassifiedEvidences((prev) => {
      const updatedCards = prev.map((card) => (card.id === cardId ? { ...card, referencedIds: newReferences } : card))
      // Update forged status after updating cards
      updateForgedStatus(updatedCards)
      return updatedCards
    })
  }

  const handleCardsUpdate = (updatedCards: ClassifiedEvidence[]) => {
    setClassifiedEvidences(updatedCards)
    updateForgedStatus(updatedCards)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      {zoomImage && (
        <div className="thumbnail-zoom-modal" onClick={() => setZoomImage(null)}>
          <img src={zoomImage.src || "/placeholder.svg"} alt={zoomImage.alt} className="thumbnail-zoom-image" />
        </div>
      )}

      <ForgeNotification show={showForgeNotification} count={selectedItems.size} />

      <ForgeQueuePanel show={showForgeQueue} tasks={forgeTasks} onClose={() => setShowForgeQueue(false)} />

      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="h-16 px-6 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Shield className="h-5 w-5 text-white" strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">证据管理系统</h1>
                <p className="text-xs text-slate-500">Legal Evidence Platform</p>
              </div>
            </div>
            <nav className="flex items-center gap-1">
              <button className="px-4 py-2 text-sm font-semibold text-blue-700 bg-blue-50 rounded-lg border border-blue-200 shadow-sm">
                证据分析
              </button>
              <button className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-all">
                案件管理
              </button>
              <button className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-all">
                报告生成
              </button>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="搜索证据..."
                className="pl-9 w-72 h-10 bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-300 transition-all"
              />
            </div>
            <Button variant="outline" size="sm" className="h-10 border-slate-200 hover:border-blue-300 bg-transparent">
              <Filter className="h-4 w-4 mr-2" />
              筛选
            </Button>
            <div className="h-6 w-px bg-slate-200 mx-2" />

            <ForgeQueueButton
              taskCount={forgeTasks.filter((t) => t.status === "forging").length}
              onClick={() => setShowForgeQueue(true)}
            />

            <Button variant="ghost" size="icon" className="relative hover:bg-slate-100">
              <Bell className="h-5 w-5 text-slate-600" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
            </Button>
            <Button variant="ghost" size="icon" className="hover:bg-slate-100">
              <User className="h-5 w-5 text-slate-600" />
            </Button>
          </div>
        </div>
      </header>

      <main className="h-[calc(100vh-4rem)] flex">
        <div className="w-80 border-r border-slate-200 bg-white/60 backdrop-blur-sm flex flex-col">
          <div className="px-4 py-3 border-b border-slate-200 bg-white/80 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3 mb-2">
              <h2 className="font-bold text-sm text-slate-900">
                原始证据 <span className="text-slate-500 font-normal">({originalEvidences.length})</span>
              </h2>
              <div className="flex gap-1.5">
                <Button
                  variant={multiSelectMode ? "default" : "outline"}
                  size="sm"
                  className={`h-7 px-3 text-xs font-medium transition-all ${
                    multiSelectMode
                      ? "bg-blue-600 hover:bg-blue-700"
                      : "border-slate-300 hover:border-blue-400 hover:bg-blue-50"
                  }`}
                  onClick={() => {
                    setMultiSelectMode(!multiSelectMode)
                    setSelectedItems(new Set())
                  }}
                >
                  {multiSelectMode ? "取消" : "多选"}
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="h-7 px-3 text-xs font-medium bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={selectedItems.size === 0}
                  onClick={handleForge}
                >
                  铸造 {selectedItems.size > 0 && `(${selectedItems.size})`}
                </Button>
              </div>
            </div>

            {multiSelectMode && (
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-slate-600 hover:text-blue-600 hover:bg-blue-50"
                  onClick={() => {
                    const allIds = new Set(originalEvidences.map((e) => e.id))
                    setSelectedItems(allIds)
                  }}
                >
                  全选
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-slate-600 hover:text-blue-600 hover:bg-blue-50"
                  onClick={() => {
                    const allIds = originalEvidences.map((e) => e.id)
                    const inverted = new Set(allIds.filter((id) => !selectedItems.has(id)))
                    setSelectedItems(inverted)
                  }}
                >
                  反选
                </Button>
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            <OriginalEvidenceList
              evidences={originalEvidences}
              onSelect={setSelectedEvidence}
              selectedId={selectedEvidence?.id}
              multiSelectMode={multiSelectMode}
              selectedItems={selectedItems}
              onToggleSelect={(id) => {
                setSelectedItems((prev) => {
                  const next = new Set(prev)
                  if (next.has(id)) {
                    next.delete(id)
                  } else {
                    next.add(id)
                  }
                  return next
                })
              }}
              onZoomImage={setZoomImage}
              showDragHandles={expandedCombinedCards.size > 0}
            />
          </div>
        </div>

        <div className="w-[420px] border-r border-slate-200 bg-white flex flex-col">
          <div className="px-4 py-3 border-b border-slate-200 bg-white">
            <h2 className="font-bold text-sm text-slate-900">
              证据卡片 <span className="text-slate-500 font-normal">({classifiedEvidences.length})</span>
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            <ClassifiedEvidenceList
              evidences={classifiedEvidences}
              onSelect={setSelectedEvidence}
              selectedId={selectedEvidence?.id}
              onZoomImage={setZoomImage}
              onDeleteCard={handleDeleteCard}
              expandedCombinedCards={expandedCombinedCards}
              onExpandedChange={setExpandedCombinedCards}
              onUpdateCardReferences={handleUpdateCardReferences}
            />
          </div>
        </div>

        <div className="flex-1 bg-slate-50/50 flex flex-col overflow-y-auto scrollbar-thin p-6">
          <div className="max-w-4xl mx-auto w-full space-y-6">
            <CaseInfoEditor />

            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-2">卡片槽位</h3>
              <p className="text-sm text-slate-500 mb-6">拖拽证据卡片到对应槽位进行分类整理</p>
              <CardSlots />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function getDefaultFeatures(category: string): Record<string, string> {
  switch (category) {
    case "身份证":
      return {
        name: "",
        gender: "",
        ethnicity: "",
        birthDate: "",
        address: "",
        idNumber: "",
      }
    case "微信聊天记录":
      return {
        wechatName: "",
        debtAmount: "",
        debtAgreement: "",
      }
    case "营业执照":
      return {
        companyName: "",
        creditCode: "",
        legalRepresentative: "",
        companyType: "",
        registeredAddress: "",
      }
    case "银行流水":
      return {
        accountName: "",
        accountNumber: "",
        totalIncome: "",
        totalExpense: "",
        period: "",
      }
    case "通话记录":
      return {
        phoneNumber: "",
        contactName: "",
        totalCalls: "",
        totalDuration: "",
        lastCallDate: "",
      }
    default:
      return {}
  }
}
