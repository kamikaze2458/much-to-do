#!/usr/bin/env bash
# scripts/rollback.sh
# Cancel an in-progress instance refresh and emit rollback guidance.
# Usage: ./scripts/rollback.sh <asg-name> [refresh-id]
set -euo pipefail

ASG_NAME="${1:?Pass ASG name as first argument}"
REFRESH_ID="${2:-}"

echo "⚠️  Rollback triggered for ASG: $ASG_NAME"

if [[ -n "$REFRESH_ID" ]]; then
  echo "==> Cancelling instance refresh $REFRESH_ID"
  aws autoscaling cancel-instance-refresh \
    --auto-scaling-group-name "$ASG_NAME" 2>/dev/null || true
fi

echo ""
echo "==> Current ASG health:"
aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names "$ASG_NAME" \
  --query 'AutoScalingGroups[0].{Min:MinSize,Max:MaxSize,Desired:DesiredCapacity,HealthCheck:HealthCheckType}' \
  --output table 2>/dev/null || echo "Could not query ASG state."

echo ""
echo "==> MANUAL ROLLBACK STEPS:"
echo "  1. Find the last known-good image tag in ECR:"
echo "       aws ecr describe-images --repository-name much-to-do-backend \\"
echo "           --query 'sort_by(imageDetails,&imagePushedAt)[-5:].imageTags' --output table"
echo ""
echo "  2. Re-tag that image as :latest in ECR."
echo ""
echo "  3. Trigger a new refresh:"
echo "       aws autoscaling start-instance-refresh \\"
echo "           --auto-scaling-group-name $ASG_NAME \\"
echo "           --preferences '{\"MinHealthyPercentage\":50}'"
echo ""
echo "Rollback script done. ⚠️  Human review required."
exit 1
