# Use the official Bun image
FROM oven/bun:1

# Set working directory
WORKDIR /app

# Copy all application code first
COPY . .

# Install dependencies
RUN bun install --frozen-lockfile

# Set user for security
USER bun

# Expose port (if needed)
EXPOSE 3000

# Run the application
CMD ["bun", "run", "index.ts"] 