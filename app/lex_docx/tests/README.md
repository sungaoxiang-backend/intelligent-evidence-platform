# Lex Docx 模块测试说明

## 测试结构

本模块包含以下测试文件：

1. **单元测试**
   - `test_utils.py` - 工具函数测试（占位符提取、文档转换等）
   - `test_status_management.py` - 状态管理功能测试
   - `test_import_export.py` - 导入导出功能测试
   - `test_generation.py` - 文档生成功能测试

2. **集成测试**
   - `test_integration_template_lifecycle.py` - 模板生命周期集成测试
   - `test_integration_document_generation.py` - 文档生成流程集成测试

## 运行测试

### 前置条件

1. 确保已安装测试依赖：
```bash
uv sync --extra dev
```

2. 确保测试数据库已创建（测试会使用 `{POSTGRES_DB}_test` 数据库）

3. 确保环境变量已配置（`.env` 文件）

### 运行所有测试

```bash
# 运行所有 lex_docx 模块的测试
pytest app/lex_docx/tests/

# 运行特定测试文件
pytest app/lex_docx/tests/test_integration_template_lifecycle.py

# 运行特定测试类
pytest app/lex_docx/tests/test_integration_template_lifecycle.py::TestTemplateLifecycle

# 运行特定测试方法
pytest app/lex_docx/tests/test_integration_template_lifecycle.py::TestTemplateLifecycle::test_create_template
```

### 运行单元测试

```bash
pytest app/lex_docx/tests/test_utils.py
pytest app/lex_docx/tests/test_status_management.py
pytest app/lex_docx/tests/test_import_export.py
pytest app/lex_docx/tests/test_generation.py
```

### 运行集成测试

```bash
pytest app/lex_docx/tests/test_integration_template_lifecycle.py
pytest app/lex_docx/tests/test_integration_document_generation.py
```

### 查看测试覆盖率

```bash
# 需要先安装 pytest-cov
uv pip install pytest-cov

# 运行测试并生成覆盖率报告
pytest app/lex_docx/tests/ --cov=app/lex_docx --cov-report=html

# 查看 HTML 报告
open htmlcov/index.html
```

## 测试说明

### 集成测试注意事项

1. **测试数据库**
   - 集成测试使用独立的测试数据库（`{POSTGRES_DB}_test`）
   - 测试会自动创建和清理数据库表
   - 每个测试用例运行后会自动回滚事务

2. **认证和权限**
   - 测试使用 `conftest.py` 中定义的 fixtures 创建测试用户
   - `test_staff` - 普通用户
   - `test_superuser` - 超级管理员
   - `auth_headers` - 普通用户认证头
   - `superuser_headers` - 超级管理员认证头

3. **Mock 外部服务**
   - COS 服务在测试中被 mock，避免实际调用外部 API
   - 文件系统操作在测试中可能需要特殊处理

4. **测试数据清理**
   - 每个测试用例应该独立，不依赖其他测试用例的数据
   - 使用 fixtures 确保测试环境的一致性

## 前端测试（待实现）

前端测试需要配置测试框架。建议使用：

1. **组件测试**：Jest + React Testing Library
2. **E2E 测试**：Playwright 或 Cypress

配置步骤：

1. 安装测试依赖
2. 配置 Jest 和 React Testing Library
3. 配置 Playwright 或 Cypress
4. 编写组件测试和 E2E 测试

## 持续集成

建议在 CI/CD 流程中运行测试：

```yaml
# 示例 GitHub Actions 配置
- name: Run tests
  run: |
    uv sync --extra dev
    pytest app/lex_docx/tests/ --cov=app/lex_docx
```

