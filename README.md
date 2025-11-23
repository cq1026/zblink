# Zeabur Manager

Cloudflare Workers 应用，用于管理 Zeabur 云服务，支持自动 Keepalive 防止服务被删除。

## 功能

- 重启/停止服务
- 密码保护
- **自动 Keepalive**：停止超过 20 天的服务自动重启后再暂停

## 部署

### 1. 创建 KV 命名空间

```bash
npx wrangler kv:namespace create "KV"
```

复制输出的 ID，替换 `wrangler.toml` 中的 `YOUR_KV_NAMESPACE_ID`

### 2. 配置环境变量

```bash
npx wrangler secret put AUTH_PASSWORD
npx wrangler secret put SERVICES
```

### 3. 部署

```bash
npx wrangler deploy
```

## 环境变量

| 变量名 | 说明 |
|--------|------|
| `AUTH_PASSWORD` | 操作密码 |
| `SERVICES` | 服务配置（JSON，含账号和服务） |

### SERVICES 格式

```json
{
  "accounts": {
    "main": "token1",
    "friend": "token2"
  },
  "services": [
    {
      "key": "blog",
      "name": "博客",
      "account": "main",
      "serviceId": "xxx",
      "environmentId": "xxx"
    },
    {
      "key": "game",
      "name": "游戏",
      "account": "friend",
      "serviceId": "yyy",
      "environmentId": "yyy"
    }
  ]
}
```

## 获取 Zeabur ID

1. **API Token**: [Zeabur 开发者设置](https://dash.zeabur.com/account/developer)

2. **Service ID / Environment ID**: 从 URL 获取
   ```
   https://dash.zeabur.com/projects/{PROJECT_ID}/services/{SERVICE_ID}?environmentID={ENVIRONMENT_ID}
   ```

## Keepalive 机制

- 每天 UTC 00:00 自动检查
- 停止超过 20 天的服务会自动：重启 → 等待 30 秒 → 暂停
- 无需手动干预

## 本地开发

```bash
# 创建 .dev.vars 文件
cp .dev.vars.example .dev.vars

# 运行
npx wrangler dev
```

## 项目结构

```
├── worker.js        # Workers 主代码
├── wrangler.toml    # 配置文件
├── src/             # 前端文件
│   ├── index.html
│   ├── style.css
│   └── app.js
└── README.md
```
