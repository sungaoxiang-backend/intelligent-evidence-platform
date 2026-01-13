import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { caseAnalysisApi } from "@/lib/api-case-analysis"
import { Case } from "@/lib/types"

export function SelectCaseSwitcher({ currentId }: { currentId: number }) {
    const router = useRouter()
    const [cases, setCases] = useState<Case[]>([])

    useEffect(() => {
        // Fetch a small list of recent cases for the switcher
        caseAnalysisApi.getCases(0, 20).then(res => {
            setCases(res.items)
        }).catch(console.error)
    }, [])

    return (
        <Select
            value={currentId.toString()}
            onValueChange={(val) => router.push(`/case-analysis/${val}`)}
        >
            <SelectTrigger className="w-[200px] h-8 text-xs">
                <SelectValue placeholder="选择案件" />
            </SelectTrigger>
            <SelectContent>
                {cases.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()} className="text-xs">
                        #{c.id} {c.description || "未命名"}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}
