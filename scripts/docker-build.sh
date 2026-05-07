#!/usr/bin/env bash
set -euo pipefail
IMAGE_NAME="muchtodo-backend"
IMAGE_TAG="${1:-latest}"
echo "==> Building ${IMAGE_NAME}:${IMAGE_TAG}"
docker build --tag "${IMAGE_NAME}:${IMAGE_TAG}" --file Dockerfile .
echo "✓ Done"
docker images "${IMAGE_NAME}"
