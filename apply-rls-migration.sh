#!/bin/bash
# Script para aplicar la migración de roles tutor y directivo

echo "==========================================="
echo "Aplicando migración de roles RLS"
echo "==========================================="
echo ""

# Verificar que Supabase CLI esté instalado
if ! command -v supabase &> /dev/null; then
    echo "❌ Error: Supabase CLI no está instalado."
    echo "Por favor, instala Supabase CLI primero:"
    echo "  npm install -g supabase"
    exit 1
fi

echo "✅ Supabase CLI detectado"
echo ""

# Aplicar migración
echo "📝 Aplicando migración: 20260102000000_add_tutor_directivo_roles.sql"
supabase db push

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ ¡Migración aplicada exitosamente!"
    echo ""
    echo "Cambios realizados:"
    echo "  1. ✅ Roles 'tutor' y 'directivo' agregados al ENUM user_role"
    echo "  2. ✅ Políticas RLS para tutores agregadas"
    echo "  3. ✅ Políticas RLS para directivos agregadas"
    echo "  4. ✅ Políticas RLS para padres mejoradas"
    echo ""
    echo "Ahora los profesores deberían poder ver sus tareas correctamente."
else
    echo ""
    echo "❌ Error al aplicar la migración"
    echo "Por favor revisa los logs arriba para más detalles."
    exit 1
fi
