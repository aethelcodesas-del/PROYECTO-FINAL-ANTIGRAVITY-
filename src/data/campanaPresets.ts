import { CampanaDossier } from '../types/campana';

export const defaultCampanaDossier: CampanaDossier = {
  id: 'camp-principal-01',
  createdAt: '2026-08-26T00:00:00.000Z',
  updatedAt: '2026-08-26T00:00:00.000Z',
  
  // Section 1: Election & Jurisdiction
  tipoProcesoEleccion: 'Ordinaria',
  fechaEleccion: '2027-10-31',
  corporacion: 'Alcaldía',
  circunscripcionTerritorial: 'Municipio',
  departamento: '',
  municipio: '',
  modalidadCandidatura: 'Uninominal',
  posicionTarjeton: '01 / Casilla Principal',

  // Section 2: Candidate
  nombreCandidato: '',
  cedulaCandidato: '',
  seudonimoPolitico: '',
  profesionCandidato: '',
  telefonoCandidato: '',
  emailCandidato: '',
  fotoUrl: '',
  resumenVida: '',

  // Section 3: Endorsement
  modalidadAval: 'Partido',
  partidoUnico: 'Partido Liberal Colombiano',
  numeroAvalCNE: '',
  nombreGrupoFirmas: '',
  metaFirmas: 50000,
  radicadoRegistraduria: '',
  promotoresFirmas: '',
  nombreCoalicion: '',
  partidosCoalicion: [],
  partidoResponsableCNE: '',

  // Section 4: Schedule & Insurance
  horaApertura: '08:00',
  horaCierre: '16:00',
  polizaNumero: '',
  aseguradora: '',

  // Section 5: Official Team & Banking
  equipo: {
    gerenteNombre: '',
    gerenteCedula: '',
    gerenteTelefono: '',
    gerenteEmail: '',
    gerenteRegistroCNE: '',
    
    contadorNombre: '',
    contadorCedula: '',
    contadorTarjetaProfesional: '',
    contadorTelefono: '',
    contadorEmail: '',

    auditorNombre: '',
    auditorCedula: '',
    auditorTarjetaProfesional: '',
    auditorEmail: '',

    bancoNombre: '',
    bancoTipoCuenta: 'Corriente',
    bancoNumeroCuenta: '',
    bancoTitular: '',
    bancoFechaApertura: ''
  },

  // Section 6: Allied Campaigns
  campanasAliadas: []
};

export const campanaPlantillasPresets: CampanaDossier[] = [
  defaultCampanaDossier,
  {
    id: 'camp-gobernacion-antioquia-2027',
    createdAt: '2026-02-01T10:00:00.000Z',
    updatedAt: '2026-08-26T12:00:00.000Z',
    tipoProcesoEleccion: 'Ordinaria',
    fechaEleccion: '2027-10-31',
    corporacion: 'Gobernación',
    circunscripcionTerritorial: 'Departamento',
    departamento: 'Antioquia',
    municipio: '',
    modalidadCandidatura: 'Uninominal',
    posicionTarjeton: '02 / Casilla Departamental',
    nombreCandidato: 'Dra. Carolina Villegas Ramos',
    cedulaCandidato: '43.210.987',
    seudonimoPolitico: 'Carolina Villegas Gobernadora',
    profesionCandidato: 'Economista y Especialista en Finanzas Públicas',
    telefonoCandidato: '+57 314 789 0123',
    emailCandidato: 'carolina@antioquiaavanza.co',
    fotoUrl: '',
    resumenVida: 'Ex Secretaria de Hacienda Departamental con 15 años de experiencia liderando presupuestos públicos y desarrollo rural.',
    modalidadAval: 'Coalición',
    partidoUnico: 'Partido Conservador Colombiano',
    numeroAvalCNE: 'AVAL-CNE-2027-9912',
    nombreGrupoFirmas: '',
    metaFirmas: 120000,
    radicadoRegistraduria: 'REG-GOB-ANT-2027-019',
    promotoresFirmas: '',
    nombreCoalicion: 'Gran Alianza por Antioquia',
    partidosCoalicion: ['Partido Conservador Colombiano', 'Centro Democrático', 'Partido Cambio Radical'],
    partidoResponsableCNE: 'Partido Conservador Colombiano',
    horaApertura: '08:00',
    horaCierre: '16:00',
    polizaNumero: 'POL-GOB-9941-CNE',
    aseguradora: 'Seguros Bolívar S.A.',
    equipo: {
      gerenteNombre: 'Dr. Santiago Restrepo',
      gerenteCedula: '71.554.890',
      gerenteTelefono: '+57 310 998 1234',
      gerenteEmail: 'gerencia@antioquiaavanza.co',
      gerenteRegistroCNE: 'GER-CNE-GOB-009',
      contadorNombre: 'Dra. Claudia Marcela Hoyos',
      contadorCedula: '32.445.112',
      contadorTarjetaProfesional: 'TP-201944-T',
      contadorTelefono: '+57 312 445 6677',
      contadorEmail: 'contabilidad@antioquiaavanza.co',
      auditorNombre: 'Dr. Fernando Londoño',
      auditorCedula: '15.998.776',
      auditorTarjetaProfesional: 'TP-88741-T',
      auditorEmail: 'auditoria@antioquiaavanza.co',
      bancoNombre: 'Banco de Bogotá',
      bancoTipoCuenta: 'Corriente',
      bancoNumeroCuenta: '098-765432-10',
      bancoTitular: 'Campaña Carolina Villegas Gobernación Antioquia 2027',
      bancoFechaApertura: '2026-02-10'
    },
    campanasAliadas: [
      {
        id: 'aliada-asamblea-ant',
        corporacion: 'Asamblea',
        partidoOLista: 'Partido Conservador Colombiano',
        nombreLista: 'Lista Oficial Asamblea de Antioquia',
        modalidad: 'Lista Abierta',
        departamento: 'Antioquia',
        municipio: '',
        metaVotosEsperada: 110000,
        candidatos: [
          { id: 'c-as-1', numeroRenglon: 51, nombre: 'Dra. Andrea Lopera', cedula: '43.998.112', telefono: '+57 311 009 8877', email: 'andrea.lopera@asamblea.co', esCabeza: true },
          { id: 'c-as-2', numeroRenglon: 52, nombre: 'Dr. Mateo Zuleta', cedula: '71.443.221', telefono: '+57 312 334 5566', email: 'mateo.zuleta@asamblea.co', esCabeza: false }
        ]
      }
    ]
  },
  {
    id: 'camp-alcaldia-monteria-2027',
    createdAt: '2026-03-01T10:00:00.000Z',
    updatedAt: '2026-08-26T12:00:00.000Z',
    tipoProcesoEleccion: 'Ordinaria',
    fechaEleccion: '2027-10-31',
    corporacion: 'Alcaldía',
    circunscripcionTerritorial: 'Municipio',
    departamento: 'Córdoba',
    municipio: 'Montería (Capital)',
    modalidadCandidatura: 'Uninominal',
    posicionTarjeton: '01 / Casilla Municipal',
    nombreCandidato: 'Dr. Alejandro Doria',
    cedulaCandidato: '78.543.210',
    seudonimoPolitico: 'Alejandro Doria - Montería Crece',
    profesionCandidato: 'Ingeniero Civil y Especialista en Gestión Pública',
    telefonoCandidato: '+57 300 456 7890',
    emailCandidato: 'contacto@alejandrodoria.co',
    fotoUrl: '',
    resumenVida: 'Líder gremial y social con amplia experiencia en desarrollo urbano y proyectos sostenibles para Montería y Córdoba.',
    modalidadAval: 'Partido',
    partidoUnico: 'Partido Liberal Colombiano',
    numeroAvalCNE: 'AVAL-CNE-2027-1029',
    nombreGrupoFirmas: '',
    metaFirmas: 50000,
    radicadoRegistraduria: 'REG-ALC-MONT-2027-04',
    promotoresFirmas: '',
    nombreCoalicion: '',
    partidosCoalicion: ['Partido Liberal Colombiano'],
    partidoResponsableCNE: 'Partido Liberal Colombiano',
    horaApertura: '08:00',
    horaCierre: '16:00',
    polizaNumero: 'POL-MONT-2027-CNE',
    aseguradora: 'Seguros La Previsora S.A.',
    equipo: {
      gerenteNombre: 'Lic. Manuel De la Ossa',
      gerenteCedula: '78.990.123',
      gerenteTelefono: '+57 301 556 7788',
      gerenteEmail: 'gerencia@alejandrodoria.co',
      gerenteRegistroCNE: 'GER-CNE-COR-045',
      contadorNombre: 'Dra. María Elena Negrete',
      contadorCedula: '34.890.112',
      contadorTarjetaProfesional: 'TP-177890-T',
      contadorTelefono: '+57 300 889 0011',
      contadorEmail: 'contabilidad@alejandrodoria.co',
      auditorNombre: 'Dr. Carlos Pineda',
      auditorCedula: '10.998.443',
      auditorTarjetaProfesional: 'TP-66541-T',
      auditorEmail: 'auditoria@alejandrodoria.co',
      bancoNombre: 'Banco BBVA Colombia',
      bancoTipoCuenta: 'Ahorros',
      bancoNumeroCuenta: '0013-0499-881920',
      bancoTitular: 'Campaña Alejandro Doria Alcaldía Montería',
      bancoFechaApertura: '2026-03-05'
    },
    campanasAliadas: [
      {
        id: 'aliada-concejo-monteria',
        corporacion: 'Concejo',
        partidoOLista: 'Partido Liberal Colombiano',
        nombreLista: 'Lista al Concejo de Montería - Partido Liberal',
        modalidad: 'Lista Abierta',
        departamento: 'Córdoba',
        municipio: 'Montería (Capital)',
        metaVotosEsperada: 28000,
        candidatos: [
          { id: 'c-mon-1', numeroRenglon: 1, nombre: 'Dr. Víctor Julio Díaz', cedula: '78.112.334', telefono: '+57 300 112 3344', email: 'victor.diaz@concejo.co', esCabeza: true },
          { id: 'c-mon-2', numeroRenglon: 2, nombre: 'Dra. Paola Andrea Petro', cedula: '34.556.778', telefono: '+57 301 445 6677', email: 'paola.petro@concejo.co', esCabeza: false }
        ]
      }
    ]
  }
];
