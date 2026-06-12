FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json turbo.json tsconfig.base.json ./
COPY apps/crm/package.json apps/crm/package.json
COPY apps/channel-service/package.json apps/channel-service/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
RUN npm ci
COPY . .
RUN npm run build --workspace=@xeno/crm

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/apps/crm/.next/standalone ./
COPY --from=builder /app/apps/crm/.next/static ./apps/crm/.next/static
COPY --from=builder /app/apps/crm/prisma ./apps/crm/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma/engines ./node_modules/@prisma/engines
COPY --from=builder /app/apps/crm/ws-dist ./apps/crm/ws-dist
USER nextjs
EXPOSE 3000
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["sh", "-c", "node apps/crm/ws-dist/ws-server.js & node node_modules/prisma/build/index.js migrate deploy --schema=apps/crm/prisma/schema.prisma && node apps/crm/server.js"]
