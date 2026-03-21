#!/usr/bin/env bash
# Kill any processes occupying the dev ports before launching

# App ports: web (3000), API (8790), evaluator (8791), fake GitHub (9999)
# Inspector ports: API (9229), evaluator (9230)
PORTS=(3000 8790 8791 9229 9230 9999)

for port in "${PORTS[@]}"; do
  pid=$(lsof -ti :"$port" 2>/dev/null || true)
  if [ -n "$pid" ]; then
    echo "Killing process(es) on port $port (PID: $pid)"
    echo "$pid" | xargs kill -9 2>/dev/null || true
  fi
done
