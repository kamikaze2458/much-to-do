# Complete Submission Guide – Month 3 Assessment

This document walks you through every step from a fresh AWS account to a
fully working CI/CD pipeline ready to submit.

---

## Prerequisites

Install these tools locally before starting:

```bash
# Terraform
brew install terraform   # macOS
# or: https://developer.hashicorp.com/terraform/install

# AWS CLI v2
# https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html

# GitHub CLI (optional but makes secret-setting easy)
brew install gh

# Docker Desktop
# https://www.docker.com/products/docker-desktop/

# Go 1.22+
# https://go.dev/dl/

# Node.js 20+
# https://nodejs.org/
```

---

## Part 1 – Fork & Clone the Repo

```bash
# 1. Go to https://github.com/Innocent9712/much-to-do
#    Click "Fork" → your GitHub account

# 2. Clone YOUR fork
git clone https://github.com/<YOUR_USERNAME>/much-to-do.git
cd much-to-do

# 3. Checkout the feature branch
git checkout feature/full-stack

# 4. Copy all files from much-to-do-fork/ into the repo root
#    (Server/Dockerfile, Server/.golangci.yml, frontend/, scripts/, etc.)
cp -r /path/to/much-to-do-fork/. .

# 5. Commit and push
git add .
git commit -m "feat: add CI/CD pipelines, frontend, and Dockerfile"
git push origin feature/full-stack
```

---

## Part 2 – AWS Account Setup

### 2.1 Configure AWS CLI

```bash
aws configure
# AWS Access Key ID: <your key>
# AWS Secret Access Key: <your secret>
# Default region name: us-east-1
# Default output format: json

# Verify it works
aws sts get-caller-identity
```

### 2.2 Create a MongoDB Atlas Cluster

1. Sign up at https://www.mongodb.com/atlas
2. Create a free M0 cluster
3. Under **Database Access**, create a user with read/write access
4. Under **Network Access**, add `0.0.0.0/0` (allow all — you'll restrict to NAT GW IPs after deploy)
5. Copy the connection string: `mongodb+srv://user:pass@cluster.mongodb.net/muchtodo`

### 2.3 Store the MongoDB URI in AWS Secrets Manager

```bash
aws secretsmanager create-secret \
  --region us-east-1 \
  --name "much-to-do/mongo-uri" \
  --description "MongoDB Atlas URI for Much-To-Do" \
  --secret-string '{"uri":"mongodb+srv://user:pass@cluster.mongodb.net/muchtodo?retryWrites=true&w=majority"}'

# Note the ARN returned — you'll need it for terraform.tfvars
```

### 2.4 Bootstrap Terraform State Backend

```bash
# Create the S3 state bucket
aws s3api create-bucket \
  --bucket much-to-do-terraform-state \
  --region us-east-1

aws s3api put-bucket-versioning \
  --bucket much-to-do-terraform-state \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption \
  --bucket much-to-do-terraform-state \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

# Create the DynamoDB lock table
aws dynamodb create-table \
  --table-name much-to-do-tf-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

---

## Part 3 – Set Up GitHub OIDC (no long-lived AWS keys in GitHub)

### 3.1 Create the OIDC Provider

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

### 3.2 Create the GitHub Actions IAM Role

```bash
GITHUB_USERNAME="<YOUR_GITHUB_USERNAME>"
REPO="much-to-do"

cat > /tmp/trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::${ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:${GITHUB_USERNAME}/${REPO}:*"
        },
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        }
      }
    }
  ]
}
EOF

aws iam create-role \
  --role-name much-to-do-github-actions \
  --assume-role-policy-document file:///tmp/trust-policy.json

# For the assessment, attach AdministratorAccess for simplicity
# In production, scope it to the specific services needed
aws iam attach-role-policy \
  --role-name much-to-do-github-actions \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess

OIDC_ROLE_ARN=$(aws iam get-role \
  --role-name much-to-do-github-actions \
  --query Role.Arn --output text)

echo "OIDC Role ARN: $OIDC_ROLE_ARN"
# Save this — you'll add it as a GitHub Secret
```

### 3.3 Create the Infra Repo GitHub Actions Role (same role works for both repos)

The same `much-to-do-github-actions` role can be used for both repos if you adjust the trust policy:

```bash
# If you want a single role for both repos, update the trust policy:
cat > /tmp/trust-policy-both.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::${ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringLike": {
          "token.actions.githubusercontent.com:sub": [
            "repo:${GITHUB_USERNAME}/much-to-do:*",
            "repo:${GITHUB_USERNAME}/starttech-infra:*"
          ]
        }
      }
    }
  ]
}
EOF

aws iam update-assume-role-policy \
  --role-name much-to-do-github-actions \
  --policy-document file:///tmp/trust-policy-both.json
```

---

## Part 4 – Deploy Infrastructure

### 4.1 Get the Latest Amazon Linux 2023 AMI ID

```bash
aws ec2 describe-images \
  --owners amazon \
  --filters \
    'Name=name,Values=al2023-ami-2023*-x86_64' \
    'Name=state,Values=available' \
  --query 'sort_by(Images, &CreationDate)[-1].ImageId' \
  --output text
# Example output: ami-0c02fb55956c7d316
```

### 4.2 Create an EC2 Key Pair

```bash
aws ec2 create-key-pair \
  --key-name much-to-do-keypair \
  --query 'KeyMaterial' \
  --output text > ~/.ssh/much-to-do-keypair.pem

chmod 400 ~/.ssh/much-to-do-keypair.pem
```

### 4.3 Fill in terraform.tfvars

```bash
cd starttech-infra
cp terraform/terraform.tfvars.example terraform/terraform.tfvars
```

Edit `terraform/terraform.tfvars`:

```hcl
aws_region  = "us-east-1"
environment = "prod"

vpc_cidr             = "10.0.0.0/16"
availability_zones   = ["us-east-1a", "us-east-1b", "us-east-1c"]
public_subnet_cidrs  = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
private_subnet_cidrs = ["10.0.11.0/24", "10.0.12.0/24", "10.0.13.0/24"]

frontend_bucket_name   = "much-to-do-frontend-prod-<YOUR_ACCOUNT_ID>"
cloudfront_price_class = "PriceClass_100"

instance_type        = "t3.small"
ami_id               = "<AMI_ID_FROM_STEP_4.1>"
key_name             = "much-to-do-keypair"
asg_min_size         = 1
asg_max_size         = 4
asg_desired_capacity = 2

mongo_uri_secret_id = "much-to-do/mongo-uri"

alarm_email = "<YOUR_EMAIL>"
```

### 4.4 Run Terraform

```bash
cd starttech-infra
./scripts/deploy-infrastructure.sh prod
```

This takes ~10–15 minutes (NAT Gateways and ElastiCache are the slow parts).

### 4.5 Save All Terraform Outputs

```bash
cd terraform
terraform output -json | tee /tmp/tf-outputs.json
terraform output   # human-readable view
```

---

## Part 5 – Set GitHub Secrets

### Application repo (`much-to-do`)

```bash
cd /path/to/much-to-do
gh auth login   # if not already authenticated

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=us-east-1

# Helper: read a terraform output
tf_out() { terraform -chdir=../starttech-infra/terraform output -raw "$1"; }

gh secret set AWS_OIDC_ROLE_ARN            -b "arn:aws:iam::${ACCOUNT_ID}:role/much-to-do-github-actions"
gh secret set FRONTEND_S3_BUCKET           -b "$(tf_out s3_frontend_bucket)"
gh secret set CLOUDFRONT_DISTRIBUTION_ID   -b "$(tf_out cloudfront_distribution_id)"
gh secret set REACT_APP_API_URL            -b "http://$(tf_out alb_dns_name)"
gh secret set LAUNCH_TEMPLATE_ID           -b "$(tf_out launch_template_id)"
gh secret set ASG_NAME                     -b "$(tf_out asg_name)"
gh secret set ALB_DNS_NAME                 -b "$(tf_out alb_dns_name)"
gh secret set MONGO_URI_SECRET_ID          -b "much-to-do/mongo-uri"
gh secret set REDIS_ADDR                   -b "$(tf_out elasticache_redis_endpoint):6379"
gh secret set SLACK_WEBHOOK_URL            -b "<YOUR_SLACK_WEBHOOK_URL>"
```

### Infrastructure repo (`starttech-infra`)

```bash
cd /path/to/starttech-infra
gh secret set AWS_OIDC_ROLE_ARN    -b "arn:aws:iam::${ACCOUNT_ID}:role/much-to-do-github-actions"
gh secret set FRONTEND_BUCKET_NAME -b "much-to-do-frontend-prod-${ACCOUNT_ID}"
gh secret set EC2_AMI_ID           -b "<AMI_ID>"
gh secret set EC2_KEY_NAME         -b "much-to-do-keypair"
gh secret set MONGO_URI_SECRET_ID  -b "much-to-do/mongo-uri"
gh secret set ALARM_EMAIL          -b "<YOUR_EMAIL>"
```

---

## Part 6 – Set Up GitHub Environments

GitHub Environments add a manual approval gate before production deploys.

1. Go to your `much-to-do` repo → **Settings → Environments**
2. Click **New environment** → name it `production`
3. Under **Protection rules**, enable **Required reviewers** and add yourself
4. Repeat for the `starttech-infra` repo

---

## Part 7 – Trigger the Pipelines

### First: push the backend to ECR manually (bootstraps the first image)

```bash
cd much-to-do

# Authenticate Docker to ECR
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
aws ecr get-login-password --region us-east-1 \
  | docker login --username AWS --password-stdin \
    "${ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com"

# Build and push
docker build -t much-to-do-backend ./Server
docker tag much-to-do-backend \
  "${ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com/much-to-do-backend:latest"
docker push \
  "${ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com/much-to-do-backend:latest"
```

### Then trigger CI by pushing a change

```bash
# Touch any file in Server/ to trigger the backend pipeline
echo "# deployed" >> Server/README.md
git add . && git commit -m "ci: trigger first deployment" && git push origin feature/full-stack

# Touch any file in frontend/ to trigger the frontend pipeline
echo "" >> frontend/src/index.js
git add . && git commit -m "ci: trigger frontend deployment" && git push origin feature/full-stack
```

### Monitor pipelines

Go to your GitHub repo → **Actions** tab and watch the jobs run.

---

## Part 8 – Verify Everything Works

```bash
# 1. Check backend health through ALB
ALB_DNS=$(terraform -chdir=starttech-infra/terraform output -raw alb_dns_name)
curl -s "http://${ALB_DNS}/health" | python3 -m json.tool

# 2. Run the full health check suite
./scripts/health-check.sh "$ALB_DNS"

# 3. Check the frontend is live
CF_DOMAIN=$(terraform -chdir=starttech-infra/terraform output -raw cloudfront_domain_name)
curl -sI "https://${CF_DOMAIN}" | head -5

# 4. Check CloudWatch logs are being written
aws logs tail /much-to-do/prod/app --since 1h

# 5. Check ASG instances are healthy
aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names "$(terraform -chdir=starttech-infra/terraform output -raw asg_name)" \
  --query 'AutoScalingGroups[0].Instances[*].{ID:InstanceId,Health:HealthStatus}' \
  --output table
```

---

## Part 9 – Create the Submission IAM User

The assessment requires submitting AWS console and CLI credentials with the
necessary IAM policies. Create a dedicated read/assess user:

```bash
# 1. Create the user
aws iam create-user --user-name much-to-do-assessor

# 2. Attach the policy from iam-submission-policy.json
aws iam put-user-policy \
  --user-name much-to-do-assessor \
  --policy-name MuchToDoAssessorPolicy \
  --policy-document file://starttech-infra/iam-submission-policy.json

# 3. Create access keys for CLI submission
aws iam create-access-key --user-name much-to-do-assessor

# 4. Create a login profile for console access
aws iam create-login-profile \
  --user-name much-to-do-assessor \
  --password "ChangeMe123!" \
  --password-reset-required

# 5. Note the console login URL
echo "https://${ACCOUNT_ID}.signin.aws.amazon.com/console"
```

---

## Part 10 – Final Submission Checklist

Before submitting, verify:

- [ ] Fork URL: `https://github.com/<YOU>/much-to-do` (branch `feature/full-stack`)
- [ ] Infra repo URL: `https://github.com/<YOU>/starttech-infra`
- [ ] Frontend pipeline ran successfully (`frontend-ci-cd.yml` → green)
- [ ] Backend pipeline ran successfully (`backend-ci-cd.yml` → green)
- [ ] Infrastructure pipeline ran successfully (`infrastructure-deploy.yml` → green)
- [ ] `curl http://<ALB_DNS>/health` returns `{"status":"ok"}`
- [ ] `https://<CLOUDFRONT_DOMAIN>` loads the React app
- [ ] CloudWatch log group `/much-to-do/prod/app` has entries
- [ ] At least one CloudWatch alarm exists and is in OK state
- [ ] AWS assessor IAM user created with access keys and console password
- [ ] MongoDB Atlas cluster is running and the backend connects successfully

### Submit

1. Both GitHub repository URLs
2. IAM user access key ID + secret (for CLI)
3. IAM user console login URL + username + password
4. AWS account ID (for assessors to look up resources)
