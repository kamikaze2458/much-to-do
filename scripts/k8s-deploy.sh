#!/usr/bin/env bash
set -euo pipefail
CLUSTER_NAME="muchtodo-cluster"

echo "==> Creating Kind cluster..."
cat <<KINDEOF | kind create cluster --name "${CLUSTER_NAME}" --config=-
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
  - role: control-plane
    kubeadmConfigPatches:
      - |
        kind: InitConfiguration
        nodeRegistration:
          kubeletExtraArgs:
            node-labels: "ingress-ready=true"
    extraPortMappings:
      - containerPort: 30080
        hostPort: 8080
        protocol: TCP
      - containerPort: 80
        hostPort: 80
        protocol: TCP
      - containerPort: 443
        hostPort: 443
        protocol: TCP
KINDEOF

echo "==> Loading image into Kind..."
kind load docker-image muchtodo-backend:latest --name "${CLUSTER_NAME}"

echo "==> Installing NGINX ingress controller..."
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s

echo "==> Applying manifests..."
kubectl apply -f kubernetes/namespace.yaml
kubectl apply -f kubernetes/mongodb/
kubectl rollout status deployment/mongodb-deployment -n muchtodo --timeout=120s
kubectl apply -f kubernetes/backend/
kubectl apply -f kubernetes/ingress.yaml
kubectl rollout status deployment/backend-deployment -n muchtodo --timeout=120s

echo ""
echo "✓ Done!"
kubectl get all -n muchtodo
