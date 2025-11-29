# -----------------------------
# Centron Bot Dockerfile (Optimized for Contabo VPS)
# -----------------------------

FROM node:20-bullseye AS base

WORKDIR /app

# Install build dependencies for node-canvas & native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    libpixman-1-dev \
    sqlite3 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev

# Copy project files
COPY . .

# Generate Prisma client
RUN npx prisma generate

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]

