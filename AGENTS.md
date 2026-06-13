# 项目上下文

## 项目简介
VPN 节点配置工具 - 输入节点信息，自动生成协议链接（SS/VMess/VLESS/Trojan），Base64 编码后保存为订阅文件，并生成可扫描的二维码。

### 版本技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4
- **QR 码**: qrcode.react

## 目录结构

```
├── public/
│   └── subscriptions/      # 生成的订阅文件存储目录（开发环境）
├── scripts/                # 构建与启动脚本
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── generate/route.ts          # 生成节点链接 + Base64编码 + 保存文件
│   │   │   └── subscription/[filename]/route.ts  # 订阅文件读取接口（生产环境）
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx                       # 主页面（表单 + 结果展示 + 二维码）
│   ├── components/ui/      # Shadcn UI 组件库
│   ├── hooks/
│   └── lib/
├── next.config.ts
├── package.json
└── tsconfig.json
```

## 核心功能模块

### 1. 节点配置表单 (`src/app/page.tsx`)
- 支持多节点添加/删除
- 支持 4 种协议：Shadowsocks、VMess、VLESS、Trojan
- 每种协议动态展示对应字段（如 VMess 的 AlterID，SS 的加密方式）
- 高级设置折叠面板（加密方式、传输协议、TLS、SNI、Path、Host）

### 2. 生成 API (`src/app/api/generate/route.ts`)
- 接收节点数组，按协议拼接 URI 字符串
- 多节点用换行符连接后 Base64 编码
- 编码结果写入静态文件
- 开发环境：写入 `public/subscriptions/` 目录，通过 `/subscriptions/xxx.txt` 直接访问
- 生产环境：写入 `/tmp/subscriptions/` 目录，通过 `/api/subscription/xxx` API 路由读取
- 返回文件路径用于二维码生成

### 3. 订阅文件读取 (`src/app/api/subscription/[filename]/route.ts`)
- 生产环境专用，从 `/tmp/subscriptions/` 读取文件
- 防目录穿越安全校验
- 开发环境直接通过 Next.js 静态文件服务访问

### 4. 二维码生成
- 前端使用 `qrcode.react` 的 `QRCodeSVG` 组件
- 编码内容为订阅文件的完整 URL

## 协议格式

| 协议 | URI 格式 |
|------|----------|
| SS | `ss://base64(method:password@host:port)#name` |
| VMess | `vmess://base64(JSON配置)` |
| VLESS | `vless://uuid@host:port?params#name` |
| Trojan | `trojan://password@host:port?params#name` |

## 包管理规范

**仅允许使用 pnpm** 作为包管理器，**严禁使用 npm 或 yarn**。

## 开发规范

### 编码规范
- TypeScript strict 模式，禁止隐式 any
- 函数参数、返回值必须有明确类型标注

### Hydration 问题防范
- 使用 'use client' + useEffect + useState 处理客户端动态内容
- 禁止在 JSX 中直接使用 typeof window、Date.now() 等

### 环境变量
- `COZE_PROJECT_DOMAIN_DEFAULT`: 对外访问域名（含协议前缀）
- `DEPLOY_RUN_PORT`: 服务监听端口
- `COZE_PROJECT_ENV`: 环境标识（DEV/PROD）
