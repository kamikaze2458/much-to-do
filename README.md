# Much To Do

A full-stack todo application — React frontend + Golang backend — deployed on AWS with a complete CI/CD pipeline.

**Upstream repo:** https://github.com/Innocent9712/much-to-do (fork the `feature/full-stack` branch)

---

## Repository Structure

```
much-to-do/
├── .github/
│   └── workflows/
│       ├── frontend-ci-cd.yml    # React → S3 + CloudFront
│       └── backend-ci-cd.yml     # Go → ECR → EC2 ASG
│
├── Server/                       # Existing Golang API (upstream code)
│   ├── Dockerfile                # ← added: multi-stage, distroless
│   ├── .dockerignore             # ← added
│   ├── .golangci.yml             # ← added: lint config
│   └── ...                       # existing Go source files
│
├── frontend/                     # React SPA (added)
│   ├── public/index.html
│   ├── src/
│   │   ├── App.js
│   │   ├── App.css
│   │   ├── App.test.js
│   │   └── index.js
│   └── package.json
│
└── scripts/
    ├── deploy-frontend.sh
    ├── deploy-backend.sh
    ├── health-check.sh
    └── rollback.sh
```

---

## Prerequisites

| Tool        | Version  |
|-------------|----------|
| Go          | ≥ 1.22   |
| Node.js     | ≥ 20     |
| Docker      | ≥ 24     |
| AWS CLI     | v2       |

---

## Local Development

### Backend (Go)

```bash
cd Server
go mod download

# Set required env vars
export MONGO_URI="mongodb+srv://user:pass@cluster.mongodb.net/muchtodo"
export REDIS_ADDR="localhost:6379"
export PORT=8080

go run .
# API available at http://localhost:8080
```

### Frontend (React)

```bash
cd frontend
npm install
REACT_APP_API_URL=http://localhost:8080 npm start
# App at http://localhost:3000
```

### Run with Docker Compose (local stack)

```yaml
# docker-compose.yml (create at repo root for local dev)
version: "3.9"
services:
  backend:
    build: ./Server
    ports: ["8080:8080"]
    environment:
      PORT: "8080"
      MONGO_URI: "${MONGO_URI}"
      REDIS_ADDR: "redis:6379"
    depends_on: [redis]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
```

```bash
docker compose up
```

---

## Testing

```bash
# Backend unit tests
cd Server && go test -race ./...

# Frontend unit tests
cd frontend && npm test -- --watchAll=false
```

---

## API Endpoints

The Server/ directory exposes a REST API at port 8080:

| Method   | Path                  | Description        |
|----------|-----------------------|--------------------|
| GET      | `/health`             | Liveness probe     |
| GET      | `/ready`              | Readiness probe    |
| GET      | `/api/v1/todos`       | List all todos     |
| POST     | `/api/v1/todos`       | Create a todo      |
| GET      | `/api/v1/todos/:id`   | Get todo by ID     |
| PATCH    | `/api/v1/todos/:id`   | Update todo        |
| DELETE   | `/api/v1/todos/:id`   | Delete todo        |

---

## Required GitHub Secrets

Set these under **Settings → Secrets and variables → Actions**:

| Secret                       | Description                                            | Source                        |
|------------------------------|--------------------------------------------------------|-------------------------------|
| `AWS_OIDC_ROLE_ARN`          | IAM role ARN for GitHub OIDC (no static keys)          | Created manually in AWS IAM   |
| `FRONTEND_S3_BUCKET`         | S3 bucket name for React assets                        | `terraform output s3_frontend_bucket` |
| `CLOUDFRONT_DISTRIBUTION_ID` | CloudFront distribution ID for cache invalidation       | `terraform output cloudfront_distribution_id` |
| `REACT_APP_API_URL`          | Full ALB URL, e.g. `http://much-to-do-alb-prod-xxx...` | `terraform output alb_dns_name` |
| `LAUNCH_TEMPLATE_ID`         | EC2 launch template ID                                 | `terraform output launch_template_id` |
| `ASG_NAME`                   | Auto Scaling Group name                                | `terraform output asg_name` |
| `ALB_DNS_NAME`               | ALB hostname for smoke tests                           | `terraform output alb_dns_name` |
| `MONGO_URI_SECRET_ID`        | Secrets Manager secret name/ARN for MongoDB URI        | Value you used in Terraform   |
| `REDIS_ADDR`                 | ElastiCache primary endpoint + port                    | `terraform output elasticache_redis_endpoint` |
| `SLACK_WEBHOOK_URL`          | Slack incoming webhook for deploy notifications        | Slack App settings            |

---

## CI/CD Pipelines

### Frontend Pipeline (`frontend-ci-cd.yml`)
Triggered on pushes to `main` that change files in `frontend/`.

| Stage   | Steps                                                  |
|---------|--------------------------------------------------------|
| Build   | `npm ci` → lint → unit tests + coverage → `npm audit` |
| Build   | `npm run build` (injects `REACT_APP_API_URL`)          |
| Deploy  | S3 sync (immutable cache for assets, no-cache for `index.html`) |
| Deploy  | CloudFront invalidation → wait for completion          |
| Notify  | Slack message on success or failure                    |

### Backend Pipeline (`backend-ci-cd.yml`)
Triggered on pushes to `main` that change files in `Server/`.

| Stage  | Steps                                                              |
|--------|--------------------------------------------------------------------|
| Test   | `go vet` → golangci-lint → unit tests (`-race`) → govulncheck     |
| Build  | Docker multi-stage build → push to ECR → Trivy vulnerability scan |
| Deploy | Update EC2 Launch Template with new image → ASG instance refresh  |
| Deploy | Poll until refresh completes → smoke test → CloudWatch metric     |
| Deploy | Rollback script on failure → Slack notification                   |

---

See [ARCHITECTURE.md](ARCHITECTURE.md) and [RUNBOOK.md](RUNBOOK.md) for more.
