#!/usr/bin/env bash
set -euo pipefail
kubectl delete namespace muchtodo --ignore-not-found
kind delete cluster --name muchtodo-cluster
echo "✓ Cleaned up."
