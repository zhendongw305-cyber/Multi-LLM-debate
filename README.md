# Veritas AI

Veritas AI 是一个多模式 AI 对话项目，包含：

- `web`：Next.js 前端
- `backend`：NestJS 后端
- `db`：MySQL 8 数据库

项目已经补好 Docker 部署基础设施。正常情况下，别人只需要拉代码、复制环境变量模板、执行 `docker compose up -d --build`，然后在前端页面里补充模型凭证与模型配置，就可以跑起来。

## 目录结构

```text
.
├── backend/                  # NestJS API
├── web/                      # Next.js 前端
├── docker/
│   └── mysql/
│       └── init/
│           └── 001-schema.sql
├── docker-compose.yml
├── .env.example
└── README.md
```

## 部署前提

部署机器需要先安装：

- Docker
- Docker Compose Plugin

可用下面命令确认：

```bash
docker -v
docker compose version
```

## 一键部署

### 1. 拉取代码

```bash
git clone <your-repo-url>
cd Veritas-AI
```

### 2. 创建环境变量文件

复制模板：

```bash
cp .env.example .env
```

然后编辑根目录 `.env`。

至少需要配置这些项：

```bash
MYSQL_ROOT_PASSWORD=change_me_root_password
MYSQL_DATABASE=appdb
MYSQL_USER=veritas
MYSQL_PASSWORD=change_me_app_password

NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
```

说明：

- `MYSQL_ROOT_PASSWORD`：MySQL root 密码
- `MYSQL_DATABASE`：应用数据库名
- `MYSQL_USER`：应用数据库用户
- `MYSQL_PASSWORD`：应用数据库用户密码
- `NEXT_PUBLIC_API_BASE_URL`：前端发请求时使用的后端地址

如何填写 `NEXT_PUBLIC_API_BASE_URL`：

- 如果是在你自己的电脑本机部署并访问：用 `http://localhost:3001`
- 如果是部署在远程服务器，并且直接暴露后端端口：用 `http://<服务器IP>:3001`
- 如果是部署在远程服务器，并通过域名反向代理后端：用 `https://api.example.com`

如果部署在远程服务器并通过域名反代，`NEXT_PUBLIC_API_BASE_URL` 应改成你的真实后端地址，例如：

```bash
NEXT_PUBLIC_API_BASE_URL=https://api.example.com
```

### 3. 启动所有服务

```bash
docker compose up -d --build
```

首次启动完成后，请进入前端页面的“模型与凭证管理”面板，手动添加 API 凭证和参与模型。当前版本不再从 `.env` 读取模型 Key。

第一次启动会自动完成：

- 拉取 MySQL 镜像
- 构建 backend 镜像
- 构建 web 镜像
- 创建数据库卷
- 初始化 MySQL 表结构

### 4. 检查服务状态

```bash
docker compose ps
```

### 5. 访问服务

本机部署时：

- 前端：`http://localhost:3000`
- 后端：`http://localhost:3001`
- 健康检查：`http://localhost:3001/health`
- MySQL：`localhost:3306`

远程服务器部署时：

- 如果直接暴露端口，前端通常访问 `http://<服务器IP>:3000`
- 后端接口通常访问 `http://<服务器IP>:3001`
- 健康检查通常访问 `http://<服务器IP>:3001/health`
- 如果用了反向代理和域名，就改为访问你自己的域名，例如 `https://app.example.com` 和 `https://api.example.com`

注意：

- 浏览器里的 `localhost` 永远指“当前打开浏览器的那台机器”
- 所以如果项目跑在远程服务器上，就不要把给浏览器访问的地址写成 `localhost`

如果后端健康检查返回类似下面的 JSON，说明 API 已经启动成功：

```json
{
  "status": "ok",
  "service": "veritas-backend"
}
```

## 数据库初始化说明

数据库表结构初始化文件在：`docker/mysql/init/001-schema.sql`

MySQL 容器第一次启动时会自动执行该文件，创建以下核心表：

- `ProviderCredential`
- `Session`
- `Message`
- `Agent`

注意：

- 只有“第一次初始化新数据卷”时会自动执行
- 如果你已经有旧卷，再次 `up` 不会重复跑初始化 SQL

如果你想彻底重置数据库：

```bash
docker compose down -v
docker compose up -d --build
```

这会删除 MySQL 数据卷，请谨慎使用。

## 常用命令

启动：

```bash
docker compose up -d --build
```

停止：

```bash
docker compose down
```

查看日志：

```bash
docker compose logs -f
```

只看后端日志：

```bash
docker compose logs -f backend
```

只看前端日志：

```bash
docker compose logs -f web
```

只看数据库日志：

```bash
docker compose logs -f db
```

重启单个服务：

```bash
docker compose restart backend
docker compose restart web
docker compose restart db
```

重新构建并启动：

```bash
docker compose up -d --build
```

## 服务之间的关系

### 数据库

`db` 服务使用 MySQL 8，并且挂载了持久化卷：

- 卷名：`mysql_data`

因此容器删除后，只要不执行 `docker compose down -v`，数据就会保留。

### 后端

后端容器通过下面的连接串连接数据库：

```text
mysql://${MYSQL_USER}:${MYSQL_PASSWORD}@db:3306/${MYSQL_DATABASE}
```

注意这里主机名是 `db`，不是 `localhost`。这是 Docker Compose 内部服务名。

### 前端

前端不再写死后端地址，而是读取：

```bash
NEXT_PUBLIC_API_BASE_URL
```

这意味着：

- 本地直接跑：可以用 `http://localhost:3001`
- 服务器直接暴露端口：可以用 `http://<服务器IP>:3001`
- 服务器通过域名或反向代理：可以换成真实对外地址，例如 `https://api.example.com`

## 服务器部署建议

如果你是部署到 Linux 服务器，推荐流程：

### 1. 安装 Docker

按官方方式安装 Docker 和 Compose Plugin。

### 2. 放行端口

至少放行这些端口：

- `3000`：前端
- `3001`：后端
- `3306`：MySQL，如果你不需要外部直连数据库，可以不开放

更推荐的做法是：

- 对外只暴露 `80/443`
- 用 Nginx/Caddy 做反向代理
- 把 `3000/3001` 只留在服务器内部

### 3. 通过域名反代

例如：

- `app.example.com` -> `web:3000`
- `api.example.com` -> `backend:3001`

然后把 `.env` 改成：

```bash
NEXT_PUBLIC_API_BASE_URL=https://api.example.com
```

## 更新部署

后续更新代码时，一般用下面这套：

```bash
git pull
docker compose up -d --build
```

如果你怀疑镜像缓存导致没有更新，可以先：

```bash
docker compose down
docker compose up -d --build
```

## 本地开发

如果你不是要跑 Docker，而是想本地开发，可以参考这两个模板：

- `backend/.env.example`
- `web/.env.example`

本地开发启动方式通常是：

### 后端

```bash
cd backend
cp .env.example .env
npm install
npm run start:dev
```

### 前端

```bash
cd web
cp .env.example .env.local
npm install
npm run dev
```

## 常见问题

### 1. 前端能打开，但请求后端失败

优先检查：

- `.env` 里的 `NEXT_PUBLIC_API_BASE_URL` 是否正确
- `backend` 容器是否正常启动
- `docker compose logs -f backend`

### 2. 后端启动了，但数据库连接失败

优先检查：

- `db` 容器是否 healthy
- `.env` 里的 MySQL 用户名、密码、库名是否一致
- 是否手动改过 `docker-compose.yml`

### 3. 改了初始化 SQL，但没有生效

这是因为 MySQL 只会在“第一次初始化卷”时执行 `docker-entrypoint-initdb.d`。

如果确认要重建数据库：

```bash
docker compose down -v
docker compose up -d --build
```

### 4. 某些 AI 模式提示没有可用模型

说明当前数据库里还没有为该模式配置可用模型，或者模型绑定的凭证未启用。

请到前端“模型与凭证管理”面板检查：

- 是否已新增凭证
- 是否已新增模型
- 是否勾选了对应模式
- 模型和凭证是否都处于启用状态

### 5. 停止生成是否可用

前端“停止生成”已经接入后端流式中断，当前 Docker 部署不会影响这个能力。

## 安全建议

- 不要把真实 `.env` 提交到 Git
- 不要把真实 API Key 放进 README；统一通过后台数据库配置
- 服务器部署时建议把数据库端口改成仅内网可见
- 生产环境建议使用 HTTPS 反向代理
- 定期备份 MySQL 数据卷

## 当前部署文件

关键部署文件如下：

- `docker-compose.yml`
- `.env.example`
- `backend/Dockerfile`
- `web/Dockerfile`
- `docker/mysql/init/001-schema.sql`

如果你接下来愿意，我还能继续帮你补：

- `nginx` 反向代理配置
- 生产环境 `docker-compose.prod.yml`
- 自动备份 MySQL 的脚本
- GitHub Actions 自动部署工作流
