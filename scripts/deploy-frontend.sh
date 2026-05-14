#!/usr/bin/env bash
# scripts/deploy-frontend.sh
# Build and deploy the React app to S3, then bust the CloudFront cache.
# Usage: ./scripts/deploy-frontend.sh
# Required env vars: FRONTEND_S3_BUCKET, CLOUDFRONT_DISTRIBUTION_ID
set -euo pipefail

BUCKET="${FRONTEND_S3_BUCKET:?Set FRONTEND_S3_BUCKET}"
DIST_ID="${CLOUDFRONT_DISTRIBUTION_ID:?Set CLOUDFRONT_DISTRIBUTION_ID}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR/../frontend"

echo "==> Building React app"
cd "$FRONTEND_DIR"
npm ci
npm test -- --watchAll=false --passWithNoTests
npm run build

BUILD_DIR="$FRONTEND_DIR/build"
echo "==> Syncing hashed assets to s3://$BUCKET (1-year immutable cache)"
aws s3 sync "$BUILD_DIR/" "s3://$BUCKET/" \
  --delete \
  --cache-control "public,max-age=31536000,immutable" \
  --exclude "index.html" \
  --exclude "*.map" \
  --exclude "asset-manifest.json"

echo "==> Uploading index.html (no-cache)"
aws s3 cp "$BUILD_DIR/index.html" "s3://$BUCKET/index.html" \
  --cache-control "no-cache,no-store,must-revalidate" \
  --content-type "text/html; charset=utf-8"

echo "==> Creating CloudFront invalidation"
INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id "$DIST_ID" \
  --paths "/*" \
  --query "Invalidation.Id" \
  --output text)

echo "    Invalidation ID: $INVALIDATION_ID"
echo "==> Frontend deployment complete ✓"
