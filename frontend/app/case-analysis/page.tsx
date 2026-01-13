"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Loader2 } from "lucide-react"
import { caseAnalysisApi } from "@/lib/api-case-analysis"
import type { Case } from "@/lib/api"
import { toast } from "@/hooks/use-toast"

export default function CaseAnalysisListPage() {
    const router = useRouter()
    const [cases, setCases] = useState<Case[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")

    useEffect(() => {
        fetchCases()
    }, [])

    const fetchCases = async () => {
        setLoading(true)
        try {
            const response = await caseAnalysisApi.getCases()
            setCases(response.items)
        } catch (error) {
            toast({
                title: "加载失败",
                description: "无法获取案件列表",
                variant: "destructive",
            })
        } finally {
            setLoading(false)
        }
    }

    const filteredCases = cases.filter(c =>
        c.description?.includes(searchQuery) ||
        c.court_name?.includes(searchQuery) ||
        c.case_type?.includes(searchQuery)
    )

    const getStatusBadge = (status: string) => {
        const map: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
            draft: { label: "草稿", variant: "secondary" },
            accepted: { label: "已受理", variant: "default" },
            documents_complete: { label: "文书完备", variant: "outline" },
            filing_submitted: { label: "已立案", variant: "default" },
        }
        const config = map[status] || { label: status, variant: "secondary" }
        return <Badge variant={config.variant}>{config.label}</Badge>
    }

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">案情分析</h1>
                    <p className="text-muted-foreground">选择一个案件进行深入分析和报告生成</p>
                </div>
                <div className="flex items-center space-x-2">
                    <div className="relative">
                        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="搜索案件..."
                            className="pl-8 w-64"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center p-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredCases.map((item) => (
                        <Card
                            key={item.id}
                            className="cursor-pointer hover:shadow-md transition-shadow"
                            onClick={() => router.push(`/case-analysis/${item.id}`)}
                        >
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <CardTitle className="text-lg line-clamp-1" title={item.description || "未命名案件"}>
                                        {item.description || "未命名案件"}
                                    </CardTitle>
                                    {getStatusBadge(item.case_status)}
                                </div>
                                <CardDescription className="flex items-center space-x-2 text-xs">
                                    <span>ID: #{item.id}</span>
                                    <span>•</span>
                                    <span>{item.court_name || "未指定法院"}</span>
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2 text-sm text-muted-foreground">
                                    <div className="flex justify-between">
                                        <span>标的额:</span>
                                        <span className="font-medium text-foreground">¥{item.loan_amount?.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>类型:</span>
                                        <span>{item.case_type === 'debt' ? '民间借贷' : '合同纠纷'}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                    {filteredCases.length === 0 && (
                        <div className="col-span-full text-center py-12 text-muted-foreground">
                            没有找到案件
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
