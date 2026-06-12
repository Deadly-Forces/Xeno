FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json turbo.json tsconfig.base.json ./
COPY apps/channel-service/package.json apps/channel-service/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
RUN npm ci
COPY apps/channel-service apps/channel-service
COPY packages/shared-types packages/shared-types
RUN npm run build --workspace=@xeno/channel-service

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 app && adduser --system --uid 1001 channel
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/channel-service/dist ./apps/channel-service/dist
COPY --from=builder /app/apps/channel-service/package.json ./apps/channel-service/package.json
USER channel
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://localhost:4000/health || exit 1
CMD ["node", "apps/channel-service/dist/index.js"]
