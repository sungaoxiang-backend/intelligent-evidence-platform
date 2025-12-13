import { NodeViewWrapper, NodeViewProps } from "@tiptap/react"
import React, { useCallback, useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

export const ImageNodeView: React.FC<NodeViewProps> = (props) => {
    const { node, updateAttributes, selected, editor, extension } = props
    const { src, alt, title, width, height, rotate } = node.attrs

    // Local state for smooth interactions
    const [isResizing, setIsResizing] = useState(false)
    const [isRotating, setIsRotating] = useState(false)
    const [localWidth, setLocalWidth] = useState<number | string>(width || "auto")
    const [localHeight, setLocalHeight] = useState<number | string>(height || "auto")
    const [localRotate, setLocalRotate] = useState<number>(rotate || 0)

    const imageRef = useRef<HTMLImageElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const initialPos = useRef<{ x: number; y: number; w: number; h: number; r: number }>({ x: 0, y: 0, w: 0, h: 0, r: 0 })

    // Sync with node attributes when not interacting
    useEffect(() => {
        if (!isResizing) {
            setLocalWidth(width || "auto")
            setLocalHeight(height || "auto")
        }
        if (!isRotating) {
            setLocalRotate(rotate || 0)
        }
    }, [width, height, rotate, isResizing, isRotating])

    // --- Resize Handler ---
    const handleResizeStart = (e: React.MouseEvent, direction: string) => {
        e.preventDefault()
        e.stopPropagation()

        if (!imageRef.current) return

        const rect = imageRef.current.getBoundingClientRect()
        // Capture initial state
        initialPos.current = {
            x: e.clientX,
            y: e.clientY,
            w: rect.width,
            h: rect.height,
            r: localRotate
        }

        setIsResizing(true)

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const dx = moveEvent.clientX - initialPos.current.x
            const dy = moveEvent.clientY - initialPos.current.y

            // Calculate new dimensions based on direction
            // Note: This logic assumes 0 rotation for simplicity in resizing calculation. 
            // For rotated images, dx/dy need to be projected onto the image axes, but for MVP simple delta is usually okay or we block resize on rotate.
            // Let's implement standard corner/edge resizing.

            let newWidth = initialPos.current.w
            let newHeight = initialPos.current.h

            // Directions: 'tl', 'tr', 'bl', 'br', 'l', 'r', 't', 'b'
            if (direction.includes('r')) newWidth = Math.max(20, initialPos.current.w + dx)
            if (direction.includes('l')) newWidth = Math.max(20, initialPos.current.w - dx)
            if (direction.includes('b')) newHeight = Math.max(20, initialPos.current.h + dy)
            if (direction.includes('t')) newHeight = Math.max(20, initialPos.current.h - dy)

            setLocalWidth(newWidth)
            setLocalHeight(newHeight)
        }

        const handleMouseUp = () => {
            setIsResizing(false)
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)

            // Persist changes
            // We use the last calculated local state
            // Note: we need to access the LATEST local state, but closures capture variables. 
            // Better to check the ref or just trust the state update cycle or use a ref for values.
            // Actually, since we are inside the component, we can just use the values from the last render or use functional updates.
            // BUT, `updateAttributes` needs the value. Let's use the element's style or a ref tracker.
            // Simplest: re-read from a ref that tracks localWidth/Height.
        }

        // To cleanly capture the final value in mouseUp, we might want to update a ref during move.
        // However, since `updateAttributes` is stable, we can just trigger it.
        // Actually, `handleMouseUp` closes over the initial scope.
        // Let's use a slightly different pattern for the listener to access current state?
        // Or simpler: put the move handler in a useEffect that depends on isResizing?

        // Let's go with the standard "add listener with fresh closure isn't easy", so we use a ref for the *current* interactive values.

        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', () => {
            setIsResizing(false)

            // Element style has valid width/height
            /* 
               Since we are uncontrolled during drag via state, we can't easily grab the state in this closure 
               unless we use a ref for current dimensions or read from DOM.
               Reading from DOM is reliable.
            */
            if (imageRef.current) {
                const finalWidth = imageRef.current.clientWidth // or style.width?
                const finalHeight = imageRef.current.clientHeight
                // We need the precise values we calculated, which might be slightly different from clientWidth due to box-sizing etc.
                // But close enough.
                // Let's use a mutable ref for temp storage to be precise.
            }
            document.removeEventListener('mousemove', handleMouseMove)
        }, { once: true })
    }

    // Refined Resize Logic with global listeners and refs
    const interactiveState = useRef({ w: 0, h: 0, r: 0 })

    useEffect(() => {
        interactiveState.current = {
            w: typeof localWidth === 'number' ? localWidth : (imageRef.current?.offsetWidth || 0),
            h: typeof localHeight === 'number' ? localHeight : (imageRef.current?.offsetHeight || 0),
            r: localRotate
        }
    }, [localWidth, localHeight, localRotate])

    const onResizeMouseDown = (e: React.MouseEvent, direction: string) => {
        e.preventDefault()
        e.stopPropagation()
        if (!imageRef.current) return

        const startX = e.clientX
        const startY = e.clientY
        const startW = imageRef.current.offsetWidth
        const startH = imageRef.current.offsetHeight

        setIsResizing(true)

        const onMove = (e: MouseEvent) => {
            const dx = e.clientX - startX
            const dy = e.clientY - startY

            let w = startW
            let h = startH

            if (direction.includes('r')) w = startW + dx
            if (direction.includes('l')) w = startW - dx
            if (direction.includes('b')) h = startH + dy
            if (direction.includes('t')) h = startH - dy

            w = Math.max(20, w)
            h = Math.max(20, h)

            setLocalWidth(w)
            setLocalHeight(h)
            interactiveState.current.w = w
            interactiveState.current.h = h
        }

        const onUp = () => {
            setIsResizing(false)
            updateAttributes({
                width: interactiveState.current.w,
                height: interactiveState.current.h
            })
            document.removeEventListener('mousemove', onMove)
            document.removeEventListener('mouseup', onUp)
        }

        document.addEventListener('mousemove', onMove)
        document.addEventListener('mouseup', onUp)
    }

    // --- Rotate Handler ---
    const onRotateMouseDown = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()

        if (!containerRef.current) return

        const rect = containerRef.current.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2

        setIsRotating(true)

        const onMove = (e: MouseEvent) => {
            const dx = e.clientX - centerX
            const dy = e.clientY - centerY
            // Calculate angle
            let angle = Math.atan2(dy, dx) * (180 / Math.PI)
            // Adjust so "up" is 0 or whatever feels natural. Typically right is 0.
            // Let's make top -90 -> 0.
            angle += 90

            setLocalRotate(angle)
            interactiveState.current.r = angle
        }

        const onUp = () => {
            setIsRotating(false)
            updateAttributes({
                rotate: interactiveState.current.r
            })
            document.removeEventListener('mousemove', onMove)
            document.removeEventListener('mouseup', onUp)
        }

        document.addEventListener('mousemove', onMove)
        document.addEventListener('mouseup', onUp)
    }

    return (
        <NodeViewWrapper className="inline-block leading-none relative group select-none draggable-source">
            <div
                ref={containerRef}
                className={cn(
                    "relative inline-block transition-transform",
                    selected ? "ring-2 ring-primary ring-offset-2" : ""
                )}
                style={{
                    width: localWidth,
                    height: localHeight,
                    transform: `rotate(${localRotate}deg)`
                }}
            >
                {/* The Image */}
                <img
                    ref={imageRef}
                    src={src}
                    alt={alt}
                    title={title}
                    className="w-full h-full object-fill block"
                    style={{ width: '100%', height: '100%', objectFit: 'fill' }}
                    draggable={true} // Allow Tiptap drag
                    data-drag-handle // Hint for drag handle
                />

                {/* Controls (Only show when selected) */}
                {selected && editor.isEditable && (
                    <>
                        {/* Resize Handles */}
                        {/* Corners */}
                        <div
                            className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border border-primary cursor-nwse-resize z-20"
                            onMouseDown={(e) => onResizeMouseDown(e, 'tl')}
                        />
                        <div
                            className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border border-primary cursor-nesw-resize z-20"
                            onMouseDown={(e) => onResizeMouseDown(e, 'tr')}
                        />
                        <div
                            className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border border-primary cursor-nesw-resize z-20"
                            onMouseDown={(e) => onResizeMouseDown(e, 'bl')}
                        />
                        <div
                            className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-primary cursor-nwse-resize z-20"
                            onMouseDown={(e) => onResizeMouseDown(e, 'br')}
                        />

                        {/* Edges (Optional, but requested "adjust width/height independently") */}
                        <div
                            className="absolute top-1/2 -right-1.5 w-3 h-3 bg-white border border-primary cursor-ew-resize -translate-y-1/2 z-20"
                            onMouseDown={(e) => onResizeMouseDown(e, 'r')}
                        />
                        <div
                            className="absolute bottom-1.5 left-1/2 w-3 h-3 bg-white border border-primary cursor-ns-resize -translate-x-1/2 z-20"
                            onMouseDown={(e) => onResizeMouseDown(e, 'b')}
                        />

                        {/* Rotate Handle */}
                        <div
                            className="absolute -top-8 left-1/2 w-4 h-4 bg-white border border-primary rounded-full cursor-grab -translate-x-1/2 flex items-center justify-center z-20"
                            onMouseDown={onRotateMouseDown}
                        >
                            <div className="w-1 h-1 bg-primary rounded-full" />
                        </div>
                        <div className="absolute -top-8 left-1/2 h-8 w-px bg-primary -translate-x-1/2 pointer-events-none" />
                    </>
                )}
            </div>
        </NodeViewWrapper>
    )
}
