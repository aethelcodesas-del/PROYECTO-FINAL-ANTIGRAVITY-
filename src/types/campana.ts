export interface CandidatoListaAliada {
  id: string;
  numeroRenglon: number;
  nombre: string;
  cedula: string;
  telefono: string;
  email: string;
  esCabeza: boolean;
  fotoUrl?: string;
}

export interface CampanaAliada {
  id: string;
  corporacion: 'Asamblea' | 'Concejo' | 'JAL';
  partidoOLista: string;
  nombreLista: string;
  modalidad: 'Lista Abierta' | 'Lista Cerrada';
  departamento: string;
  municipio: string;
  localidadComuna?: string;
  metaVotosEsperada: number;
  candidatos: CandidatoListaAliada[];
}

export interface EquipoOficialCampana {
  // Gerente de Campaña
  gerenteNombre: string;
  gerenteCedula: string;
  gerenteTelefono: string;
  gerenteEmail: string;
  gerenteRegistroCNE: string;

  // Contador Público Oficial
  contadorNombre: string;
  contadorCedula: string;
  contadorTarjetaProfesional: string;
  contadorTelefono: string;
  contadorEmail: string;

  // Auditor / Revisor Fiscal
  auditorNombre: string;
  auditorCedula: string;
  auditorTarjetaProfesional?: string;
  auditorEmail?: string;

  // Cuenta Bancaria Exclusiva de Campaña (Ley 1475/2011)
  bancoNombre: string;
  bancoTipoCuenta: 'Ahorros' | 'Corriente';
  bancoNumeroCuenta: string;
  bancoTitular: string;
  bancoFechaApertura: string;
}

export interface CampanaDossier {
  id: string;
  createdAt: string;
  updatedAt: string;
  
  // Parámetros Financieros & Tope CNE
  topeLegalCNE?: number;
  presupuesto_total?: number;
  legalSpendingLimit?: number;

  // Section 1: Election & Jurisdiction
  tipoProcesoEleccion: 'Ordinaria' | 'Atípica';
  fechaEleccion: string;
  corporacion: 'Gobernación' | 'Asamblea' | 'Alcaldía' | 'Concejo' | 'JAL';
  circunscripcionTerritorial: 'Municipio' | 'Departamento';
  departamento: string;
  municipio: string;
  modalidadCandidatura: 'Uninominal' | 'Lista Abierta' | 'Lista Cerrada';
  posicionTarjeton: string;

  // Parámetros específicos de Elección Atípica
  decretoConvocatoriaAtipica?: string;
  fechaDecretoAtipica?: string;
  motivoVacanciaAtipica?: string;
  periodoFinAtipica?: string;
  duracionCampanaDias?: number;

  // Parámetros específicos de Elección Ordinaria
  periodoCuatrenio?: string;
  faseProcesoOrdinario?: string;

  // Section 2: Candidate
  nombreCandidato: string;
  cedulaCandidato: string;
  seudonimoPolitico: string;
  profesionCandidato: string;
  telefonoCandidato: string;
  emailCandidato: string;
  fotoUrl: string;
  resumenVida: string;

  // Section 3: Endorsement
  modalidadAval: 'Partido' | 'Firmas' | 'Coalición';
  partidoUnico: string;
  numeroAvalCNE: string;
  nombreGrupoFirmas: string;
  metaFirmas: number;
  radicadoRegistraduria: string;
  promotoresFirmas: string;
  nombreCoalicion: string;
  partidosCoalicion: string[];
  partidoResponsableCNE: string;

  // Section 4: Schedule & Insurance
  horaApertura: string;
  horaCierre: string;
  polizaNumero: string;
  aseguradora: string;

  // Section 5: Official Team & Banking
  equipo: EquipoOficialCampana;

  // Section 6: Allied Campaigns
  campanasAliadas: CampanaAliada[];
}
