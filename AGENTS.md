# 项目上下文

## 项目简介
VPN 节点配置工具 - 输入节点信息，自动生成协议链接（SS/VMess/VLESS/Trojan/SOCKS5），Base64 编码后保存为订阅文件，并生成可扫描的二维码。节点数据持久化存储在 Supabase 数据库中。

### 版本技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4
- **QR 码**: qrcode.react
- **拖拽排序**: @dnd-kit/core + @dnd-kit/sortable
- **数据库**: Supabase (Postgres)

## 目录结构

```
├── public/
│   └── subscriptions/          # 生成的订阅文件存储目录（开发环境）
├── scripts/                    # 构建与启动脚本
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── generate/route.ts          # 生成订阅（从数据库读取选中节点）
│   │   │   ├── nodes/route.ts             # 添加节点
│   │   │   ├── nodes/list/route.ts        # 查询节点列表
│   │   │   ├── nodes/[id]/route.ts        # 删除节点
│   │   │   ├── nodes/reorder/route.ts     # 拖拽排序更新
│   │   │   └── subscription/[filename]/route.ts  # 订阅文件读取
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx                       # 主页面（表单 + 列表 + 二维码）
│   ├── components/ui/        # Shadcn UI 组件库
│   ├── hooks/
│   ├── lib/
│   └── storage/database/     # Supabase 客户端 + Schema
│       ├── supabase-client.ts
│       └── shared/schema.ts  # Drizzle 表结构定义
├── next.config.ts
├── package.json
└── tsconfig.json
```

## 核心功能模块

### 1. 节点配置表单 (`src/app/page.tsx`)
- 支持 5 种协议：Shadowsocks、VMess、VLESS、Trojan、SOCKS5
- 每种协议动态展示对应字段
- 高级设置折叠面板

### 2. 节点列表 (`src/app/page.tsx`)
- 从数据库加载，按 sort_order 排序
- 支持拖拽排序（@dnd-kit）
- 首列单选框，支持全选/取消全选
- 每行可删除

### 3. 添加节点 API (`src/app/api/nodes/route.ts`)
- POST 添加节点到数据库，自动计算 sort_order

### 4. 节点列表 API (`src/app/api/nodes/list/route.ts`)
- GET 查询所有节点，按 sort_order + id 排序

### 5. 删除节点 API (`src/app/api/nodes/[id]/route.ts`)
- DELETE 按 ID 删除节点

### 6. 排序更新 API (`src/app/api/nodes/reorder/route.ts`)
- POST 批量更新 sort_order

### 7. 生成订阅 API (`src/app/api/generate/route.ts`)
- 接收选中的 nodeIds，从数据库查询节点
- 按协议拼接 URI，Base64 编码，写入静态文件
- 返回完整 URL 用于二维码

### 8. 订阅文件读取 (`src/app/api/subscription/[filename]/route.ts`)
- 生产环境从 /tmp/subscriptions/ 读取，防目录穿越

## 协议格式

| 协议 | URI 格式 |
|------|----------|
| SS | `ss://base64(method:password@host:port)#name` |
| VMess | `vmess://base64(JSON配置)` |
| VLESS | `vless://uuid@host:port?params#name` |
| Trojan | `trojan://password@host:port?params#name` |
| SOCKS5 | `socks5://user:pass@host:port#name` |

## 数据库表结构 (vpn_nodes)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | serial (PK) | 自增主键 |
| protocol | varchar(20) | 协议类型 |
| address | varchar(255) | 服务器地址 |
| port | integer | 端口 |
| account | varchar(255) | 账号/UUID |
| password | varchar(255) | 密码 |
| node_name | varchar(128) | 节点名称 |
| encryption | varchar(64) | 加密方式 |
| network | varchar(20) | 传输协议 |
| tls | varchar(20) | TLS设置 |
| sni | varchar(255) | SNI |
| path | varchar(255) | 路径 |
| host | varchar(255) | Host |
| alter_id | integer | VMess AlterID |
| sort_order | integer | 排序序号 |
| created_at | timestamp | 创建时间 |
| updated_at | timestamp | 更新时间 |

## 包管理规范

**仅允许使用 pnpm** 作为包管理器，**严禁使用 npm 或 yarn**。

## 开发规范

### 编码规范
- TypeScript strict 模式，禁止隐式 any
- 函数参数、返回值必须有明确类型标注
- Supabase 操作必须检查 { data, error }，error 必须 throw
- 字段名使用 snake_case（数据库列名）

### Hydration 问题防范
- 使用 'use client' + useEffect + useState 处理客户端动态内容
- 禁止在 JSX 中直接使用 typeof window、Date.now() 等

### 环境变量
- `COZE_PROJECT_DOMAIN_DEFAULT`: 对外访问域名（含协议前缀）
- `DEPLOY_RUN_PORT`: 服务监听端口
- `COZE_PROJECT_ENV`: 环境标识（DEV/PROD）
- `COZE_SUPABASE_URL`: Supabase 连接 URL
- `COZE_SUPABASE_ANON_KEY`: Supabase 匿名密钥
- `COZE_SUPABASE_SERVICE_ROLE_KEY`: Supabase 服务端密钥
