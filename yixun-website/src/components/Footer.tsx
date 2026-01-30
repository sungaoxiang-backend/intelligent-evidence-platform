import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export function Footer() {
    const [isZoomed, setIsZoomed] = useState(false);

    return (
        <>
            <footer className="bg-muted/50 border-t border-border/40 pt-16 pb-8 text-center md:text-left">
                <div className="container">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                        <div className="space-y-4">
                            <div className="flex items-center justify-center md:justify-start gap-2">
                                <div className="w-6 h-6 rounded-lg bg-primary flex items-center justify-center">
                                    <span className="text-primary-foreground font-bold text-xs">汇</span>
                                </div>
                                <span className="font-bold">汇法律</span>
                            </div>
                            <p className="text-sm text-muted-foreground max-w-md mx-auto md:mx-0">
                                致力于为法律行业打造智能、高效、安全的数字化基础设施。
                            </p>
                        </div>

                        <div className="md:text-right flex flex-col items-center md:items-end">
                            <h4 className="font-semibold mb-4">联系我们</h4>
                            <div
                                className="p-2 bg-white rounded-lg shadow-sm border border-border/50 inline-block cursor-zoom-in transition-transform hover:scale-105"
                                onClick={() => setIsZoomed(true)}
                            >
                                <img src="/contact-qrcode.png" alt="汇法律AI律师" className="w-28 h-28 rounded-md" />
                                <p className="mt-1 text-xs text-center text-muted-foreground font-medium">点击放大扫码</p>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-border/40 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
                        <p>© 2024 广州义寻科技有限公司 All rights reserved.</p>
                        <div className="flex gap-4 items-center">
                            <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                                粤ICP备2023052474号-1
                            </a>
                        </div>
                    </div>
                </div>
            </footer>

            <AnimatePresence>
                {isZoomed && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsZoomed(false)}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 cursor-zoom-out"
                    >
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            className="relative bg-white p-4 rounded-2xl shadow-2xl max-w-sm w-full"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button
                                onClick={() => setIsZoomed(false)}
                                className="absolute -top-3 -right-3 p-2 bg-white rounded-full shadow-lg border border-border/50 hover:bg-gray-50 transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                            <img src="/contact-qrcode.png" alt="汇法律AI律师" className="w-full h-auto rounded-xl" />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
