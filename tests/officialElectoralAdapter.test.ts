/**
 * PRUEBAS UNITARIAS PARA EL ADAPTADOR OFICIAL DE LA REGISTRADURÍA (FASE 4)
 * Ejecutable mediante: npx tsx tests/officialElectoralAdapter.test.ts
 */

import {
  padLeft,
  cleanText,
  resolveHeaderKey,
  parseDelimitedTextToRows,
  normalizeDivipoleEntities
} from '../src/services/registraduria/divipoleAdapter';
import { parseCensusRows } from '../src/services/registraduria/censusAdapter';
import { calculateSha256 } from '../src/services/registraduria/sha256';
import {
  isHtmlOrBlockedContent,
  parseOfficialElectoralContent
} from '../src/services/registraduria/registraduriaOfficialAdapter';
import { ElectoralProcessConfig } from '../src/services/registraduria/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FALLÓ: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASÓ: ${message}`);
  }
}

async function runAllTests() {
  console.log('\n============================================================');
  console.log('EJECUTANDO SUITE DE PRUEBAS DEL ADAPTADOR OFICIAL REGISTRADURÍA');
  console.log('============================================================\n');

  const congresoProcess: ElectoralProcessConfig = {
    codigoProceso: 'COL-2026-CONGRESO',
    nombre: 'Elecciones Congreso 2026',
    tipoProceso: 'NACIONAL',
    anio: 2026,
    fechaEleccion: '2026-03-08',
    corporacionesHabilitadas: ['SENADO', 'CAMARA']
  };

  const territorialProcess: ElectoralProcessConfig = {
    codigoProceso: 'COL-2027-TERRITORIAL',
    nombre: 'Elecciones Territoriales 2027',
    tipoProceso: 'TERRITORIAL',
    anio: 2027,
    fechaEleccion: '2027-10-31',
    corporacionesHabilitadas: ['ALCALDIA', 'CONCEJO', 'GOBERNACION', 'ASAMBLEA', 'JAL']
  };

  // 1. Normalización de códigos con ceros a la izquierda
  assert(padLeft(1, 2) === '01', 'padLeft(1, 2) debe ser "01"');
  assert(padLeft('5', 3) === '005', 'padLeft("5", 3) debe ser "005"');
  assert(padLeft(23, 2) === '23', 'padLeft(23, 2) debe ser "23"');
  assert(padLeft('189', 3) === '189', 'padLeft("189", 3) debe ser "189"');

  // 2. Limpieza de texto y caracteres invisibles
  const textWithInvisible = '\uFEFF  I.E. Cotorra \u200B Sede Principal  ';
  assert(cleanText(textWithInvisible) === 'I.E. Cotorra Sede Principal', 'cleanText debe remover BOM y espacios extra');

  // 3. Resolución flexible de encabezados
  assert(resolveHeaderKey('COD_DPTO') === 'codDpto', 'COD_DPTO debe resolver a codDpto');
  assert(resolveHeaderKey('Código Municipio') === 'codMpio', 'Código Municipio debe resolver a codMpio');
  assert(resolveHeaderKey('Lugar de Votacion') === 'nombrePuesto', 'Lugar de Votacion debe resolver a nombrePuesto');
  assert(resolveHeaderKey('Nro Mesas') === 'mesas', 'Nro Mesas debe resolver a mesas');

  // 4. Cálculo SHA-256 Web Crypto
  const testString = 'REGISTRADURIA_DIVIPOLE_2026_TEST_STRING';
  const hash = await calculateSha256(testString);
  assert(typeof hash === 'string' && hash.length === 64, 'calculateSha256 debe generar un hex hash de 64 caracteres');

  // 5. Detección de bloqueos HTML / Cloudflare Challenge / Captcha
  const cloudflareHtml = '<!DOCTYPE html><html><head><title>Just a moment...</title></head><body>cf-browser-verification</body></html>';
  const blockCheck = isHtmlOrBlockedContent(cloudflareHtml);
  assert(blockCheck.isBlocked === true, 'isHtmlOrBlockedContent debe detectar desafío de protección Cloudflare');

  const error403Html = '<html><head><title>403 Forbidden</title></head></html>';
  assert(isHtmlOrBlockedContent(error403Html).isBlocked === true, 'isHtmlOrBlockedContent debe detectar 403 Forbidden');

  // 6. Parsing DIVIPOLE válido (CSV/Punto y coma)
  const sampleCsv = `COD_DPTO;DEPARTAMENTO;COD_MPIO;MUNICIPIO;COD_ZONA;COD_PUESTO;PUESTO;DIRECCION;MESAS
23;CORDOBA;189;COTORRA;01;01;I.E. COTORRA SEDE PRINCIPAL;CALLE 8 # 6-25;18
23;CORDOBA;189;COTORRA;99;01;I.E. TREMENTINO;PLAZA PRINCIPAL;10
05;ANTIOQUIA;001;MEDELLIN;01;01;COLEGIO MARCO FIDEL SUAREZ;CRA 50 # 52-25;28`;

  const parsedCsvResult = await parseOfficialElectoralContent(sampleCsv, 'https://test-registraduria.gov.co/divipole.csv', congresoProcess, 'DIVIPOLE');
  assert(parsedCsvResult.success === true, 'parseOfficialElectoralContent debe procesar con éxito el CSV oficial');
  assert(parsedCsvResult.departments.length === 2, 'Debe identificar 2 departamentos (Córdoba y Antioquia)');
  assert(parsedCsvResult.municipalities.length === 2, 'Debe identificar 2 municipios (Cotorra y Medellín)');
  assert(parsedCsvResult.pollingPlaces.length === 3, 'Debe identificar 3 puestos de votación');
  assert(parsedCsvResult.pollingPlaces[0].codUnicoDivipole === '231890101', 'El puesto 1 debe tener código único "231890101"');
  assert(parsedCsvResult.pollingPlaces[1].esRural === true, 'El puesto de la zona 99 debe marcarse como rural');
  assert(parsedCsvResult.pollingTables.length === (18 + 10 + 28), 'Las mesas generadas deben coincidir exactamente con la suma oficial (56 mesas)');

  // 7. Parsing Censo Electoral Oficial
  const sampleCenso = `COD_DPTO,DEPARTAMENTO,COD_MPIO,MUNICIPIO,HOMBRES,MUJERES,TOTAL_CENSO,FECHA_CORTE
23,CORDOBA,189,COTORRA,7500,7800,15300,2026-01-15
05,ANTIOQUIA,001,MEDELLIN,820000,910000,1730000,2026-01-15`;

  const parsedCensoResult = await parseOfficialElectoralContent(sampleCenso, 'https://test-registraduria.gov.co/censo.csv', territorialProcess, 'CENSO');
  assert(parsedCensoResult.success === true, 'parseOfficialElectoralContent debe procesar con éxito el censo oficial');
  assert(parsedCensoResult.census.length === 2, 'Debe identificar 2 registros de censo municipal');
  assert(parsedCensoResult.census[0].totalElectores === 15300, 'Conserva el total de electores oficial publicado (15300)');

  // 8. Detección de duplicados en la fuente
  const duplicateCsv = `COD_DPTO,DEPARTAMENTO,COD_MPIO,MUNICIPIO,COD_ZONA,COD_PUESTO,PUESTO,MESAS
23,CORDOBA,189,COTORRA,01,01,I.E. COTORRA SEDE PRINCIPAL,18
23,CORDOBA,189,COTORRA,01,01,I.E. COTORRA DUPLICADO,18`;

  const duplicateResult = await parseOfficialElectoralContent(duplicateCsv, 'https://test-registraduria.gov.co/dup.csv', congresoProcess, 'DIVIPOLE');
  assert(duplicateResult.pollingPlaces.length === 1, 'No debe duplicar puestos con el mismo código único DIVIPOLE');
  assert(duplicateResult.validation.errores.length > 0, 'Debe registrar advertencia/error de duplicado');

  console.log('\n============================================================');
  console.log('✅ TODAS LAS PRUEBAS DEL ADAPTADOR DE REGISTRADURÍA PASARON');
  console.log('============================================================\n');
}

runAllTests().catch((err) => {
  console.error('Error ejecutando pruebas:', err);
  process.exit(1);
});
