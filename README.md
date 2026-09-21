# Kovar Agent Webside

浏览器 Web Agent，组合了固定默认 DeepSeek 对话、显式 Kovar 模型调用、Kovar Agent 工具与 Sepolia 钱包工具。

最重要的边界：

```text
Default Chat
DEEPSEEK_API_KEY → deepseek-v4-pro

Explicit Kovar Request
Connected Wallet Agent → Kovar Gateway → exact selected Kovar model
```

普通对话永远不会因为钱包、Kovar 绑定或 quota 可用而自动走 Kovar。只有用户明确说“使用 Kovar…”或等价强意图时，才进入 Kovar 模型预检与确认流程。页面没有永久模型选择器。

## 已实现

- Next.js App Router、React、TypeScript strict。
- RainbowKit + wagmi + viem 钱包连接，Ethereum Sepolia（chain ID `11155111`）。
- 默认聊天服务端代理，`DEEPSEEK_API_KEY` 不进入浏览器 bundle。
- 强意图 Agent Controller：`normal_chat`、`kovar_tool`、`kovar_model`、`wallet_tool`。
- 钱包地址作为 Agent ID：`connectedAddress.toLowerCase()`；不创建、不导入、不保存私钥。
- Gateway challenge/register、EIP-191 request signing、binding、Kovar login/2FA、Agent Key ensure。
- Account、models、pricing、usage、logs、tasks、topup info/chains/create/status 查询或操作。
- Kovar chat SSE、`X-Task-Id`、`gateway_error` 与中断后按已有 task ID 恢复；不会重放收费 POST。
- 运行时读取 AXUSD `symbol()`、`decimals()`、`balanceOf()`；支持 ETH/AXUSD transfer、approve 与 raw contract write 预览。
- 仅明确说 `unlimited`、`max` 或“无限授权”时使用 unlimited approve。
- Chat history 按钱包地址隔离；密码、2FA、token、签名和私钥不进入 history/localStorage。

## 目录

```text
src/
├── app/                    # 页面、providers、server API routes
├── config/                 # 客户端常量与 server-only env
├── contracts/              # ERC-20 ABI
├── features/
│   ├── agent/              # Agent 状态
│   ├── chat/               # Agent UI、消息与确认卡
│   ├── kovar/              # Kovar 登录 UI
│   └── wallet/             # 钱包连接与 wrong-network UI
├── lib/
│   ├── deepseek/           # DeepSeekService
│   ├── gateway/            # Gateway 签名、client、errors
│   └── web3/               # chain、wagmi config、explorer
├── services/               # AgentController、KovarCostEstimator
└── styles/
```

## 核心流程

### 默认 DeepSeek Chat

```text
Browser → POST /api/chat → DeepSeekService → DEEPSEEK_MODEL
```

此流程不调用 Kovar models、pricing、account 或 task API，也不显示 quota。

### Kovar Model

```text
明确 “Use Kovar…”
→ Agent 状态 / binding
→ GET /api/v1/models（精确校验 model ID）
→ GET /api/v1/pricing
→ 安全估价或显示 unavailable
→ 用户点击 “Send with Kovar”
→ 签名 POST /api/v1/tasks
→ SSE response
```

如果用户未指定模型，只在该次请求卡片中展示当前可用模型。指定模型不存在时不会自动替换。

### Wallet / Agent

- 首次连接后点击 Register Agent，完成 challenge、注册消息签名与 register。
- `PENDING` 不无限轮询；用户使用 Refresh Agent 主动检查。
- 地址变化会重置 Agent、Kovar、quota、任务确认和交易确认状态，并加载该地址独立 history。
- 错误网络必须切回 Sepolia，所有写操作先显示 network/action/asset/amount/to 预览。
- 交易 success 以 Sepolia receipt 为准，并提供 Etherscan 链接。

## 环境变量

复制示例并填写：

```bash
cp .env.example .env.local
```

必需：

- `DEEPSEEK_API_KEY`：仅服务端。
- `DEEPSEEK_BASE_URL`：OpenAI-compatible DeepSeek base URL。
- `DEEPSEEK_MODEL`：默认 `deepseek-v4-pro`。
- `KOVAR_AGENT_GATEWAY_URL`：仅服务端，由 `/api/gateway/*` 透明代理。
- `NEXT_PUBLIC_EVM_RPC_URL`、`NEXT_PUBLIC_EVM_CHAIN_ID`、`NEXT_PUBLIC_AXUSD_ADDRESS`。
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`：启用 WalletConnect QR/mobile 时填写；Injected/EIP-6963 钱包不依赖它。

## 本地运行

```bash
pnpm install
pnpm dev
```

质量检查：

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## 当前 Gateway 限制

- 当前 Gateway 源码没有独立的 `estimate` / `preflight` / `dry-run` API。Web 只对已与当前 router 源码核验的 `deepseek-v4-pro` 规则做整数向上估算；其他模型显示 `Estimated cost unavailable`，不会猜价格。Gateway 的最终任务 admission 仍会再次执行真实 pricing 与 budget guard。
- Gateway 的每个 Agent API 都要求一次新的 EIP-191 钱包签名；Web 不保存私钥或创建本地解锁凭据，因此连续预检可能出现多次钱包签名。
- 当前可直接操作的 Kovar 模型 UI 是 chat/SSE。Gateway proxy 保留 task、video polling 等路由，但图像编辑、音频上传等 multipart authoring UI 尚未提供。
- 未配置真实 DeepSeek key、Gateway、已批准 Agent 和钱包时，无法进行真实模型扣费、Kovar 登录或链上写入的自动验收。
