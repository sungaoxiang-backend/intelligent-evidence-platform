import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { ImageIcon, Ban } from "lucide-react"

interface UnclassifiedEvidenceCardProps {
  cardId: string
  cardType: string
  evidenceId: string
}

export function UnclassifiedEvidenceCard({ cardId, cardType, evidenceId }: UnclassifiedEvidenceCardProps) {
  return (
    <Card className="w-full max-w-sm bg-white">
      <CardHeader className="space-y-4 pb-4">
        <div className="flex items-start justify-between">
          {/* Image Placeholder */}
          <div className="w-24 h-24 border-2 border-foreground rounded flex items-center justify-center bg-white">
            <ImageIcon className="w-12 h-12" />
          </div>

          {/* Card Info */}
          <div className="flex-1 ml-4 space-y-1">
            <div className="text-sm font-medium">卡片ID:#{cardId}</div>
            <div className="text-xs text-muted-foreground">卡片类型：{cardType}</div>
            <div className="text-xs text-muted-foreground mt-2">引用证据ID: #{evidenceId}</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex items-center justify-center py-12 border-t">
        {/* Empty/Unclassified State */}
        <div className="w-24 h-24 border-4 border-foreground rounded-full flex items-center justify-center relative">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-full h-0.5 bg-foreground rotate-45" />
          </div>
          <Ban className="w-16 h-16 opacity-0" />
        </div>
      </CardContent>
    </Card>
  )
}
