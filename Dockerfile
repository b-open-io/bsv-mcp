# Use the official Bun image
FROM oven/bun:1

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy application code
COPY . .

# Set user for security
USER bun

# Expose port (if needed)
EXPOSE 3000

# Run the application
CMD ["bun", "run", "index.ts"] 