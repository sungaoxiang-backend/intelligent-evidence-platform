import Image from "@tiptap/extension-image"
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
                renderHTML: (attributes) => {
                    if (!attributes.rotate) {
                        return {}
                    }
                    return {
                        style: `transform: rotate(${attributes.rotate}deg); display: inline-block;`,
                        // Also add a data attribute for easier parsing if needed, though style is standard
                        "data-rotate": attributes.rotate
                    }
                },
            },
        }
    },

    addNodeView() {
        return ReactNodeViewRenderer(ImageNodeView)
    },
})
