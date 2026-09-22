FROM node:22-bookworm-slim AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.3.0 --activate

FROM base AS deps

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_EVM_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
ARG NEXT_PUBLIC_EVM_CHAIN_ID=11155111
ARG NEXT_PUBLIC_AXUSD_ADDRESS=0x7E36fAAdF4FBF1566549d60aa73355ed15DaecEc
ARG NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=

ENV NEXT_PUBLIC_EVM_RPC_URL=$NEXT_PUBLIC_EVM_RPC_URL
ENV NEXT_PUBLIC_EVM_CHAIN_ID=$NEXT_PUBLIC_EVM_CHAIN_ID
ENV NEXT_PUBLIC_AXUSD_ADDRESS=$NEXT_PUBLIC_AXUSD_ADDRESS
ENV NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=$NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

RUN mkdir -p public && pnpm build

FROM builder AS check

RUN pnpm lint && pnpm typecheck && pnpm test

FROM node:22-bookworm-slim AS runner

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
WORKDIR /app

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

USER node
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=6 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
