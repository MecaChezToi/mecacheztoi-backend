#!/usr/bin/env bash
set -e

echo "INSTALL CHROME IN PROJECT DIR"
export PUPPETEER_CACHE_DIR=/opt/render/project/.cache/puppeteer
npx --yes puppeteer@latest browsers install chrome@121.0.6167.85

