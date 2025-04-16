FROM oven/bun:latest

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN bun install

# Copy application code
COPY . .

# Command will be provided by smithery.yaml at runtime
CMD ["bun", "run", "index.ts"] 