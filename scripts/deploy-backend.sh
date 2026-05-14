#!/usr/bin/env bash
# scripts/deploy-backend.sh
# Build the Golang Docker image, push to ECR, and trigger a rolling ASG refresh.
# Required env vars: ASG_NAME, ECR_REPO_URL, AWS_REGION
set -euo pipefail

ASG_NAME="${ASG_NAME:?Set ASG_NAME}"
ECR_REPO_URL="${ECR_REPO_URL:?Set ECR_REPO_URL}"        # full ECR URL without tag
AWS_REGION="${AWS_REGION:-us-east-1}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$SCRIPT_DIR/../Server"

SHORT_SHA=$(git -C "$SCRIPT_DIR/.." rev-parse --short HEAD 2>/dev/null || echo "manual")
IMAGE_TAG="$SHORT_SHA"
IMAGE_URI="$ECR_REPO_URL:$IMAGE_TAG"
LATEST_URI="$ECR_REPO_URL:latest"

echo "==> Authenticating to ECR"
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$ECR_REPO_URL"

echo "==> Building Docker image  $IMAGE_URI"
docker build \
  --tag "$IMAGE_URI" \
  --tag "$LATEST_URI" \
  "$SERVER_DIR"

echo "==> Pushing images to ECR"
docker push "$IMAGE_URI"
docker push "$LATEST_URI"

echo "==> Starting ASG instance refresh (rolling update)"
REFRESH_ID=$(aws autoscaling start-instance-refresh \
  --auto-scaling-group-name "$ASG_NAME" \
  --strategy Rolling \
  --preferences '{"MinHealthyPercentage":50,"InstanceWarmup":120}' \
  --query InstanceRefreshId \
  --output text)

echo "    Refresh ID: $REFRESH_ID"

echo "==> Waiting for refresh to complete (max 20 min)…"
for i in $(seq 1 40); do
  STATUS=$(aws autoscaling describe-instance-refreshes \
    --auto-scaling-group-name "$ASG_NAME" \
    --instance-refresh-ids "$REFRESH_ID" \
    --query 'InstanceRefreshes[0].Status' \
    --output text)
  echo "  [${i}/40] $STATUS"
  case "$STATUS" in
    Successful) echo "==> Deployment complete ✓"; exit 0 ;;
    Failed|Cancelled) echo "ERROR: $STATUS"; exit 1 ;;
  esac
  sleep 30
done

echo "ERROR: Timed out"
exit 1
