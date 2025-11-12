# Multi-stage Dockerfile for Telegram userbot
# Stage 1: Builder (install deps, build TS)
FROM node:22-alpine AS builder

# Install build dependencies including FFmpeg for local mode
RUN apk add --no-cache python3 make g++ ffmpeg

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies (ci for production and dev)
RUN npm ci

# Copy source code BEFORE build
COPY src ./src

# Build the TypeScript project
RUN npm run build

# Stage 2: Runtime (lightweight, copy built app, download Whisper model with script and check)
# Use node:22-slim (Debian-based) for GNU wget support in script
FROM node:22-slim AS runtime

# Install runtime deps: FFmpeg + tools for whisper.cpp build, script (GNU wget, curl, bash, git, make, g++, cmake, python3)
RUN apt-get update && apt-get install -y ffmpeg curl wget bash git make g++ cmake python3 && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy built app and node_modules from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Create models directory
RUN mkdir -p /app/models

# Args for model config
ARG MODEL_SIZE=$MODEL_SIZE
ARG WHISPER_MODE=local
ENV WHISPER_MODEL_SIZE=$MODEL_SIZE
ENV WHISPER_MODE=$WHISPER_MODE

# # Download Whisper model using direct script if in local mode and doesn't exist (check for ggml file)
# RUN if [ "$WHISPER_MODE" = "local" ]; then \
#       MODEL_BIN="ggml-$MODEL_SIZE.bin"; \
#       if [ ! -f "/app/models/$MODEL_BIN" ]; then \
#         echo "Model $MODEL_SIZE not found, downloading with script to /app/models..."; \
#         cd /app/node_modules/whisper-node/lib/whisper.cpp/models && \
#         chmod +x download-ggml-model.sh && \
#         ./download-ggml-model.sh $MODEL_SIZE && \
#         mv $MODEL_BIN /app/models/ || echo "Moved model to /app/models"; \
#       else \
#         echo "Model $MODEL_SIZE already exists in /app/models"; \
#       fi; \
#     else \
#       echo "Skipping Whisper model download (not in local mode)"; \
#     fi

# Expose no ports (userbot, not web server)
EXPOSE 0

# Run the app
CMD ["npm", "run", "download_start"]