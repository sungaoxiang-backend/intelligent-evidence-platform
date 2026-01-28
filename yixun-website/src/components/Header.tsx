

export function Header() {
    return (
        <header className="fixed top-0 w-full z-50 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-16 max-w-screen-2xl items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                        <span className="text-primary-foreground font-bold text-lg">汇</span>
                    </div>
                    <span className="text-xl font-bold tracking-tight">汇法律</span>
                </div>
            </div>
        </header>
    );
}
