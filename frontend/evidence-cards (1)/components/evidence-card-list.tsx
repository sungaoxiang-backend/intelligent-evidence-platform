"use client"

import { IndependentEvidenceCard } from "./independent-evidence-card"
import { CombinedEvidenceCard } from "./combined-evidence-card"
import { UnclassifiedEvidenceCard } from "./unclassified-evidence-card"

export function EvidenceCardList() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Independent Evidence Card - Classified */}
      <div>
        <h2 className="text-sm font-medium mb-4 text-foreground">独立证据卡片-列表内视图</h2>
        <IndependentEvidenceCard
          cardId="31"
          cardType="身份证"
          evidenceId="12"
          data={{
            姓名: "张三",
            性别: "男",
            民族: "汉",
            出生: "1993年3月3日",
            住址: "浙江湖创基地",
            公民身份号码: "412727199909090909",
          }}
        />
      </div>

      {/* Combined Evidence Card */}
      <div>
        <h2 className="text-sm font-medium mb-4 text-foreground">联合证据卡片-列表内视图</h2>
        <CombinedEvidenceCard
          cardId="31"
          cardType="微信聊天记录"
          evidenceIds={["12", "14", "15", "16"]}
          data={{
            微信昵称: "李四",
            欠款合意: "无",
            欠款金额: "55000.0",
          }}
          referencedEvidences={[
            { id: "12", name: "身份证img.png", sequence: 1 },
            { id: "14", name: "聊天记录1.png", sequence: 2 },
            { id: "15", name: "聊天记录2.png", sequence: 3 },
            { id: "16", name: "聊天记录3.png", sequence: 4 },
          ]}
        />
      </div>

      {/* Unclassified Evidence Card */}
      <div>
        <h2 className="text-sm font-medium mb-4 text-foreground">未识别分类卡片-列表内视图</h2>
        <UnclassifiedEvidenceCard cardId="42" cardType="未知" evidenceId="70" />
      </div>
    </div>
  )
}
