FROM node:22-alpine

# Required by Prisma
RUN apk add --no-cache openssl

WORKDIR /app

ENV NODE_ENV=production

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy application
COPY . .

# Build the React Router app
RUN npm run build

# Remove development dependencies after the build
RUN npm prune --omit=dev

EXPOSE 3000

# Generate Prisma Client, run migrations, then start
CMD ["npm", "run", "docker-start"]