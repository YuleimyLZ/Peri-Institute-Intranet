// ...existing code...
import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { StudentCourses } from "@/components/dashboard/StudentCourses";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Notifications } from "@/components/Notifications";
import { BookOpen, FileText, GraduationCap, TrendingUp, User, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import heroImage from "@/assets/hero-education.jpg";
import { Link } from "react-router-dom";

interface DashboardStats {
  coursesCount: number;
  pendingAssignments: number;
  upcomingExams: number;
  attendanceRate: number;
}


const Index = () => {
  const { profile } = useAuth();

  // Helpers para mensaje de bienvenida y subtítulo (dentro del componente para acceso a profile)
  const getWelcomeMessage = () => {
    const name = profile ? profile.first_name : 'Usuario';
    return `¡Bienvenido, ${name}!`;
  };

  const getSubtitle = () => {
    return 'Portal de Padres - IE La Campiña';
  };
  const [children, setChildren] = useState<any[]>([]);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const [pendingTasksCount, setPendingTasksCount] = useState(0);
  const [recentAbsencesCount, setRecentAbsencesCount] = useState(0);

  useEffect(() => {
    if (profile?.role === 'parent' && profile.id) {
      fetchChildren();
    }
  }, [profile]);

  // Fetch hijos y, si hay, tareas pendientes e inasistencias recientes
  const fetchChildren = async () => {
    setLoadingChildren(true);
    const { data, error } = await supabase
      .from('parent_student_relationships')
      .select('student:student_id(id, first_name, last_name, academic_year, is_active, grade, section, status)')
      .eq('parent_id', profile.id);
    if (!error && data) {
      const hijos = data.map((rel: any) => rel.student);
      setChildren(hijos);
      // Indicador: hijos con tareas pendientes
      let pending = 0;
      let absences = 0;
      for (const child of hijos) {
        // Tareas pendientes
        const { data: assignments } = await (supabase
          .from('assignments' as any)
          .select('id')
          .eq('student_id', child.id)
          .eq('status', 'pending'));
        if (assignments && assignments.length > 0) pending++;
        // Inasistencias recientes (últimos 7 días)
        const { data: attendance } = await (supabase
          .from('attendance' as any)
          .select('id')
          .eq('student_id', child.id)
          .eq('status', 'absent')
          .gte('date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)));
        if (attendance && attendance.length > 0) absences++;
      }
      setPendingTasksCount(pending);
      setRecentAbsencesCount(absences);
    } else {
      setChildren([]);
      setPendingTasksCount(0);
      setRecentAbsencesCount(0);
    }
    setLoadingChildren(false);
  };


  // Redirigir a dashboards específicos según el rol
  if (profile?.role === 'parent') {
    return <Navigate to="/parent/admin" replace />;
  }

  if (profile?.role === 'admin') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  if (profile?.role === 'directivo') {
    return <Navigate to="/directivo/dashboard" replace />;
  }

  if (profile?.role === 'tutor') {
    return <Navigate to="/tutor/dashboard" replace />;
  }

  // Vista original para estudiantes y profesores
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-hero p-8 text-white shadow-glow">
          <div className="absolute inset-0 opacity-20">
            <img 
              src={heroImage} 
              alt="Educación virtual IE La Campiña" 
              className="w-full h-full object-cover"
            />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <GraduationCap className="w-8 h-8" />
              <div>
                <h1 className="text-2xl font-bold">{getWelcomeMessage()}</h1>
                <p className="text-white/90">{getSubtitle()}</p>
              </div>
            </div>
            <p className="text-lg text-white/90 max-w-2xl">
              {(profile?.role as string) === 'teacher'
                ? 'Gestiona tus cursos, evalúa a tus estudiantes y mantente conectado con la comunidad educativa.'
                : (profile?.role as string) === 'admin'
                ? 'Administra la plataforma educativa y supervisa el progreso académico institucional.'
                : (profile?.role as string) === 'parent'
                ? 'Mantente informado sobre el progreso académico de tus hijos y la vida escolar.'
                : 'Accede a tus cursos, completa tus tareas y mantente conectado con tu educación desde cualquier lugar.'
              }
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            title="Mis Cursos"
            value={"..."}
            icon={BookOpen}
            description="Cursos inscritos"
            color="primary"
          />
          <StatsCard
            title="Tareas Pendientes"
            value={"..."}
            icon={FileText}
            description="Por entregar próximamente"
            color="accent"
          />
          <StatsCard
            title="Exámenes Próximos"
            value={"..."}
            icon={TrendingUp}
            description="Próximos a rendir"
            color="secondary"
          />
          <StatsCard
            title="Asistencia"
            value={"..."}
            icon={GraduationCap}
            description="Tasa de asistencia"
            color="primary"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            <StudentCourses />
            <RecentActivity />
          </div>
          {/* Right Column */}
          <div className="space-y-6">
            <QuickActions />
            {/* Calendar Section */}
            <div>
              {/* Si tienes AcademicCalendar, inclúyelo aquí */}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default Index;
