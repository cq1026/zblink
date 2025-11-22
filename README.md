# Zeabur Manager

部署在 Cloudflare Pages 上的 Web 应用，用于管理多个 Zeabur 云服务。

## 功能

- 支持多个服务管理
- 重启/启动/停止/部署服务
- 密码保护所有操作
- 深色主题界面
- 操作日志记录

## 部署

### 1. 在 Cloudflare Pages 创建项目

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Workers & Pages → 创建应用程序 → Pages
3. 连接 Git 仓库

### 2. 配置构建

- **构建命令**: 留空
- **构建输出目录**: `src`

### 3. 配置环境变量

| 变量名 | 说明 |
|--------|------|
| `AUTH_PASSWORD` | 操作密码 |
| `ZEABUR_API_TOKEN` | Zeabur API Token |
| `SERVICES` | 服务配置（JSON 格式） |

### 4. SERVICES 格式

```json
[
  {
    "key": "blog",
    "name": "博客服务",
    "serviceId": "你的服务ID",
    "environmentId": "你的环境ID"
  },
  {
    "key": "api",
    "name": "API 服务",
    "serviceId": "另一个服务ID",
    "environmentId": "另一个环境ID"
  }
]
```

**字段说明**：
- `key`: 唯一标识符（不会暴露给前端的 ID）
- `name`: 显示名称
- `serviceId`: Zeabur 服务 ID
- `environmentId`: Zeabur 环境 ID

### 5. 获取 Zeabur ID

1. **API Token**: [Zeabur 开发者设置](https://dash.zeabur.com/account/developer)

2. **Service ID / Environment ID**: 从 URL 获取
   ```
   https://dash.zeabur.com/projects/{PROJECT_ID}/services/{SERVICE_ID}?environmentID={ENVIRONMENT_ID}
   ```

## 本地开发

```bash
# 创建配置文件
cp .dev.vars.example .dev.vars

# 编辑 .dev.vars 填入配置

# 运行开发服务器
npx wrangler pages dev src
```

## 安全性

- 所有操作需要密码验证
- 敏感信息（Token、ID）存储在 Cloudflare 环境变量
- 前端只能获取服务的 key 和 name
- serviceId、environmentId 不会暴露给浏览器
