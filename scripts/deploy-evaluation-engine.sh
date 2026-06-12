# ACCOUNT_ID: set in repo-root .env
# REGION: from your AWS profile (e.g. aws-vault exec my-profile -- ./scripts/deploy-evaluation-engine.sh sets AWS_REGION)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE_DIR="${ROOT}/backend/python-eval-function"
echo "IMAGE_DIR=${IMAGE_DIR}"

set -a
[ -f "${ROOT}/.env" ] && . "${ROOT}/.env"
set +a

if [ -z "${AWS_REGION-}" ]; then
  echo "Error: AWS_REGION not set. Please specify AWS_REGION in your environment." >&2
  exit 1
fi

if [ -z "${ACCOUNT_ID-}" ]; then
  echo "Error: ACCOUNT_ID not set" >&2
  exit 1
fi

REGION="${AWS_REGION}"
REPO="genai-evaluation"
REGISTRY="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"
BUILD_ID="$(date +%Y%m%d%H%M%S)"
REMOTE="${REGISTRY}/${REPO}"

# 1. Build image (linux/amd64 for Fargate compatibility)
docker build --platform linux/amd64 -t "${REPO}:${BUILD_ID}" -t "${REPO}:latest" "${IMAGE_DIR}"
echo "Built image ${REPO}:${BUILD_ID}"
# 2. Login
 aws ecr get-login-password --region "${REGION}" | docker login --username AWS --password-stdin "${REGISTRY}"

# # 3. Tag
 docker tag "${REPO}:${BUILD_ID}" "${REMOTE}:${BUILD_ID}"
 docker tag "${REPO}:${BUILD_ID}" "${REMOTE}:latest"

# # 4. Push
 docker push "${REMOTE}:${BUILD_ID}"
 docker push "${REMOTE}:latest"

 echo "Pushed ${REMOTE}:${BUILD_ID} and ${REMOTE}:latest"
