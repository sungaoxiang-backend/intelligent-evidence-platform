import Image from "@tiptap/extension-image"
import { mergeAttributes } from "@tiptap/core"
import { ReactNodeViewRenderer } from "@tiptap/react"
import { ImageNodeView } from "./image-node-view"

declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        imageExtension: {
            setImageAttributes: (attributes: { width?: number | string; height?: number | string; rotate?: number }) => ReturnType
        }
    }
}

export const ImageExtension = Image.extend({
    name: "image",

    addAttributes() {
        return {
            ...this.parent?.(),
            width: {
                default: null,
                parseHTML: (element) => element.getAttribute("width"),
                renderHTML: (attributes) => {
                    if (!attributes.width) {
                        return {}
                    }
                    return {
                        width: attributes.width,
                    }
                },
            },
            height: {
                default: null,
                parseHTML: (element) => element.getAttribute("height"),
                renderHTML: (attributes) => {
                    if (!attributes.height) {
                        return {}
                    }
                    return {
                        height: attributes.height,
                    }
                },
            },
            rotate: {
                default: 0,
                parseHTML: (element) => {
                    const transform = element.style.transform
                    if (transform) {
                        const match = transform.match(/rotate\(([-\d.]+)deg\)/)
                        return match ? parseFloat(match[1]) : 0
                    }
                    return 0
                },
                // renderHTML handled in main renderHTML method
            },
        }
    },

    renderHTML({ HTMLAttributes, node }) {
        const { width, height, rotate } = node.attrs

        if (rotate && rotate !== 0 && (width || height)) {
            // Parse dimensions
            let w = typeof width === "string" ? parseFloat(width) : width
            let h = typeof height === "string" ? parseFloat(height) : height

            // If dimensions are missing or invalid, fallback to standard img tag (can't calculate wrapper)
            if (!w || !h) {
                // Try to guess from styles if passed in attributes? No, node.attrs is source of truth.
                // Just render standard img with transform if we can't wrap correctly
                return ["img", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
                    style: `transform: rotate(${rotate}deg)`
                })]
            }

            const angle = rotate * (Math.PI / 180)
            const boundingWidth = Math.abs(w * Math.cos(angle)) + Math.abs(h * Math.sin(angle))
            const boundingHeight = Math.abs(w * Math.sin(angle)) + Math.abs(h * Math.cos(angle))

            return [
                "span",
                {
                    class: "image-wrapper",
                    style: `display: inline-block; width: ${boundingWidth}px; height: ${boundingHeight}px; position: relative; vertical-align: middle; line-height: 0;`,
                },
                [
                    "img",
                    mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
                        style: `transform: rotate(${rotate}deg); position: absolute; left: 50%; top: 50%; margin-left: -${w / 2}px; margin-top: -${h / 2}px; max-width: none;`
                    })
                ]
            ]
        }

        return ["img", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)]
    },

    addNodeView() {
        return ReactNodeViewRenderer(ImageNodeView)
    },
})
