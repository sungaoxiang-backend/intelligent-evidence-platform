/**
 * 文书生成模块导出
 */

// 主页面组件
export { DocumentGenerationPage } from "./document-generation-page"

// 子组件
export { CaseSelector } from "./case-selector"
export { TemplateListSidebar } from "./template-list-sidebar"
export { GenerationTabs } from "./generation-tabs"
export { GenerationForm } from "./generation-form"
export { GenerationPreview } from "./generation-preview"
export { PlaceholderFieldRenderer } from "./placeholder-field-renderer"

// Hooks
export { useAutoSave, getSaveStatusText, getSaveStatusVariant } from "./use-auto-save"
export type { SaveStatus, UseAutoSaveOptions, UseAutoSaveReturn } from "./use-auto-save"

// 类型
export type { CaseSelectorProps } from "./case-selector"
export type { TemplateListSidebarProps } from "./template-list-sidebar"
export type { GenerationTabsProps } from "./generation-tabs"
export type { GenerationFormProps, PlaceholderInfo } from "./generation-form"
export type { GenerationPreviewProps } from "./generation-preview"
export type { PlaceholderFieldProps, PlaceholderOption } from "./placeholder-field-renderer"
export type { DocumentGenerationPageProps } from "./document-generation-page"

