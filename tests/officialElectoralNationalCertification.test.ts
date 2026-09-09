/**
 * SUITE DE CERTIFICACIÓN Y CARGA NACIONAL COMPLETA DEL CATÁLOGO DIVIPOLE (FASE 13)
 * Proceso: COL-2026-CONGRESO
 * Ejecutable mediante: npx tsx tests/officialElectoralNationalCertification.test.ts
 */

import {
  certifyNationalDivipolePayload,
  executeNationalDivipoleBatchLoad,
  MIN_NATIONAL_PLAUSIBILITY_THRESHOLDS
} from '../src/services/registraduria/nationalDivipoleStagingService';
import { ingestOfflineOfficialFile } from '../src/services/registraduria/offlineOfficialFileIngestion';
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

// Base de datos transaccional simulada
class MockCertifiedSupabaseDatabase {
  public electoral_processes: Record<string, any> = {};
  public divipole_departments: Record<string, any> = {};
  public divipole_municipalities: Record<string, any> = {};
  public divipole_zones: Record<string, any> = {};
  public divipole_polling_places: Record<string, any> = {};
  public divipole_polling_tables: Record<string, any> = {};
  public divipole_sync_history: any[] = [];
  public divipole_change_log: any[] = [];

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

      // 1. Idempotencia
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

      // 2. Snapshot para Rollback
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
        if (!proc || !proc.codigoProceso) throw new Error('Código de proceso inválido.');
        this.electoral_processes[proc.codigoProceso] = proc;

        let nuevosPuestos = 0;
        let modificadosPuestos = 0;

        for (const d of payload.departments) {
          this.divipole_departments[d.codDptoDivipole] = d;
        }

        for (const m of payload.municipalities) {
          if (!this.divipole_departments[m.codDptoDivipole]) {
            throw new Error(`Violación de FK: Departamento ${m.codDptoDivipole} no existe`);
          }
          this.divipole_municipalities[m.codCompletoDivipole] = m;
        }

        for (const z of payload.zones) {
          if (!this.divipole_municipalities[z.codCompletoMunicipio]) {
            throw new Error(`Violación de FK: Municipio ${z.codCompletoMunicipio} no existe`);
          }
          this.divipole_zones[`${z.codCompletoMunicipio}${z.codZonaDivipole}`] = z;
        }

        for (const p of payload.pollingPlaces) {
          const codMpioComp = `${p.codDptoDivipole}${p.codMpioDivipole}`;
          if (!this.divipole_municipalities[codMpioComp]) {
            throw new Error(`Violación de FK: Municipio ${codMpioComp} no existe`);
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

        for (const t of payload.pollingTables) {
          if (!this.divipole_polling_places[t.codUnicoDivipole]) {
            throw new Error(`Violación de FK: Puesto ${t.codUnicoDivipole} no existe`);
          }
          this.divipole_polling_tables[t.codigoMesaCompleto] = t;
        }

        this.lastSyncSha = sha256;
        const syncId = `sync-cert-${Date.now()}`;
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
            message: 'Carga certificada completada exitosamente.'
          },
          error: null
        };
      } catch (err: any) {
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

async function runNationalCertificationTests() {
  console.log('\n============================================================');
  console.log('EJECUTANDO SUITE DE CERTIFICACIÓN NACIONAL DIVIPOLE (FASE 13)');
  console.log('============================================================\n');

  const db = new MockCertifiedSupabaseDatabase();
  const mockClient = {
    rpc: (name: string, params: any) => db.executeRpcSync(name, params),
    from: () => ({ insert: () => Promise.resolve({ error: null }) })
  };

  const initialStationsSnapshot = JSON.stringify(db.polling_stations);

  // 1. Detección de Falta de Archivo Completo (OFFICIAL_FULL_FILE_REQUIRED)
  console.log('--- 1. Validación de Disponibilidad de Archivo Nacional ---');
  const nullFileCert = certifyNationalDivipolePayload(null);
  assert(nullFileCert.certified === false, 'Sin archivo no se certifica la carga nacional');
  assert(nullFileCert.status === 'OFFICIAL_FULL_FILE_REQUIRED', 'Estado reporta OFFICIAL_FULL_FILE_REQUIRED');

  // 2. Detección de Archivo Parcial / Muestra (SOURCE_EXTRACTION_INCOMPLETE)
  console.log('--- 2. Detección y Rechazo de Lote Parcial como Catálogo Nacional ---');
  const partialPdfText = '%PDF-1.7\n' + [
    'COD_DPTO;DEPARTAMENTO;COD_MPIO;MUNICIPIO;COD_ZONA;COD_PUESTO;PUESTO;MESAS',
    '11;BOGOTA D.C.;001;BOGOTA, D.C.;01;01;PLAZA DE BOLIVAR;15',
    '05;ANTIOQUIA;001;MEDELLIN;01;01;PLAZA MAYOR;40',
    '23;CORDOBA;189;COTORRA;01;01;COLEGIO EL CARMEN;12',
    '76;VALLE DEL CAUCA;001;CALI;01;01;CAM CENTRO ADMINISTRATIVO;30',
    '08;ATLANTICO;001;BARRANQUILLA;01;01;ESTADIO METROPOLITANO;50'
  ].join('\n');

  const partialAdapterResult: OfficialAdapterResult = await processOfficialPdfDivipole(
    partialPdfText,
    'https://www.registraduria.gov.co/IMG/pdf/muestra_5_dptos.pdf',
    DEFAULT_PROCESO_CONGRESO_2026,
    { dryRun: true }
  );

  const partialCertResult = certifyNationalDivipolePayload(partialAdapterResult);
  assert(partialCertResult.certified === false, 'Lote de 5 departamentos no es certificado como nacional');
  assert(partialCertResult.status === 'SOURCE_EXTRACTION_INCOMPLETE', 'Estado clasificado como SOURCE_EXTRACTION_INCOMPLETE');
  assert(partialCertResult.departmentsCount === 5, 'Registra 5 departamentos detectados');

  // 3. Regla de Umbral de Seguridad Nacional
  console.log('--- 3. Verificación de Umbrales Mínimos Nacionales de Seguridad ---');
  assert(MIN_NATIONAL_PLAUSIBILITY_THRESHOLDS.MIN_DEPARTMENTS === 32, 'Umbral mínimo de departamentos = 32');
  assert(MIN_NATIONAL_PLAUSIBILITY_THRESHOLDS.MIN_MUNICIPALITIES === 1000, 'Umbral mínimo de municipios = 1000');
  assert(MIN_NATIONAL_PLAUSIBILITY_THRESHOLDS.MIN_POLLING_PLACES === 10000, 'Umbral mínimo de puestos = 10000');
  assert(MIN_NATIONAL_PLAUSIBILITY_THRESHOLDS.MIN_POLLING_TABLES === 100000, 'Umbral mínimo de mesas = 100000');

  // 4. Validación de Integridad de SHA-256 y Process ID
  console.log('--- 4. Validación Inmutable de SHA-256 y Process ID ---');
  const ingestionResult = await ingestOfflineOfficialFile({
    processId: 'COL-2026-CONGRESO',
    sourceOriginUrl: 'https://www.registraduria.gov.co/IMG/pdf/Divipole_definitiva_Elecciones_Congreso_2026.pdf',
    obtainedAt: new Date().toISOString(),
    fileName: 'Divipole_definitiva_Elecciones_Congreso_2026.pdf',
    fileBufferOrContent: partialPdfText
  }, { dryRun: true });

  assert(ingestionResult.isValid === true, 'El archivo entregado es sintácticamente válido');
  assert(ingestionResult.sha256.length === 64, 'SHA-256 es un hash hexadecimal inmutable de 64 caracteres');
  assert(ingestionResult.processConfig.codigoProceso === 'COL-2026-CONGRESO', 'Proceso estrictamente COL-2026-CONGRESO');

  // 5. Verificación de DRY-RUN Nacional (0 Modificaciones en Base de Datos)
  console.log('--- 5. Ejecución en DRY-RUN Nacional Obligatorio ---');
  const dryRunExecution = await executeNationalDivipoleBatchLoad(partialAdapterResult, {
    dryRun: true,
    strictPlausibilityCheck: false
  });
  assert(dryRunExecution.success === true, 'DRY-RUN ejecuta exitosamente');
  assert(dryRunExecution.status === 'EXITOSA_DRY_RUN', 'Estado es EXITOSA_DRY_RUN');
  assert(Object.keys(db.divipole_polling_places).length === 0, '0 puestos en base de datos en DRY-RUN');
  assert(Object.keys(db.divipole_polling_tables).length === 0, '0 mesas en base de datos en DRY-RUN');
  assert(db.divipole_sync_history.length === 0, '0 historiales creados en DRY-RUN');
  assert(JSON.stringify(db.polling_stations) === initialStationsSnapshot, 'polling_stations 100% intacta');

  // 6. Carga Transaccional Atómica con Supabase RPC
  console.log('--- 6. Carga Transaccional Atómica ---');
  const syncExecution = await syncOfficialElectoralDataToSupabase(partialAdapterResult, {
    supabaseClient: mockClient,
    dryRun: false
  });
  assert(syncExecution.success === true, 'Carga transaccional reporta éxito');
  assert(syncExecution.status === 'EXITOSA', 'Estado de sincronización es EXITOSA');
  assert(syncExecution.cantidadNuevos === 5, '5 puestos registrados');
  assert(Object.keys(db.divipole_departments).length === 5, '5 departamentos almacenados');
  assert(Object.keys(db.divipole_polling_tables).length === 147, '147 mesas almacenadas (15+40+12+30+50)');

  // 7. Prueba de Idempotencia Estricta
  console.log('--- 7. Prueba de Idempotencia Estricta ---');
  const idempotentSync = await syncOfficialElectoralDataToSupabase(partialAdapterResult, {
    supabaseClient: mockClient,
    dryRun: false
  });
  assert(idempotentSync.success === true, 'Re-ejecución idempotente responde exitosamente');
  assert(idempotentSync.status === 'NO_CHANGES', 'Estado debe ser NO_CHANGES');
  assert(idempotentSync.cantidadNuevos === 0, '0 nuevos puestos');
  assert(idempotentSync.cantidadModificados === 0, '0 puestos modificados');
  assert(Object.keys(db.divipole_polling_places).length === 5, 'Puestos totales conservados en 5 sin duplicados');

  // 8. Prueba de Rollback Atómico
  console.log('--- 8. Prueba de Rollback Atómico ante Error FK ---');
  const corruptedBatch: OfficialAdapterResult = {
    ...partialAdapterResult,
    sha256: 'SHA256_CORRUPTED_CERTIFICATION_TEST',
    municipalities: [
      {
        codDptoDivipole: '99',
        codMpioDivipole: '999',
        codCompletoDivipole: '99999',
        nombreMunicipio: 'MUNICIPIO INVALIDO',
        esCapital: false
      }
    ]
  };

  const rollbackSync = await syncOfficialElectoralDataToSupabase(corruptedBatch, {
    supabaseClient: mockClient,
    dryRun: false
  });
  assert(rollbackSync.success === false, 'Transacción corrupta falla');
  assert(rollbackSync.error?.includes('Rollback') === true, 'Reporta rollback ejecutado');
  assert(Object.keys(db.divipole_polling_places).length === 5, 'Base de datos restaurada intacta');

  // 9. Verificación de Protección Absoluta de polling_stations
  console.log('--- 9. Verificación de Protección de polling_stations ---');
  assert(JSON.stringify(db.polling_stations) === initialStationsSnapshot, 'polling_stations (IDs, campañas, testigos) permanece 100% inalterada');

  console.log('\n============================================================');
  console.log('✅ TODAS LAS 12 VERIFICACIONES DE LA FASE 13 PASARON');
  console.log('============================================================\n');
}

runNationalCertificationTests().catch((err) => {
  console.error('Error ejecutando pruebas de certificación nacional:', err);
  process.exit(1);
});
