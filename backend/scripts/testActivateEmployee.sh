#!/bin/bash

# ============================================================================
# Script de Test: Activate Employee
# Descripción: Testea el endpoint de activación de empleados
# Uso: ./testActivateEmployee.sh
# ============================================================================

# Colores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuración
API_URL="http://localhost:3000/api"

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}  Test: Activate Employee${NC}"
echo -e "${BLUE}================================${NC}\n"

# ============================================================================
# PASO 1: Login
# ============================================================================
echo -e "${YELLOW}📝 Ingresa tus credenciales:${NC}"
read -p "Email: " USER_EMAIL
read -sp "Password: " USER_PASSWORD
echo ""

echo -e "\n${BLUE}🔐 Autenticando...${NC}"

LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${USER_EMAIL}\",
    \"password\": \"${USER_PASSWORD}\"
  }")

# Verificar si el login fue exitoso
TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | sed 's/"token":"//')

if [ -z "$TOKEN" ]; then
    echo -e "${RED}❌ Error en login. Verifica tus credenciales.${NC}"
    echo "Respuesta del servidor:"
    echo $LOGIN_RESPONSE | jq '.' 2>/dev/null || echo $LOGIN_RESPONSE
    exit 1
fi

echo -e "${GREEN}✅ Login exitoso!${NC}"
echo -e "Token: ${TOKEN:0:20}...\n"

# ============================================================================
# PASO 2: Configurar datos del empleado
# ============================================================================
echo -e "${YELLOW}👤 Datos del empleado a activar:${NC}"
read -p "Employee ID: " EMPLOYEE_ID

echo -e "\n${YELLOW}Selecciona el rol final:${NC}"
echo "1) Crew Member"
echo "2) Crew Leader"
echo "3) Sales Person"
read -p "Opción (1-3): " ROLE_OPTION

case $ROLE_OPTION in
    1)
        FINAL_ROLE="crew_member"
        IS_LEADER="false"
        ;;
    2)
        FINAL_ROLE="crew_leader"
        IS_LEADER="true"
        ;;
    3)
        FINAL_ROLE="sales_person"
        IS_LEADER="false"
        ;;
    *)
        echo -e "${RED}Opción inválida${NC}"
        exit 1
        ;;
esac

echo -e "\n${YELLOW}Branch IDs (separados por comas, ej: 1,2,3):${NC}"
read -p "Branches: " BRANCHES_INPUT
# Convertir "1,2,3" a formato JSON array [1,2,3]
BRANCHES="[$(echo $BRANCHES_INPUT | sed 's/,/, /g')]"

# Solo preguntar animal si es crew
ANIMAL_JSON=""
if [ "$FINAL_ROLE" != "sales_person" ]; then
    echo -e "\n${YELLOW}Selecciona un animal:${NC}"
    echo "1) Lion"
    echo "2) Tiger"
    echo "3) Bear"
    echo "4) Eagle"
    echo "5) Shark"
    echo "6) Wolf"
    echo "7) Panther"
    echo "8) Falcon"
    read -p "Opción (1-8): " ANIMAL_OPTION
    
    case $ANIMAL_OPTION in
        1) ANIMAL="Lion" ;;
        2) ANIMAL="Tiger" ;;
        3) ANIMAL="Bear" ;;
        4) ANIMAL="Eagle" ;;
        5) ANIMAL="Shark" ;;
        6) ANIMAL="Wolf" ;;
        7) ANIMAL="Panther" ;;
        8) ANIMAL="Falcon" ;;
        *) ANIMAL="Lion" ;;
    esac
    
    ANIMAL_JSON=", \"animal\": \"${ANIMAL}\""
fi

echo -e "\n${YELLOW}Telegram Group IDs (separados por comas, ej: 5,7,9):${NC}"
read -p "Groups: " GROUPS_INPUT
# Convertir "5,7,9" a formato JSON array [5,7,9]
TELEGRAM_GROUPS="[$(echo $GROUPS_INPUT | sed 's/,/, /g')]"

# ============================================================================
# PASO 3: Activar empleado
# ============================================================================
echo -e "\n${BLUE}🚀 Activando empleado...${NC}\n"

PAYLOAD="{
  \"final_role\": \"${FINAL_ROLE}\",
  \"branches\": ${BRANCHES},
  \"is_leader\": ${IS_LEADER}${ANIMAL_JSON},
  \"telegram_groups\": ${TELEGRAM_GROUPS}
}"

echo -e "${YELLOW}Payload enviado:${NC}"
echo "$PAYLOAD" | jq '.' 2>/dev/null || echo "$PAYLOAD"
echo ""

ACTIVATE_RESPONSE=$(curl -s -X POST "${API_URL}/employees/${EMPLOYEE_ID}/activate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "$PAYLOAD")

# Verificar respuesta
SUCCESS=$(echo $ACTIVATE_RESPONSE | grep -o '"success":[^,]*' | sed 's/"success"://')

if [ "$SUCCESS" = "true" ]; then
    echo -e "${GREEN}✅ Empleado activado exitosamente!${NC}\n"
    echo -e "${YELLOW}Respuesta del servidor:${NC}"
    echo $ACTIVATE_RESPONSE | jq '.' 2>/dev/null || echo $ACTIVATE_RESPONSE
    
    # ============================================================================
    # PASO 4: Verificar en la BD (opcional)
    # ============================================================================
    echo -e "\n${BLUE}📊 ¿Querés verificar los cambios en la base de datos? (y/n)${NC}"
    read -p "> " VERIFY_DB
    
    if [ "$VERIFY_DB" = "y" ] || [ "$VERIFY_DB" = "Y" ]; then
        echo -e "\n${YELLOW}Necesitás tener psql configurado. Ingresa los datos de conexión:${NC}"
        read -p "Database name: " DB_NAME
        read -p "Database user: " DB_USER
        
        echo -e "\n${BLUE}1. Verificando crew_member/sales_person...${NC}"
        if [ "$FINAL_ROLE" = "sales_person" ]; then
            psql -U $DB_USER -d $DB_NAME -c "SELECT * FROM botzilla.sales_person WHERE employee_id = ${EMPLOYEE_ID};"
        else
            psql -U $DB_USER -d $DB_NAME -c "SELECT * FROM botzilla.crew_member WHERE employee_id = ${EMPLOYEE_ID};"
        fi
        
        echo -e "\n${BLUE}2. Verificando grupos asignados...${NC}"
        psql -U $DB_USER -d $DB_NAME -c "SELECT etg.*, tg.name as group_name FROM botzilla.employee_telegram_group etg LEFT JOIN botzilla.telegram_group tg ON etg.telegram_group_id = tg.id WHERE etg.employee_id = ${EMPLOYEE_ID};"
        
        echo -e "\n${BLUE}3. Verificando status del employee...${NC}"
        psql -U $DB_USER -d $DB_NAME -c "SELECT id, first_name, last_name, status, approved_by, approved_date FROM botzilla.employee WHERE id = ${EMPLOYEE_ID};"
    fi
    
else
    echo -e "${RED}❌ Error al activar empleado${NC}\n"
    echo -e "${YELLOW}Respuesta del servidor:${NC}"
    echo $ACTIVATE_RESPONSE | jq '.' 2>/dev/null || echo $ACTIVATE_RESPONSE
    exit 1
fi

echo -e "\n${GREEN}================================${NC}"
echo -e "${GREEN}  Test completado!${NC}"
echo -e "${GREEN}================================${NC}"

