#!/bin/bash
# update_centron.sh — Auto update centron-bot from GitHub and rebuild Docker

cd /home/kalmin/apps/centron-bot || exit

LOGFILE="/home/kalmin/apps/update_centron.log"

{
  echo "=============================================="
  echo "Update started at $(date)"

  # Make sure local repo is clean
  git reset --hard HEAD
  git pull origin main

  # Move up to apps directory for docker-compose.yml
  cd /home/kalmin/apps || exit

  # Stop and rebuild
  docker compose down
  docker compose up -d --build

  echo "Update finished at $(date)"
  echo
} >> "$LOGFILE" 2>&1

