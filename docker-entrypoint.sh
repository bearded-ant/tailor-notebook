#!/bin/bash
set -e

echo "🚀 Starting Tailor Notebook..."

# Run Prisma migrations/db push if needed
echo "📦 Initializing database..."
cd /app
bunx prisma db push --skip-generate

# Start the application
echo "✅ Starting server..."
exec bun server.js
