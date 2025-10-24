#!/bin/bash

# Script de inicio rápido para Closed Jobs Report Generator
# Uso: ./runClosedJobsReport.sh

echo "==================================================="
echo "  CLOSED JOBS REPORT GENERATOR - Quick Start"
echo "==================================================="
echo ""

# Verificar que Node.js está instalado
if ! command -v node &> /dev/null
then
    echo "❌ Error: Node.js no está instalado."
    echo "   Por favor instala Node.js desde https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js encontrado: $(node --version)"
echo ""

# Verificar si package.json existe
if [ ! -f "package.json" ]; then
    echo "⚠️  Warning: package.json no encontrado en este directorio."
    echo "   Creando package.json..."
    cat > package.json << 'EOF'
{
  "name": "closed-jobs-report-generator",
  "version": "1.0.0",
  "description": "Standalone script to export Closed Jobs from Attic Tech API to Excel",
  "main": "exportClosedJobsReport.js",
  "dependencies": {
    "axios": "^1.6.0",
    "exceljs": "^4.4.0"
  }
}
EOF
    echo "✅ package.json creado"
    echo ""
fi

# Verificar si node_modules existe
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependencias..."
    npm install
    echo ""
fi

# Verificar que el script existe
if [ ! -f "exportClosedJobsReport.js" ]; then
    echo "❌ Error: exportClosedJobsReport.js no encontrado."
    echo "   Por favor asegúrate de estar en el directorio correcto."
    exit 1
fi

# Ejecutar el script
echo "🚀 Iniciando Closed Jobs Report Generator..."
echo ""
node exportClosedJobsReport.js

echo ""
echo "==================================================="
echo "  Script finalizado"
echo "==================================================="

