# AGENTS.md — 通用 Web3 dApp 前端工程规范

> 适用范围：EVM Web3 dApp 前端项目，尤其是 Next.js / React / TypeScript 项目。
> 目标：让代码生成 Agent 在不同 Web3 dApp 中遵循一致的工程边界、钱包交互、质量门禁和交付方式。
> 原则：高内聚、低耦合、最小必要复杂度、可验证交付。
>
> 本文件是仓库级工程约束，不是业务需求文档。项目特有的链、合约、页面、品牌、接口和业务规则应放在项目 README、docs 或本文件末尾的 “Project Overrides” 中。

---

## 1. 指令优先级

按以下优先级执行：

1. 用户当前明确提出的目标、范围和验收标准。
2. 当前仓库已有且合理的代码、目录、风格和架构约定。
3. 本 `AGENTS.md` 的安全、架构边界和质量要求。
4. 框架、Web3 库和依赖的官方推荐实践。
5. 本文件中的默认技术选型。

如果现有项目已经有稳定实现，不为了“统一风格”进行无关迁移。

---

## 2. Agent 工作原则

### 2.1 Think Before Coding

不要静默猜测。

开始实现前：

- 先阅读相关代码、`README.md`、`package.json`、环境变量、测试和部署配置。
- 明确本次任务的目标、涉及范围、主要依赖和成功标准。
- 如果存在多个会明显改变业务结果、数据模型、安全边界或链上行为的解释，先说明歧义并询问。
- 小型实现细节采用合理默认值，不为低价值问题反复打断任务。
- 如果已有更简单方案，优先简单方案。

### 2.2 Simplicity First

只实现当前任务真正需要的内容。

- 不增加未要求的功能。
- 不为单次使用代码创建复杂抽象。
- 不为“未来可能需要”提前设计大量扩展点。
- 不引入无必要的微服务、状态库、封装层或依赖。
- 如果同样结果可以用明显更少的代码完成，优先更简单实现。
- 高内聚、低耦合不等于“接口越多越好”；只有存在稳定边界、重复逻辑或可替换依赖时才抽象。

### 2.3 Surgical Changes

修改现有项目时，只改完成任务所必需的内容。

- 不顺手重构无关模块。
- 不重排无关文件或格式化整个仓库。
- 不删除本次修改前已经存在的死代码，除非用户明确要求。
- 本次修改造成的未使用 import、变量、函数和文件必须清理。
- 每一个修改都应该能追溯到当前需求。

### 2.4 Goal-Driven Execution

先定义可验证结果，再实现。

对于非简单任务，先给出简短计划：

```text
1. 修改什么 → 如何验证
2. 修改什么 → 如何验证
3. 修改什么 → 如何验证
```

实现后必须实际执行可用的检查，不得仅凭代码阅读声称完成。

---

## 3. 技术栈策略

### 3.1 现有项目优先

已有项目：

- 保持现有框架、组件库、状态管理和 Web3 技术路线。
- 除非任务明确要求，不做 React / Next / Tailwind / wagmi / viem / RainbowKit 的大版本迁移。
- 新依赖必须有明确用途。

### 3.2 新建 EVM dApp 默认栈

若项目未指定技术栈，可使用：

- Framework：Next.js App Router
- UI：React + TypeScript strict
- Styling：Tailwind CSS
- UI primitives：shadcn/ui + Radix UI
- Icons：Lucide
- Form：React Hook Form + Zod
- Server state：TanStack Query
- Web3 core：wagmi + viem
- Wallet UI：RainbowKit
- Unit / component test：Vitest + React Testing Library
- E2E：Playwright
- Package manager：pnpm

版本要求：

- 使用相互兼容的稳定版本。
- 不使用 `*` 或无约束的 `latest`。
- 保留并提交锁文件。
- 不为了追求“最新”而主动升级已有稳定依赖。

---

## 4. 架构核心：高内聚、低耦合

### 4.1 依赖方向

推荐依赖方向：

```text
app / routes
    ↓
features
    ↓
shared components / domain helpers
    ↓
lib / web3 / api / config
```

禁止反向依赖：

```text
lib -> feature
config -> React page
ui primitive -> business feature
contract config -> page component
```

### 4.2 高内聚

同一业务能力所需的：

- components
- hooks
- schemas
- api
- types
- transaction logic
- tests

优先放在同一 `features/<feature-name>/` 内。

例如：

```text
features/
└── staking/
    ├── components/
    ├── hooks/
    ├── api/
    ├── schemas/
    ├── types/
    ├── utils/
    └── index.ts
```

`staking` 的业务状态、交易流程和展示逻辑应尽量留在 `staking` feature 内，而不是散落到 `app/`、`lib/` 和全局 hooks。

### 4.3 低耦合

- feature 不直接引用另一个 feature 的内部文件。
- 跨 feature 能力通过明确公共出口、shared component 或基础设施模块共享。
- 页面只负责路由参数、权限入口、数据入口和 feature 组合。
- 通用 UI 不读取合约、不调用业务 API、不知道业务实体。
- Web3 provider 和 chain config 不依赖具体页面。
- 合约 ABI 和地址不直接写进组件。
- 不在业务组件中直接访问 `window.ethereum`。

### 4.4 不过度抽象

不要为了“低耦合”给每个函数增加 interface、adapter、factory。

只有满足至少一个条件时再抽象：

- 存在两个以上真实实现；
- 第三方依赖需要隔离；
- 逻辑被多个 feature 复用；
- 该边界需要独立测试；
- 当前需求明确要求可替换。

---

## 5. 推荐目录

新项目默认：

```text
.
├── public/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── loading.tsx
│   │   ├── error.tsx
│   │   ├── not-found.tsx
│   │   └── providers.tsx
│   ├── features/
│   │   ├── wallet/
│   │   ├── transactions/
│   │   └── <business-feature>/
│   ├── components/
│   │   ├── ui/
│   │   └── layout/
│   ├── contracts/
│   │   ├── abi/
│   │   ├── addresses.ts
│   │   ├── chains.ts
│   │   └── types.ts
│   ├── lib/
│   │   ├── web3/
│   │   │   ├── config.ts
│   │   │   ├── chains.ts
│   │   │   ├── explorer.ts
│   │   │   └── errors.ts
│   │   ├── api/
│   │   ├── errors/
│   │   ├── logger/
│   │   └── utils/
│   ├── config/
│   │   ├── env.client.ts
│   │   ├── env.server.ts
│   │   └── app.ts
│   ├── hooks/
│   ├── styles/
│   └── types/
├── tests/
├── e2e/
├── docs/
├── .env.example
├── package.json
├── pnpm-lock.yaml
└── README.md
```

说明：

- `app/`：框架和路由边界，不堆业务逻辑。
- `features/`：业务能力。
- `components/ui`：纯 UI 原语。
- `contracts/`：ABI、地址、链与合约类型。
- `lib/web3`：Web3 基础设施，不放具体业务交易流程。
- `config/`：配置和环境变量校验。
- `hooks/`：只存真正跨 feature 的 hooks。
- 避免 `common/`、`misc/`、`helpers/` 这类责任模糊目录。

现有项目不要求为了匹配此目录进行一次性大搬迁；按需求渐进整理。

---

## 6. TypeScript 与代码规范

必须：

- `strict: true`
- 外部数据先视为 `unknown`
- 使用 Zod、类型守卫或官方 parser 做运行时校验
- 不新增 `any`
- 不新增无说明的 `@ts-ignore`
- 尽量避免非空断言
- 金额、余额和 token 数量不使用 JavaScript 浮点数
- 链上原始整数优先使用 `bigint`
- 地址使用 viem `Address`
- tx hash 使用 viem `Hash`

命名：

- 文件 / 目录：`kebab-case`
- React component / type：`PascalCase`
- function / variable：`camelCase`
- hooks：`useXxx`
- boolean：`is/has/can/should`
- module constant：`SCREAMING_SNAKE_CASE`

金额命名必须体现单位或资产：

```text
amountUsdc
amountRaw
feeBps
priceUsd
tokenDecimals
```

避免：

```text
data1
temp
obj
info
value2
handleClick2
```

---

## 7. React / Next.js 规则

- 默认 Server Component。
- 只有需要 hooks、浏览器 API、钱包连接、交互状态或客户端库时才使用 `'use client'`。
- `'use client'` 边界尽可能小。
- 页面组件只做组合，不承担复杂交易流程。
- 不用 `useEffect` 代替可以直接完成的数据流。
- 不保存可以从 props / query / wallet state 推导出的重复状态。
- 可变列表禁止使用 array index 作为 key。
- 交互元素必须支持键盘、focus、disabled、loading。
- 异步操作必须防重复提交。
- 必须处理 loading、empty、error、success、disabled 和 mobile 状态。

---

## 8. Web3 基础规则

### 8.1 统一配置

以下内容必须集中管理：

- chain definitions
- RPC transports
- block explorer
- contract addresses
- ABI
- WalletConnect project id
- confirmations
- token metadata

不得散落在页面和组件中。

### 8.2 合约地址

地址按 `chainId` 映射：

```ts
type ContractAddresses = Record<number, {
  token: Address
  vault: Address
}>
```

要求：

- 主网和测试网明确区分。
- production 不得自动 fallback 到测试网合约。
- 缺少当前环境必要地址时 fail fast。
- 地址必须经过校验。
- 不根据名称猜测合约方法、事件、decimals 或权限。

### 8.3 精度

- 原始链上数量保持 `bigint`。
- 输入使用 `parseUnits`。
- 展示使用 `formatUnits`。
- 百分比和滑点使用整数 `bps`。
- 金融计算明确舍入规则。
- 不使用 `Number(tokenAmount)` 参与资产计算。

---

## 9. 钱包连接规范

### 9.1 默认实现

EVM dApp 默认：

```text
wagmi + viem + RainbowKit
```

如果现有项目已经使用 Reown AppKit、ConnectKit、Dynamic、Privy 或其他稳定钱包方案，不强制迁移。

不要在 RainbowKit 已能满足需求时手写整套钱包连接弹窗。

### 9.2 钱包 UI

默认钱包连接体验应使用 RainbowKit 的 Connect Wallet modal，交互参考典型双栏钱包弹窗：

```text
┌─────────────────────────────────────────────┐
│ Connect a Wallet                            │
├────────────────────┬────────────────────────┤
│ Installed          │ What is a Wallet?      │
│ - browser wallets  │ educational content    │
│                    │                        │
│ Recommended        │ Get a Wallet           │
│ - WalletConnect    │ Learn More             │
│ - common wallets   │                        │
└────────────────────┴────────────────────────┘
```

要求：

- 桌面端可使用类似“左侧钱包列表 + 右侧钱包说明”的布局。
- 移动端使用适合小屏的单栏 / step 式体验。
- 优先显示已安装钱包。
- 推荐钱包和 fallback 钱包分组清晰。
- 钱包图标、名称和连接方式保持官方来源，不自己伪造品牌图标。
- Modal 样式通过 RainbowKit theme / CSS token 适配产品品牌。
- 不复制第三方产品的商标、品牌素材或完全相同的视觉皮肤；只复用交互模式。

RainbowKit 支持 EIP-6963 的环境中，应让兼容的已安装浏览器钱包自动出现在 `Installed` 区域。

当项目需要自定义钱包顺序或分组时，可以使用 RainbowKit 的 wallet list 配置；需要保留通用 fallback：

- WalletConnect
- injected wallet

具体钱包如 MetaMask、OKX Wallet、Coinbase Wallet、Trust Wallet、Phantom 等，按目标用户、平台和当前库实际支持情况配置，不在业务页面硬编码。

### 9.3 钱包模块边界

推荐：

```text
features/wallet/
├── components/
│   ├── connect-wallet-button.tsx
│   ├── wallet-account-menu.tsx
│   └── wrong-network-banner.tsx
├── hooks/
│   └── use-wallet-session.ts
└── index.ts

lib/web3/
├── config.ts
├── chains.ts
└── errors.ts
```

规则：

- RainbowKit / wagmi provider 初始化集中在 `app/providers.tsx` 与 `lib/web3/config.ts`。
- 页面不重复创建 wagmi config。
- 业务 feature 不直接操作 RainbowKit 内部状态。
- 只在真正需要表达应用语义时封装 `useWalletSession`；不要机械包装每一个 wagmi hook。
- 钱包 UI 可以替换，但合约业务逻辑不应因此整体重写。

### 9.4 Provider 结构

Next.js / React 项目建议保持单一根级 provider：

```tsx
<WagmiProvider config={wagmiConfig}>
  <QueryClientProvider client={queryClient}>
    <RainbowKitProvider>
      {children}
    </RainbowKitProvider>
  </QueryClientProvider>
</WagmiProvider>
```

不要在多个页面创建重复的 `WagmiProvider`、`QueryClientProvider` 或 `RainbowKitProvider`。

### 9.5 WalletConnect

- `projectId` 通过环境变量提供。
- `projectId` 可公开到客户端，但不得误放真正的后端密钥。
- 必须有明确 app name / metadata。
- QR、mobile deep link 和 browser wallet 场景均需要测试。
- 不在代码中散落 WalletConnect 配置。

### 9.6 钱包连接不是登录

必须区分：

```text
Wallet Connected
≠
Authenticated
```

如果业务需要身份认证：

- 使用明确的 SIWE / wallet-signature auth 流程。
- nonce 必须来自可信服务端。
- 签名只用于明确展示给用户的登录动作。
- 不得因为用户连接钱包就默认为已登录。
- 断开钱包与退出业务 Session 的关系必须由业务规则明确决定。

---

## 10. 链切换与账户变化

应用必须正确处理：

- wallet connected
- wallet disconnected
- account changed
- chain changed
- unsupported chain
- user rejected connection
- user rejected chain switch
- connector unavailable

不要要求用户手动刷新页面恢复状态。

Wrong network UI：

- 明确展示当前网络和目标网络。
- 提供 “Switch Network”。
- 用户拒绝切链不显示成系统故障。
- 合约写入前必须再次确认当前 `chainId`。

---

## 11. 合约读取与写入

### 11.1 Read

读取逻辑：

- 优先放在 feature 的 query / hook 中。
- ABI、address、chain 从集中配置读取。
- 对轮询频率和 stale time 做明确选择。
- 不在多个组件重复调用相同链上读取。
- 可以复用 TanStack Query / wagmi query cache。

### 11.2 Write

任何链上写操作必须由明确用户操作触发。

写入前检查：

- wallet connected
- supported chain
- address validity
- input validity
- token decimals
- balance
- allowance
- quote freshness
- deadline / slippage（若适用）

可行时先执行 simulation。

禁止：

- 页面加载自动签名
- 页面加载自动 approve
- 页面加载自动发送交易
- 把用户拒签当系统异常
- 在 UI 中提前显示成功

---

## 12. Approve / Permit / Transaction 流程

代币交易常见流程应显式表达：

```text
idle
→ preparing
→ awaiting_signature
→ submitted
→ confirming
→ success
```

错误分支至少区分：

```text
rejected
reverted
rpc_error
wrong_network
insufficient_balance
insufficient_allowance
```

approve + action 场景：

- allowance 足够时，不重复 approve。
- allowance 不足时，清晰展示 approve 是独立交易。
- approve 成功确认后再执行下一步。
- 不把两次签名伪装成一次。
- 若协议支持 Permit / Permit2 且项目明确采用，可实现对应流程；不要自动假定支持。

交易提交后：

- 显示 tx hash。
- 提供区块浏览器链接。
- 防止重复点击造成重复交易。
- UI success 必须基于明确确认策略，而不是仅 `sendTransaction` 返回 hash。

---

## 13. Web3 错误归类

统一转换第三方错误，不让每个页面解析 RPC 原文。

推荐错误码：

```text
WALLET_NOT_CONNECTED
USER_REJECTED
WRONG_NETWORK
CONNECTOR_UNAVAILABLE
INSUFFICIENT_BALANCE
INSUFFICIENT_ALLOWANCE
SIMULATION_FAILED
TRANSACTION_REVERTED
RPC_UNAVAILABLE
CONTRACT_CONFIG_MISSING
UNKNOWN_WEB3_ERROR
```

UI 只依赖稳定错误码，不依赖完整 RPC message。

用户主动拒绝：

- 不显示严重错误页。
- 可以轻量提示 “Transaction cancelled” / “Connection cancelled”。

revert：

- 能安全解析已知业务错误时，显示可行动信息。
- 不直接向普通用户倾倒完整 RPC stack、calldata 或内部错误。

---

## 14. 状态管理

状态按责任放置：

- URL state：筛选、tab、分页、可分享参数
- server / chain state：TanStack Query / wagmi
- local UI state：React state
- form state：React Hook Form
- wallet connection：wagmi / wallet connector
- global client state：只有明确跨页面且不属于上述类型时才引入

不要因为状态“看起来重要”就放进全局 store。

---

## 15. UI 与设计系统

### 15.1 Token

颜色、字体、圆角、阴影、间距、z-index 使用设计 token / CSS variables 集中管理。

不要在页面散落：

```text
#123456
17px
23px
9999px
```

除非属于真实一次性值且不会形成重复模式。

### 15.2 UI 边界

- `components/ui` 只提供可复用 UI primitive。
- feature component 负责业务组合。
- Wallet、transaction、staking、swap 等属于 feature，不放进 `components/ui`。

### 15.3 Responsive

至少验证：

- mobile
- tablet
- desktop

关键操作不能因为移动端缩小而被隐藏。

### 15.4 Accessibility

- keyboard usable
- visible focus
- icon button 有 accessible name
- form error 与字段关联
- modal 有 focus trap
- ESC / close 行为合理
- WCAG AA 对比度

钱包弹窗尤其要验证：

- keyboard navigation
- focus restore
- scroll behavior
- wallet list overflow
- mobile viewport

---

## 16. API 与外部数据

所有边界数据都需要校验：

- URL params
- query params
- forms
- backend response
- webhook payload
- env
- third-party response
- untrusted chain-derived structured metadata

通用 HTTP client 负责：

- timeout
- cancellation
- JSON parse failure
- non-2xx
- request id
- stable error normalization
- auth header（如需要）

不要在每个 feature 重写一套 fetch wrapper。

---

## 17. 安全

必须遵守：

- 私钥和助记词永远不进入前端源码。
- 不要求用户输入 seed phrase。
- 不记录私钥、助记词、完整签名、Cookie、Authorization。
- 服务端 secret 不得使用 `NEXT_PUBLIC_`。
- 钱包地址是否记录到分析系统需要按产品隐私要求处理。
- 用户签名必须由明确交互触发。
- 签名前向用户说明签名用途。
- 合约写入不能由隐藏副作用触发。
- 不信任前端隐藏按钮作为权限控制。
- 后端权限必须服务端验证。

---

## 18. 环境变量

客户端和服务端 env 分开校验。

示例：

```text
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
NEXT_PUBLIC_DEFAULT_CHAIN_ID=
RPC_URL=
```

注意：

- `NEXT_PUBLIC_*` 会进入客户端 bundle。
- 私有 RPC、数据库、服务端 token、签名密钥不能公开。
- `.env.example` 只放安全示例，不放真实凭据。
- production 缺少必要配置时应 fail fast。

---

## 19. 测试

测试真实风险，不单纯追求覆盖率。

### 19.1 Unit

重点：

- parse / format units
- fee / bps
- amount validation
- schema
- chain config
- address lookup
- error normalization

### 19.2 Component

覆盖：

- connect wallet
- disconnected state
- connected account state
- wrong network
- loading
- user rejection
- disabled transaction button
- transaction success / error

### 19.3 Web3 mock

单元和组件测试：

- 不依赖真实主网。
- 使用 mock connector / mock transport / test fixture。
- 固定 chain、account、balance、allowance、receipt。

### 19.4 E2E

核心 dApp 至少覆盖：

```text
connect wallet
→ correct network
→ read state
→ initiate transaction
→ sign / submit
→ confirmation
→ final UI
```

以及至少一个关键失败流程。

真实钱包扩展 E2E 若环境难以稳定自动化，可以把 connector 层 mock 掉，但必须另有人工验收步骤验证真实钱包。

---

## 20. 日志与隐私

服务端使用结构化日志。

客户端：

- 不散落 `console.log`。
- 生产环境不输出调试信息。
- 钱包错误进入统一 error mapping。

禁止日志内容：

- private key
- seed phrase
- auth token
- raw signature
- cookie
- 完整敏感身份数据

交易 hash 可以记录；钱包地址若用于 analytics，应依据隐私要求进行截断、hash 或其他处理。

---

## 21. 性能

避免：

- 每个 component 各自发起同一个 RPC 请求
- 高频无意义 polling
- 首屏加载整个 Web3 大模块
- 不必要的客户端组件扩大 hydration 范围
- 因钱包连接导致整页重复渲染

对于不依赖钱包的营销 / 内容区，尽量保持 server-rendered 和轻量。

Web3 相关 client boundary 应局部化。

---

## 22. 依赖规则

安装新依赖前确认：

1. 现有依赖不能完成？
2. 原生 Web API / framework 不能简单完成？
3. 新依赖是否活跃维护？
4. bundle / runtime 成本是否合理？
5. 是否真的被多个地方使用或解决关键问题？

禁止为了“规范看起来完整”安装未使用依赖。

---

## 23. Git 与修改范围

- 不覆盖用户已有未提交改动。
- 不执行危险 reset / clean，除非用户明确要求。
- 不修改无关文件。
- 不在修 bug 时顺手格式化整个仓库。
- 自动生成文件仅在项目确实要求时提交。
- commit message 描述真实变更，不夸大范围。

---

## 24. CI 与质量门禁

根据项目现有脚本执行；新项目推荐至少提供：

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "lint": "eslint . --max-warnings=0",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "check": "pnpm lint && pnpm typecheck && pnpm test && pnpm build"
  }
}
```

不要为了让 CI 通过而：

- 关闭 strict
- 大范围 eslint-disable
- skip failing tests
- 删除有效断言
- 把类型改成 `any`

---

## 25. Definition of Done

任务完成前检查：

- 用户要求的功能真实完成。
- 修改范围与任务直接相关。
- 没有明显无用抽象。
- feature 边界清楚。
- ABI / address / chain 没有散落在组件中。
- 没有直接在业务组件操作 `window.ethereum`。
- 钱包连接、断开、拒绝、错误网络有合理 UI。
- 写交易只由明确用户行为触发。
- asset amount 使用正确精度。
- loading / error / empty / success 状态完整。
- mobile / desktop 可用。
- lint / typecheck / relevant tests / build 通过。
- 未验证项被明确列出。

如果外部 RPC、钱包、API、ABI、密钥或运行环境导致无法验证，不得声称已经验证通过。

---

## 26. 最终回复格式

完成代码任务后，用简短结构报告：

1. 完成了什么。
2. 关键架构 / 行为变化。
3. 主要修改文件。
4. 实际执行了哪些验证，以及结果。
5. 未验证项；没有则写“无”。

不要在最终回复重复大段代码。

---

## 27. Project Overrides

每个具体 dApp 只需要在本节补充项目特有信息，不应复制整套工程规范。

```md
### Project

- Name:
- Goal:
- Target users:
- In scope:
- Out of scope:

### Chains

- Supported chains:
- Default chain:
- Production chain IDs:
- Test chain IDs:

### Wallet

- Wallet UI: RainbowKit / existing solution
- Recommended wallets:
- WalletConnect project id env:
- SIWE auth: yes / no

### Contracts

- ABI paths:
- Address config:
- Read methods:
- Write methods:
- Events:
- Confirmations:

### Tokens

- Symbols:
- Decimals:
- Slippage / fee / rounding rules:

### Backend

- API base:
- Auth:
- OpenAPI / docs:

### UI

- Brand tokens:
- Theme:
- Reference:
- Responsive priority:

### Deployment

- Platform:
- Environments:
- Required env:
- CI requirements:

### Constraints

- Files not to modify:
- Required dependencies:
- Forbidden dependencies:
- Additional acceptance commands:
```

---

## 28. Quick Architecture Check

在提交前快速回答：

```text
1. 这个业务逻辑是否放在自己的 feature 内？
2. 页面是否只是组合层？
3. 通用 UI 是否知道了不该知道的业务？
4. feature 是否直接依赖另一个 feature 的内部实现？
5. ABI / address / chain 是否集中管理？
6. wallet provider 是否只有一套？
7. 交易状态是否明确？
8. 是否存在可以删除的过度抽象？
9. 每个改动是否都能追溯到当前需求？
10. 是否有可执行的成功验证？
```

任意一项明显不合理时，先修正再交付。
