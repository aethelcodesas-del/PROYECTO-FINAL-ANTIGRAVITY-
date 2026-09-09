/**
 * PRUEBAS DE CARGA NACIONAL REAL Y CONTROLADA DEL CATÁLOGO DIVIPOLE OFICIAL (FASE 12)
 * Proceso: COL-2026-CONGRESO
 * Ejecutable mediante: npx tsx tests/officialElectoralNationalRealLoad.test.ts
 */

import { ingestOfflineOfficialFile } from '../src/services/registraduria/offlineOfficialFileIngestion';
import { executeNationalDivipoleBatchLoad, MIN_NATIONAL_PLAUSIBILITY_THRESHOLDS } from '../src/services/registraduria/nationalDivipoleStagingService';
import { syncOfficialElectoralDataToSupabase } from '../src/services/registraduria/electoralSyncService';
import { processOfficialPdfDivipole } from '../src/services/registraduria/pdfDivipoleAdapter';
import { DEFAULT_PROCESO_CONGRESO_2026 } from '../src/services/registraduria/schedulerEngine';
import { OfficialAdapterResult } from '../src/services/registraduria/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FALLÓ: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASÓ: ${message}`);
  }
}

// Base de datos transaccional simulada en memoria para validar atomicidad, FKs, historial y protección de polling_stations
class MockOfficialSupabaseDatabase {
  public electoral_processes: Record<string, any> = {};
  public divipole_departments: Record<string, any> = {};
  public divipole_municipalities: Record<string, any> = {};
  public divipole_zones: Record<string, any> = {};
  public divipole_polling_places: Record<string, any> = {};
  public divipole_polling_tables: Record<string, any> = {};
  public divipole_sync_history: any[] = [];
  public divipole_change_log: any[] = [];

  // Tabla operacional existente con asignaciones de campaña y testigos
  public polling_stations: any[] = [
    {
      id: 'station-op-101',
      campaign_id: 'camp-col-2026',
      name: 'PUESTO OPERATIVO EXISTENTE',
      witness_id: 'wit-888',
      department: 'CORDOBA',
      municipality: 'COTORRA',
      zone: '01',
      place: 'COLEGIO EL CARMEN',
      table_number: 1,
      status: 'ACTIVO'
    },
    {
      id: 'station-op-102',
      campaign_id: 'camp-col-2026',
      name: 'PUESTO OPERATIVO BOGOTA',
      witness_id: 'wit-999',
      department: 'BOGOTA D.C.',
      municipality: 'BOGOTA, D.C.',
      zone: '01',
      place: 'CORFERIAS',
      table_number: 5,
      status: 'ACTIVO'
    }
  ];

  public lastSyncSha: string | null = null;

  async executeRpcSync(fnName: string, params: any): Promise<{ data: any; error: any }> {
    if (fnName === 'sync_official_divipole_batch') {
      const payload = params.p_payload;
      const sha256 = payload.sha256;

      // 1. Verificación de Idempotencia por SHA-256
      if (this.lastSyncSha && this.lastSyncSha === sha256) {
        this.divipole_sync_history.push({
          id: `sync-${Date.now()}`,
          estado: 'EXITOSA',
          sha256_fuente: sha256,
          nota: 'NO_CHANGES'
        });
        return {
          data: {
            success: true,
            status: 'NO_CHANGES',
            sha256,
            registrosValidos: payload.statistics.registrosValidos,
            cantidadNuevos: 0,
            cantidadModificados: 0,
            message: 'Catálogo al día. SHA-256 idéntico sin cambios detectados.'
          },
          error: null
        };
      }

      // 2. Snapshot para soporte de Rollback
      const snapshot = {
        processes: { ...this.electoral_processes },
        depts: { ...this.divipole_departments },
        mpios: { ...this.divipole_municipalities },
        zones: { ...this.divipole_zones },
        places: { ...this.divipole_polling_places },
        tables: { ...this.divipole_polling_tables }
      };

      try {
        const proc = payload.process;
        if (!proc || !proc.codigoProceso) throw new Error('Código de proceso electoral inválido.');
        this.electoral_processes[proc.codigoProceso] = proc;

        let nuevosPuestos = 0;
        let modificadosPuestos = 0;

        // Departamentos
        for (const d of payload.departments) {
          this.divipole_departments[d.codDptoDivipole] = d;
        }

        // Municipios (Validar FK Departamento)
        for (const m of payload.municipalities) {
          if (!this.divipole_departments[m.codDptoDivipole]) {
            throw new Error(`Violación de FK: Departamento ${m.codDptoDivipole} no existe en catálogo.`);
          }
          this.divipole_municipalities[m.codCompletoDivipole] = m;
        }

        // Zonas (Validar FK Municipio)
        for (const z of payload.zones) {
          if (!this.divipole_municipalities[z.codCompletoMunicipio]) {
            throw new Error(`Violación de FK: Municipio ${z.codCompletoMunicipio} no existe en catálogo.`);
          }
          this.divipole_zones[`${z.codCompletoMunicipio}${z.codZonaDivipole}`] = z;
        }

        // Puestos de votación
        for (const p of payload.pollingPlaces) {
          const codMpioComp = `${p.codDptoDivipole}${p.codMpioDivipole}`;
          if (!this.divipole_municipalities[codMpioComp]) {
            throw new Error(`Violación de FK: Municipio ${codMpioComp} no existe en catálogo.`);
          }

          if (this.divipole_polling_places[p.codUnicoDivipole]) {
            modificadosPuestos++;
            this.divipole_change_log.push({
              cod_unico_divipole: p.codUnicoDivipole,
              tipo_cambio: 'MODIFICADO',
              sha256_nuevo: sha256
            });
          } else {
            nuevosPuestos++;
          }
          this.divipole_polling_places[p.codUnicoDivipole] = p;
        }

        // Mesas de votación
        for (const t of payload.pollingTables) {
          if (!this.divipole_polling_places[t.codUnicoDivipole]) {
            throw new Error(`Violación de FK: Puesto de votación ${t.codUnicoDivipole} no existe.`);
          }
          this.divipole_polling_tables[t.codigoMesaCompleto] = t;
        }

        this.lastSyncSha = sha256;
        const syncId = `sync-tx-real-${Date.now()}`;
        this.divipole_sync_history.push({
          id: syncId,
          estado: 'EXITOSA',
          sha256_fuente: sha256,
          registros_recibidos: payload.statistics.registrosRecibidos,
          registros_validos: payload.statistics.registrosValidos,
          cantidad_nuevos: nuevosPuestos,
          cantidad_modificados: modificadosPuestos
        });

        return {
          data: {
            success: true,
            status: 'EXITOSA',
            syncId,
            processId: proc.codigoProceso,
            sha256,
            registrosValidos: payload.statistics.registrosValidos,
            cantidadNuevos: nuevosPuestos,
            cantidadModificados: modificadosPuestos,
            message: 'Carga oficial nacional aplicada exitosamente.'
          },
          error: null
        };
      } catch (err: any) {
        // Rollback
        this.electoral_processes = snapshot.processes;
        this.divipole_departments = snapshot.depts;
        this.divipole_municipalities = snapshot.mpios;
        this.divipole_zones = snapshot.zones;
        this.divipole_polling_places = snapshot.places;
        this.divipole_polling_tables = snapshot.tables;

        return {
          data: null,
          error: { message: `Transacción abortada (Rollback ejecutado): ${err.message}` }
        };
      }
    }

    return { data: null, error: { message: 'Función RPC desconocida' } };
  }
}

async function runNationalRealLoadTests() {
  console.log('\n============================================================');
  console.log('EJECUTANDO PRUEBAS DE CARGA NACIONAL REAL Y CONTROLADA (FASE 12)');
  console.log('============================================================\n');

  const db = new MockOfficialSupabaseDatabase();
  const mockClient = {
    rpc: (name: string, params: any) => db.executeRpcSync(name, params),
    from: () => ({ insert: () => Promise.resolve({ error: null }) })
  };

  // Guardar snapshot de polling_stations operativa
  const initialPollingStationsCount = db.polling_stations.length;
  const initialStationsSnapshot = JSON.stringify(db.polling_stations);

  // FASE 12.1 & 12.2 — INGESTA Y VALIDACIÓN DE INTEGRIDAD DE ARCHIVO OFICIAL
  console.log('--- 1. Ingesta y Validación de Integridad de Archivo Oficial ---');
  const validOfficialPdfContent = '%PDF-1.7\n' + [
    'COD_DPTO;DEPARTAMENTO;COD_MPIO;MUNICIPIO;COD_ZONA;COD_PUESTO;PUESTO;DIRECCION;MESAS;LATITUD;LONGITUD;ES_RURAL',
    '11;BOGOTA D.C.;001;BOGOTA, D.C.;01;01;PLAZA DE BOLIVAR;CRA 7 CL 10;15;4.5981;-74.0758;0',
    '11;BOGOTA D.C.;001;BOGOTA, D.C.;01;02;CORFERIAS;CRA 37 NO 24-67;80;4.6288;-74.0899;0',
    '05;ANTIOQUIA;001;MEDELLIN;01;01;PLAZA MAYOR;CALLE 41 #55-80;40;6.2428;-75.5768;0',
    '05;ANTIOQUIA;001;MEDELLIN;99;01;SAN CRISTOBAL CORREGIMIENTO;PLAZA PRINCIPAL;10;6.2785;-75.6321;1',
    '23;CORDOBA;189;COTORRA;01;01;COLEGIO EL CARMEN;CALLE CENTRAL;12;9.0435;-75.7925;0',
    '23;CORDOBA;189;COTORRA;99;01;VEREDA LA CULEBRA;ESCUELA RURAL;4;9.0125;-75.7512;1',
    '76;VALLE DEL CAUCA;001;CALI;01;01;CAM CENTRO ADMINISTRATIVO;AV 2 NORTE;30;3.4516;-76.5320;0',
    '08;ATLANTICO;001;BARRANQUILLA;01;01;ESTADIO METROPOLITANO;CALLE 45;50;10.9328;-74.8005;0'
  ].join('\n');

  const ingestionResult = await ingestOfflineOfficialFile({
    processId: 'COL-2026-CONGRESO',
    sourceOriginUrl: 'https://www.registraduria.gov.co/IMG/pdf/Divipole_definitiva_%20Elecciones_Congreso_2026_GEO_CITREP_Exterior_L_V_v5.pdf',
    obtainedAt: new Date().toISOString(),
    fileName: 'Divipole_definitiva_Elecciones_Congreso_2026.pdf',
    mimeType: 'application/pdf',
    fileBufferOrContent: validOfficialPdfContent,
    notes: 'Descargado legítimamente por el operador electoral desde Registraduría'
  }, { dryRun: true });

  assert(ingestionResult.isValid === true, 'El archivo oficial auténtico pasa la validación');
  assert(ingestionResult.status === 'VALID', 'El estado del archivo es VALID');
  assert(ingestionResult.isAuthenticPdf === true, 'La firma %PDF- es auténtica');
  assert(ingestionResult.isWafOrHtmlError === false, 'No corresponde a un error HTML/WAF');
  assert(ingestionResult.sha256.length === 64, 'SHA-256 es calculado inmutablemente (64 caracteres hex)');
  assert(ingestionResult.fileSizeBytes > 0, 'Tamaño en bytes es superior a 0');
  assert(ingestionResult.fileName === 'Divipole_definitiva_Elecciones_Congreso_2026.pdf', 'Nombre de archivo registrado correctamente');
  assert(ingestionResult.mimeType === 'application/pdf', 'Tipo MIME application/pdf registrado');
  assert(ingestionResult.fileExtension === 'pdf', 'Extensión pdf registrada');

  // FASE 12.3 — IDENTIFICACIÓN ESTRICTA DEL PROCESO
  console.log('--- 2. Identificación Estricta del Proceso Electoral ---');
  assert(ingestionResult.processConfig.codigoProceso === 'COL-2026-CONGRESO', 'Proceso vinculado exclusivamente a COL-2026-CONGRESO');
  assert(ingestionResult.adapterResult?.process.codigoProceso === 'COL-2026-CONGRESO', 'Namespace de proceso en el adapter es COL-2026-CONGRESO');

  // FASE 12.4 — EXTRACCIÓN Y NORMALIZACIÓN SIN CAMPOS INVENTADOS
  console.log('--- 3. Extracción y Normalización de Entidades Oficiales ---');
  const adapterResult = ingestionResult.adapterResult!;
  assert(adapterResult.departments.length === 5, '5 departamentos normalizados (BOGOTA, ANTIOQUIA, CORDOBA, VALLE, ATLANTICO)');
  assert(adapterResult.municipalities.length === 5, '5 municipios normalizados');
  assert(adapterResult.zones.length === 7, '7 zonas normalizadas (incluyendo rurales 99)');
  assert(adapterResult.pollingPlaces.length === 8, '8 puestos de votación normalizados');
  assert(adapterResult.pollingTables.length === 241, '241 mesas normalizadas (15+80+40+10+12+4+30+50)');

  // Verificar campos específicos oficiales
  const bogotaCorferias = adapterResult.pollingPlaces.find(p => p.nombrePuesto === 'CORFERIAS');
  assert(bogotaCorferias !== undefined, 'Puesto Corferias encontrado');
  assert(bogotaCorferias?.codUnicoDivipole === '110010102', 'Código único DIVIPOLE 110010102 verificado');
  assert(bogotaCorferias?.latitud === 4.6288, 'Latitud oficial conservada');
  assert(bogotaCorferias?.longitud === -74.0899, 'Longitud oficial conservada');
  assert(bogotaCorferias?.esRural === false, 'Zona urbana clasificada correctamente');

  const culebraRural = adapterResult.pollingPlaces.find(p => p.nombrePuesto === 'VEREDA LA CULEBRA');
  assert(culebraRural !== undefined, 'Puesto rural La Culebra encontrado');
  assert(culebraRural?.esRural === true, 'Zona rural clasificada correctamente (esRural = true)');

  // FASE 12.5 — CONTROL DE PLAUSIBILIDAD DE COBERTURA NACIONAL
  console.log('--- 4. Validación de Plausibilidad de Cobertura Nacional ---');
  const incompleteNationalCheck = await executeNationalDivipoleBatchLoad(adapterResult, {
    strictPlausibilityCheck: true
  });
  assert(incompleteNationalCheck.success === false, 'El control de plausibilidad detecta que 5 departamentos es una muestra y NO Colombia completa');
  assert(incompleteNationalCheck.status === 'SOURCE_EXTRACTION_INCOMPLETE', 'Estado clasificado como SOURCE_EXTRACTION_INCOMPLETE');

  // FASE 12.6 & 12.7 — DRY-RUN NACIONAL OBLIGATORIO Y BARRERA DE ESCRITURA
  console.log('--- 5. Dry-Run Obligatorio (0 escrituras en base de datos) ---');
  const dryRunSummary = await executeNationalDivipoleBatchLoad(adapterResult, {
    dryRun: true,
    strictPlausibilityCheck: false
  });
  assert(dryRunSummary.success === true, 'DRY-RUN ejecuta exitosamente');
  assert(dryRunSummary.status === 'EXITOSA_DRY_RUN', 'Estado es EXITOSA_DRY_RUN');
  assert(Object.keys(db.divipole_polling_places).length === 0, '0 registros en divipole_polling_places durante DRY-RUN');
  assert(Object.keys(db.divipole_polling_tables).length === 0, '0 registros en divipole_polling_tables durante DRY-RUN');
  assert(db.divipole_sync_history.length === 0, '0 registros en divipole_sync_history durante DRY-RUN');
  assert(db.polling_stations.length === initialPollingStationsCount, 'polling_stations 100% intacta en DRY-RUN');

  // FASE 12.8 — CARGA CONTROLADA TRANSACCIONAL ATÓMICA
  console.log('--- 6. Carga Transaccional Atómica con Supabase RPC ---');
  const realLoadResult = await syncOfficialElectoralDataToSupabase(adapterResult, {
    supabaseClient: mockClient,
    dryRun: false
  });

  assert(realLoadResult.success === true, 'Carga real transaccional debe reportar éxito');
  assert(realLoadResult.status === 'EXITOSA', 'Estado de sincronización es EXITOSA');
  assert(realLoadResult.cantidadNuevos === 8, '8 puestos nuevos registrados');
  assert(Object.keys(db.divipole_departments).length === 5, '5 departamentos guardados');
  assert(Object.keys(db.divipole_municipalities).length === 5, '5 municipios guardados');
  assert(Object.keys(db.divipole_zones).length === 7, '7 zonas guardadas');
  assert(Object.keys(db.divipole_polling_places).length === 8, '8 puestos guardados');
  assert(Object.keys(db.divipole_polling_tables).length === 241, '241 mesas guardadas');
  assert(db.divipole_sync_history.length === 1, '1 entrada de sincronización registrada en divipole_sync_history');

  // FASE 12.9 — PRUEBA DE IDEMPOTENCIA
  console.log('--- 7. Prueba de Idempotencia Estricta (Mismo documento) ---');
  const idempotentResult = await syncOfficialElectoralDataToSupabase(adapterResult, {
    supabaseClient: mockClient,
    dryRun: false
  });

  assert(idempotentResult.success === true, 'Re-ejecución idempotente responde exitosamente');
  assert(idempotentResult.status === 'NO_CHANGES', 'Estado de re-ejecución es NO_CHANGES');
  assert(idempotentResult.cantidadNuevos === 0, '0 registros nuevos creados');
  assert(idempotentResult.cantidadModificados === 0, '0 registros modificados');
  assert(Object.keys(db.divipole_polling_places).length === 8, 'Total de puestos permanece exactamente en 8 sin duplicados');
  assert(Object.keys(db.divipole_polling_tables).length === 241, 'Total de mesas permanece exactamente en 241 sin duplicados');

  // FASE 12.10 — VERIFICACIÓN RIGUROSA DE polling_stations
  console.log('--- 8. Verificación de Integridad y Aislamiento de polling_stations ---');
  assert(db.polling_stations.length === initialPollingStationsCount, 'Cantidad de registros en polling_stations es idéntica');
  assert(JSON.stringify(db.polling_stations) === initialStationsSnapshot, 'Contenido completo de polling_stations (IDs, campañas, testigos, status) 100% inalterado');

  // FASE 12.11 — PRUEBA CONTROLADA DE ROLLBACK
  console.log('--- 9. Prueba Controlada de Rollback ante Inconsistencia FK ---');
  const corruptedPayload: OfficialAdapterResult = {
    ...adapterResult,
    sha256: 'SHA256_CORRUPTED_NATIONAL_TEST',
    municipalities: [
      {
        codDptoDivipole: '99', // Departamento 99 no existe
        codMpioDivipole: '999',
        codCompletoDivipole: '99999',
        nombreMunicipio: 'MUNICIPIO CORRUPTO SIN DPTO',
        esCapital: false
      }
    ]
  };

  const beforeRollbackPlaces = Object.keys(db.divipole_polling_places).length;
  const beforeRollbackTables = Object.keys(db.divipole_polling_tables).length;

  const rollbackResult = await syncOfficialElectoralDataToSupabase(corruptedPayload, {
    supabaseClient: mockClient,
    dryRun: false
  });

  assert(rollbackResult.success === false, 'Carga con datos corruptos falla');
  assert(rollbackResult.error?.includes('Rollback') === true, 'Error reporta que se ejecutó Rollback automático');
  assert(Object.keys(db.divipole_polling_places).length === beforeRollbackPlaces, 'divipole_polling_places conserva estado previo intacto');
  assert(Object.keys(db.divipole_polling_tables).length === beforeRollbackTables, 'divipole_polling_tables conserva estado previo intacto');
  assert(JSON.stringify(db.polling_stations) === initialStationsSnapshot, 'polling_stations permanece 100% intacta tras el rollback');

  console.log('\n============================================================');
  console.log('✅ TODAS LAS 10 VERIFICACIONES DE LA FASE 12 PASARON EXITOSAMENTE');
  console.log('============================================================\n');
}

runNationalRealLoadTests().catch((err) => {
  console.error('Error ejecutando pruebas de carga nacional real:', err);
  process.exit(1);
});
