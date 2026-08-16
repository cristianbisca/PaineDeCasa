FROM node:24-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S pdc && adduser -S pdc -G pdc
COPY --from=build /app/public ./public
COPY --from=build --chown=pdc:pdc /app/.next/standalone ./
COPY --from=build --chown=pdc:pdc /app/.next/static ./.next/static
USER pdc
EXPOSE 3000
CMD ["node", "server.js"]
