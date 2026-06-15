#!/usr/bin/env bash
set -e
npm run build
exec node backend/src/index.js
