#!/usr/bin/env bash
# Crewlink Kubernetes 배포 (이미지 빌드 + 오버레이 적용)
#
# Usage:
#   ./scripts/k8s-deploy.sh minimal          # 비용 최소 프로파일
#   ./scripts/k8s-deploy.sh standard         # 표준 프로파일
#   ./scripts/k8s-deploy.sh --build minimal  # 이미지 빌드 후 배포
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OVERLAY="${1:-minimal}"
BUILD=false
AUTO_YES=false

shift || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --build) BUILD=true; shift ;;
    --yes|-y) AUTO_YES=true; shift ;;
    *) OVERLAY="$1"; shift ;;
  esac
done

build_images() {
  echo "▶ Backend 이미지 빌드..."
  docker build -t crewlink/backend:latest "${ROOT}/site_backend"
  echo "▶ Frontend 이미지 빌드..."
  docker build -t crewlink/frontend:latest "${ROOT}/outsourcing_site"
  echo "  (원격 레지스트리 사용 시 docker tag && docker push 후 kustomization images 수정)"
}

if $BUILD; then
  build_images
fi

if [[ ! -f "${ROOT}/k8s/base/secret.yaml" ]]; then
  echo "secret.yaml 없음. 예시 복사:"
  echo "  cp k8s/base/secret.example.yaml k8s/base/secret.yaml"
  exit 1
fi

if $AUTO_YES; then
  exec "${ROOT}/scripts/k8s-cost-optimizer.sh" --profile "$OVERLAY" --yes
else
  exec "${ROOT}/scripts/k8s-cost-optimizer.sh" --profile "$OVERLAY"
fi
