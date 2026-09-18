# Image produksi Next.js (output: "standalone") untuk Cloud Run.
# Tiga tahap: deps -> builder -> runner. Hanya runner yang menjadi image akhir.

ARG NODE_IMAGE=node:24-alpine

# 1) deps: pasang dependency persis sesuai package-lock.json.
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# 2) builder: build aplikasi.
FROM ${NODE_IMAGE} AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# public/ bisa belum ada di repo (git tidak menyimpan folder kosong),
# padahal tahap runner menyalinnya.
RUN mkdir -p public && npm run build

# 3) runner: hanya hasil standalone, dijalankan user non-root.
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
# HOSTNAME wajib 0.0.0.0: Docker mengisinya dengan ID container, dan server.js
# akan listen di alamat itu. PORT hanya nilai bawaan; Cloud Run menimpanya.
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=8080

# User `node` (uid 1000) sudah tersedia di image resmi Node. Kepemilikan file
# diberikan ke user itu karena Next.js menulis cache ke .next/ saat runtime.
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node
EXPOSE 8080
CMD ["node", "server.js"]
