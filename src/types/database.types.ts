export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      clients: {
        Row: {
          id: string;
          name: string;
          nit: string | null;
          email: string;
          phone: string | null;
          address: string | null;
          city: string | null;
          department: string | null;
          country: string;
          logo_url: string | null;
          plan: 'BASIC' | 'PRO' | 'ENTERPRISE';
          status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
          max_users: number;
          allowed_modules: string[];
          start_date: string;
          expiry_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          nit?: string | null;
          email: string;
          phone?: string | null;
          address?: string | null;
          city?: string | null;
          department?: string | null;
          country?: string;
          logo_url?: string | null;
          plan?: 'BASIC' | 'PRO' | 'ENTERPRISE';
          status?: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
          max_users?: number;
          allowed_modules?: string[];
          start_date?: string;
          expiry_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          nit?: string | null;
          email?: string;
          phone?: string | null;
          address?: string | null;
          city?: string | null;
          department?: string | null;
          country?: string;
          logo_url?: string | null;
          plan?: 'BASIC' | 'PRO' | 'ENTERPRISE';
          status?: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
          max_users?: number;
          allowed_modules?: string[];
          start_date?: string;
          expiry_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          client_id: string | null;
          campaign_id: string | null;
          email: string;
          display_name: string | null;
          phone: string | null;
          cedula: string | null;
          role: string;
          status: string;
          allowed_modules: string[];
          custom_role_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          client_id?: string | null;
          campaign_id?: string | null;
          email: string;
          display_name?: string | null;
          phone?: string | null;
          cedula?: string | null;
          role?: string;
          status?: string;
          allowed_modules?: string[];
          custom_role_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string | null;
          campaign_id?: string | null;
          email?: string;
          display_name?: string | null;
          phone?: string | null;
          cedula?: string | null;
          role?: string;
          status?: string;
          allowed_modules?: string[];
          custom_role_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      campaigns: {
        Row: {
          id: string;
          client_id: string | null;
          nombre: string;
          candidato_nombre: string | null;
          cargo_postulacion: string | null;
          departamento: string | null;
          municipio: string | null;
          circunscripcion: string | null;
          fecha_inicio: string | null;
          fecha_eleccion: string | null;
          meta_votos: number;
          presupuesto_total: number;
          estado: 'PLANIFICACION' | 'ACTIVA' | 'PAUSADA' | 'FINALIZADA';
          descripcion: string | null;
          is_demo: boolean;
          demo_expires_at: string | null;
          created_by: string | null;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id?: string | null;
          nombre: string;
          candidato_nombre?: string | null;
          cargo_postulacion?: string | null;
          departamento?: string | null;
          municipio?: string | null;
          circunscripcion?: string | null;
          fecha_inicio?: string | null;
          fecha_eleccion?: string | null;
          meta_votos?: number;
          presupuesto_total?: number;
          estado?: 'PLANIFICACION' | 'ACTIVA' | 'PAUSADA' | 'FINALIZADA';
          descripcion?: string | null;
          is_demo?: boolean;
          demo_expires_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string | null;
          nombre?: string;
          candidato_nombre?: string | null;
          cargo_postulacion?: string | null;
          departamento?: string | null;
          municipio?: string | null;
          circunscripcion?: string | null;
          fecha_inicio?: string | null;
          fecha_eleccion?: string | null;
          meta_votos?: number;
          presupuesto_total?: number;
          estado?: 'PLANIFICACION' | 'ACTIVA' | 'PAUSADA' | 'FINALIZADA';
          descripcion?: string | null;
          is_demo?: boolean;
          demo_expires_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      candidates: {
        Row: {
          id: string;
          client_id: string;
          nombre: string;
          identificacion: string | null;
          cargo: string | null;
          partido: string | null;
          territorio: string | null;
          perfil_profesional: string | null;
          propuesta_valor: string | null;
          foto_url: string | null;
          redes_sociales: Json;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          nombre: string;
          identificacion?: string | null;
          cargo?: string | null;
          partido?: string | null;
          territorio?: string | null;
          perfil_profesional?: string | null;
          propuesta_valor?: string | null;
          foto_url?: string | null;
          redes_sociales?: Json;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          nombre?: string;
          identificacion?: string | null;
          cargo?: string | null;
          partido?: string | null;
          territorio?: string | null;
          perfil_profesional?: string | null;
          propuesta_valor?: string | null;
          foto_url?: string | null;
          redes_sociales?: Json;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      leaders: {
        Row: {
          id: string;
          client_id: string;
          nombre: string;
          cedula: string;
          telefono: string | null;
          email: string | null;
          comuna: string | null;
          barrio: string | null;
          puesto: string | null;
          mesa: string | null;
          meta_votos: number;
          votos_comprometidos: number;
          status: 'ACTIVE' | 'INACTIVE';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          nombre: string;
          cedula: string;
          telefono?: string | null;
          email?: string | null;
          comuna?: string | null;
          barrio?: string | null;
          puesto?: string | null;
          mesa?: string | null;
          meta_votos?: number;
          votos_comprometidos?: number;
          status?: 'ACTIVE' | 'INACTIVE';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          nombre?: string;
          cedula?: string;
          telefono?: string | null;
          email?: string | null;
          comuna?: string | null;
          barrio?: string | null;
          puesto?: string | null;
          mesa?: string | null;
          meta_votos?: number;
          votos_comprometidos?: number;
          status?: 'ACTIVE' | 'INACTIVE';
          created_at?: string;
          updated_at?: string;
        };
      };
      voters: {
        Row: {
          id: string;
          client_id: string;
          nombre: string;
          cedula: string;
          telefono: string | null;
          email: string | null;
          departamento: string | null;
          municipio: string | null;
          comuna: string | null;
          barrio: string | null;
          puesto: string | null;
          mesa: string | null;
          lider_id: string | null;
          intencion: 'Voto Seguro' | 'Probable' | 'Indeciso' | 'En Contra';
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          nombre: string;
          cedula: string;
          telefono?: string | null;
          email?: string | null;
          departamento?: string | null;
          municipio?: string | null;
          comuna?: string | null;
          barrio?: string | null;
          puesto?: string | null;
          mesa?: string | null;
          lider_id?: string | null;
          intencion?: 'Voto Seguro' | 'Probable' | 'Indeciso' | 'En Contra';
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          nombre?: string;
          cedula?: string;
          telefono?: string | null;
          email?: string | null;
          departamento?: string | null;
          municipio?: string | null;
          comuna?: string | null;
          barrio?: string | null;
          puesto?: string | null;
          mesa?: string | null;
          lider_id?: string | null;
          intencion?: 'Voto Seguro' | 'Probable' | 'Indeciso' | 'En Contra';
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      budget_items: {
        Row: {
          id: string;
          client_id: string;
          campaign_id: string | null;
          tipo: 'INGRESO' | 'GASTO';
          categoria_cne: string;
          concepto: string;
          monto: number;
          fecha: string;
          comprobante_numero: string | null;
          soporte_url: string | null;
          beneficiario_nombre: string | null;
          beneficiario_nit: string | null;
          estado: 'REGISTRADO' | 'VERIFICADO' | 'OBSERVADO' | 'ANULADO';
          observaciones: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          campaign_id?: string | null;
          tipo: 'INGRESO' | 'GASTO';
          categoria_cne: string;
          concepto: string;
          monto: number;
          fecha?: string;
          comprobante_numero?: string | null;
          soporte_url?: string | null;
          beneficiario_nombre?: string | null;
          beneficiario_nit?: string | null;
          estado?: 'REGISTRADO' | 'VERIFICADO' | 'OBSERVADO' | 'ANULADO';
          observaciones?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          campaign_id?: string | null;
          tipo?: 'INGRESO' | 'GASTO';
          categoria_cne?: string;
          concepto?: string;
          monto?: number;
          fecha?: string;
          comprobante_numero?: string | null;
          soporte_url?: string | null;
          beneficiario_nombre?: string | null;
          beneficiario_nit?: string | null;
          estado?: 'REGISTRADO' | 'VERIFICADO' | 'OBSERVADO' | 'ANULADO';
          observaciones?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      witnesses: {
        Row: {
          id: string;
          client_id: string;
          nombre: string;
          cedula: string;
          telefono: string | null;
          email: string | null;
          municipio: string | null;
          zona: string | null;
          puesto: string;
          mesa: string;
          estado: 'PENDIENTE' | 'CAPACITADO' | 'ACREDITADO' | 'EN_MESA' | 'INACTIVO';
          documento_soporte_url: string | null;
          observaciones: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          nombre: string;
          cedula: string;
          telefono?: string | null;
          email?: string | null;
          municipio?: string | null;
          zona?: string | null;
          puesto: string;
          mesa: string;
          estado?: 'PENDIENTE' | 'CAPACITADO' | 'ACREDITADO' | 'EN_MESA' | 'INACTIVO';
          documento_soporte_url?: string | null;
          observaciones?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          nombre?: string;
          cedula?: string;
          telefono?: string | null;
          email?: string | null;
          municipio?: string | null;
          zona?: string | null;
          puesto?: string;
          mesa?: string;
          estado?: 'PENDIENTE' | 'CAPACITADO' | 'ACREDITADO' | 'EN_MESA' | 'INACTIVO';
          documento_soporte_url?: string | null;
          observaciones?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      jurors: {
        Row: {
          id: string;
          client_id: string;
          nombre: string;
          cedula: string;
          telefono: string | null;
          municipio: string | null;
          puesto: string;
          mesa: string;
          cargo: 'PRESIDENTE' | 'VICEPRESIDENTE' | 'VOCAL' | 'REMANENTE';
          afinidad: 'A_FAVOR' | 'NEUTRO' | 'EN_CONTRA' | 'DESCONOCIDO';
          observaciones: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          nombre: string;
          cedula: string;
          telefono?: string | null;
          municipio?: string | null;
          puesto: string;
          mesa: string;
          cargo?: 'PRESIDENTE' | 'VICEPRESIDENTE' | 'VOCAL' | 'REMANENTE';
          afinidad?: 'A_FAVOR' | 'NEUTRO' | 'EN_CONTRA' | 'DESCONOCIDO';
          observaciones?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          nombre?: string;
          cedula?: string;
          telefono?: string | null;
          municipio?: string | null;
          puesto?: string;
          mesa?: string;
          cargo?: 'PRESIDENTE' | 'VICEPRESIDENTE' | 'VOCAL' | 'REMANENTE';
          afinidad?: 'A_FAVOR' | 'NEUTRO' | 'EN_CONTRA' | 'DESCONOCIDO';
          observaciones?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      surveys: {
        Row: {
          id: string;
          client_id: string;
          campaign_id: string | null;
          titulo: string;
          descripcion: string | null;
          fecha_inicio: string | null;
          fecha_fin: string | null;
          muestra_objetivo: number;
          estado: string;
          preguntas: Json;
          created_at: string;
          updated_at: string;
          title?: string | null;
          status?: string | null;
          questions?: Json;
        };
        Insert: {
          id?: string;
          client_id: string;
          campaign_id?: string | null;
          titulo: string;
          descripcion?: string | null;
          fecha_inicio?: string | null;
          fecha_fin?: string | null;
          muestra_objetivo?: number;
          estado?: string;
          preguntas?: Json;
          created_at?: string;
          updated_at?: string;
          title?: string | null;
          status?: string | null;
          questions?: Json;
        };
        Update: {
          id?: string;
          client_id?: string;
          campaign_id?: string | null;
          titulo?: string;
          descripcion?: string | null;
          fecha_inicio?: string | null;
          fecha_fin?: string | null;
          muestra_objetivo?: number;
          estado?: string;
          preguntas?: Json;
          created_at?: string;
          updated_at?: string;
          title?: string | null;
          status?: string | null;
          questions?: Json;
        };
      };
      swot_matrices: {
        Row: {
          id: string;
          client_id: string;
          campaign_id: string | null;
          fortalezas: string[];
          oportunidades: string[];
          debilidades: string[];
          amenazas: string[];
          conclusiones_ai: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          campaign_id?: string | null;
          fortalezas?: string[];
          oportunidades?: string[];
          debilidades?: string[];
          amenazas?: string[];
          conclusiones_ai?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          campaign_id?: string | null;
          fortalezas?: string[];
          oportunidades?: string[];
          debilidades?: string[];
          amenazas?: string[];
          conclusiones_ai?: string | null;
          updated_at?: string;
        };
      };
      campaign_calendar: {
        Row: {
          id: string;
          client_id: string;
          titulo: string;
          descripcion: string | null;
          tipo_evento: 'REUNION' | 'MITIN' | 'ENTREVISTA' | 'VISITA_TERRITORIAL' | 'OTRO' | null;
          fecha_inicio: string;
          fecha_fin: string | null;
          ubicacion: string | null;
          latitud: number | null;
          longitud: number | null;
          responsable_id: string | null;
          estado: 'PROGRAMADO' | 'REALIZADO' | 'CANCELADO';
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          titulo: string;
          descripcion?: string | null;
          tipo_evento?: 'REUNION' | 'MITIN' | 'ENTREVISTA' | 'VISITA_TERRITORIAL' | 'OTRO' | null;
          fecha_inicio: string;
          fecha_fin?: string | null;
          ubicacion?: string | null;
          latitud?: number | null;
          longitud?: number | null;
          responsable_id?: string | null;
          estado?: 'PROGRAMADO' | 'REALIZADO' | 'CANCELADO';
          created_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          titulo?: string;
          descripcion?: string | null;
          tipo_evento?: 'REUNION' | 'MITIN' | 'ENTREVISTA' | 'VISITA_TERRITORIAL' | 'OTRO' | null;
          fecha_inicio?: string;
          fecha_fin?: string | null;
          ubicacion?: string | null;
          latitud?: number | null;
          longitud?: number | null;
          responsable_id?: string | null;
          estado?: 'PROGRAMADO' | 'REALIZADO' | 'CANCELADO';
          created_at?: string;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          client_id: string;
          user_id: string | null;
          action: string;
          resource: string;
          details: Json;
          timestamp: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          user_id?: string | null;
          action: string;
          resource: string;
          details?: Json;
          timestamp?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          user_id?: string | null;
          action?: string;
          resource?: string;
          details?: Json;
          timestamp?: string;
        };
      };
      plans: {
        Row: {
          id: string;
          name: string;
          code: string;
          description: string | null;
          max_users: number;
          max_campaigns: number;
          allowed_module_codes: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          code: string;
          description?: string | null;
          max_users?: number;
          max_campaigns?: number;
          allowed_module_codes?: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          code?: string;
          description?: string | null;
          max_users?: number;
          max_campaigns?: number;
          allowed_module_codes?: string[];
          created_at?: string;
        };
      };
      modules: {
        Row: {
          id: string;
          code: string;
          name: string;
          description: string | null;
          icon: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          description?: string | null;
          icon?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          name?: string;
          description?: string | null;
          icon?: string | null;
          created_at?: string;
        };
      };
      module_functions: {
        Row: {
          id: string;
          module_code: string;
          code: string;
          name: string;
          description: string | null;
        };
        Insert: {
          id?: string;
          module_code: string;
          code: string;
          name: string;
          description?: string | null;
        };
        Update: {
          id?: string;
          module_code?: string;
          code?: string;
          name?: string;
          description?: string | null;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_superadmin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      get_user_client_id: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
