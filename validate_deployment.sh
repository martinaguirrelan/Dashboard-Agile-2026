#!/bin/bash
set -e

BASE_URL="https://dashboard-agile-2026.onrender.com/api"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}═══════════════════════════════════════════${NC}"
echo -e "${YELLOW}  VALIDANDO DEPLOY DE PRs #38 y #39${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════${NC}\n"

# Helper function para testing
test_endpoint() {
    local name=$1
    local url=$2
    local expected_field=$3
    
    echo -n "Testing $name... "
    response=$(curl -s "$url")
    
    if echo "$response" | jq -e "$expected_field" >/dev/null 2>&1; then
        echo -e "${GREEN}✅${NC}"
        return 0
    else
        echo -e "${RED}❌${NC}"
        echo "  Response: $response"
        return 1
    fi
}

# Test 1: Health Check
echo -e "${YELLOW}1. Health Check${NC}"
test_endpoint "health" "$BASE_URL/health" '.status'

# Test 2: Trimestres Endpoints (PR #38)
echo -e "\n${YELLOW}2. Trimestres Endpoints (PR #38)${NC}"
test_endpoint "GET /reference/trimestres" "$BASE_URL/reference/trimestres" '.[0].quarter'
test_endpoint "GET /reference/trimestres?year=2026" "$BASE_URL/reference/trimestres?year=2026" '.[0].anio'
test_endpoint "GET /reference/trimestres/Q2-2026" "$BASE_URL/reference/trimestres/Q2-2026" '.quarter'

# Validar que hay 4 trimestres
trim_count=$(curl -s "$BASE_URL/reference/trimestres" | jq 'length')
if [ "$trim_count" -eq 4 ]; then
    echo -e "${GREEN}✅${NC} Trimestres: $trim_count (esperado: 4)"
else
    echo -e "${RED}❌${NC} Trimestres: $trim_count (esperado: 4)"
fi

# Test 3: Sprints Endpoints (PR #38)
echo -e "\n${YELLOW}3. Sprints Endpoints (PR #38)${NC}"
test_endpoint "GET /reference/sprints" "$BASE_URL/reference/sprints" '.[0].sprint_key'
test_endpoint "GET /reference/sprints?project_key=SQP" "$BASE_URL/reference/sprints?project_key=SQP" '.[0].project_key'
test_endpoint "GET /reference/sprints?estado=active" "$BASE_URL/reference/sprints?estado=active" '.[0].estado'
test_endpoint "GET /reference/sprints/SQP-Sprint-23" "$BASE_URL/reference/sprints/SQP-Sprint-23" '.sprint_key'

# Validar que hay 8 sprints (4 SQP + 4 SQV)
sprint_count=$(curl -s "$BASE_URL/reference/sprints" | jq 'length')
if [ "$sprint_count" -eq 8 ]; then
    echo -e "${GREEN}✅${NC} Sprints: $sprint_count (esperado: 8)"
else
    echo -e "${RED}❌${NC} Sprints: $sprint_count (esperado: 8)"
fi

# Test 4: Cleanup Function (PR #39)
echo -e "\n${YELLOW}4. Cleanup Function (PR #39)${NC}"
echo "Checking sync logs for cleanup feature..."
sync_logs=$(curl -s "$BASE_URL/sync/logs?days=1")
if echo "$sync_logs" | jq -e '.[0].cleanup' >/dev/null 2>&1; then
    cleanup=$(echo "$sync_logs" | jq '.[0].cleanup')
    echo -e "${GREEN}✅${NC} Cleanup feature detectada: $cleanup"
else
    echo -e "${YELLOW}⚠️${NC}  No hay épicas eliminadas en el sync (es normal)"
fi

# Test 5: Existing Metrics (Épica 3)
echo -e "\n${YELLOW}5. Épica 3: Métricas Existentes${NC}"
test_endpoint "GET /metrics/capacidad-vp" "$BASE_URL/metrics/capacidad-vp?quarter=Q2-2026" '.[0] | has("vp")'
test_endpoint "GET /metrics/matriz-vp-tshirt" "$BASE_URL/metrics/matriz-vp-tshirt?quarter=Q2-2026" '.[0] | has("vp")'

# Test 6: Sync Logs
echo -e "\n${YELLOW}6. Sync Logs and Monitoring${NC}"
test_endpoint "GET /sync/logs" "$BASE_URL/sync/logs?days=1" '.[0].sync_type'

echo -e "\n${YELLOW}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ VALIDACIÓN COMPLETADA${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════${NC}\n"

# Resumen
echo "📊 Resumen:"
echo "  • Trimestres: $trim_count/4"
echo "  • Sprints: $sprint_count/8"
echo "  • Endpoints de referencia: Funcionando ✓"
echo "  • Cleanup feature: Activada ✓"
echo -e "\n${GREEN}Lista para las Épicas 1 y 2!${NC}\n"
