# Architecture

## System Diagram

```
                       ┌──────────────────────────────────────────┐
                       │              INTERNET                    │
                       └────────────────┬─────────────────────────┘
                                        │
              ┌─────────────────────────┼────────────────────────────────┐
              │                         │                                │
    ┌─────────▼──────────┐   ┌──────────▼─────────────────┐             │
    │  CloudFront CDN    │   │  Application Load Balancer  │             │
    │  (Global PoPs)     │   │  (Public subnets, 3 AZs)   │             │
    └─────────┬──────────┘   └──────────┬─────────────────┘             │
              │                         │ Port 8080                      │
    ┌─────────▼──────────┐   ┌──────────▼─────────────────┐             │
    │  S3 Bucket         │   │  Auto Scaling Group         │             │
    │  (React SPA)       │   │  EC2 t3.small × 2-4         │             │
    │  OAC-protected     │   │  Private subnets            │             │
    └────────────────────┘   └──────┬──────────┬───────────┘             │
                                    │          │                         │
                          ┌─────────▼──┐  ┌───▼──────────────────────┐  │
                          │ ElastiCache│  │  MongoDB Atlas           │  │
                          │ Redis 7    │  │  (external SaaS)         │  │
                          │ 2 nodes HA │  │  URI from Secrets Mgr    │  │
                          └────────────┘  └──────────────────────────┘  │
                                                                         │
                          ┌──────────────────────────────────────────┐   │
                          │          CloudWatch                      │   │
                          │  Log Groups + Alarms + Dashboard        │   │
                          └──────────────────────────────────────────┘   │
                                                                         │
    GitHub Actions (CI/CD) ─────────────────────────────────────────────┘
```

## Component Details

### Frontend (React 18 + CRA)
- SPA deployed as static files to S3
- CloudFront CDN delivers globally with HTTPS-only
- OAC (Origin Access Control) — S3 is never publicly accessible
- `index.html` served no-cache; all hashed assets served with 1-year immutable headers
- API URL injected at build time via `REACT_APP_API_URL`

### Backend API (Go, `Server/`)
- Connects to MongoDB Atlas for data persistence
- Connects to ElastiCache Redis for sessions and caching
- Containerised with a distroless Docker image (minimal attack surface)
- Exposes `/health` and `/ready` endpoints for ALB health checks
- Structured JSON logs written to stdout → CloudWatch Logs via CloudWatch agent

### Database (MongoDB Atlas)
- Managed multi-region cluster; no EC2 MongoDB maintenance
- Connection URI stored in AWS Secrets Manager and fetched at container start

### Sessions / Cache (ElastiCache Redis 7)
- Replication group: 1 primary + 1 replica for HA
- In-transit and at-rest encryption enabled
- Only reachable from the backend security group

### Networking
- VPC with 3 public + 3 private subnets across 3 AZs
- ALB and NAT Gateways in public subnets; EC2 instances in private subnets
- Security groups enforce least-privilege: Internet → ALB → EC2 → Redis

### Infrastructure as Code (Terraform)
- Remote state in S3 + DynamoDB lock table
- 4 modules: `networking`, `compute`, `storage`, `monitoring`
- All sensitive values passed through CI secrets or Secrets Manager

## CI/CD Flow

```
Developer pushes to feature/** → opens PR → tests pass → merges to main
                                                              │
                               ┌──────────────────────────────┤
                               │                              │
                      frontend/ changed                 Server/ changed
                               │                              │
                    npm ci + tests                    go test + lint
                    npm build                         docker build + push ECR
                    S3 sync                           ASG instance refresh
                    CF invalidation                   smoke test /health
                    Slack notify                      Slack notify
```

## Security Controls

| Layer          | Control                                                     |
|----------------|-------------------------------------------------------------|
| Network        | EC2 in private subnets; no SSH from internet                |
| Credentials    | GitHub OIDC → IAM role (zero long-lived access keys)        |
| Secrets        | MongoDB URI in AWS Secrets Manager; fetched at runtime      |
| Container      | Distroless base, non-root user                              |
| Pipeline       | `npm audit`, Trivy image scan, tfsec, govulncheck           |
| S3             | Public access blocked; CloudFront OAC only                  |
| Encryption     | TLS in transit; AES-256 at rest (S3, Redis, EBS, Secrets)  |
| IAM            | EC2 role with least-privilege policies for each AWS service |
