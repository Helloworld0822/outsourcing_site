#!/usr/bin/env bash
# Crewlink K8s 비용 최소화 기획 — 미리보기 후 실행 여부를 사용자가 결정합니다.
#
# Usage:
#   ./scripts/k8s-cost-optimizer.sh              # 대화형
#   ./scripts/k8s-cost-optimizer.sh --plan-only  # 기획만 출력
#   ./scripts/k8s-cost-optimizer.sh --profile minimal --yes  # 확인 없이 적용
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLAN_FILE="${ROOT}/k8s/cost-plan.yaml"
NAMESPACE="crewlink"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

PLAN_ONLY=false
AUTO_YES=false
SELECTED_PROFILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --plan-only) PLAN_ONLY=true; shift ;;
    --yes|-y) AUTO_YES=true; shift ;;
    --profile) SELECTED_PROFILE="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo -e "${RED}필요: $1${NC}"; exit 1; }
}

print_header() {
  echo ""
  echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}  Crewlink Kubernetes 비용 최소화 기획${NC}"
  echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
  echo ""
}

print_profiles() {
  echo -e "${YELLOW}▶ 프로파일 비교${NC}"
  echo ""
  echo "  [1] minimal     — 최소 비용 (권장)     월 \$25-60"
  echo "      · Backend 1, HPA max 2, ClusterIP gateway"
  echo "      · 외부 Neon/Cloud SQL DB 필수"
  echo ""
  echo "  [2] standard    — 표준 운영            월 \$80-180"
  echo "      · Backend/Frontend 2 replica, HPA max 3"
  echo ""
  echo "  [3] bundled-db  — 올인원 POC (비권장)  월 \$120-250"
  echo "      · 클러스터 내 Postgres 포함"
  echo ""
}

print_recommendations() {
  echo -e "${YELLOW}▶ 추가 절감 권장 사항${NC}"
  echo ""
  echo "  • 관리형 Postgres(Neon) — in-cluster DB 대비 노드+PVC 비용 절감"
  echo "  • LoadBalancer → Ingress/ClusterIP — LB 월 \$15-30 절감"
  echo "  • Redis 32MB 제한 — minimal 오버레이에 포함"
  echo "  • (선택) 야간 CronJob scale-to-zero — compute 30-50% 절감"
  echo "  • (선택) Spot 노드 풀 — compute 60-70% 절감"
  echo ""
  echo "  상세: k8s/cost-plan.yaml, docs/K8S.md"
  echo ""
}

profile_to_overlay() {
  case "$1" in
    1|minimal) echo "minimal" ;;
    2|standard) echo "standard" ;;
    3|bundled-db|bundled) echo "bundled-db" ;;
    *) echo "" ;;
  esac
}

choose_profile() {
  if [[ -n "$SELECTED_PROFILE" ]]; then
    profile_to_overlay "$SELECTED_PROFILE"
    return
  fi
  print_profiles
  read -r -p "프로파일 번호 또는 이름 [1/minimal]: " choice
  choice="${choice:-1}"
  local overlay
  overlay="$(profile_to_overlay "$choice")"
  if [[ -z "$overlay" ]]; then
    echo -e "${RED}잘못된 선택입니다.${NC}"
    exit 1
  fi
  echo "$overlay"
}

apply_overlay() {
  local overlay="$1"
  local overlay_path="${ROOT}/k8s/overlays/${overlay}"

  if [[ ! -d "$overlay_path" ]]; then
    echo -e "${RED}오버레이 없음: ${overlay_path}${NC}"
    exit 1
  fi

  echo -e "${GREEN}▶ kubectl kustomize 검증...${NC}"
  kubectl kustomize "$overlay_path" >/dev/null

  if [[ ! -f "${ROOT}/k8s/base/secret.yaml" ]]; then
    echo -e "${YELLOW}⚠ k8s/base/secret.yaml 없음.${NC}"
    echo "  cp k8s/base/secret.example.yaml k8s/base/secret.yaml 후 값을 채워주세요."
    read -r -p "secret 없이 계속하시겠습니까? [y/N]: " cont
    [[ "${cont,,}" == "y" ]] || exit 1
  fi

  echo -e "${GREEN}▶ Secret 적용...${NC}"
  if [[ -f "${ROOT}/k8s/base/secret.yaml" ]]; then
    kubectl apply -f "${ROOT}/k8s/base/secret.yaml"
  fi

  echo -e "${GREEN}▶ Overlay 적용: ${overlay}${NC}"
  kubectl apply -k "$overlay_path"

  echo -e "${GREEN}▶ DB 마이그레이션 Job 실행...${NC}"
  kubectl delete job backend-migrate -n "$NAMESPACE" --ignore-not-found
  kubectl apply -f "${ROOT}/k8s/base/migrate-job.yaml"
  kubectl wait --for=condition=complete job/backend-migrate -n "$NAMESPACE" --timeout=120s || {
    echo -e "${YELLOW}마이그레이션 Job 로그:${NC}"
    kubectl logs job/backend-migrate -n "$NAMESPACE" || true
  }

  echo ""
  echo -e "${GREEN}✓ 적용 완료${NC}"
  kubectl get pods,svc,hpa -n "$NAMESPACE"
}

main() {
  require_cmd kubectl

  print_header
  print_recommendations

  if $PLAN_ONLY; then
    echo -e "${CYAN}(--plan-only: 기획만 출력하고 종료)${NC}"
    exit 0
  fi

  local overlay
  overlay="$(choose_profile)"

  echo ""
  echo -e "${YELLOW}▶ 선택된 프로파일: ${overlay}${NC}"
  echo ""
  echo "  적용 내용:"
  echo "    · k8s/overlays/${overlay} 매니페스트"
  echo "    · Secret (있는 경우)"
  echo "    · migrate Job"
  echo ""

  if $AUTO_YES; then
    apply_overlay "$overlay"
    exit 0
  fi

  read -r -p "위 기획을 클러스터에 적용하시겠습니까? [y/N]: " answer
  case "${answer,,}" in
    y|yes)
      apply_overlay "$overlay"
      ;;
    *)
      echo ""
      echo -e "${CYAN}적용을 취소했습니다.${NC}"
      echo "  나중에 실행: ./scripts/k8s-cost-optimizer.sh --profile ${overlay}"
      echo "  또는:        kubectl apply -k k8s/overlays/${overlay}"
      echo ""
      ;;
  esac
}

main "$@"
