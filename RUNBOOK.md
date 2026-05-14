# Runbook – Much To Do

## 1. Initial Setup

### 1.1 Bootstrap Terraform State

Run once, before any `terraform apply`:

```bash
AWS_REGION=us-east-1

# State bucket
aws s3api create-bucket --bucket much-to-do-terraform-state --region $AWS_REGION

aws s3api put-bucket-versioning \
  --bucket much-to-do-terraform-state \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption \
  --bucket much-to-do-terraform-state \
  --server-side-encryption-configuration \
    '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

# DynamoDB lock table
aws dynamodb create-table \
  --table-name much-to-do-tf-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region $AWS_REGION
```

### 1.2 Store MongoDB Atlas URI

```bash
aws secretsmanager create-secret \
  --name "much-to-do/mongo-uri" \
  --description "MongoDB Atlas connection string" \
  --secret-string '{"uri":"mongodb+srv://user:pass@cluster.mongodb.net/muchtodo?retryWrites=true"}'
```

Note the ARN for `mongo_uri_secret_id` in `terraform.tfvars`.

### 1.3 GitHub OIDC Trust

Create an IAM OIDC provider for GitHub Actions and an IAM role that GitHub can assume:

```bash
# 1. Create OIDC provider
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1

# 2. Create the role (edit trust policy with your GitHub org/repo)
cat > /tmp/trust.json <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
    },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringLike": {
        "token.actions.githubusercontent.com:sub": "repo:<YOUR_GITHUB_ORG>/much-to-do:*"
      }
    }
  }]
}
EOF

aws iam create-role \
  --role-name much-to-do-github-actions \
  --assume-role-policy-document file:///tmp/trust.json

# 3. Attach policies (AdministratorAccess for initial setup; restrict later)
aws iam attach-role-policy \
  --role-name much-to-do-github-actions \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
```

### 1.4 Deploy Infrastructure

```bash
cd starttech-infra
cp terraform/terraform.tfvars.example terraform/terraform.tfvars
# Edit terraform.tfvars
./scripts/deploy-infrastructure.sh prod
```

### 1.5 Populate GitHub Secrets

After `terraform output`, set each secret in the app repo:

```bash
REPO="<your-github-username>/much-to-do"

gh secret set AWS_OIDC_ROLE_ARN              --repo "$REPO"
gh secret set FRONTEND_S3_BUCKET             --repo "$REPO"
gh secret set CLOUDFRONT_DISTRIBUTION_ID     --repo "$REPO"
gh secret set REACT_APP_API_URL              --repo "$REPO"
gh secret set LAUNCH_TEMPLATE_ID             --repo "$REPO"
gh secret set ASG_NAME                       --repo "$REPO"
gh secret set ALB_DNS_NAME                   --repo "$REPO"
gh secret set MONGO_URI_SECRET_ID            --repo "$REPO"
gh secret set REDIS_ADDR                     --repo "$REPO"
gh secret set SLACK_WEBHOOK_URL              --repo "$REPO"
```

---

## 2. Day-to-Day Deployments

### Deploy Frontend (manual)
```bash
export FRONTEND_S3_BUCKET=<bucket>
export CLOUDFRONT_DISTRIBUTION_ID=<dist-id>
./scripts/deploy-frontend.sh
```

### Deploy Backend (manual)
```bash
export ASG_NAME=much-to-do-asg-prod
export ECR_REPO_URL=<account>.dkr.ecr.us-east-1.amazonaws.com/much-to-do-backend
./scripts/deploy-backend.sh
```

---

## 3. Rollback Procedures

### Frontend Rollback (restore previous S3 version)

```bash
BUCKET=<bucket-name>

# List index.html versions
aws s3api list-object-versions \
  --bucket "$BUCKET" --prefix index.html \
  --query 'Versions[].[VersionId,LastModified]' --output table

# Restore
aws s3api copy-object \
  --bucket "$BUCKET" \
  --copy-source "$BUCKET/index.html?versionId=<VERSION_ID>" \
  --key index.html \
  --cache-control "no-cache,no-store,must-revalidate"

# Invalidate CloudFront
aws cloudfront create-invalidation \
  --distribution-id <DIST_ID> --paths "/*"
```

### Backend Rollback (re-tag previous ECR image)

```bash
REPO=much-to-do-backend
REGISTRY=<account>.dkr.ecr.us-east-1.amazonaws.com

# Find previous image
aws ecr describe-images --repository-name $REPO \
  --query 'sort_by(imageDetails,&imagePushedAt)[-5:].imageTags' --output table

# Re-tag previous image as :latest
aws ecr batch-get-image \
  --repository-name $REPO --image-ids imageTag=<PREV_TAG> \
  --query 'images[0].imageManifest' --output text > /tmp/manifest.json

aws ecr put-image \
  --repository-name $REPO --image-tag latest \
  --image-manifest file:///tmp/manifest.json

# Trigger fresh rolling refresh
aws autoscaling start-instance-refresh \
  --auto-scaling-group-name much-to-do-asg-prod \
  --preferences '{"MinHealthyPercentage":50}'
```

---

## 4. Incident Response

### All 5xx from ALB

```bash
# 1. Check target health
aws elbv2 describe-target-health --target-group-arn <TG_ARN>

# 2. Check recent error logs
aws logs filter-log-events \
  --log-group-name /much-to-do/prod/app \
  --filter-pattern "ERROR" \
  --start-time $(date -d '30 minutes ago' +%s000)

# 3. Check ASG activity
aws autoscaling describe-scaling-activities \
  --auto-scaling-group-name much-to-do-asg-prod --max-items 10

# 4. Scale out immediately if needed
aws autoscaling set-desired-capacity \
  --auto-scaling-group-name much-to-do-asg-prod --desired-capacity 4
```

### Frontend Showing Stale Content

1. Check if the CI pipeline S3 sync completed successfully
2. Manually create a CloudFront invalidation:
   ```bash
   aws cloudfront create-invalidation \
     --distribution-id <DIST_ID> --paths "/*"
   ```

---

## 5. Useful One-Liners

```bash
# Stream live application logs
aws logs tail /much-to-do/prod/app --follow

# Check Redis replication lag
aws elasticache describe-replication-groups \
  --replication-group-id much-to-do-redis-prod \
  --query 'ReplicationGroups[0].MemberClusters'

# List EC2 instances in the ASG
aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names much-to-do-asg-prod \
  --query 'AutoScalingGroups[0].Instances[*].{ID:InstanceId,State:HealthStatus}'

# Force terminate an unhealthy instance (ASG will replace it)
aws autoscaling terminate-instance-in-auto-scaling-group \
  --instance-id <INSTANCE_ID> --should-decrement-desired-capacity false
```
