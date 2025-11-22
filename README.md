# Zeabur Service Manager

一个部署在 Cloudflare Pages 上的 Web 应用，用于管理 Zeabur 云服务。

## 功能

- 重启服务
- 启动/停止服务
- 重新部署服务
- 密码保护所有操作
- 操作日志记录

## 部署到 Cloudflare Pages

### 1. Fork 或克隆此仓库

### 2. 在 Cloudflare Dashboard 创建 Pages 项目

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 Workers & Pages
3. 创建应用程序 → Pages → 连接到 Git
4. 选择此仓库

### 3. 配置构建设置

- **构建命令**: 留空
- **构建输出目录**: `src`

### 4. 配置环境变量

在 Cloudflare Pages 项目设置中添加以下环境变量：

| 变量名 | 说明 |
|--------|------|
| `AUTH_PASSWORD` | 操作密码（用于验证） |
| `ZEABUR_API_TOKEN` | Zeabur API Token |
| `ZEABUR_SERVICE_ID` | 服务 ID |
| `ZEABUR_ENVIRONMENT_ID` | 环境 ID |

### 5. 获取 Zeabur 配置信息

1. **API Token**: 在 [Zeabur 开发者设置](https://dash.zeabur.com/account/developer) 获取

2. **Service ID 和 Environment ID**:
   - 打开 Zeabur 控制台
   - 进入你的项目和服务
   - 从 URL 中获取：`https://dash.zeabur.com/projects/{PROJECT_ID}/services/{SERVICE_ID}?environmentID={ENVIRONMENT_ID}`

## 本地开发

### 安装 Wrangler

```bash
npm install -g wrangler
```

### 配置本地环境变量

创建 `.dev.vars` 文件：

```
AUTH_PASSWORD=your_password
ZEABUR_API_TOKEN=your_token
ZEABUR_SERVICE_ID=your_service_id
ZEABUR_ENVIRONMENT_ID=your_environment_id
```

### 运行本地开发服务器

```bash
npx wrangler pages dev src
```

## 项目结构

```
├── src/
│   ├── index.html    # 前端页面
│   ├── style.css     # 样式
│   └── app.js        # 前端逻辑
├── functions/
│   └── api/
│       └── [[action]].js  # API 端点
└── README.md
```

## 安全说明

- 所有操作都需要输入密码验证
- 密码存储在 Cloudflare 环境变量中，不会暴露给前端
- API Token 等敏感信息也存储在环境变量中
- 建议使用强密码

## API 端点

- `POST /api/restart` - 重启服务
- `POST /api/start` - 启动服务
- `POST /api/stop` - 停止服务
- `POST /api/redeploy` - 重新部署

所有端点需要在请求体中包含 `{ "password": "your_password" }`
