# Použijeme Node.js verzi 22, která má nativní podporu pro TypeScript (type stripping)
FROM node:22-slim AS builder

WORKDIR /app

# Kopírování konfiguračních souborů
COPY package*.json ./
COPY tsconfig.json ./
COPY vite.config.ts ./

# Instalace závislostí
RUN npm install

# Kopírování zdrojových kódů a build frontendu
COPY . .
RUN npm run build

# Finální obraz pro produkci
FROM node:22-slim
WORKDIR /app

# Kopírování pouze nezbytných souborů z builderu
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts

# Nastavení prostředí
ENV NODE_ENV=production
EXPOSE 3000

# Spuštění serveru s využitím nativní podpory TypeScriptu v Node.js 22
CMD ["node", "--experimental-strip-types", "server.ts"]
