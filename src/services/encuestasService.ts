import { supabase } from '../lib/supabaseClient';
import type { SurveyStudy } from '../components/views/GestionEncuestasSondeos';

export const encuestasService = {
  /**
   * Obtiene la lista de encuestas asociadas a un cliente (o todas si tiene permiso).
   */
  async getEncuestas(): Promise<SurveyStudy[]> {
    const { data, error } = await supabase
      .from('surveys')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching surveys:', error);
      throw error;
    }

    // Mapeamos el modelo de DB al modelo de UI
    return (data || []).map((row: any) => ({
      id: row.id,
      code: row.code || `ENC-${row.id.substring(0,4).toUpperCase()}`,
      title: row.titulo,
      type: row.type || 'Sondeo Flash',
      methodology: row.methodology || 'Presencial (CAPI)',
      status: row.estado || 'Borrador',
      targetSample: row.muestra_objetivo || 0,
      completedSample: row.completed_sample || 0,
      marginOfError: row.margin_of_error || 0,
      confidenceLevel: row.confidence_level || 95,
      startDate: row.fecha_inicio || '',
      endDate: row.fecha_fin || '',
      pollstersCount: row.pollsters_count || 0,
      location: row.location || '',
      questionsCount: row.questions_count || (row.preguntas ? row.preguntas.length : 0),
    }));
  },

  /**
   * Crea una nueva encuesta
   */
  async crearEncuesta(clientId: string, survey: Omit<SurveyStudy, 'id' | 'code' | 'completedSample' | 'pollstersCount'>): Promise<SurveyStudy> {
    const dbPayload = {
      client_id: clientId,
      titulo: survey.title,
      type: survey.type,
      methodology: survey.methodology,
      estado: survey.status,
      muestra_objetivo: survey.targetSample,
      margin_of_error: survey.marginOfError,
      confidence_level: survey.confidenceLevel,
      fecha_inicio: survey.startDate,
      fecha_fin: survey.endDate,
      location: survey.location,
      questions_count: survey.questionsCount,
      preguntas: [], // Inicialmente vacío
      code: `ENC-${Math.random().toString(36).substring(2,6).toUpperCase()}`
    };

    const { data, error } = await supabase
      .from('surveys')
      .insert([dbPayload])
      .select('*')
      .single();

    if (error) {
      console.error('Error creating survey:', error);
      throw error;
    }

    return {
      id: data.id,
      code: data.code,
      title: data.titulo,
      type: data.type,
      methodology: data.methodology,
      status: data.estado,
      targetSample: data.muestra_objetivo,
      completedSample: data.completed_sample || 0,
      marginOfError: data.margin_of_error,
      confidenceLevel: data.confidence_level,
      startDate: data.fecha_inicio,
      endDate: data.fecha_fin,
      pollstersCount: data.pollsters_count || 0,
      location: data.location,
      questionsCount: data.questions_count
    };
  },

  /**
   * Actualiza una encuesta existente
   */
  async actualizarEncuesta(id: string, survey: Partial<SurveyStudy>): Promise<void> {
    const dbPayload: any = {};
    if (survey.title !== undefined) dbPayload.titulo = survey.title;
    if (survey.type !== undefined) dbPayload.type = survey.type;
    if (survey.methodology !== undefined) dbPayload.methodology = survey.methodology;
    if (survey.status !== undefined) dbPayload.estado = survey.status;
    if (survey.targetSample !== undefined) dbPayload.muestra_objetivo = survey.targetSample;
    if (survey.marginOfError !== undefined) dbPayload.margin_of_error = survey.marginOfError;
    if (survey.confidenceLevel !== undefined) dbPayload.confidence_level = survey.confidenceLevel;
    if (survey.startDate !== undefined) dbPayload.fecha_inicio = survey.startDate;
    if (survey.endDate !== undefined) dbPayload.fecha_fin = survey.endDate;
    if (survey.location !== undefined) dbPayload.location = survey.location;
    if (survey.questionsCount !== undefined) dbPayload.questions_count = survey.questionsCount;

    const { error } = await supabase
      .from('surveys')
      .update(dbPayload)
      .eq('id', id);

    if (error) {
      console.error('Error updating survey:', error);
      throw error;
    }
  },

  /**
   * Elimina una encuesta
   */
  async eliminarEncuesta(id: string): Promise<void> {
    const { error } = await supabase
      .from('surveys')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting survey:', error);
      throw error;
    }
  }
};
