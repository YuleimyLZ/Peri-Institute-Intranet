# 🎯 Panel de Supervisión Docente - Guía de Inicio Rápido

## 📌 ¿Qué se ha implementado?

Se ha creado un **sistema completo de supervisión docente** que permite a directivos (directores y coordinadores) monitorear el desempeño y actividad de todos los profesores en tiempo real.

### ✨ Características Principales

- 📊 **Dashboard con métricas generales**: Total de profesores, alertas activas, tareas pendientes
- 👨‍🏫 **Vista detallada por profesor**: Toda la información de cada docente en un solo lugar
- ⚠️ **Sistema de alertas inteligente**: Identifica automáticamente profesores que necesitan atención
- 📈 **Análisis de calificaciones**: Distribución de notas por profesor (AD/A/B/C)
- 📅 **Timeline de actividad**: Seguimiento día a día de las acciones del profesor
- 🔍 **Filtros avanzados**: Busca y filtra profesores fácilmente

## 🚀 Pasos para Activar

### 1️⃣ Aplicar la Migración de Base de Datos

**Opción A: Usando Supabase Dashboard (Recomendado)**
1. Ve a tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard)
2. Click en "SQL Editor" en el menú lateral
3. Abre el archivo: `supabase/migrations/20251228_add_directivo_role.sql`
4. Copia todo el contenido
5. Pégalo en el editor SQL
6. Click en "Run" o presiona Ctrl+Enter

**Opción B: Usando CLI de Supabase**
```bash
cd ProyectoWeb_laCampina
npx supabase db push
```

### 2️⃣ Asignar Rol Directivo a un Usuario

Ejecuta este SQL en el SQL Editor de Supabase:

```sql
-- Reemplaza 'tu-email@ejemplo.com' con el email del usuario
UPDATE public.profiles 
SET role = 'directivo' 
WHERE email = 'tu-email@ejemplo.com';
```

**O si quieres agregar directivo como rol adicional:**
```sql
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'directivo'::app_role
FROM public.profiles 
WHERE email = 'tu-email@ejemplo.com';
```

### 3️⃣ Iniciar la Aplicación

```bash
npm run dev
```

### 4️⃣ Acceder al Dashboard

1. Inicia sesión con el usuario al que asignaste rol directivo
2. En el menú lateral verás "Supervisión Docente" 👁️
3. Click en ese ítem o navega a: `http://localhost:5173/directivo-dashboard`

## 📊 Métricas Que Puedes Monitorear

### Por Cada Profesor Verás:

#### 📝 Tareas
- ✅ Total de tareas creadas
- ✅ Tareas publicadas
- ✅ Tareas de la última semana
- ✅ Tareas del último mes
- ✅ Tareas pendientes de calificar

#### ⏱️ Calificación
- ✅ Total de submissions calificadas
- ✅ Submissions pendientes
- ✅ Tiempo promedio de calificación (en horas)
- ✅ Última fecha de calificación

#### 📚 Exámenes
- ✅ Total de exámenes creados
- ✅ Exámenes publicados

#### 🏫 Cursos
- ✅ Total de cursos asignados
- ✅ Cursos activos

#### 📋 Asistencia
- ✅ Registros de asistencia creados
- ✅ Última fecha de registro

#### 📊 Distribución de Notas
- ✅ AD (18-20): Logro Destacado
- ✅ A (14-17): Logro Esperado
- ✅ B (11-13): En Proceso
- ✅ C (0-10): En Inicio

## ⚠️ Sistema de Alertas

El sistema identifica automáticamente profesores que necesitan atención:

### 🔴 Urgente (High Priority)
- Más de 10 tareas pendientes de calificar
- Sin actividad reciente (sin publicar contenido)

### 🟡 Atención (Medium Priority)
- Más de 5 tareas pendientes de calificar
- Sin crear tareas en 14+ días

### 🔵 Revisar (Low Priority)
- Sin registrar asistencia en 7+ días
- Baja actividad general

## 🎨 Interfaz del Dashboard

### Vista Principal
- **6 tarjetas de métricas generales** en la parte superior
- **Barra de filtros** con:
  - Búsqueda por nombre o email
  - Filtro por estado (Todos/Activos/Necesitan atención)
  - Filtro por severidad de alertas
- **Tabla completa de profesores** con todas las métricas
- **Botón de actualizar** para refrescar datos

### Vista Detallada de Profesor
Al hacer click en "Ver Detalles" de cualquier profesor:

#### Pestaña 1: Resumen
- Tarjetas con métricas principales
- Información de cursos y exámenes
- Estadísticas de asistencia
- Panel de alertas (si tiene problemas)

#### Pestaña 2: Calificaciones
- Gráfico de distribución de notas
- Porcentajes por cada nivel (AD/A/B/C)
- Barras de progreso visuales

#### Pestaña 3: Actividad
- Timeline de los últimos 30 días
- Desglose diario de:
  - Tareas creadas
  - Submissions calificadas
  - Exámenes creados
  - Asistencias registradas

## 🔒 Permisos y Seguridad

### Directivos PUEDEN:
- ✅ Ver todos los cursos
- ✅ Ver todas las tareas y submissions
- ✅ Ver todos los exámenes
- ✅ Ver recursos de curso
- ✅ Ver registros de asistencia
- ✅ Ver perfiles de profesores y estudiantes

### Directivos NO PUEDEN:
- ❌ Editar o eliminar tareas
- ❌ Calificar submissions
- ❌ Modificar exámenes
- ❌ Cambiar cursos
- ❌ Modificar asistencia

**El sistema es de solo lectura** para supervisión, no para intervención directa.

## 🛠️ Resolución de Problemas

### No veo "Supervisión Docente" en el menú
- Verifica que el usuario tenga rol `directivo` o `admin`
- Revisa en la base de datos:
```sql
SELECT email, role FROM public.profiles WHERE email = 'tu-email@ejemplo.com';
```

### No se muestran datos de profesores
- Asegúrate de que existan profesores con rol `teacher` o `tutor`
- Verifica que tengan tareas/cursos creados
```sql
SELECT COUNT(*) FROM public.profiles WHERE role IN ('teacher', 'tutor');
```

### Error al cargar el dashboard
- Revisa la consola del navegador (F12)
- Verifica que la migración se aplicó correctamente
- Comprueba que las funciones SQL existan:
```sql
SELECT proname FROM pg_proc WHERE proname LIKE '%teacher%';
```

### Las alertas no se muestran
- Verifica que la función `get_teachers_needing_attention()` exista
- Ejecuta manualmente:
```sql
SELECT * FROM public.get_teachers_needing_attention();
```

## 📈 Mejoras Futuras Sugeridas

### Corto Plazo
- [ ] Gráficos de tendencias temporales
- [ ] Exportar reportes a PDF/Excel
- [ ] Notificaciones por email a directivos

### Mediano Plazo
- [ ] Comparativas entre profesores
- [ ] Benchmarking por departamento
- [ ] Metas y objetivos personalizados

### Largo Plazo
- [ ] Sistema de feedback bidireccional
- [ ] Planes de mejora individualizados
- [ ] Reconocimientos y gamificación

## 📞 Soporte

Si encuentras algún problema o necesitas ayuda:

1. Revisa los logs de la consola del navegador
2. Verifica los errores en Supabase Dashboard > Logs
3. Consulta la documentación completa en `DIRECTIVO_DASHBOARD_IMPLEMENTATION.md`

## 📚 Archivos Importantes

```
📁 ProyectoWeb_laCampina/
├── 📄 DIRECTIVO_DASHBOARD_README.md          ← Estás aquí
├── 📄 DIRECTIVO_DASHBOARD_IMPLEMENTATION.md  ← Docs técnicas detalladas
├── 📄 setup_directivo.sql                    ← Script de configuración rápida
├── 📁 supabase/migrations/
│   └── 📄 20251228_add_directivo_role.sql   ← Migración principal
└── 📁 src/
    ├── 📁 pages/
    │   └── 📄 DirectivoDashboard.tsx         ← Dashboard principal
    ├── 📄 App.tsx                            ← Rutas actualizadas
    └── 📁 utils/
        └── 📄 roleNavigation.ts              ← Navegación actualizada
```

## ✅ Checklist de Verificación

Antes de usar el sistema, verifica:

- [ ] Migración aplicada correctamente
- [ ] Al menos un usuario con rol `directivo`
- [ ] Existen profesores en el sistema (rol `teacher` o `tutor`)
- [ ] Los profesores tienen cursos asignados
- [ ] Existen tareas y submissions en el sistema
- [ ] La aplicación está corriendo (`npm run dev`)
- [ ] Puedes iniciar sesión con el usuario directivo
- [ ] Ves el menú "Supervisión Docente"

---

## 🎉 ¡Listo!

Ahora tienes un sistema completo de supervisión docente. Los directivos pueden:
- Monitorear el desempeño de todos los profesores
- Identificar rápidamente quién necesita apoyo
- Analizar tendencias y patrones
- Tomar decisiones basadas en datos

**¡Disfruta supervisando y mejorando la calidad educativa!** 📚✨
