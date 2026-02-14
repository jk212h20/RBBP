#!/bin/bash
# Apply pending migrations on production and test lightning login
# Usage: bash scripts/apply-migrations-and-test.sh <admin-email> <admin-password>

API_URL="https://rbbp-production.up.railway.app/api"

if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Usage: bash scripts/apply-migrations-and-test.sh <admin-email> <admin-password>"
  echo ""
  echo "This script will:"
  echo "  1. Log in as admin to get a JWT token"
  echo "  2. Apply pending database migrations (profileImage, registrationCloseMinutes, venue_applications)"
  echo "  3. Run the lightning login test"
  exit 1
fi

ADMIN_EMAIL="$1"
ADMIN_PASSWORD="$2"

echo "============================================"
echo "Step 1: Login as admin"
echo "============================================"
echo "POST $API_URL/auth/login"

LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$ADMIN_EMAIL\", \"password\": \"$ADMIN_PASSWORD\"}")

echo "Response: $LOGIN_RESPONSE"

# Extract token using jq if available, otherwise use grep
if command -v jq &> /dev/null; then
  TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token // empty')
  USER_ROLE=$(echo "$LOGIN_RESPONSE" | jq -r '.user.role // empty')
else
  TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
  USER_ROLE=$(echo "$LOGIN_RESPONSE" | grep -o '"role":"[^"]*"' | cut -d'"' -f4)
fi

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to get token. Check credentials."
  exit 1
fi

echo "✅ Got token: ${TOKEN:0:30}..."
echo "   Role: $USER_ROLE"

if [ "$USER_ROLE" != "ADMIN" ]; then
  echo "⚠️  Warning: User role is '$USER_ROLE', not ADMIN. Migration endpoint requires admin."
fi

echo ""
echo "============================================"
echo "Step 2: Apply pending migrations"
echo "============================================"
echo "POST $API_URL/admin/apply-pending-migrations"

MIGRATION_RESPONSE=$(curl -s -X POST "$API_URL/admin/apply-pending-migrations" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN")

echo "Response:"
if command -v jq &> /dev/null; then
  echo "$MIGRATION_RESPONSE" | jq .
else
  echo "$MIGRATION_RESPONSE"
fi

echo ""
echo "============================================"
echo "Step 3: Test Lightning Login"
echo "============================================"

cd "$(dirname "$0")/.."
npx ts-node scripts/test-lightning-login.ts --production
