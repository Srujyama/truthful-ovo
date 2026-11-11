# Truthful, the real version: the built app + the managed backend (Node 24, SQLite) behind one origin.
FROM node:24-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build
ENV NODE_ENV=production PORT=8080 DATA_DIR=/data/managed
EXPOSE 8080
CMD ["node", "server/host.mjs"]
