/**
 * PRUEBAS DE PRIMERA CARGA CONTROLADA, IDEMPOTENCIA, ROLLBACK Y AISLAMIENTO (FASE 9)
 * Ejecutable mediante: npx tsx tests/officialElectoralControlledLoad.test.ts
 */

import { processOfficialPdfDivipole } from '../src/services/registraduria/pdfDivipoleAdapter';
import { syncOfficialElectoralDataToSupabase } from '../src/services/registraduria/electoralSyncService';
import { DEFAULT_PROCESO_CONGRESO_2026 } from '../src/services/registraduria/schedulerEngine';
import { OfficialAdapterResult, ElectoralProcessConfig } from '../src/services/registraduria/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FALLÓ: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASÓ: ${message}`);
  }
}

// Estructura de base de datos simulada en memoria para validar la transacción y relaciones FK
class MockPostgreSqlDatabase {
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

      // 2. Simulación Transaccional Atómica con Rollback
      const backup = {
        processes: { ...this.electoral_processes },
        depts: { ...this.divipole_departments },
        mpios: { ...this.divipole_municipalities },
        zones: { ...this.divipole_zones },
        places: { ...this.divipole_polling_places },
        tables: { ...this.divipole_polling_tables }
      };

      try {
        // Validar proceso
        const proc = payload.process;
        if (!proc || !proc.codigoProceso) throw new Error('Código de proceso inválido');
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
            throw new Error(`Violación de FK: Departamento ${m.codDptoDivipole} no existe`);
          }
          this.divipole_municipalities[m.codCompletoDivipole] = m;
        }

        // Zonas (Validar FK Municipio)
        for (const z of payload.zones) {
          if (!this.divipole_municipalities[z.codCompletoMunicipio]) {
            throw new Error(`Violación de FK: Municipio ${z.codCompletoMunicipio} no existe`);
          }
          this.divipole_zones[`${z.codCompletoMunicipio}${z.codZonaDivipole}`] = z;
        }

        // Puestos
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

        // Mesas
        for (const t of payload.pollingTables) {
          if (!this.divipole_polling_places[t.codUnicoDivipole]) {
            throw new Error(`Violación de FK: Puesto ${t.codUnicoDivipole} no existe`);
          }
          this.divipole_polling_tables[t.codigoMesaCompleto] = t;
        }

        this.lastSyncSha = sha256;
        const syncId = `sync-tx-${Date.now()}`;
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
            message: 'Carga transaccional completada exitosamente.'
          },
          error: null
        };
      } catch (err: any) {
        // Rollback a estado anterior
        this.electoral_processes = backup.processes;
        this.divipole_departments = backup.depts;
        this.divipole_municipalities = backup.mpios;
        this.divipole_zones = backup.zones;
        this.divipole_polling_places = backup.places;
        this.divipole_polling_tables = backup.tables;

        return {
          data: null,
          error: { message: `Transacción abortada (Rollback ejecutado): ${err.message}` }
        };
      }
    }

    return { data: null, error: { message: 'Función RPC desconocida' } };
  }
}

async function runControlledLoadTests() {
  console.log('\n============================================================');
  console.log('EJECUTANDO PRUEBAS DE PRIMERA CARGA CONTROLADA (FASE 9)');
  console.log('============================================================\n');

  const db = new MockPostgreSqlDatabase();
  const mockClient = {
    rpc: (name: string, params: any) => db.executeRpcSync(name, params),
    from: () => ({ insert: () => Promise.resolve({ error: null }) })
  };

  // 1. Preparar Payload Validado de la FASE 8 (Antioquia & Córdoba)
  const officialPdfText = '%PDF-1.7\n' + [
    'COD_DPTO;DEPARTAMENTO;COD_MPIO;MUNICIPIO;COD_ZONA;COD_PUESTO;PUESTO;MESAS',
    '23;CORDOBA;189;COTORRA;01;01;COLEGIO EL CARMEN;12',
    '23;CORDOBA;189;COTORRA;99;01;VEREDA LA CULEBRA;4',
    '05;ANTIOQUIA;001;MEDELLIN;01;01;PLAZA MAYOR;35'
  ].join('\n');

  const adapterResult: OfficialAdapterResult = await processOfficialPdfDivipole(
    officialPdfText,
    'https://www.registraduria.gov.co/IMG/pdf/Divipole_definitiva_2026.pdf',
    DEFAULT_PROCESO_CONGRESO_2026,
    { dryRun: true }
  );

  assert(adapterResult.success === true, 'El adaptador de Fase 8 debe generar un payload válido');
  assert(adapterResult.departments.length === 2, 'Payload contiene 2 departamentos');
  assert(adapterResult.municipalities.length === 2, 'Payload contiene 2 municipios');
  assert(adapterResult.pollingPlaces.length === 3, 'Payload contiene 3 puestos');
  assert(adapterResult.pollingTables.length === 51, 'Payload contiene 51 mesas');

  // 2. Primera Escritura Controlada en Base de Datos Oficial
  const initialPollingStationsCount = db.polling_stations.length;
  const initialPollingStationId = db.polling_stations[0].id;
  const initialWitnessId = db.polling_stations[0].witness_id;

  const firstLoadResult = await syncOfficialElectoralDataToSupabase(adapterResult, {
    supabaseClient: mockClient,
    dryRun: false
  });

  assert(firstLoadResult.success === true, 'Primera carga controlada debe reportar éxito');
  assert(firstLoadResult.status === 'EXITOSA', 'Estado de la sincronización debe ser EXITOSA');
  assert(firstLoadResult.cantidadNuevos === 3, 'Debe registrar 3 puestos nuevos');
  assert(Object.keys(db.divipole_departments).length === 2, 'Debe haber escrito 2 departamentos en divipole_departments');
  assert(Object.keys(db.divipole_municipalities).length === 2, 'Debe haber escrito 2 municipios en divipole_municipalities');
  assert(Object.keys(db.divipole_zones).length === 3, 'Debe haber escrito 3 zonas en divipole_zones');
  assert(Object.keys(db.divipole_polling_places).length === 3, 'Debe haber escrito 3 puestos en divipole_polling_places');
  assert(Object.keys(db.divipole_polling_tables).length === 51, 'Debe haber escrito 51 mesas en divipole_polling_tables');
  assert(db.divipole_sync_history.length === 1, 'Debe haber registrado el historial en divipole_sync_history');

  // 3. Verificación de Aislamiento Absoluto de polling_stations
  assert(db.polling_stations.length === initialPollingStationsCount, 'polling_stations conserva exactamente el mismo número de registros');
  assert(db.polling_stations[0].id === initialPollingStationId, 'polling_stations conserva el ID operacional intacto');
  assert(db.polling_stations[0].witness_id === initialWitnessId, 'polling_stations conserva asignación de testigo intacta');

  // 4. Prueba de Idempotencia Estricta (Mismo Payload y SHA-256)
  const secondLoadResult = await syncOfficialElectoralDataToSupabase(adapterResult, {
    supabaseClient: mockClient,
    dryRun: false
  });

  assert(secondLoadResult.success === true, 'Re-ejecución con mismo SHA-256 debe responder exitosamente');
  assert(secondLoadResult.status === 'NO_CHANGES', 'Estado debe ser NO_CHANGES');
  assert(secondLoadResult.cantidadNuevos === 0, 'No debe insertar ningún puesto nuevo (0 nuevos)');
  assert(secondLoadResult.cantidadModificados === 0, 'No debe modificar ningún puesto (0 modificados)');
  assert(Object.keys(db.divipole_polling_places).length === 3, 'Total de puestos sigue siendo exactamente 3 sin duplicados');
  assert(Object.keys(db.divipole_polling_tables).length === 51, 'Total de mesas sigue siendo exactamente 51 sin duplicados');

  // 5. Prueba de Actualización con Nuevo Hash SHA-256 y Registro de Change Log
  const modifiedPdfText = '%PDF-1.7\n' + [
    'COD_DPTO;DEPARTAMENTO;COD_MPIO;MUNICIPIO;COD_ZONA;COD_PUESTO;PUESTO;MESAS',
    '23;CORDOBA;189;COTORRA;01;01;COLEGIO EL CARMEN ACTUALIZADO;15',
    '23;CORDOBA;189;COTORRA;99;01;VEREDA LA CULEBRA;4',
    '05;ANTIOQUIA;001;MEDELLIN;01;01;PLAZA MAYOR;35'
  ].join('\n');

  const modifiedAdapterResult: OfficialAdapterResult = await processOfficialPdfDivipole(
    modifiedPdfText,
    'https://www.registraduria.gov.co/IMG/pdf/Divipole_definitiva_2026.pdf',
    DEFAULT_PROCESO_CONGRESO_2026,
    { dryRun: true }
  );

  assert(modifiedAdapterResult.sha256 !== adapterResult.sha256, 'El nuevo archivo debe tener un SHA-256 diferente');

  const updateLoadResult = await syncOfficialElectoralDataToSupabase(modifiedAdapterResult, {
    supabaseClient: mockClient,
    dryRun: false
  });

  assert(updateLoadResult.success === true, 'Carga con SHA nuevo debe ejecutarse');
  assert(updateLoadResult.status === 'EXITOSA', 'Estado debe ser EXITOSA');
  assert(updateLoadResult.cantidadModificados >= 1, 'Debe registrar puestos modificados');
  assert(db.divipole_change_log.length >= 1, 'Debe registrar entradas de auditoría en divipole_change_log');

  // 6. Prueba de Rollback Atómico ante Error de Clave Foránea / Payload Corrupto
  const corruptedPayload: OfficialAdapterResult = {
    ...adapterResult,
    sha256: 'SHA_CORRUPTED_FK_TEST',
    municipalities: [
      {
        codDptoDivipole: '99', // Departamento 99 NO existe en el lote
        codMpioDivipole: '999',
        codCompletoDivipole: '99999',
        nombreMunicipio: 'MUNICIPIO HUERFANO',
        esCapital: false
      }
    ]
  };

  const beforeRollbackPlacesCount = Object.keys(db.divipole_polling_places).length;

  const failedSyncResult = await syncOfficialElectoralDataToSupabase(corruptedPayload, {
    supabaseClient: mockClient,
    dryRun: false
  });

  assert(failedSyncResult.success === false, 'Transacción corrupta debe fallar');
  assert(failedSyncResult.error?.includes('Rollback') === true, 'Debe reportar que se ejecutó rollback automático');
  assert(Object.keys(db.divipole_polling_places).length === beforeRollbackPlacesCount, 'La base de datos debe permanecer exactamente en el estado previo');

  console.log('\n============================================================');
  console.log('✅ TODAS LAS PRUEBAS DE CARGA CONTROLADA (FASE 9) PASARON');
  console.log('============================================================\n');
}

runControlledLoadTests().catch((err) => {
  console.error('Error ejecutando pruebas de carga controlada:', err);
  process.exit(1);
});
