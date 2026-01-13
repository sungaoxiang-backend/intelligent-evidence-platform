import { useState } from "react"
import {
    LegalReportContent, ArgumentBlock, ReasoningSection, LegalSection, ConclusionSection,
    DimensionResult, LegalDimensionResult, ConclusionDimensionResult,
    SystemResource
} from "@/lib/api-case-analysis"
import { Separator } from "@/components/ui/separator"
import { ChevronDown, ChevronRight, AlertCircle, FileText } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

interface AnalysisReportViewProps {
    content: LegalReportContent
}

// ----------------------------------------------------------------------
// Minimalist Helper Components
// ----------------------------------------------------------------------

const SectionHeading = ({ children, className }: { children: React.ReactNode, className?: string }) => (
    <h3 className={cn("text-lg font-bold text-gray-900 mb-4 flex items-center gap-2", className)}>
        {children}
    </h3>
)

const SubHeading = ({ children }: { children: React.ReactNode }) => (
    <h4 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide border-b pb-1 border-gray-100">
        {children}
    </h4>
)

const TextBlock = ({ children, className }: { children: React.ReactNode, className?: string }) => (
    <div className={cn("text-sm leading-relaxed text-gray-800", className)}>
        {children}
    </div>
)

const LabelValue = ({ label, value }: { label: string, value: string }) => (
    <div className="text-sm">
        <span className="font-semibold text-gray-600 mr-2">{label}:</span>
        <span className="text-gray-900">{value}</span>
    </div>
)

const ConfidenceIndicator = ({ level, score }: { level?: string, score?: number }) => {
    if (!level) return null
    return (
        <span className="text-xs font-mono text-gray-500 border px-1.5 py-0.5 rounded ml-2">
            置信度: {level === 'high' ? '高' : level === 'medium' ? '中' : '低'}
            {score !== undefined && ` (${Math.round(score * 100)}%)`}
        </span>
    )
}

// ----------------------------------------------------------------------
// Logic Components
// ----------------------------------------------------------------------

const ReportSection = ({
    title,
    children,
    defaultOpen = true,
    className
}: {
    title: string,
    children: React.ReactNode,
    defaultOpen?: boolean,
    className?: string
}) => {
    const [isOpen, setIsOpen] = useState(defaultOpen)

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className={cn("border-b border-gray-200 py-4 first:pt-0", className)}>
            <div className="flex items-center justify-between cursor-pointer group" onClick={() => setIsOpen(!isOpen)}>
                <h3 className="text-base font-bold text-gray-900 group-hover:text-blue-700 transition-colors flex items-center gap-2">
                    {title}
                </h3>
                <CollapsibleTrigger asChild>
                    <button className="text-gray-400 hover:text-gray-600">
                        {isOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    </button>
                </CollapsibleTrigger>
            </div>
            <CollapsibleContent>
                <div className="pt-4 px-2 space-y-6 animate-in slide-in-from-top-2 duration-200">
                    {children}
                </div>
            </CollapsibleContent>
        </Collapsible>
    )
}

const DimensionView = ({
    title,
    result,
    type
}: {
    title: string,
    result: DimensionResult | LegalDimensionResult | ConclusionDimensionResult | DimensionResult[] | ConclusionDimensionResult[],
    type: 'reasoning' | 'legal' | 'conclusion'
}) => {
    const results = Array.isArray(result) ? result : [result]
    if (results.length === 0) return null

    return (
        <div className="mb-6 last:mb-0">
            <SubHeading>{title}</SubHeading>

            <div className="space-y-4">
                {results.map((item: any, idx) => (
                    <div key={idx} className="space-y-2">
                        {/* Question */}
                        {item.question && (
                            <div className="font-medium text-gray-900 flex gap-2 text-sm italic">
                                <span className="text-gray-400 not-italic">Q:</span>
                                {item.question}
                            </div>
                        )}

                        {/* Answer */}
                        <div className="pl-4 border-l-2 border-gray-200 space-y-2">
                            <TextBlock>{item.answer}</TextBlock>

                            {/* Reason */}
                            {item.reason && (
                                <p className="text-xs text-gray-500 mt-1">
                                    <span className="font-medium">分析逻辑：</span>{item.reason}
                                </p>
                            )}

                            {/* Legal Sources */}
                            {type === 'legal' && item.refs_legal_resources && (
                                <div className="mt-2 bg-gray-50 p-2 text-xs text-gray-600 space-y-1 rounded-sm">
                                    {item.refs_legal_resources.map((res: any, i: number) => (
                                        <div key={i} className="flex gap-2">
                                            <span className="font-semibold text-gray-500">[{res.source_channel}]</span>
                                            <span>{res.basis}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Probability Info */}
                            {type === 'conclusion' && item.probability_info && (
                                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs border-t border-dashed pt-2">
                                    <div>
                                        <span className="font-semibold text-gray-600 block mb-0.5">积极因素 (+)</span>
                                        <span className="text-gray-800">{item.probability_info.positive}</span>
                                    </div>
                                    <div>
                                        <span className="font-semibold text-gray-600 block mb-0.5">消极因素 (-)</span>
                                        <span className="text-gray-800">{item.probability_info.negative}</span>
                                    </div>
                                    {item.probability_info.conflict && (
                                        <div className="col-span-full">
                                            <span className="font-semibold text-orange-700 block mb-0.5">矛盾点 (!)</span>
                                            <span className="text-gray-700">{item.probability_info.conflict}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

const ArgumentBlockView = ({ block }: { block: ArgumentBlock }) => {
    return (
        <div className="space-y-8">
            <DimensionView title="观点陈述 (用户)" result={block.view_points.results} type="reasoning" />
            <DimensionView title="证据支持 (材料)" result={block.evidences.results} type="reasoning" />
            <DimensionView title="法律依据" result={block.laws.results} type="legal" />
            <DimensionView title="综合结论" result={block.conclusion.results} type="conclusion" />
        </div>
    )
}

// ----------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------

export function AnalysisReportView({ content }: AnalysisReportViewProps) {
    if (!content) return <div className="p-8 text-center text-gray-500">无报告内容</div>

    return (
        <div className="max-w-[210mm] mx-auto bg-white p-8 md:p-12 shadow-sm border border-gray-100 text-gray-900 font-sans">

            {/* 1. Header & Conclusion (Always Visible) */}
            <div className="mb-10 space-y-6">
                <div className="text-center border-b-2 border-black pb-4 mb-8">
                    <h1 className="text-2xl font-bold tracking-tight text-black">{content.case_title || '案件法律分析报告'}</h1>
                    <p className="text-sm text-gray-500 mt-2">Case Analysis ID: {content.case_id}</p>
                </div>

                <div className="bg-gray-50 p-6 border-l-4 border-gray-800 rounded-r-md">
                    <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        核心结论
                    </h2>
                    <div className="text-base font-medium leading-relaxed text-gray-900 mb-4">
                        {content.conclusion.summary}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 border-t border-gray-200 pt-3">
                        <ConfidenceIndicator
                            level={content.conclusion.probability_info.confidence_level}
                            score={content.conclusion.probability_info.confidence_score}
                        />
                        <div className="flex gap-2 text-xs">
                            <span className="font-semibold text-gray-700">有利:</span>
                            <span className="text-gray-600 truncate max-w-[200px]" title={content.conclusion.probability_info.positive}>{content.conclusion.probability_info.positive}</span>
                        </div>
                        <div className="flex gap-2 text-xs">
                            <span className="font-semibold text-gray-700">不利:</span>
                            <span className="text-gray-600 truncate max-w-[200px]" title={content.conclusion.probability_info.negative}>{content.conclusion.probability_info.negative}</span>
                        </div>
                    </div>
                </div>

                {/* Pursuit Questions */}
                {content.conclusion.pursuit_questions && content.conclusion.pursuit_questions.length > 0 && (
                    <div className="space-y-3 pt-2">
                        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" /> 建议追问 / 风险提示
                        </h3>
                        <ul className="space-y-2 text-sm text-gray-700 list-disc pl-5">
                            {content.conclusion.pursuit_questions.slice(0, 10).map((q, i) => (
                                <li key={i} className="pl-1">
                                    <span className="font-medium text-gray-900">{q.question}</span>
                                    <span className="ml-2 text-xs text-gray-500 bg-gray-100 px-1 py-0.5 rounded">
                                        {q.type === 'guidance' ? '引导' : q.type === 'risk_warning' ? '风险' : '澄清'}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            <Separator className="mb-8" />

            {/* 2. Detailed Structure (Collapsible) */}
            <div className="space-y-1">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 pl-1">论证详情</div>

                {/* 1. Cause of Action */}
                <ReportSection title="一、案由梳理">
                    <ArgumentBlockView block={content.cause_of_action} />
                </ReportSection>

                {/* 2. Parties */}
                <ReportSection title="二、当事人主体资格">
                    <div className="grid grid-cols-1 gap-6">
                        <div className="border border-gray-200 rounded p-4">
                            <h4 className="font-bold text-gray-800 mb-4 border-b pb-2">原告方</h4>
                            <ArgumentBlockView block={content.parties.plaintiff} />
                        </div>
                        <div className="border border-gray-200 rounded p-4">
                            <h4 className="font-bold text-gray-800 mb-4 border-b pb-2">被告方</h4>
                            <ArgumentBlockView block={content.parties.defendant} />
                        </div>
                    </div>
                </ReportSection>

                {/* 3. Jurisdiction */}
                <ReportSection title="三、管辖权确认">
                    <ArgumentBlockView block={content.jurisdiction} />
                </ReportSection>

                {/* 4. Claims */}
                <ReportSection title="四、诉讼请求分析">
                    <ArgumentBlockView block={content.claims} />
                </ReportSection>

                {/* 5. Rights & Obligations Process */}
                <ReportSection title="五、权利义务相关事实进程" className="border-b-0">
                    <div className="space-y-8 pl-4 border-l-2 border-gray-100 ml-2">
                        {/* Phase 1 */}
                        <div className="relative">
                            <div className="absolute -left-[23px] top-0 w-4 h-4 rounded-full bg-gray-200 border-2 border-white ring-1 ring-gray-100"></div>
                            <h4 className="font-bold text-gray-900 mb-4">阶段 1: 权利义务建立</h4>
                            <div className="bg-gray-50/50 p-4 rounded-md border border-gray-100">
                                <ArgumentBlockView block={content.rights_and_obligations_process.formation} />
                            </div>
                        </div>

                        {/* Phase 2 */}
                        <div className="relative">
                            <div className="absolute -left-[23px] top-0 w-4 h-4 rounded-full bg-gray-200 border-2 border-white ring-1 ring-gray-100"></div>
                            <h4 className="font-bold text-gray-900 mb-4">阶段 2: 履行/履约</h4>
                            <div className="bg-gray-50/50 p-4 rounded-md border border-gray-100">
                                <ArgumentBlockView block={content.rights_and_obligations_process.performance} />
                            </div>
                        </div>

                        {/* Phase 3 */}
                        <div className="relative">
                            <div className="absolute -left-[23px] top-0 w-4 h-4 rounded-full bg-gray-800 border-2 border-white ring-1 ring-gray-100"></div>
                            <h4 className="font-bold text-gray-900 mb-4">阶段 3: 违约/争议产生</h4>
                            <div className="bg-gray-50/50 p-4 rounded-md border border-gray-100">
                                <ArgumentBlockView block={content.rights_and_obligations_process.breach} />
                            </div>
                        </div>
                    </div>
                </ReportSection>
            </div>
        </div>
    )
}
