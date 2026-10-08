#!/bin/bash
# Start Metro for the phone (Expo Go) and make sure port 8081 is reachable.
URL_HTTPS="https://$CODESPACE_NAME-8081.$GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN"
pkill -f "expo start" 2>/dev/null; sleep 1
CI=1 EXPO_PACKAGER_PROXY_URL=$URL_HTTPS nohup npx expo start --clear > /tmp/metro.log 2>&1 &
echo "Starting Metro..."
for i in $(seq 1 40); do curl -s --max-time 2 http://localhost:8081/status | grep -q running && break; sleep 2; done
curl -s --max-time 2 http://localhost:8081/status | grep -q running || { echo "Metro did not start - see: tail -30 /tmp/metro.log"; exit 1; }
echo "Metro is running."
gh codespace ports visibility 8081:public -c $CODESPACE_NAME 2>/dev/null
CODE=$(curl -s --max-time 15 -o /dev/null -w "%{http_code}" $URL_HTTPS/status)
if [ "$CODE" = "200" ]; then
  echo "Port 8081 is public. In Expo Go enter:  exps://$CODESPACE_NAME-8081.$GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN"
else
  echo "Port 8081 is NOT reachable yet (got $CODE). Forward it: F1 > Forward a Port > 8081, then run ./start-phone.sh again."
fi
