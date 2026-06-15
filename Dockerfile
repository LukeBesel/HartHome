# ─── HartHome — single-image build (API serves the built SPA) ───────────────
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/
RUN npm install
COPY . .
RUN npm run build

FROM node:20-slim AS run
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY backend ./backend
COPY --from=build /app/frontend/dist ./frontend/dist
RUN npm install --omit=dev --workspace=backend
EXPOSE 3001
CMD ["node", "backend/src/index.js"]
