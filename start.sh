#!/bin/bash
set -e

echo "🚀 Starting MasterBelarus API..."

# Install dependencies
cd api
npm install

# Build TypeScript
npx tsc -p tsconfig.json

# Start server
node dist/server.js
