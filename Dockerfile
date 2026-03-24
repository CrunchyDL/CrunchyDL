# Build Frontend
FROM node:22-bookworm-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Final Image
FROM node:22-bookworm-slim
WORKDIR /app

# Install dependencies (FFmpeg and Build tools for native modules like node-pty)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    mkvtoolnix \
    python3 \
    make \
    g++ \
    curl \
    git && \
    rm -rf /var/lib/apt/lists/* && \
    curl -L https://github.com/shaka-project/shaka-packager/releases/download/v2.6.1/packager-linux-x64 -o /usr/local/bin/shaka-packager && \
    chmod +x /usr/local/bin/shaka-packager

# Copy Backend
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install
RUN npm rebuild sqlite3 --build-from-source

# Copy multi-downloader-nx
COPY backend/multi-downloader-nx ./multi-downloader-nx
# Install multi-downloader-nx dependencies and build
WORKDIR /app/backend/multi-downloader-nx
RUN npm install --legacy-peer-deps
RUN npm run tsc false false

# Copy backend source (excluding node_modules via .dockerignore)
WORKDIR /app/backend
COPY backend/ ./
# Re-run npm install to ensure all dependencies are correctly linked/built if anything was missed,
# though the previous npm install should have handled it if .dockerignore works.
# Actually, the best way is to copy package files, install, THEN copy source.

# Copy built frontend to backend/public (or serve via nginx, but let's keep it simple with Express for now)
COPY --from=frontend-build /app/frontend/dist ./public

# Setup Environment
ENV PORT=3001
ENV DOWNLOAD_DIR=/downloads
ENV DB_PATH=/app/data/database.sqlite
RUN mkdir -p /downloads /app/data

EXPOSE 3001

CMD ["node", "index.js"]
