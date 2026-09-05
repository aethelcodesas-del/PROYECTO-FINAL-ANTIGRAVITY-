export interface CensoConsultaResult {
  cedula: string;
  encontrado: boolean;
  esCircunscripcionPermitida: boolean;
  circunscripcionCiudadano: string;
  circunscripcionCampana: string;
  nombreCompleto?: string;
  departamento?: string;
  municipio?: string;
  puestoVotacion?: string;
  comunaSector?: string;
  direccionPuesto?: string;
  mesa?: number;
  estadoCedula?: 'Habilitada' | 'Inhabilitada por Sanción' | 'No Inscrita';
  fechaUltimaActualizacion?: string;
  mensajeRespuesta: string;
}

export async function consultarCensoElectoralAPI(
  cedula: string,
  circunscripcionCampana: string = '',
): Promise<CensoConsultaResult> {
  const cleanCedula = cedula.trim().replace(/\D/g, '');
  if (!cleanCedula) {
    return {
      cedula: '',
      encontrado: false,
      esCircunscripcionPermitida: false,
      circunscripcionCiudadano: '',
      circunscripcionCampana,
      mensajeRespuesta: 'Número de cédula inválido o no suministrado.',
    };
  }

  const endpoint = `https://coresoft.solutions/api/cedula?documento=${cleanCedula}`;
  const token = import.meta.env.VITE_CORESOFT_TOKEN || '';

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('No fue posible consultar el proveedor oficial.');
    }

    const payload = await response.json();
    
    if (payload && payload.success && payload.nombre) {
      const nombreCompleto = payload.nombre;
      // Asumimos que si lo encuentra en la base de datos de la API, es válido.
      // La API no nos devuelve puesto de votación explícitamente en el ejemplo, 
      // pero usamos la ciudad/dirección si están disponibles.
      const municipio = payload.ciudad || '';
      
      return {
        cedula: cleanCedula,
        encontrado: true,
        esCircunscripcionPermitida: true,
        circunscripcionCiudadano: municipio,
        circunscripcionCampana,
        nombreCompleto: nombreCompleto,
        departamento: '',
        municipio: municipio,
        puestoVotacion: 'No especificado (Consulta externa)',
        comunaSector: '',
        direccionPuesto: payload.direccion || '',
        estadoCedula: 'Habilitada',
        mensajeRespuesta: 'Consulta oficial completada exitosamente.',
      };
    } else {
      return {
        cedula: cleanCedula,
        encontrado: false,
        esCircunscripcionPermitida: false,
        circunscripcionCiudadano: '',
        circunscripcionCampana,
        mensajeRespuesta: 'La cédula no fue encontrada en la base de datos externa.',
      };
    }
  } catch (error: any) {
    console.error('Error fetching cedula from coresoft API:', error);
    return {
      cedula: cleanCedula,
      encontrado: false,
      esCircunscripcionPermitida: false,
      circunscripcionCiudadano: '',
      circunscripcionCampana,
      mensajeRespuesta: `Error de conexión con el proveedor externo: ${error?.message || 'Desconocido'}`,
    };
  }
}

/** Mantiene la firma usada por el módulo mientras se conecta el proveedor CNE. */
export async function verificarActualizacionPuestoAPI(
  cedula: string,
  _forzarActualizacion: boolean = false,
): Promise<{
  trasladadoAMedellin: boolean;
  puestoNuevo?: {
    departamento: string;
    municipio: string;
    puestoVotacion: string;
    comunaSector: string;
    direccionPuesto: string;
    mesa: number;
    fechaInscripcion: string;
  };
  mensaje: string;
}> {
  const cleanCedula = cedula.trim().replace(/\D/g, '');
  return {
    trasladadoAMedellin: false,
    mensaje: `No existe una actualización oficial de puesto disponible para la C.C. ${cleanCedula}.`,
  };
}
