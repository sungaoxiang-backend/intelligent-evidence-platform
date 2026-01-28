import { motion } from 'framer-motion';
import { Shield, Scale, FileText } from 'lucide-react';

export function Hero() {
    return (
        <section className="relative pt-32 pb-16 md:pt-48 md:pb-32 overflow-hidden">
            <div className="absolute inset-0 z-0">
                <div className="absolute top-0 transform -translate-x-1/2 left-1/2 w-full h-[500px] bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
            </div>

            <div className="container relative z-10 text-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-medium text-primary mb-6">
                        <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-pulse"></span>
                        下一代法律科技平台
                    </span>

                    <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-foreground mb-6 max-w-4xl mx-auto leading-tight">
                        赋能法律实践 <br className="hidden sm:inline" />
                        <span className="text-primary bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-600">
                            智启公正未来
                        </span>
                    </h1>

                    <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                        结合人工智能与深度法律图谱，为法律从业者提供高效、精准的数字化证据分析与案件管理解决方案。
                    </p>

                    <div className="flex flex-col items-center justify-center gap-4 mb-16">
                        {/* QR Code moved to footer */}
                    </div>
                </motion.div>

                {/* Floating Icons Animation */}
                <div className="relative h-[200px] md:h-[400px] mt-8 max-w-5xl mx-auto perspective-1000">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3, duration: 0.8 }}
                        className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full h-full border border-border/50 rounded-xl bg-background/50 backdrop-blur-sm shadow-2xl flex items-center justify-center"
                    >
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 p-8 w-full h-full">
                            <div className="flex flex-col items-center justify-center p-6 rounded-lg bg-card/50 border border-border/50">
                                <Shield className="w-12 h-12 text-primary mb-4" />
                                <h3 className="text-lg font-bold mb-2">安全合规</h3>
                                <p className="text-sm text-muted-foreground">企业级数据加密与隐私保护</p>
                            </div>
                            <div className="flex flex-col items-center justify-center p-6 rounded-lg bg-card/50 border border-border/50">
                                <Scale className="w-12 h-12 text-primary mb-4" />
                                <h3 className="text-lg font-bold mb-2">智能分析</h3>
                                <p className="text-sm text-muted-foreground">基于图谱的深度案件推理</p>
                            </div>
                            <div className="flex flex-col items-center justify-center p-6 rounded-lg bg-card/50 border border-border/50">
                                <FileText className="w-12 h-12 text-primary mb-4" />
                                <h3 className="text-lg font-bold mb-2">证据管理</h3>
                                <p className="text-sm text-muted-foreground">一站式数字化证据链整合</p>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
