# 员工管理接口文档（staffs）

## 1. 员工登录

- **接口地址**：`POST /api/v1/login/access-token`
- **请求类型**：`application/x-www-form-urlencoded`
- **请求参数**：

| 参数名    | 类型   | 必填 | 说明     |
| --------- | ------ | ---- | -------- |
| username  | string | 是   | 用户名   |
| password  | string | 是   | 密码     |

- **请求示例**：

```http
POST /api/v1/login/access-token
Content-Type: application/x-www-form-urlencoded

username=admin&password=admin123
```

- **响应示例**：

```json
{
  "code": 200,
  "message": "success",
  "timestamp": "2025-07-16T14:41:04.348061+08:00",
  "data": {
    "access_token": "<token>",
    "token_type": "bearer"
  }
}
```

---

## 2. 当前员工详情

- **接口地址**：`GET /api/v1/staffs/me`
- **请求头**：

| 参数名        | 必填 | 说明         |
| ------------- | ---- | ------------ |
| Authorization | 是   | Bearer Token |

- **请求示例**：

```http
GET /api/v1/staffs/me
Authorization: Bearer {access_token}
```

- **响应示例**：

```json
{
  "code": 200,
  "message": "success",
  "timestamp": "2025-07-16T14:39:53.995094+08:00",
  "data": {
    "username": "admin",
    "is_active": true,
    "is_superuser": true,
    "id": 1,
    "created_at": "2025-07-16T10:59:56.271974+08:00",
    "updated_at": "2025-07-16T10:59:56.271974+08:00"
  }
}
```

---

## 3. 当前员工更新

- **接口地址**：`PUT /api/v1/staffs/me`
- **请求头**：

| 参数名        | 必填 | 说明         |
| ------------- | ---- | ------------ |
| Authorization | 是   | Bearer Token |

- **请求体**（JSON）：

| 参数名   | 类型   | 必填 | 说明   |
| -------- | ------ | ---- | ------ |
| password | string | 是   | 新密码 |

- **请求示例**：

```http
PUT /api/v1/staffs/me
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "password": "admin123"
}
```

- **响应示例**：

```json
{
  "code": 200,
  "message": "success",
  "timestamp": "2025-07-16T14:41:17.647938+08:00",
  "data": {
    "username": "admin",
    "is_active": true,
    "is_superuser": true,
    "id": 1,
    "created_at": "2025-07-16T10:59:56.271974+08:00",
    "updated_at": "2025-07-16T14:41:17.363952+08:00"
  }
}
```

---

## 4. 创建员工

- **接口地址**：`POST /api/v1/staffs`
- **请求头**：

| 参数名        | 必填 | 说明         |
| ------------- | ---- | ------------ |
| Authorization | 是   | Bearer Token |

- **请求体**（JSON）：

| 参数名   | 类型   | 必填 | 说明   |
| -------- | ------ | ---- | ------ |
| username | string | 是   | 用户名 |
| password | string | 是   | 密码   |

- **请求示例**：

```http
POST /api/v1/staffs
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "username": "ethan",
  "password": "ethan123"
}
```

- **响应示例**：

```json
{
  "code": 200,
  "message": "success",
  "timestamp": "2025-07-16T14:40:14.866665+08:00",
  "data": {
    "username": "ethan",
    "is_active": true,
    "is_superuser": false,
    "id": 2,
    "created_at": "2025-07-16T14:40:14.479069+08:00",
    "updated_at": "2025-07-16T14:40:14.479069+08:00"
  }
}
```

---

## 5. 删除员工

- **接口地址**：`DELETE /api/v1/staffs/{id}`
- **请求头**：

| 参数名        | 必填 | 说明         |
| ------------- | ---- | ------------ |
| Authorization | 是   | Bearer Token |

- **路径参数**：

| 参数名 | 类型 | 必填 | 说明   |
| ------ | ---- | ---- | ------ |
| id     | int  | 是   | 员工ID |

- **请求示例**：

```http
DELETE /api/v1/staffs/2
Authorization: Bearer {access_token}
```

- **响应示例**：

```json
{
  "code": 200,
  "message": "success",
  "timestamp": "2025-07-16T14:43:01.739441+08:00",
  "data": null
}
```

---

## 6. 员工列表

- **接口地址**：`GET /api/v1/staffs`
- **请求头**：

| 参数名        | 必填 | 说明         |
| ------------- | ---- | ------------ |
| Authorization | 是   | Bearer Token |

- **请求示例**：

```http
GET /api/v1/staffs
Authorization: Bearer {access_token}
```

- **响应示例**：

```json
{
  "code": 200,
  "message": "success",
  "timestamp": "2025-07-16T14:39:15.265583+08:00",
  "data": [
    {
      "username": "admin",
      "is_active": true,
      "is_superuser": true,
      "id": 1,
      "created_at": "2025-07-16T10:59:56.271974+08:00",
      "updated_at": "2025-07-16T10:59:56.271974+08:00"
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "size": 100,
    "pages": 1
  }
}
``` 