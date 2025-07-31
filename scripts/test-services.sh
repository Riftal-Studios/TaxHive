#!/bin/bash

echo "Testing GSTHive services..."
echo ""

# Test Redis
echo -n "Redis: "
if redis-cli ping > /dev/null 2>&1; then
    echo "✅ Running"
else
    echo "❌ Not running"
fi

# Test Next.js
echo -n "Next.js: "
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Running at http://localhost:3000"
else
    echo "❌ Not running"
fi

# Test database connection
echo -n "Database: "
if npx prisma db execute --schema prisma/schema.prisma --stdin <<< "SELECT 1;" > /dev/null 2>&1; then
    echo "✅ Connected"
else
    echo "❌ Not connected"
fi

echo ""
echo "All services checked!"