# Design Document

## Overview

预览模式下的模板列表使用 `TemplateListItem` 渲染每张卡片，目前卡片的内容区与操作区均使用 `flex-[0_0_xx%]` 固定 basis，导致当模板名称过长时，整张卡片会强制拉伸超出列宽，按钮与状态徽章被挤出可视区域。编辑模式下的占位符卡片虽然也采用 70/30 分栏，但其容器宽度更稳定，因此不存在该问题。我们需要让模板卡片自身具备固定宽度，并让 70/30 分栏在容器内自适应缩放，确保按钮区域永远可见。

参考现有实现：

```660:835:frontend/app/document-templates/page.tsx
        {/* 按钮和状态区域 - 30% */}
        <div className="flex-[0_0_30%] flex flex-col items-end justify-between min-w-0 flex-shrink-0">
          {/* 操作按钮 */}
          <div className="flex gap-2 mb-auto">
            ...
```

```281:385:frontend/components/template-editor/placeholder-list.tsx
          {/* 按钮和状态区域 - 30% */}
          <div className="flex-[0_0_30%] flex flex-col items-end justify-between min-w-0 flex-shrink-0">
            ...
```

## Architecture

- 前端仍由 Next.js 14 App Router 驱动，变更仅限客户端组件 `frontend/app/document-templates/page.tsx`。
- 添加一个共享的侧栏卡片宽度 CSS 变量（例如 `--editor-sidebar-card-width`）到 `frontend/app/globals.css`，供模板卡片与占位符卡片同时使用，保证一致性。
- 将 `TemplateListItem` 的主容器宽度设置为 `var(--editor-sidebar-card-width)`，并在 `PlaceholderList` 中为卡片容器也挂载同一变量（仅当当前没有显式宽度，以保持统一来源）。
- 用 CSS Grid 或允许 shrink 的 flex 配置（`basis-0 grow`）替代引发溢出的 `flex-[0_0_70%]` / `flex-[0_0_30%]`，确保 70/30 比例在固定宽度内保持不变。

## Components and Interfaces

- `frontend/app/document-templates/page.tsx`
  - 调整 `TemplateListItem`：
    - 为卡片根节点添加 `style={{ width: 'var(--editor-sidebar-card-width)' }}`（或 tailwind `w-[var(--...)]` 形式）并保留 `w-full` 以适配窄屏。
    - 将内部布局改为 `className="grid grid-cols-[minmax(0,0.7fr)_minmax(96px,0.3fr)]"`，确保左侧文本区域可收缩，右侧交互区维持最小宽度。
    - 左侧内容区使用 `min-w-0` 与 `truncate` 保持 70% 宽度内展示，超长文本通过省略号处理。
    - 右侧按钮区设置 `min-w-[96px] flex`，内部按钮改为 `shrink-0`，同时利用 `flex-wrap` 避免过窄时断行。
    - 状态徽章容器改为 `justify-self-end`，保证始终在右上/下角对齐。
  - 列表容器（`<div className="p-3 ...">`）设置 `className="p-3 space-y-2 flex flex-col items-center"`，保证卡片宽度一致并居中。

- `frontend/components/template-editor/placeholder-list.tsx`
  - 若当前卡片未绑定固定宽度，则将同一 CSS 变量应用于占位符卡片根节点，确保两个模式的视觉一致性。

- `frontend/app/globals.css`（或 `styles/vars.css`）
  - 定义 `:root { --editor-sidebar-card-width: 360px; }`，并提供小屏降级（通过媒体查询将宽度改为 `calc(100% - 24px)`）。

## Data Models

- 无需修改后端 `DocumentTemplate` 或 `PlaceholderMeta` 数据结构，仅前端展示层处理。
- 依赖现有的 `DocumentTemplate` 属性（`name`, `description`, `status` 等）继续在左侧 70% 区域渲染。

## Error Handling

- 所有按钮交互保持原逻辑；唯一需注意的是当卡片宽度固定后，按钮点击区域不能被 `overflow:hidden` 截断，所以需确认右侧区域的 `overflow` 设为 `visible`。
- 在输入框重命名模式中，需保证 `input` 遵循 `max-width` 并在溢出时滚动或折行，防止影响按钮。

## Testing Strategy

- 单元测试：暂无直接可测逻辑；重点通过视觉回归手测或 Storybook（若存在）验证。
- 手动测试步骤：
  1. 打开 `/document-templates` 页面，确保模板列表卡片宽度固定，与编辑模式下占位符卡片匹配。
  2. 创建或修改一个名称极长的模板名称，确认卡片总宽度不变，长名称以省略号显示。
  3. 缩放浏览器窗口到最小断点，确认卡片切换为 100% 宽度但 70/30 比例仍成立，按钮没有溢出。
  4. 切换到编辑模式（进入模板编辑），确认占位符卡片仍与预览模式宽度一致，且新增 CSS 变量没有破坏原有样式。

