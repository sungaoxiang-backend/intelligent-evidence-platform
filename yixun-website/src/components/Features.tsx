
import { Brain, Network, Lock, Zap } from 'lucide-react';

const features = [
    {
        icon: <Brain className="w-6 h-6 text-white" />,
        title: "AI 辅助办案",
        description: "利用大语言模型自动提取案卷关键信息，生成案情摘要与法律文书草稿，提升文书撰写效率 80% 以上。",
        color: "bg-blue-500"
    },
    {
        icon: <Network className="w-6 h-6 text-white" />,
        title: "可视化证据链",
        description: "通过直观的思维导图展示证据与事实的关联，自动发现证据链断裂与矛盾点，辅助制定诉讼策略。",
        color: "bg-indigo-500"
    },
    {
        icon: <Lock className="w-6 h-6 text-white" />,
        title: "银行级数据安全",
        description: "私有化部署支持，全链路数据加密，精细化权限管控，确保案件数据绝对安全，符合律所合规要求。",
        color: "bg-cyan-500"
    },
    {
        icon: <Zap className="w-6 h-6 text-white" />,
        title: "极速协同办公",
        description: "支持多人实时在线协作办案，任务分发与进度追踪，让团队配合如臂使指，不再为沟通成本烦恼。",
        color: "bg-violet-500"
    }
];

export function Features() {
    return (
        <section id="features" className="py-24 bg-muted/30">
            <div className="container">
                <div className="text-center mb-16">
                    <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">为什么选择 汇法律</h2>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        我们不仅仅提供工具，更提供全新的法律工程化思维，重塑案件办理流程。
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {features.map((feature, index) => (
                        <div key={index} className="group relative bg-card p-6 rounded-2xl border border-border/50 shadow-sm hover:shadow-md transition-all duration-300 hover:translate-y-[-2px]">
                            <div className={`w-12 h-12 rounded-lg ${feature.color} flex items-center justify-center mb-4 shadow-lg`}>
                                {feature.icon}
                            </div>
                            <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                            <p className="text-muted-foreground leading-relaxed">
                                {feature.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
