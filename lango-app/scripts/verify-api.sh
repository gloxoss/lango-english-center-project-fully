#!/usr/bin/env bash
set -e

COOKIE_JAR=$(mktemp)
echo "Logging in as superadmin@schoolos.ma on https://schoolos.epioso.com..."

LOGIN_RESP=$(curl -sk -c "$COOKIE_JAR" -X POST \
  -H "Content-Type: application/json" \
  -H "Origin: https://schoolos.epioso.com" \
  -d '{"email":"superadmin@schoolos.ma","password":"Admin123!"}' \
  https://schoolos.epioso.com/api/auth/sign-in/email)

echo "Login response: $LOGIN_RESP"
echo "Cookies saved in jar:"
cat "$COOKIE_JAR"

echo -e "\n========================================================"
echo "1. Testing GET /api/settings/branches"
echo "========================================================"
curl -sk -i -b "$COOKIE_JAR" https://schoolos.epioso.com/api/settings/branches

echo -e "\n\n========================================================"
echo "2. Testing GET /api/addons/broadcast/connections"
echo "========================================================"
curl -sk -i -b "$COOKIE_JAR" https://schoolos.epioso.com/api/addons/broadcast/connections

echo -e "\n\n========================================================"
echo "3. Testing GET /api/communication/announcements/unread-count"
echo "========================================================"
curl -sk -i -b "$COOKIE_JAR" https://schoolos.epioso.com/api/communication/announcements/unread-count
echo -e "\n"

rm -f "$COOKIE_JAR"
