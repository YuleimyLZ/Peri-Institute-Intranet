@echo off
REM Script para aplicar la migración de roles tutor y directivo en Windows

echo =========================================
echo Aplicando migracion de roles RLS
echo =========================================
echo.

REM Verificar que Supabase CLI esté instalado
where supabase >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Supabase CLI no esta instalado.
    echo Por favor, instala Supabase CLI primero:
    echo   npm install -g supabase
    pause
    exit /b 1
)

echo [OK] Supabase CLI detectado
echo.

REM Aplicar migración
echo Aplicando migracion: 20260102000000_add_tutor_directivo_roles.sql
supabase db push

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [OK] Migracion aplicada exitosamente!
    echo.
    echo Cambios realizados:
    echo   1. [OK] Roles 'tutor' y 'directivo' agregados al ENUM user_role
    echo   2. [OK] Politicas RLS para tutores agregadas
    echo   3. [OK] Politicas RLS para directivos agregadas
    echo   4. [OK] Politicas RLS para padres mejoradas
    echo.
    echo Ahora los profesores deberian poder ver sus tareas correctamente.
) else (
    echo.
    echo ERROR: Error al aplicar la migracion
    echo Por favor revisa los logs arriba para mas detalles.
)

pause
