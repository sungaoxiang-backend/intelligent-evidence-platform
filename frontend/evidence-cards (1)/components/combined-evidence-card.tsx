"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ImageIcon, Plus, ImageOff } from "lucide-react"

interface ReferencedEvidence {
  id: string
  name: string
  sequence: number
}

interface CombinedEvidenceCardProps {
  cardId: string
  cardType: string
  evidenceIds: string[]
  data: Record<string, string>
  referencedEvidences: ReferencedEvidence[]
}

export function CombinedEvidenceCard({
  cardId,
  cardType,
  evidenceIds,
  data,
  referencedEvidences,
}: CombinedEvidenceCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="space-y-4">
      <Card className="w-full max-w-sm bg-white relative">
        <CardHeader className="space-y-4 pb-4">
          <div className="flex items-start justify-between">
            {/* Stacked Images Icon */}
            <div className="relative w-24 h-24">
              <div className="absolute top-0 left-0 w-24 h-24 border-2 border-foreground rounded flex items-center justify-center bg-white">
                <ImageIcon className="w-12 h-12" />
              </div>
              <div className="absolute top-2 left-2 w-24 h-24 border-2 border-foreground rounded flex items-center justify-center bg-white">
                <ImageIcon className="w-12 h-12" />
              </div>
              <div className="absolute top-4 left-4 w-24 h-24 border-2 border-foreground rounded flex items-center justify-center bg-white">
                <ImageIcon className="w-12 h-12" />
              </div>
            </div>

            {/* Card Info */}
            <div className="flex-1 ml-6 space-y-1">
              <div className="text-sm font-medium">卡片ID:#{cardId}</div>
              <div className="text-xs text-muted-foreground">卡片类型：{cardType}</div>
              <div className="text-xs text-muted-foreground mt-2">引用证据ID: #{evidenceIds.join("#")}</div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 pt-4 border-t">
          {Object.entries(data).map(([key, value], index) => (
            <div key={index} className="grid grid-cols-2 gap-4 text-sm">
              {index % 2 === 0 && Object.entries(data)[index + 1] ? (
                <>
                  <div>
                    <span className="text-foreground">{key}：</span>
                    <span className="text-foreground">{value}</span>
                  </div>
                  <div>
                    <span className="text-foreground">{Object.entries(data)[index + 1][0]}：</span>
                    <span className="text-foreground">{Object.entries(data)[index + 1][1]}</span>
                  </div>
                </>
              ) : index % 2 === 0 ? (
                <div className="col-span-2">
                  <span className="text-foreground">{key}：</span>
                  <span className="text-foreground">{value}</span>
                </div>
              ) : null}
            </div>
          ))}
        </CardContent>

        {/* Expand Button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute bottom-4 right-4 h-8 w-8"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <Plus className={`h-5 w-5 transition-transform ${isExpanded ? "rotate-45" : ""}`} />
        </Button>
      </Card>

      {/* Expanded Evidence List */}
      {isExpanded && (
        <div className="space-y-3 pl-4 border-l-2 border-border">
          <h3 className="text-sm font-medium text-foreground">联合证据卡片-展开按钮列表内视图</h3>
          {referencedEvidences.map((evidence) => (
            <Card key={evidence.id} className="w-full max-w-sm bg-white">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  {/* Empty State Icon */}
                  <div className="w-20 h-20 border-2 border-foreground rounded flex items-center justify-center bg-white">
                    <ImageOff className="w-10 h-10" />
                  </div>

                  {/* Evidence Metadata */}
                  <div className="flex-1 ml-4 space-y-1">
                    <div className="text-sm font-medium">证据ID:#{evidence.id}</div>
                    <div className="text-xs text-muted-foreground">证据名称：{evidence.name}</div>
                    <div className="text-xs text-muted-foreground">证据序号：{evidence.sequence}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
