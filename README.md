# MuchTodo — Container Assessment

A Golang + MongoDB REST API containerised with Docker and deployed to Kubernetes using Kind.

## Prerequisites
- Docker 25+
- docker compose v2
- Kind v0.23+
- kubectl v1.29+

## Phase 1 — Docker

### Build
```bash
./scripts/docker-build.sh
```

### Run
```bash
./scripts/docker-run.sh up
```

### Verify
```bash
curl http://localhost:8080/health
curl http://localhost:8080/users
```

### Stop
```bash
./scripts/docker-run.sh down
```

## Phase 2 — Kubernetes

### Deploy
```bash
./scripts/k8s-deploy.sh
```

### Verify
```bash
kubectl get all -n muchtodo
curl http://localhost:8080/health
```

### Ingress access
```bash
echo "127.0.0.1 muchtodo.local" | sudo tee -a /etc/hosts
curl http://muchtodo.local/health
```

### Cleanup
```bash
./scripts/k8s-cleanup.sh
```
