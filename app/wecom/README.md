# 企业微信集成模块

## 概述

本模块实现了企业微信的完整集成，包括URL验证、消息接收、事件处理和API调用功能。

## 功能特性

### ✅ 已实现功能

1. **URL验证** - 符合企业微信严格合规要求
2. **消息接收** - 支持加密消息的接收和解密
3. **事件处理** - 完整的事件分发和处理框架
4. **API集成** - 客户联系、欢迎语等核心API

### 🔧 核心组件

#### services.py - 核心服务
- `WeComService` - 单例模式的企业微信服务类
- 签名验证（支持URL验证和消息接收两种模式）
- AES消息解密（符合官方标准）
- API调用封装（获取access_token、客户详情、发送欢迎语等）

#### routers.py - API路由
- `GET /callback` - URL验证接口
- `POST /callback` - 消息接收接口
- `POST /contact-way` - 创建联系方式接口

## 事件处理

### 支持的事件类型

#### 用户事件
- `subscribe` - 关注事件
- `unsubscribe` - 取消关注事件
- `LOCATION` - 地理位置上报
- `CLICK` - 菜单点击事件
- `VIEW` - 菜单跳转事件
- `enter_agent` - 进入应用事件

#### 客户联系事件
- `change_external_contact` - 客户联系变更
  - `add_external_contact` - 添加客户
  - `del_external_contact` - 删除客户
  - `edit_external_contact` - 编辑客户
  - `add_half_external_contact` - 半客户关系

#### 客户群事件
- `change_external_chat` - 客户群变更

#### 客户标签事件
- `change_external_tag` - 客户标签变更

#### 用户消息
- `text` - 文本消息
- `image` - 图片消息
- `voice` - 语音消息
- `video` - 视频消息
- `file` - 文件消息
- `location` - 位置消息

### 事件处理框架

所有事件通过统一的处理框架分发：

1. **POST /callback** 接收加密消息
2. **签名验证** 确保消息来源可信
3. **消息解密** 获取原始XML内容
4. **事件解析** 提取事件类型和参数
5. **事件分发** 根据事件类型调用对应处理器
6. **业务处理** 执行具体的业务逻辑
7. **响应返回** 返回 `success` 确认接收

## 配置要求

### 环境变量

```bash
WECOM_CORP_ID=你的企业ID
WECOM_CORP_SECRET=你的应用密钥
WECOM_AGENT_ID=你的应用ID
WECOM_TOKEN=你的Token
WECOM_ENCODING_AES_KEY=你的EncodingAESKey
WECOM_CALLBACK_URL=你的回调URL
```

### 网络要求

- 必须使用80或443端口
- 域名需要备案（国内服务器）
- 需要在企业微信后台配置可信IP
- 支持HTTPS（推荐）

## 使用示例

### URL验证

企业微信配置回调URL时自动调用：

```
GET /callback?msg_signature=xxx&timestamp=xxx&nonce=xxx&echostr=xxx
```

### 接收消息

企业微信推送消息时调用：

```
POST /callback?msg_signature=xxx&timestamp=xxx&nonce=xxx
Content-Type: application/xml

<xml>
  <Encrypt><![CDATA[加密内容]]></Encrypt>
</xml>
```

### 创建联系方式

```bash
curl -X POST https://your-domain.com/wecom/contact-way \
  -H "Content-Type: application/json" \
  -d '{
    "type": 1,
    "scene": 1,
    "remark": "测试联系方式",
    "skip_verify": true,
    "style": 1,
    "qr_code": "https://example.com/qrcode.jpg"
  }'
```

## 日志说明

### 生产环境日志

- **INFO级别** - 关键业务流程（事件接收、处理成功等）
- **WARNING级别** - 潜在问题（换行符警告等）
- **ERROR级别** - 处理失败、异常等

### 调试信息

- 事件类型和来源用户
- 消息解密和签名验证结果
- 业务处理关键步骤
- API调用结果

## 合规性保证

### URL验证阶段
- ✅ 只返回纯文本明文
- ✅ Content-Type: text/plain
- ✅ 无XML/JSON包装
- ✅ 无BOM头
- ✅ 无换行符
- ✅ 字节级精确控制

### 消息接收阶段
- ✅ 5秒内响应
- ✅ 返回纯文本"success"
- ✅ 完整的签名验证
- ✅ 正确的解密算法

## 扩展开发

### 添加新事件处理器

1. 在 `handle_event_message` 中添加事件映射
2. 实现对应的处理函数
3. 添加必要的业务逻辑

### 自定义业务逻辑

在相应的处理函数中添加业务代码：
- 数据库操作
- 消息队列
- 第三方集成
- 业务规则处理

## 注意事项

1. **响应时间** - 必须在5秒内返回响应
2. **重试机制** - 企业微信会重试3次，间隔5-10秒
3. **幂等性** - 消息可能重复，需要保证幂等处理
4. **错误处理** - 始终返回success，错误在内部处理
5. **日志级别** - 生产环境建议INFO级别，调试可用DEBUG

## 故障排查

### 常见问题

1. **签名验证失败** - 检查Token配置和参数排序
2. **解密失败** - 确认EncodingAESKey正确性
3. **回调不通过** - 检查端口、域名备案、可信IP
4. **响应超时** - 优化处理逻辑，考虑异步处理

### 调试建议

1. 查看日志中的事件类型和来源用户
2. 检查XML解析和解密步骤
3. 验证API调用返回结果
4. 监控响应时间和错误率

## 更新日志

- 2025-09-07 - 完成企业微信集成，通过官方验证
- 2025-09-07 - 实现完整事件处理框架
- 2025-09-07 - 添加生产环境日志支持