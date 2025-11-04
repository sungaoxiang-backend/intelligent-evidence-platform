import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { ImageIcon } from "lucide-react"

interface IndependentEvidenceCardProps {
  cardId: string
  cardType: string
  evidenceId: string
  data: Record<string, string>
}

export function IndependentEvidenceCard({ cardId, cardType, evidenceId, data }: IndependentEvidenceCardProps) {
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
    </Card>
  )
}
