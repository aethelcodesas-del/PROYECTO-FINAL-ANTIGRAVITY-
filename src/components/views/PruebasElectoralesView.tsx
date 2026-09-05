import React, { useState, useEffect, useRef } from 'react';
import { useCampaignData } from '../../contexts/CampaignContext';
import { ViewMode, AuthUser } from '../../types';
import { 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Activity, 
  FileCheck, 
  FileText, 
  Users, 
  Settings, 
  Database, 
  Lock, 
  RefreshCw, 
  Play, 
  Check, 
  X, 
  Cpu, 
  Layers, 
  Wifi, 
  AlertCircle, 
  Terminal, 
  Fingerprint,
  Upload,
  ArrowRight,
  Shield,
  CornerDownRight,
  Maximize2
} from 'lucide-react';

interface PruebasElectoralesViewProps {
  onSelectView: (view: ViewMode) => void;
  authUser: AuthUser;
}

interface TestLog {
  timestamp: string;
  module: string;
  caseId: string;
  action: string;
  status: 'INFO' | 'SUCCESS' | 'WARNING' | 'ALERT' | 'ERROR';
  message: string;
  signature: string;
}

type TestStatus = 'PENDIENTE' | 'CORRIENDO' | 'APROBADO' | 'FALLIDO';

interface TestCase {
  id: string;
  title: string;
  precondition: string;
  steps: string[];
  expectedResult: string;
  status: TestStatus;
  module: 'DIVIPOLE' | 'PRECONTEO' | 'ESCRUTINIO' | 'SEGURIDAD';
}

export const PruebasElectoralesView: React.FC<PruebasElectoralesViewProps> = ({
  onSelectView,
  authUser
}) => {
  // Test cases state
  const [testCases, setTestCases] = useState<TestCase[]>([
    {
      id: 'TC-DIV-01',
      title: 'Carga y verificación de la DIVIPOLE',
      precondition: 'Archivo de DIVIPOLE cargado en la plataforma',
      steps: [
        'Ingresar como administrador.',
        'Importar tabla de puestos y mesas por municipio.',
        'Consultar mesa específica (ej. Mesa 1, Puesto X).'
      ],
      expectedResult: 'La estructura de mesas debe coincidir en cantidad, departamento y municipio sin duplicados.',
      status: 'PENDIENTE',
      module: 'DIVIPOLE'
    },
    {
      id: 'TC-DIV-02',
      title: 'Verificación de Inmutabilidad Hash',
      precondition: 'Hash de la DIVIPOLE congelado previo a la elección',
      steps: [
        'Generar la firma Hash (SHA-256) del archivo DIVIPOLE.',
        'Simular un intento de modificación en base de datos.',
        'Ejecutar script de validación de integridad.'
      ],
      expectedResult: 'El sistema debe alertar discrepancia si el hash difiere del valor registrado en la auditoría inicial.',
      status: 'PENDIENTE',
      module: 'DIVIPOLE'
    },
    {
      id: 'TC-PRE-01',
      title: 'Sumatoria y consistencia del E-14',
      precondition: 'Mesa habilitada para digitación',
      steps: [
        'Ingresar votos por candidato.',
        'Ingresar votos nulos y en blanco.',
        'Colocar un total de votos superior al censo de la mesa (350).'
      ],
      expectedResult: 'Bloqueo / Alerta: El sistema debe impedir el guardado o marcar el acta con inconsistencia por "exceso de votantes vs. censo de mesa".',
      status: 'PENDIENTE',
      module: 'PRECONTEO'
    },
    {
      id: 'TC-PRE-02',
      title: 'Transmisión del Formulario E-14 Digitalizado',
      precondition: 'Centro de recepción habilitado',
      steps: [
        'Cargar imagen escaneada del E-14.',
        'Digitar los valores de la mesa.',
        'Enviar el paquete de datos al servidor central.'
      ],
      expectedResult: 'Transmisión cifrada correcta, asignación de código de verificación y disponibilidad en la consola de preconteo en tiempo real.',
      status: 'PENDIENTE',
      module: 'PRECONTEO'
    },
    {
      id: 'TC-PRE-03',
      title: 'Doble Digitación (Verificación Ciega)',
      precondition: 'Módulo de doble captura activo',
      steps: [
        'El Digitador A ingresa los datos del E-14.',
        'El Digitador B (sin ver lo digitado por A) ingresa los mismos datos.',
        'Si hay discrepancia en un valor, el sistema solicita un tercer revisor.'
      ],
      expectedResult: 'El sistema identifica diferencias campo a campo y no consolida el acta hasta resolver la discrepancia.',
      status: 'PENDIENTE',
      module: 'PRECONTEO'
    },
    {
      id: 'TC-ESC-01',
      title: 'Cálculo de Cifra Repartidora y Umbral',
      precondition: 'Elección con votos consolidados',
      steps: [
        'Ingresar votación total válida.',
        'Aplicar el filtro de umbral constitucional (3% del total de votos válidos).',
        'Ejecutar algoritmo D\'Hondt / Cifra repartidora.'
      ],
      expectedResult: 'Asignación exacta de curules según la fórmula legal colombiana, excluyendo listas que no superen el umbral.',
      status: 'PENDIENTE',
      module: 'ESCRUTINIO'
    },
    {
      id: 'TC-ESC-02',
      title: 'Cuadre de Actas E-14 Clava vs. Escrutinio Municipal',
      precondition: 'Comisión escrutadora en sesión',
      steps: [
        'Cargar datos de escrutinio municipal.',
        'Comparar totales del Preconteo con el Escrutinio.',
        'Generar E-24 (Acta de consolidación).'
      ],
      expectedResult: 'Registrar las diferencias justificadas y actualizar los datos en el historial con trazabilidad completa del juez/clavero.',
      status: 'PENDIENTE',
      module: 'ESCRUTINIO'
    },
    {
      id: 'TC-SEC-01',
      title: 'Control de Accesos por Rol',
      precondition: 'Usuarios con roles (Transmisor, Clavero, Auditor, SuperAdmin)',
      steps: [
        'Iniciar sesión simulada como Transmisor.',
        'Intentar modificar una cifra en el módulo de Escrutinio Nacional.'
      ],
      expectedResult: 'Acceso denegado (HTTP 403 / Alerta de Permisos): Únicamente las comisiones escrutadoras autorizadas pueden modificar datos de escrutinio.',
      status: 'PENDIENTE',
      module: 'SEGURIDAD'
    },
    {
      id: 'TC-SEC-02',
      title: 'Prueba de Carga de Cierre de Mesas (4:00 PM)',
      precondition: 'Entorno de Staging configurado',
      steps: [
        'Simular envío simultáneo de 100,000 actas en un lapso de 15 minutos.',
        'Monitorear tiempo de respuesta e infraestructura.'
      ],
      expectedResult: 'Tiempo de respuesta en transmisión menor a 2 segundos; disponibilidad del servicio en 99.99% sin pérdida de datos.',
      status: 'PENDIENTE',
      module: 'SEGURIDAD'
    },
    {
      id: 'TC-SEC-03',
      title: 'Auditoría de Logs de Transacciones',
      precondition: 'Sistema en producción / simulación',
      steps: [
        'Modificar un registro de votación en simulación.',
        'Consultar el archivo syslog/audit log y verificar integridad criptográfica.'
      ],
      expectedResult: 'El log debe registrar: usuario, IP, hora exacta, valor anterior y valor nuevo con firma criptográfica (SHA-256) en cadena.',
      status: 'PENDIENTE',
      module: 'SEGURIDAD'
    }
  ]);

  const [selectedCaseId, setSelectedCaseId] = useState<string>('TC-DIV-01');
  const [logs, setLogs] = useState<TestLog[]>([]);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Checklist verification states
  const [checklist, setChecklist] = useState({
    codeIntegrity: { status: 'PENDIENTE', hash: 'SHA256-7fa8a2e1d0f8c3b9a02213e4f7a6b8c9d0e1f2a3' },
    dbZero: { status: 'PENDIENTE', votesCount: 15420 },
    failover: { status: 'PENDIENTE', activeNode: 'Nodo Principal (Bogotá - Central)' }
  });

  // Simulator workspaces variables
  // TC-DIV-01 variables
  const [divipoleLoaded, setDivipoleLoaded] = useState(false);
  const [divipoleQuery, setDivipoleQuery] = useState('');
  const [divipoleResults, setDivipoleResults] = useState<{ puesto: string; mesa: number; dpto: string; mpio: string }[]>([]);

  // TC-DIV-02 variables
  const [divipoleHash, setDivipoleHash] = useState('a8f5c889de83ac93710dbf038f07f9b8c2d5e3f4a9b8c7d6e5f4a3b2c1d0e9f8');
  const [dbTampered, setDbTampered] = useState(false);
  const [hashVerificationResult, setHashVerificationResult] = useState<string | null>(null);

  // TC-PRE-01 variables
  const [pre1Votes, setPre1Votes] = useState({ candA: 0, candB: 0, candC: 0, blanco: 0, nulo: 0 });
  const [pre1ExceededAlert, setPre1ExceededAlert] = useState(false);

  // TC-PRE-02 variables
  const [e14FileUploaded, setE14FileUploaded] = useState(false);
  const [transmissionStep, setTransmissionStep] = useState(0);
  const [transmissionCode, setTransmissionCode] = useState('');

  // TC-PRE-03 variables
  const [doubleDigitator, setDoubleDigitator] = useState({
    digitatorA: { candA: '', candB: '', blanco: '' },
    digitatorB: { candA: '', candB: '', blanco: '' },
    digitatorC: { candA: '', candB: '', blanco: '' },
    isCompleteA: false,
    isCompleteB: false,
    discrepancyFields: [] as string[],
    resolved: false
  });

  // TC-ESC-01 variables
  const [esc1Data, setEsc1Data] = useState({
    seats: 5,
    votes: {
      'Partido Liberal': 45000,
      'Partido Conservador': 32000,
      'Pacto Histórico': 28000,
      'Movimiento Nuevo': 2500 // Fails threshold of 3%
    },
    results: [] as { party: string; quotient: number; seats: number }[],
    totalValid: 0,
    threshold: 0,
    cifraRepartidora: 0
  });

  // TC-ESC-02 variables
  const [esc2Discrepancy, setEsc2Discrepancy] = useState({
    mesa: 'Mesa 12B - Kennedy',
    preconteo: 180,
    escrutinio: 185,
    resolved: false,
    judgeName: '',
    justification: '',
    e24Generated: false
  });

  // TC-SEC-01 variables
  const [sec1SimulatedRole, setSec1SimulatedRole] = useState<string>('transmisor');
  const [sec1Result, setSec1Result] = useState<{ code: number; message: string } | null>(null);

  // TC-SEC-02 variables
  const [sec2LoadTesting, setSec2LoadTesting] = useState(false);
  const [sec2Progress, setSec2Progress] = useState(0);
  const [sec2Metrics, setSec2Metrics] = useState({ processed: 0, latency: 0, availability: 100 });

  // TC-SEC-03 variables
  const [logIntegrityResult, setLogIntegrityResult] = useState<string | null>(null);

  // Auto-scroll logs
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Seed initial logs
  useEffect(() => {
    addLog('SISTEMA', 'INIT', 'Inicializando consola de aseguramiento de calidad (QA)', 'INFO', 'Consola de auditoría electoral activa. Esperando simulación.');
  }, []);

  const addLog = (module: string, caseId: string, action: string, status: TestLog['status'], message: string) => {
    const timestamp = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + '.' + String(Date.now() % 1000).padStart(3, '0');
    // Generate signature mock
    const randomHex = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    const signature = `0x${randomHex.toUpperCase()}`;

    const newLog: TestLog = {
      timestamp,
      module,
      caseId,
      action,
      status,
      message,
      signature
    };

    setLogs(prev => [...prev, newLog]);
  };

  const updateTestCaseStatus = (id: string, status: TestStatus) => {
    setTestCases(prev => prev.map(tc => tc.id === id ? { ...tc, status } : tc));
  };

  // DIVIPOLE TC-DIV-01 Simulator
  const runTC_DIV_01 = () => {
    updateTestCaseStatus('TC-DIV-01', 'CORRIENDO');
    addLog('DIVIPOLE', 'TC-DIV-01', 'IMPORT_START', 'INFO', 'Iniciando importación de la DIVIPOLE oficial Censo 2026.');
    
    setTimeout(() => {
      setDivipoleLoaded(true);
      const mockData = [
        { puesto: 'Colegio Lucrecio', mesa: 1, dpto: 'Antioquia', mpio: 'Medellín' },
        { puesto: 'Colegio Lucrecio', mesa: 2, dpto: 'Antioquia', mpio: 'Medellín' },
        { puesto: 'I.E. Marco Fidel Suárez', mesa: 5, dpto: 'Antioquia', mpio: 'Medellín' },
        { puesto: 'I.E. Marco Fidel Suárez', mesa: 6, dpto: 'Antioquia', mpio: 'Medellín' },
        { puesto: 'Inem José Félix de Restrepo', mesa: 12, dpto: 'Antioquia', mpio: 'Medellín' },
        { puesto: 'Colegio Kennedy Central', mesa: 1, dpto: 'Bogotá D.C.', mpio: 'Bogotá D.C.' },
        { puesto: 'Colegio Kennedy Central', mesa: 2, dpto: 'Bogotá D.C.', mpio: 'Bogotá D.C.' }
      ];
      setDivipoleResults(mockData);
      updateTestCaseStatus('TC-DIV-01', 'APROBADO');
      addLog('DIVIPOLE', 'TC-DIV-01', 'IMPORT_SUCCESS', 'SUCCESS', 'Carga exitosa: 12,515 puestos y 120,000 mesas verificadas sin duplicados.');
    }, 1500);
  };

  // Integrity checks TC-DIV-02 Simulator
  const runTC_DIV_02 = () => {
    updateTestCaseStatus('TC-DIV-02', 'CORRIENDO');
    addLog('DIVIPOLE', 'TC-DIV-02', 'HASH_CHECK_START', 'INFO', `Calculando hash de integridad SHA-256 en la base de datos de la DIVIPOLE.`);

    setTimeout(() => {
      if (dbTampered) {
        setHashVerificationResult('mismatch');
        updateTestCaseStatus('TC-DIV-02', 'FALLIDO');
        addLog('DIVIPOLE', 'TC-DIV-02', 'HASH_CHECK_FAIL', 'ALERT', '¡ALERTA DE SEGURIDAD! Modificación no autorizada en BD detectada. Hash difiere del valor registrado.');
      } else {
        setHashVerificationResult('match');
        updateTestCaseStatus('TC-DIV-02', 'APROBADO');
        addLog('DIVIPOLE', 'TC-DIV-02', 'HASH_CHECK_SUCCESS', 'SUCCESS', `Validación exitosa: El hash de la DIVIPOLE coincide con la firma inmutable de auditoría.`);
      }
    }, 1500);
  };

  const toggleDbTamper = () => {
    const nextTamper = !dbTampered;
    setDbTampered(nextTamper);
    setHashVerificationResult(null);
    if (nextTamper) {
      addLog('DIVIPOLE', 'TC-DIV-02', 'DB_TAMPER', 'WARNING', 'Simulación: Insertando mesa fantasma (Mesa 999) en tabla DIVIPOLE.');
    } else {
      addLog('DIVIPOLE', 'TC-DIV-02', 'DB_RESTORE', 'INFO', 'Simulación: Restaurando base de datos a su estado íntegro original.');
    }
  };

  // Consistencia E-14 TC-PRE-01 Simulator
  const handlePre1VotesChange = (field: keyof typeof pre1Votes, val: number) => {
    const updatedVotes = { ...pre1Votes, [field]: val };
    setPre1Votes(updatedVotes);
    
    const sum = updatedVotes.candA + updatedVotes.candB + updatedVotes.candC + updatedVotes.blanco + updatedVotes.nulo;
    if (sum > 350) {
      setPre1ExceededAlert(true);
    } else {
      setPre1ExceededAlert(false);
    }
  };

  const saveTC_PRE_01 = () => {
    updateTestCaseStatus('TC-PRE-01', 'CORRIENDO');
    const total = pre1Votes.candA + pre1Votes.candB + pre1Votes.candC + pre1Votes.blanco + pre1Votes.nulo;
    addLog('PRECONTEO', 'TC-PRE-01', 'SAVE_ATTEMPT', 'INFO', `Intentando guardar acta de escrutinio con total de ${total} votos (Censo: 350).`);

    setTimeout(() => {
      if (total > 350) {
        updateTestCaseStatus('TC-PRE-01', 'APROBADO'); // Passed because it SUCCESSFULLY blocked it
        addLog('PRECONTEO', 'TC-PRE-01', 'BLOCK_SUCCESS', 'SUCCESS', `Bloqueo exitoso: El sistema impidió el guardado de ${total} votos por exceso de votantes.`);
      } else {
        updateTestCaseStatus('TC-PRE-01', 'APROBADO');
        addLog('PRECONTEO', 'TC-PRE-01', 'SAVE_SUCCESS', 'SUCCESS', `Guardado correcto: Votos consistentes (${total} votos).`);
      }
    }, 1200);
  };

  // Digital Transmission TC-PRE-02 Simulator
  const runTC_PRE_02 = () => {
    if (!e14FileUploaded) {
      alert('Por favor, "cargue" la imagen escaneada del E-14 primero.');
      return;
    }
    updateTestCaseStatus('TC-PRE-02', 'CORRIENDO');
    setTransmissionStep(1);
    addLog('PRECONTEO', 'TC-PRE-02', 'TX_INIT', 'INFO', 'Iniciando transmisión segura de Formulario E-14 digitalizado.');

    setTimeout(() => {
      setTransmissionStep(2);
      addLog('PRECONTEO', 'TC-PRE-02', 'OCR_ANALYSIS', 'INFO', 'Ejecutando algoritmo de visión OCR electoral. Valores extraídos.');
      
      setTimeout(() => {
        setTransmissionStep(3);
        addLog('PRECONTEO', 'TC-PRE-02', 'ENCRYPT_PACK', 'INFO', 'Cifrando paquete con algoritmo AES-256 + firma RSA.');
        
        setTimeout(() => {
          setTransmissionStep(4);
          const generatedCode = `CR-E14-MED-${Math.floor(1000 + Math.random() * 9000)}`;
          setTransmissionCode(generatedCode);
          updateTestCaseStatus('TC-PRE-02', 'APROBADO');
          addLog('PRECONTEO', 'TC-PRE-02', 'TX_SUCCESS', 'SUCCESS', `Transmisión cifrada exitosa. Código de verificación asignado: ${generatedCode}.`);
        }, 1200);
      }, 1000);
    }, 1000);
  };

  // Doble Digitación TC-PRE-03 Simulator
  const runDobleDigitacionSim = () => {
    updateTestCaseStatus('TC-PRE-03', 'CORRIENDO');
    addLog('PRECONTEO', 'TC-PRE-03', 'DOUBLE_DIGIT_START', 'INFO', 'Simulando doble captura ciega de Formulario E-14.');
    
    // Fill Digitador A
    setDoubleDigitator(prev => ({
      ...prev,
      digitatorA: { candA: '145', candB: '90', blanco: '15' },
      isCompleteA: true
    }));
    addLog('PRECONTEO', 'TC-PRE-03', 'CAPT_A_COMPLETE', 'INFO', 'Digitador A finaliza ingreso de datos.');

    setTimeout(() => {
      // Fill Digitador B with discrepancy
      setDoubleDigitator(prev => ({
        ...prev,
        digitatorB: { candA: '145', candB: '92', blanco: '15' }, // candB differs (90 vs 92)
        isCompleteB: true,
        discrepancyFields: ['candB']
      }));
      addLog('PRECONTEO', 'TC-PRE-03', 'DISCREPANCY_DETECTED', 'WARNING', 'Verificación ciega: Diferencia encontrada en campo [Candidato B] (A: 90, B: 92). Requerida verificación de tercer revisor.');
    }, 1200);
  };

  const resolveDobleDigitacion = (correctVal: string) => {
    setDoubleDigitator(prev => ({
      ...prev,
      digitatorC: { candA: '145', candB: correctVal, blanco: '15' },
      resolved: true
    }));
    
    updateTestCaseStatus('TC-PRE-03', 'APROBADO');
    addLog('PRECONTEO', 'TC-PRE-03', 'RESOLVED_SUCCESS', 'SUCCESS', `Tercer revisor resolvió discrepancia en Candidato B = ${correctVal}. Acta consolidada con éxito.`);
  };

  // Cifra Repartidora TC-ESC-01 Simulator
  const runTC_ESC_01 = () => {
    updateTestCaseStatus('TC-ESC-01', 'CORRIENDO');
    addLog('ESCRUTINIO', 'TC-ESC-01', 'CALC_START', 'INFO', 'Iniciando cálculo de Umbral y Cifra Repartidora electoral.');

    const totalValid = (Object.values(esc1Data.votes) as number[]).reduce((a, b) => a + b, 0);
    const threshold = Math.round(totalValid * 0.03); // 3% Colombian Threshold
    addLog('ESCRUTINIO', 'TC-ESC-01', 'THRESHOLD_CALC', 'INFO', `Umbral constitucional (3%): ${threshold.toLocaleString()} votos.`);

    // Filter parties exceeding threshold
    const qualifiedParties = (Object.entries(esc1Data.votes) as [string, number][]).filter(([_, votes]) => votes >= threshold);
    const excludedParties = (Object.entries(esc1Data.votes) as [string, number][]).filter(([_, votes]) => votes < threshold);
    
    excludedParties.forEach(([party, votes]) => {
      addLog('ESCRUTINIO', 'TC-ESC-01', 'EXCLUDED_PARTY', 'WARNING', `Lista "${party}" excluida por no alcanzar el umbral (${votes.toLocaleString()} votos).`);
    });

    setTimeout(() => {
      // D'Hondt Seat Allocation
      const quotients: { party: string; q: number }[] = [];
      qualifiedParties.forEach(([party, votes]) => {
        for (let i = 1; i <= esc1Data.seats; i++) {
          quotients.push({ party, q: votes / i });
        }
      });

      // Sort quotients descending
      quotients.sort((a, b) => b.q - a.q);
      
      // Get the quotients that win seats (top seats amount)
      const winningQuotients = quotients.slice(0, esc1Data.seats);
      const cifraRepartidora = winningQuotients[winningQuotients.length - 1].q;

      // Count seats per party
      const seatCounts: Record<string, number> = {};
      qualifiedParties.forEach(([party]) => {
        seatCounts[party] = 0;
      });
      winningQuotients.forEach(wq => {
        seatCounts[wq.party] = (seatCounts[wq.party] || 0) + 1;
      });

      const results = (Object.entries(esc1Data.votes) as [string, number][]).map(([party, votes]) => ({
        party,
        quotient: votes,
        seats: seatCounts[party] || 0
      }));

      setEsc1Data(prev => ({
        ...prev,
        totalValid,
        threshold,
        cifraRepartidora,
        results
      }));

      updateTestCaseStatus('TC-ESC-01', 'APROBADO');
      addLog('ESCRUTINIO', 'TC-ESC-01', 'CALC_SUCCESS', 'SUCCESS', `Cifra repartidora establecida en ${cifraRepartidora.toLocaleString()}. Curules asignados correctamente.`);
    }, 1500);
  };

  // Escrutinio Municipal TC-ESC-02 Simulator
  const resolveTC_ESC_02 = () => {
    if (!esc2Discrepancy.judgeName || !esc2Discrepancy.justification) {
      alert('Por favor, ingrese el nombre del Juez y la justificación legal de la corrección.');
      return;
    }
    updateTestCaseStatus('TC-ESC-02', 'CORRIENDO');
    addLog('ESCRUTINIO', 'TC-ESC-02', 'CORRECTION_INIT', 'INFO', `Registrando cuadre de actas para ${esc2Discrepancy.mesa}.`);

    setTimeout(() => {
      setEsc2Discrepancy(prev => ({
        ...prev,
        resolved: true,
        e24Generated: true
      }));
      updateTestCaseStatus('TC-ESC-02', 'APROBADO');
      addLog('ESCRUTINIO', 'TC-ESC-02', 'E24_GENERATED', 'SUCCESS', `Formulario E-24 generado. Corrección autorizada por ${esc2Discrepancy.judgeName}: "${esc2Discrepancy.justification}"`);
    }, 1200);
  };

  // Control Acceso Rol TC-SEC-01 Simulator
  const runTC_SEC_01 = () => {
    updateTestCaseStatus('TC-SEC-01', 'CORRIENDO');
    addLog('SEGURIDAD', 'TC-SEC-01', 'AUTH_CHECK', 'INFO', `Petición POST /api/escrutinio/update por parte del usuario con rol [${sec1SimulatedRole.toUpperCase()}].`);

    setTimeout(() => {
      if (sec1SimulatedRole === 'transmisor') {
        setSec1Result({
          code: 403,
          message: 'HTTP 403 Forbidden: Acceso denegado. Únicamente las comisiones escrutadoras autorizadas pueden modificar datos de escrutinio.'
        });
        updateTestCaseStatus('TC-SEC-01', 'APROBADO'); // Test passed because access was successfully blocked
        addLog('SEGURIDAD', 'TC-SEC-01', 'DENIED_LOGGED', 'SUCCESS', 'Simulación de seguridad: El sistema bloqueó correctamente al Transmisor y guardó la auditoría.');
      } else {
        setSec1Result({
          code: 200,
          message: 'HTTP 200 OK: Operación autorizada con éxito. Datos del Escrutinio Nacional actualizados.'
        });
        updateTestCaseStatus('TC-SEC-01', 'APROBADO');
        addLog('SEGURIDAD', 'TC-SEC-01', 'GRANTED_LOGGED', 'SUCCESS', `Acceso concedido para rol ${sec1SimulatedRole.toUpperCase()}. Registro actualizado.`);
      }
    }, 1200);
  };

  // Load testing TC-SEC-02 Simulator
  const runTC_SEC_02 = () => {
    updateTestCaseStatus('TC-SEC-02', 'CORRIENDO');
    setSec2LoadTesting(true);
    setSec2Progress(0);
    addLog('SEGURIDAD', 'TC-SEC-02', 'LOAD_TEST_START', 'INFO', 'Iniciando simulación de estrés de cierre de mesas. Flujo estimado: 100,000 actas en 15 mins.');

    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += 10;
      setSec2Progress(currentProgress);
      
      const processed = Math.round((currentProgress / 100) * 100000);
      const latency = parseFloat((0.8 + Math.random() * 0.7).toFixed(2)); // latency < 2s
      const availability = Math.random() > 0.05 ? 99.99 : 99.98;

      setSec2Metrics({
        processed,
        latency,
        availability
      });

      addLog('SEGURIDAD', 'TC-SEC-02', 'STRESS_TICK', 'INFO', `Envío simultáneo: ${processed.toLocaleString()} actas transmitidas. Latencia media: ${latency}s.`);

      if (currentProgress >= 100) {
        clearInterval(interval);
        setSec2LoadTesting(false);
        updateTestCaseStatus('TC-SEC-02', 'APROBADO');
        addLog('SEGURIDAD', 'TC-SEC-02', 'LOAD_TEST_SUCCESS', 'SUCCESS', 'Prueba de Carga exitosa: 100,000 actas procesadas en staging sin pérdida de datos. Latencia < 2s.');
      }
    }, 1000);
  };

  // Audit Logs TC-SEC-03 Simulator
  const runTC_SEC_03 = () => {
    updateTestCaseStatus('TC-SEC-03', 'CORRIENDO');
    addLog('SEGURIDAD', 'TC-SEC-03', 'AUDIT_INTEGRITY_CHECK', 'INFO', 'Ejecutando script de validación de hashes encadenados en registros de auditoría.');

    setTimeout(() => {
      setLogIntegrityResult('integro');
      updateTestCaseStatus('TC-SEC-03', 'APROBADO');
      addLog('SEGURIDAD', 'TC-SEC-03', 'AUDIT_INTEGRITY_SUCCESS', 'SUCCESS', 'Auditoría validada: Todos los registros del syslog contienen firma criptográfica SHA-256 enlazada de forma inmutable.');
    }, 1500);
  };

  // Reset all simulations
  const resetAllSimulations = () => {
    setTestCases(prev => prev.map(tc => ({ ...tc, status: 'PENDIENTE' })));
    setLogs([]);
    setDivipoleLoaded(false);
    setDivipoleResults([]);
    setDbTampered(false);
    setHashVerificationResult(null);
    setPre1Votes({ candA: 0, candB: 0, candC: 0, blanco: 0, nulo: 0 });
    setPre1ExceededAlert(false);
    setE14FileUploaded(false);
    setTransmissionStep(0);
    setTransmissionCode('');
    setDoubleDigitator({
      digitatorA: { candA: '', candB: '', blanco: '' },
      digitatorB: { candA: '', candB: '', blanco: '' },
      digitatorC: { candA: '', candB: '', blanco: '' },
      isCompleteA: false,
      isCompleteB: false,
      discrepancyFields: [],
      resolved: false
    });
    setEsc1Data({
      seats: 5,
      votes: {
        'Partido Liberal': 45000,
        'Partido Conservador': 32000,
        'Pacto Histórico': 28000,
        'Movimiento Nuevo': 2500
      },
      results: [],
      totalValid: 0,
      threshold: 0,
      cifraRepartidora: 0
    });
    setEsc2Discrepancy({
      mesa: 'Mesa 12B - Kennedy',
      preconteo: 180,
      escrutinio: 185,
      resolved: false,
      judgeName: '',
      justification: '',
      e24Generated: false
    });
    setSec1Result(null);
    setSec2Metrics({ processed: 0, latency: 0, availability: 100 });
    setSec2Progress(0);
    setLogIntegrityResult(null);
    
    // Checklist reset
    setChecklist({
      codeIntegrity: { status: 'PENDIENTE', hash: 'SHA256-7fa8a2e1d0f8c3b9a02213e4f7a6b8c9d0e1f2a3' },
      dbZero: { status: 'PENDIENTE', votesCount: 15420 },
      failover: { status: 'PENDIENTE', activeNode: 'Nodo Principal (Bogotá - Central)' }
    });

    addLog('SISTEMA', 'INIT', 'RESET_SIMULATOR', 'WARNING', 'Simulador reiniciado a valores de fábrica. Base de datos y estados de prueba limpiados.');
  };

  // Interactive Checklist execution
  const runChecklistAction = (item: 'codeIntegrity' | 'dbZero' | 'failover') => {
    if (item === 'codeIntegrity') {
      setChecklist(prev => ({
        ...prev,
        codeIntegrity: { ...prev.codeIntegrity, status: 'VERIFICANDO' }
      }));
      addLog('SISTEMA', 'CHECKLIST', 'CODE_INTEGRITY_RUN', 'INFO', 'Calculando hash SHA-256 de bundles webpack/vite en producción.');
      
      setTimeout(() => {
        setChecklist(prev => ({
          ...prev,
          codeIntegrity: { ...prev.codeIntegrity, status: 'APROBADO' }
        }));
        addLog('SISTEMA', 'CHECKLIST', 'CODE_INTEGRITY_SUCCESS', 'SUCCESS', `Firma del código fuente inmutable verificada con éxito: ${checklist.codeIntegrity.hash}`);
      }, 1200);
    } else if (item === 'dbZero') {
      setChecklist(prev => ({
        ...prev,
        dbZero: { ...prev.dbZero, status: 'VERIFICANDO' }
      }));
      addLog('SISTEMA', 'CHECKLIST', 'DB_ZERO_RUN', 'INFO', 'Comprobando registros activos de preconteo en base de datos central.');
      
      setTimeout(() => {
        setChecklist(prev => ({
          ...prev,
          dbZero: { ...prev.dbZero, status: 'APROBADO', votesCount: 0 }
        }));
        addLog('SISTEMA', 'CHECKLIST', 'DB_ZERO_SUCCESS', 'SUCCESS', 'Base de datos completamente en CERO (0) votos antes del inicio formal.');
      }, 1200);
    } else if (item === 'failover') {
      setChecklist(prev => ({
        ...prev,
        failover: { ...prev.failover, status: 'VERIFICANDO' }
      }));
      addLog('SISTEMA', 'CHECKLIST', 'FAILOVER_TEST', 'WARNING', 'Simulando corte físico del Datacenter Principal de Bogotá...');
      
      setTimeout(() => {
        setChecklist(prev => ({
          ...prev,
          failover: { ...prev.failover, status: 'APROBADO', activeNode: 'Nodo Secundario (Medellín - Backup) [FAILOVER ACTIVE]' }
        }));
        addLog('SISTEMA', 'CHECKLIST', 'FAILOVER_SUCCESS', 'SUCCESS', 'Failover exitoso: Conmutación al Datacenter secundario completada en 2.8 segundos. Pérdida de paquetes: 0%.');
      }, 1500);
    }
  };

  const getStatusColor = (status: TestStatus) => {
    switch (status) {
      case 'APROBADO': return 'bg-emerald-950 text-emerald-400 border border-emerald-500/40';
      case 'FALLIDO': return 'bg-rose-950 text-rose-400 border border-rose-500/40';
      case 'CORRIENDO': return 'bg-cyan-950 text-cyan-300 border border-cyan-500/40 animate-pulse';
      default: return 'bg-slate-900 text-slate-400 border border-slate-700/50';
    }
  };

  const currentTestCase = testCases.find(tc => tc.id === selectedCaseId);

  return (
    <div className="min-h-[calc(100vh-60px)] bg-[#030712] bg-circuit-pattern text-slate-100 p-4 md:p-8 space-y-6">
      
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-cyan-500/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight uppercase flex items-center gap-2">
              <span>Aseguramiento de Calidad (QA) Electoral</span>
              <span className="text-xs bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-2 py-0.5 rounded font-mono">Colombia CNE/RNEC</span>
            </h2>
            <p className="text-xs text-cyan-300/70">
              Matriz de Pruebas y Simulador de Procesos para DIVIPOLE, E-14, Cifra Repartidora y Seguridad CNE.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={resetAllSimulations}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0c223f] border border-cyan-500/30 text-xs font-semibold text-cyan-300 hover:bg-cyan-900/40 hover:text-white transition-all cursor-pointer shadow-md"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reiniciar Simulador</span>
          </button>
        </div>
      </div>

      {/* Overview Cards Row */}
      <div className="functional-grid grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#0c203b] border border-cyan-500/20 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">Total Casos de Prueba</span>
          <span className="text-3xl font-black text-white mt-1">{testCases.length}</span>
        </div>
        <div className="bg-[#0c203b] border border-cyan-500/20 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Pruebas Aprobadas</span>
          <span className="text-3xl font-black text-emerald-400 mt-1">
            {testCases.filter(t => t.status === 'APROBADO').length}
          </span>
        </div>
        <div className="bg-[#0c203b] border border-cyan-500/20 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider">Pruebas Fallidas</span>
          <span className="text-3xl font-black text-rose-400 mt-1">
            {testCases.filter(t => t.status === 'FALLIDO').length}
          </span>
        </div>
        <div className="bg-[#0c203b] border border-cyan-500/20 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Pendientes de Ejecución</span>
          <span className="text-3xl font-black text-slate-400 mt-1">
            {testCases.filter(t => t.status === 'PENDIENTE').length}
          </span>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="functional-grid grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Test Cases Selection List */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-[#0c203b] border border-cyan-500/30 rounded-3xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2">
              <h3 className="text-sm font-bold text-cyan-200 tracking-wider uppercase">
                Matriz de Casos de Prueba
              </h3>
              <span className="text-[10px] text-cyan-400 font-mono">QA-MATRIX-v1.0</span>
            </div>

            <div className="space-y-3.5 overflow-y-auto max-h-[500px] pr-2 custom-scrollbar">
              {['DIVIPOLE', 'PRECONTEO', 'ESCRUTINIO', 'SEGURIDAD'].map(modName => {
                const modCases = testCases.filter(tc => tc.module === modName);
                if (modCases.length === 0) return null;
                return (
                  <div key={modName} className="space-y-1.5">
                    <p className="text-[10px] font-black tracking-wider text-cyan-400 uppercase px-1">
                      Módulo: {modName === 'DIVIPOLE' ? 'DIVIPOLE y Censo' : modName === 'PRECONTEO' ? 'Captura y Preconteo' : modName === 'ESCRUTINIO' ? 'Escrutinios y Consolidación' : 'Seguridad e Integridad'}
                    </p>
                    <div className="space-y-1">
                      {modCases.map(tc => {
                        const isSelected = selectedCaseId === tc.id;
                        return (
                          <div
                            key={tc.id}
                            onClick={() => setSelectedCaseId(tc.id)}
                            className={`p-3 rounded-2xl border text-xs cursor-pointer transition-all flex items-start justify-between gap-3 ${
                              isSelected 
                                ? 'bg-[#0f2d54] border-cyan-400 text-white shadow-md' 
                                : 'bg-[#08172e]/70 border-cyan-500/10 text-slate-300 hover:border-cyan-500/30'
                            }`}
                          >
                            <div className="space-y-1 overflow-hidden">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-cyan-300">{tc.id}</span>
                                <span className="font-bold truncate text-[11px]">{tc.title}</span>
                              </div>
                              <p className="text-[10px] text-slate-400 truncate">{tc.expectedResult}</p>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold shrink-0 ${getStatusColor(tc.status)}`}>
                              {tc.status}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Verification Checklist */}
          <div className="bg-[#0c203b] border border-cyan-500/30 rounded-3xl p-5 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-cyan-200 tracking-wider uppercase border-b border-cyan-500/20 pb-2">
              Checklist de Verificación Final
            </h3>
            
            <div className="space-y-3.5 text-xs">
              {/* Item 1 */}
              <div className="flex items-start justify-between p-3 rounded-2xl bg-[#08172e]/60 border border-cyan-500/10">
                <div className="space-y-1 max-w-[70%]">
                  <div className="font-bold text-slate-200 flex items-center gap-1.5">
                    <span>1. Inmutabilidad de Código</span>
                    {checklist.codeIntegrity.status === 'APROBADO' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                  </div>
                  <p className="text-[10px] text-slate-400">Firmas Hash (SHA-256) antes y después del simulacro.</p>
                  <p className="text-[9px] text-cyan-400/70 font-mono truncate">{checklist.codeIntegrity.hash}</p>
                </div>
                <button
                  disabled={checklist.codeIntegrity.status === 'VERIFICANDO'}
                  onClick={() => runChecklistAction('codeIntegrity')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                    checklist.codeIntegrity.status === 'APROBADO'
                      ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30'
                      : 'bg-cyan-950 text-cyan-300 border-cyan-500/40 hover:bg-cyan-800'
                  }`}
                >
                  {checklist.codeIntegrity.status === 'VERIFICANDO' ? 'Verificando...' : checklist.codeIntegrity.status === 'APROBADO' ? 'Verificado' : 'Validar'}
                </button>
              </div>

              {/* Item 2 */}
              <div className="flex items-start justify-between p-3 rounded-2xl bg-[#08172e]/60 border border-cyan-500/10">
                <div className="space-y-1 max-w-[70%]">
                  <div className="font-bold text-slate-200 flex items-center gap-1.5">
                    <span>2. Inserción Cero en BD</span>
                    {checklist.dbZero.status === 'APROBADO' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                  </div>
                  <p className="text-[10px] text-slate-400">Garantizar base de datos en 0 votos antes de escrutinios.</p>
                  <p className="text-[9px] text-amber-400/80 font-mono">
                    Votos detectados: {checklist.dbZero.votesCount}
                  </p>
                </div>
                <button
                  disabled={checklist.dbZero.status === 'VERIFICANDO'}
                  onClick={() => runChecklistAction('dbZero')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                    checklist.dbZero.status === 'APROBADO'
                      ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30'
                      : 'bg-cyan-950 text-cyan-300 border-cyan-500/40 hover:bg-cyan-800'
                  }`}
                >
                  {checklist.dbZero.status === 'VERIFICANDO' ? 'Limpiando...' : checklist.dbZero.status === 'APROBADO' ? 'Puesto a 0' : 'Puesta a Cero'}
                </button>
              </div>

              {/* Item 3 */}
              <div className="flex items-start justify-between p-3 rounded-2xl bg-[#08172e]/60 border border-cyan-500/10">
                <div className="space-y-1 max-w-[70%]">
                  <div className="font-bold text-slate-200 flex items-center gap-1.5">
                    <span>3. Plan de Contingencia (Failover)</span>
                    {checklist.failover.status === 'APROBADO' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                  </div>
                  <p className="text-[10px] text-slate-400">Cambio a servidor secundario en caso de caída principal.</p>
                  <p className="text-[9px] text-cyan-400/70 font-mono truncate">{checklist.failover.activeNode}</p>
                </div>
                <button
                  disabled={checklist.failover.status === 'VERIFICANDO'}
                  onClick={() => runChecklistAction('failover')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                    checklist.failover.status === 'APROBADO'
                      ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30'
                      : 'bg-cyan-950 text-cyan-300 border-cyan-500/40 hover:bg-cyan-800'
                  }`}
                >
                  {checklist.failover.status === 'VERIFICANDO' ? 'Conmutando...' : checklist.failover.status === 'APROBADO' ? 'Activo Backup' : 'Probar Failover'}
                </button>
              </div>

            </div>
          </div>
        </div>

        {/* Right Side: Active Test Execution Workspace */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Active Case Header Details */}
          {currentTestCase && (
            <div className="bg-[#0c203b] border border-cyan-500/30 rounded-3xl p-6 shadow-xl space-y-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-cyan-500/20 pb-3">
                <div>
                  <span className="font-mono text-cyan-400 font-bold tracking-wider text-xs">{currentTestCase.id}</span>
                  <h3 className="text-lg font-black text-white">{currentTestCase.title}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-xl text-xs font-black ${getStatusColor(currentTestCase.status)}`}>
                    {currentTestCase.status}
                  </span>
                </div>
              </div>

              {/* Case Specifications */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="bg-[#07172e] p-3.5 rounded-2xl border border-cyan-500/10 space-y-1">
                  <span className="text-[10px] text-cyan-400 uppercase font-black">Precondición:</span>
                  <p className="text-slate-300 font-medium leading-relaxed">{currentTestCase.precondition}</p>
                </div>
                <div className="bg-[#07172e] p-3.5 rounded-2xl border border-cyan-500/10 space-y-1">
                  <span className="text-[10px] text-cyan-400 uppercase font-black">Resultado Esperado:</span>
                  <p className="text-slate-300 font-medium leading-relaxed">{currentTestCase.expectedResult}</p>
                </div>
              </div>

              {/* Step list */}
              <div className="space-y-2">
                <span className="text-[10px] text-cyan-400 uppercase font-black tracking-wider">Pasos de Ejecución:</span>
                <ol className="list-decimal list-inside text-xs text-slate-300 space-y-1.5 pl-1.5 font-medium">
                  {currentTestCase.steps.map((st, idx) => (
                    <li key={idx} className="leading-relaxed">{st}</li>
                  ))}
                </ol>
              </div>

              {/* Interactive workspace divider */}
              <div className="border-t border-cyan-500/15 pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Play className="w-4 h-4 text-cyan-400 animate-pulse" />
                  <span className="text-xs text-cyan-200 font-bold uppercase tracking-wider">Espacio de Trabajo del Simulador</span>
                </div>

                {/* WORKSPACE RENDERING */}

                {/* 1. TC-DIV-01 (Carga DIVIPOLE) Workspace */}
                {currentTestCase.id === 'TC-DIV-01' && (
                  <div className="bg-[#08172e]/60 rounded-2xl p-4 border border-cyan-500/15 space-y-4">
                    {!divipoleLoaded ? (
                      <div className="text-center py-6 space-y-4">
                        <p className="text-xs text-slate-400">Importación de tabla nacional de departamentos, municipios, puestos y mesas.</p>
                        <button
                          onClick={runTC_DIV_01}
                          className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-950/50 flex items-center gap-2 mx-auto cursor-pointer"
                        >
                          <Upload className="w-4 h-4" />
                          <span>Importar Archivo DIVIPOLE.csv</span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-semibold bg-emerald-950/40 border border-emerald-500/20 p-2.5 rounded-xl">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Estructura de DIVIPOLE cargada con éxito. Verificada consistencia (0 duplicados).</span>
                        </div>

                        {/* Search Input */}
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={divipoleQuery}
                            onChange={(e) => setDivipoleQuery(e.target.value)}
                            placeholder="Buscar puesto o municipio..."
                            className="bg-[#050f20] border border-cyan-500/20 text-xs text-white rounded-xl px-3 py-1.5 w-full focus:outline-none focus:border-cyan-400"
                          />
                        </div>

                        {/* Rendered Mock Grid */}
                        <div className="overflow-x-auto rounded-xl border border-cyan-500/10">
                          <table className="w-full text-[11px] text-left">
                            <thead>
                              <tr className="bg-[#0c203b] text-cyan-300 font-bold border-b border-cyan-500/20">
                                <th className="p-2">Departamento</th>
                                <th className="p-2">Municipio</th>
                                <th className="p-2">Puesto</th>
                                <th className="p-2">Mesa</th>
                              </tr>
                            </thead>
                            <tbody>
                              {divipoleResults
                                .filter(item => 
                                  item.puesto.toLowerCase().includes(divipoleQuery.toLowerCase()) || 
                                  item.mpio.toLowerCase().includes(divipoleQuery.toLowerCase())
                                )
                                .map((item, idx) => (
                                  <tr key={idx} className="border-b border-cyan-500/5 text-slate-200">
                                    <td className="p-2 font-medium">{item.dpto}</td>
                                    <td className="p-2">{item.mpio}</td>
                                    <td className="p-2">{item.puesto}</td>
                                    <td className="p-2 font-mono text-cyan-300 font-bold">Mesa {item.mesa}</td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. TC-DIV-02 (Integridad Hash) Workspace */}
                {currentTestCase.id === 'TC-DIV-02' && (
                  <div className="bg-[#08172e]/60 rounded-2xl p-4 border border-cyan-500/15 space-y-4 text-xs">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center bg-[#050f20] p-2.5 rounded-xl border border-cyan-500/10">
                        <span className="text-slate-400 font-bold">Hash Inicial Oficial (SHA-256):</span>
                        <code className="text-[10px] text-cyan-300 font-mono truncate max-w-[50%]">{divipoleHash.slice(0, 32)}...</code>
                      </div>
                      <div className="flex justify-between items-center bg-[#050f20] p-2.5 rounded-xl border border-cyan-500/10">
                        <span className="text-slate-400 font-bold">Simulación Hack / Alteración BD:</span>
                        <button
                          onClick={toggleDbTamper}
                          className={`px-3 py-1 rounded-lg font-bold border transition-colors ${
                            dbTampered 
                              ? 'bg-rose-950 text-rose-300 border-rose-500/40 hover:bg-rose-900'
                              : 'bg-slate-900 text-slate-400 border-slate-700/50 hover:bg-slate-800'
                          }`}
                        >
                          {dbTampered ? 'Alteración Inyectada (Tampered)' : 'Base de Datos Íntegra'}
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={runTC_DIV_02}
                      className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                    >
                      <Shield className="w-4 h-4" />
                      <span>Ejecutar Verificación de Integridad</span>
                    </button>

                    {/* Result */}
                    {hashVerificationResult && (
                      <div className={`p-4 rounded-2xl border ${
                        hashVerificationResult === 'match'
                          ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                          : 'bg-rose-950/40 border-rose-500/30 text-rose-300 animate-pulse'
                      }`}>
                        {hashVerificationResult === 'match' ? (
                          <div className="flex items-start gap-2.5">
                            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-bold">VERIFICACIÓN EXITOSA (HASH MATCH)</p>
                              <p className="text-[10px] opacity-80 mt-0.5">El valor SHA-256 de la DIVIPOLE cargada coincide exactamente con el hash auditado inicialmente. Base de datos inmutable.</p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-2.5">
                            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5 animate-bounce" />
                            <div>
                              <p className="font-bold">¡ALERTA DE SEGURIDAD! DISCREPANCIA DETECTADA</p>
                              <p className="text-[10px] opacity-80 mt-0.5">El hash calculado en base de datos difiere de la firma inmutable. Se ha detectado una alteración no registrada en los registros de mesas.</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* 3. TC-PRE-01 (Consistencia E-14) Workspace */}
                {currentTestCase.id === 'TC-PRE-01' && (
                  <div className="bg-[#08172e]/60 rounded-2xl p-4 border border-cyan-500/15 space-y-4 text-xs">
                    <div className="flex items-center justify-between border-b border-cyan-500/10 pb-1.5">
                      <span className="font-bold text-slate-300">Digitación de Votos - Mesa 5, Puesto X</span>
                      <span className="text-[11px] bg-slate-900 border border-slate-700 text-slate-300 px-2 py-0.5 rounded font-bold font-mono">Censo de Mesa: 350</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
                      <div>
                        <label className="text-[10px] text-slate-400 font-bold block mb-1">Candidato A</label>
                        <input
                          type="number"
                          value={pre1Votes.candA}
                          onChange={(e) => handlePre1VotesChange('candA', parseInt(e.target.value) || 0)}
                          className="bg-[#050f20] border border-cyan-500/20 text-xs text-white rounded-xl px-3 py-1.5 w-full focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 font-bold block mb-1">Candidato B</label>
                        <input
                          type="number"
                          value={pre1Votes.candB}
                          onChange={(e) => handlePre1VotesChange('candB', parseInt(e.target.value) || 0)}
                          className="bg-[#050f20] border border-cyan-500/20 text-xs text-white rounded-xl px-3 py-1.5 w-full focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 font-bold block mb-1">Candidato C</label>
                        <input
                          type="number"
                          value={pre1Votes.candC}
                          onChange={(e) => handlePre1VotesChange('candC', parseInt(e.target.value) || 0)}
                          className="bg-[#050f20] border border-cyan-500/20 text-xs text-white rounded-xl px-3 py-1.5 w-full focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 font-bold block mb-1">En Blanco</label>
                        <input
                          type="number"
                          value={pre1Votes.blanco}
                          onChange={(e) => handlePre1VotesChange('blanco', parseInt(e.target.value) || 0)}
                          className="bg-[#050f20] border border-cyan-500/20 text-xs text-white rounded-xl px-3 py-1.5 w-full focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 font-bold block mb-1">Votos Nulos</label>
                        <input
                          type="number"
                          value={pre1Votes.nulo}
                          onChange={(e) => handlePre1VotesChange('nulo', parseInt(e.target.value) || 0)}
                          className="bg-[#050f20] border border-cyan-500/20 text-xs text-white rounded-xl px-3 py-1.5 w-full focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                    </div>

                    {/* Math verification */}
                    <div className="flex justify-between items-center bg-[#050f20] p-3 rounded-xl border border-cyan-500/10">
                      <span className="font-bold text-slate-400">Total Votos Registrados:</span>
                      <span className={`text-sm font-extrabold ${pre1ExceededAlert ? 'text-rose-400 font-mono' : 'text-emerald-400 font-mono'}`}>
                        {pre1Votes.candA + pre1Votes.candB + pre1Votes.candC + pre1Votes.blanco + pre1Votes.nulo} / 350
                      </span>
                    </div>

                    {/* Exceeded Block Alert */}
                    {pre1ExceededAlert && (
                      <div className="p-3 bg-rose-950/40 border border-rose-500/30 text-rose-300 rounded-xl flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold uppercase text-[11px]">Bloqueo por Inconsistencia (Exceso de Votos)</p>
                          <p className="text-[10px] opacity-85 mt-0.5">El total de votos sumados excede el censo electoral permitido de la mesa (350). El sistema impide el guardado formal del acta.</p>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={saveTC_PRE_01}
                      className={`w-full py-2 rounded-xl font-bold transition-all shadow-md cursor-pointer ${
                        pre1ExceededAlert
                          ? 'bg-rose-950/50 border border-rose-500/30 text-rose-400 cursor-not-allowed hover:bg-rose-900/10'
                          : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white'
                      }`}
                    >
                      {pre1ExceededAlert ? 'Corregir Datos (Guardado Bloqueado)' : 'Validar y Guardar Formulario E-14'}
                    </button>
                  </div>
                )}

                {/* 4. TC-PRE-02 (Transmisión E-14 OCR) Workspace */}
                {currentTestCase.id === 'TC-PRE-02' && (
                  <div className="bg-[#08172e]/60 rounded-2xl p-4 border border-cyan-500/15 space-y-4 text-xs">
                    <div className="flex flex-col sm:flex-row items-center gap-4 bg-[#050f20] p-4 rounded-2xl border border-cyan-500/10">
                      
                      {/* Stylized File Upload Simulation */}
                      <div className="w-full sm:w-1/3 flex flex-col items-center justify-center p-4 border-2 border-dashed border-cyan-500/20 rounded-xl bg-slate-900/40 hover:bg-slate-900/80 transition-all cursor-pointer"
                           onClick={() => {
                             setE14FileUploaded(true);
                             addLog('PRECONTEO', 'TC-PRE-02', 'FILE_LOAD', 'INFO', 'Archivo escaneado "E14_MESA_5.png" cargado en el buffer temporal.');
                           }}>
                        <Upload className="w-6 h-6 text-cyan-400 mb-2" />
                        <span className="text-[10px] font-bold text-slate-300">
                          {e14FileUploaded ? 'E14_MESA_5.png' : 'Simular Carga de Acta'}
                        </span>
                        <span className="text-[9px] text-slate-400 mt-0.5">Formatos JPG/PNG</span>
                      </div>

                      <div className="w-full sm:w-2/3 space-y-2">
                        <span className="text-[10px] text-cyan-400 font-bold uppercase">Estado de la Transmisión:</span>
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <div className={`p-1.5 rounded border ${transmissionStep >= 1 ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>
                            1. Imagen E-14 Cargada
                          </div>
                          <div className={`p-1.5 rounded border ${transmissionStep >= 2 ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>
                            2. Reconocimiento OCR
                          </div>
                          <div className={`p-1.5 rounded border ${transmissionStep >= 3 ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>
                            3. Cifrado AES-256
                          </div>
                          <div className={`p-1.5 rounded border ${transmissionStep >= 4 ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>
                            4. Transmitido OK
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={runTC_PRE_02}
                      className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                    >
                      <Fingerprint className="w-4 h-4" />
                      <span>Transmitir Acta al Servidor Central</span>
                    </button>

                    {/* Receipt Output */}
                    {transmissionCode && (
                      <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 rounded-xl space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-bold uppercase text-[10px]">RECIBO DE TRANSMISIÓN GENERADO:</span>
                          <span className="bg-emerald-900 border border-emerald-400/40 text-[9px] px-2 py-0.5 rounded font-mono font-bold text-emerald-200">{transmissionCode}</span>
                        </div>
                        <p className="text-[10px] opacity-80 leading-relaxed">
                          La firma SHA-256 coincide. Los datos ingresaron de forma inmutable a la base de datos de preconteo y se encuentran listos para visualización en tiempo real.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* 5. TC-PRE-03 (Doble Digitación) Workspace */}
                {currentTestCase.id === 'TC-PRE-03' && (
                  <div className="bg-[#08172e]/60 rounded-2xl p-4 border border-cyan-500/15 space-y-4 text-xs">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Digitador A */}
                      <div className="bg-[#050f20] p-3 rounded-2xl border border-cyan-500/10 space-y-2">
                        <p className="font-bold text-cyan-300 border-b border-cyan-500/10 pb-1 flex items-center justify-between">
                          <span>Digitador A (Captura 1)</span>
                          {doubleDigitator.isCompleteA && <span className="text-[10px] text-emerald-400">Capturado</span>}
                        </p>
                        <div className="space-y-1 text-[11px] text-slate-300">
                          <div>Candidato A: <span className="font-bold text-white">{doubleDigitator.digitatorA.candA || '-'}</span></div>
                          <div>Candidato B: <span className="font-bold text-white">{doubleDigitator.digitatorA.candB || '-'}</span></div>
                          <div>Blanco: <span className="font-bold text-white">{doubleDigitator.digitatorA.blanco || '-'}</span></div>
                        </div>
                      </div>

                      {/* Digitador B */}
                      <div className="bg-[#050f20] p-3 rounded-2xl border border-cyan-500/10 space-y-2">
                        <p className="font-bold text-cyan-300 border-b border-cyan-500/10 pb-1 flex items-center justify-between">
                          <span>Digitador B (Captura 2)</span>
                          {doubleDigitator.isCompleteB && <span className="text-[10px] text-emerald-400">Capturado</span>}
                        </p>
                        <div className="space-y-1 text-[11px] text-slate-300">
                          <div>Candidato A: <span className="font-bold text-white">{doubleDigitator.digitatorB.candA || '-'}</span></div>
                          <div className={doubleDigitator.discrepancyFields.includes('candB') ? 'text-rose-300 font-bold bg-rose-950/20 px-1 rounded' : ''}>
                            Candidato B: <span className="font-bold text-white">{doubleDigitator.digitatorB.candB || '-'}</span>
                          </div>
                          <div>Blanco: <span className="font-bold text-white">{doubleDigitator.digitatorB.blanco || '-'}</span></div>
                        </div>
                      </div>
                    </div>

                    {!doubleDigitator.isCompleteA ? (
                      <button
                        onClick={runDobleDigitacionSim}
                        className="w-full py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl cursor-pointer"
                      >
                        Iniciar Simulación de Doble Captura Ciega
                      </button>
                    ) : (
                      <div className="space-y-3">
                        {doubleDigitator.discrepancyFields.length > 0 && !doubleDigitator.resolved && (
                          <div className="p-3 bg-rose-950/40 border border-rose-500/30 text-rose-300 rounded-xl space-y-2.5">
                            <div className="flex items-center gap-1.5">
                              <AlertTriangle className="w-4 h-4 text-rose-400" />
                              <span className="font-bold">DISCREPANCIA DETECTADA: [Candidato B]</span>
                            </div>
                            <p className="text-[10px] opacity-90 leading-relaxed">
                              El Digitador A reportó <strong>90 votos</strong> y el Digitador B reportó <strong>92 votos</strong>. El sistema bloqueó la consolidación automática. Es requerida la intervención ciega de un Tercer Digitador Revisor.
                            </p>
                            
                            {/* Revisor Resolutor Interface */}
                            <div className="border-t border-rose-500/20 pt-2.5 space-y-2">
                              <p className="text-[10px] text-slate-300 font-bold uppercase">Digitador C (Tercer Revisor) - Seleccione valor correcto de la imagen física:</p>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => resolveDobleDigitacion('90')}
                                  className="flex-1 py-1.5 bg-slate-900 border border-cyan-500/30 rounded-lg font-bold text-cyan-300 hover:bg-slate-800"
                                >
                                  Resolver a 90 (Valor A)
                                </button>
                                <button
                                  onClick={() => resolveDobleDigitacion('92')}
                                  className="flex-1 py-1.5 bg-slate-900 border border-cyan-500/30 rounded-lg font-bold text-cyan-300 hover:bg-slate-800"
                                >
                                  Resolver a 92 (Valor B)
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {doubleDigitator.resolved && (
                          <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 rounded-xl flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>Acta consolidada con éxito. Discrepancia resuelta: Candidato B = {doubleDigitator.digitatorC.candB}.</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* 6. TC-ESC-01 (Cifra Repartidora) Workspace */}
                {currentTestCase.id === 'TC-ESC-01' && (
                  <div className="bg-[#08172e]/60 rounded-2xl p-4 border border-cyan-500/15 space-y-4 text-xs">
                    <div className="flex flex-col sm:flex-row gap-4">
                      
                      {/* Input Votaciones */}
                      <div className="w-full sm:w-1/2 space-y-2.5">
                        <div className="flex justify-between items-center border-b border-cyan-500/10 pb-1">
                          <span className="font-bold text-slate-300">Votos por Lista</span>
                          <span className="text-[10px] text-cyan-400 font-bold">Total Curules: {esc1Data.seats}</span>
                        </div>
                        
                        {Object.entries(esc1Data.votes).map(([party, votes]) => (
                          <div key={party} className="flex items-center justify-between gap-2">
                            <span className="text-[11px] text-slate-300 truncate w-1/2">{party}</span>
                            <input
                              type="number"
                              value={votes}
                              onChange={(e) => {
                                const newVotes = parseInt(e.target.value) || 0;
                                setEsc1Data(prev => ({
                                  ...prev,
                                  votes: { ...prev.votes, [party]: newVotes }
                                }));
                              }}
                              className="bg-[#050f20] border border-cyan-500/20 text-xs text-white rounded-lg px-2.5 py-1 w-1/2 text-right focus:outline-none focus:border-cyan-400 font-mono"
                            />
                          </div>
                        ))}
                      </div>

                      {/* Calculations Visual */}
                      <div className="w-full sm:w-1/2 bg-[#050f20] p-3.5 rounded-2xl border border-cyan-500/10 flex flex-col justify-between">
                        <div className="space-y-2">
                          <p className="font-bold text-cyan-300 border-b border-cyan-500/10 pb-1">Filtro de Umbral (3% Votos Válidos)</p>
                          <div className="space-y-1 text-[11px] text-slate-300">
                            <div className="flex justify-between">
                              <span>Votos Válidos:</span>
                              <strong className="text-white font-mono">{esc1Data.totalValid.toLocaleString()}</strong>
                            </div>
                            <div className="flex justify-between">
                              <span>Umbral Requerido:</span>
                              <strong className="text-amber-400 font-mono">{esc1Data.threshold.toLocaleString()}</strong>
                            </div>
                            {esc1Data.cifraRepartidora > 0 && (
                              <div className="flex justify-between border-t border-cyan-500/10 pt-1.5 mt-1.5 text-emerald-300">
                                <span>Cifra Repartidora:</span>
                                <strong className="font-mono text-xs">{Math.round(esc1Data.cifraRepartidora).toLocaleString()}</strong>
                              </div>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={runTC_ESC_01}
                          className="w-full py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg mt-4 cursor-pointer"
                        >
                          Calcular Curules (D'Hondt)
                        </button>
                      </div>

                    </div>

                    {/* Results table */}
                    {esc1Data.results.length > 0 && (
                      <div className="overflow-x-auto rounded-xl border border-cyan-500/10 bg-[#050f20]/60">
                        <table className="w-full text-[11px] text-left">
                          <thead>
                            <tr className="bg-[#0c203b] text-cyan-300 font-bold border-b border-cyan-500/20">
                              <th className="p-2">Lista / Partido</th>
                              <th className="p-2 text-right">Votación</th>
                              <th className="p-2 text-center">¿Supera Umbral?</th>
                              <th className="p-2 text-center bg-cyan-950/40 text-cyan-200">Curules Asignados</th>
                            </tr>
                          </thead>
                          <tbody>
                            {esc1Data.results.map((res) => {
                              const exceeds = res.quotient >= esc1Data.threshold;
                              return (
                                <tr key={res.party} className="border-b border-cyan-500/5 text-slate-200">
                                  <td className="p-2 font-bold">{res.party}</td>
                                  <td className="p-2 text-right font-mono">{res.quotient.toLocaleString()}</td>
                                  <td className="p-2 text-center">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      exceeds ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/20' : 'bg-rose-950 text-rose-400 border border-rose-500/20'
                                    }`}>
                                      {exceeds ? 'SÍ' : 'NO'}
                                    </span>
                                  </td>
                                  <td className="p-2 text-center bg-cyan-950/20 font-extrabold text-xs text-white">
                                    {res.seats}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* 7. TC-ESC-02 (Cuadre de Actas) Workspace */}
                {currentTestCase.id === 'TC-ESC-02' && (
                  <div className="bg-[#08172e]/60 rounded-2xl p-4 border border-cyan-500/15 space-y-4 text-xs">
                    <div className="overflow-x-auto rounded-xl border border-cyan-500/10">
                      <table className="w-full text-[11px] text-left">
                        <thead>
                          <tr className="bg-[#0c203b] text-cyan-300 font-bold border-b border-cyan-500/20">
                            <th className="p-2">Identificación de Mesa</th>
                            <th className="p-2 text-right">Votos Preconteo</th>
                            <th className="p-2 text-right">Votos Escrutinio Municipal</th>
                            <th className="p-2 text-center">Diferencia</th>
                            <th className="p-2 text-center">Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-cyan-500/5 text-slate-200">
                            <td className="p-2 font-bold">Mesa 12A - Kennedy</td>
                            <td className="p-2 text-right font-mono">145</td>
                            <td className="p-2 text-right font-mono">145</td>
                            <td className="p-2 text-center font-mono">0</td>
                            <td className="p-2 text-center">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-500/20">
                                Consistente
                              </span>
                            </td>
                          </tr>
                          <tr className="border-b border-cyan-500/5 text-slate-200">
                            <td className="p-2 font-bold">{esc2Discrepancy.mesa}</td>
                            <td className="p-2 text-right font-mono">{esc2Discrepancy.preconteo}</td>
                            <td className="p-2 text-right font-mono">
                              {esc2Discrepancy.resolved ? esc2Discrepancy.escrutinio : '-'}
                            </td>
                            <td className="p-2 text-center font-mono text-rose-400 font-bold">
                              {esc2Discrepancy.resolved ? '0' : `+${esc2Discrepancy.escrutinio - esc2Discrepancy.preconteo}`}
                            </td>
                            <td className="p-2 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                esc2Discrepancy.resolved 
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/20' 
                                  : 'bg-rose-950 text-rose-400 border border-rose-500/20 animate-pulse'
                              }`}>
                                {esc2Discrepancy.resolved ? 'Corregido' : 'Discrepancia'}
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {!esc2Discrepancy.resolved ? (
                      <div className="bg-[#050f20] p-4 rounded-2xl border border-cyan-500/10 space-y-3">
                        <p className="font-bold text-cyan-300 border-b border-cyan-500/10 pb-1 flex items-center justify-between">
                          <span>Formulario de Resolución de Discrepancias - Juez Electoral</span>
                          <span className="text-[10px] text-amber-400 font-bold">Comisión Escrutadora</span>
                        </p>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-1">Nombre del Juez/Clavero</label>
                            <input
                              type="text"
                              value={esc2Discrepancy.judgeName}
                              onChange={(e) => setEsc2Discrepancy(prev => ({ ...prev, judgeName: e.target.value }))}
                              placeholder="Ej. Dr. Mario Restrepo"
                              className="bg-[#08172e] border border-cyan-500/20 text-xs text-white rounded-lg px-2.5 py-1.5 w-full focus:outline-none focus:border-cyan-400"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-1">Justificación del Cuadre (Soporte)</label>
                            <input
                              type="text"
                              value={esc2Discrepancy.justification}
                              onChange={(e) => setEsc2Discrepancy(prev => ({ ...prev, justification: e.target.value }))}
                              placeholder="Ej. Acta física original de claveros recontada"
                              className="bg-[#08172e] border border-cyan-500/20 text-xs text-white rounded-lg px-2.5 py-1.5 w-full focus:outline-none focus:border-cyan-400"
                            />
                          </div>
                        </div>

                        <button
                          onClick={resolveTC_ESC_02}
                          className="w-full py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg cursor-pointer"
                        >
                          Resolver Discrepancia y Actualizar Historial E-24
                        </button>
                      </div>
                    ) : (
                      <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 rounded-xl flex items-center gap-2 justify-between">
                        <div className="flex items-center gap-2">
                          <FileCheck className="w-4 h-4 text-emerald-400" />
                          <span>Acta E-24 de Consolidación Municipal generada exitosamente con firma del Juez.</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">Trace: Juez Restrepo</span>
                      </div>
                    )}
                  </div>
                )}

                {/* 8. TC-SEC-01 (Rol RBAC) Workspace */}
                {currentTestCase.id === 'TC-SEC-01' && (
                  <div className="bg-[#08172e]/60 rounded-2xl p-4 border border-cyan-500/15 space-y-4 text-xs">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#050f20] p-4 rounded-2xl border border-cyan-500/10">
                      <div className="space-y-1 w-full sm:w-1/2">
                        <span className="text-[10px] text-cyan-400 font-bold uppercase">Simular Rol del Usuario:</span>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {['transmisor', 'clavero', 'auditor', 'superadmin'].map(role => (
                            <button
                              key={role}
                              onClick={() => {
                                setSec1SimulatedRole(role);
                                setSec1Result(null);
                              }}
                              className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                                sec1SimulatedRole === role
                                  ? 'bg-cyan-950 text-cyan-300 border-cyan-500/40'
                                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                              }`}
                            >
                              {role.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="w-full sm:w-1/2">
                        <span className="text-[10px] text-slate-400 block mb-1">Acción del API a Ejecutar:</span>
                        <div className="bg-[#08172e] p-2 rounded-lg border border-cyan-500/20 font-mono text-[10px] text-slate-200">
                          POST /api/escrutinio-nacional/modify
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={runTC_SEC_01}
                      className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                    >
                      <Lock className="w-4 h-4" />
                      <span>Enviar Petición HTTPS Restringida</span>
                    </button>

                    {/* Simulated DevTools Network Result */}
                    {sec1Result && (
                      <div className={`p-4 rounded-2xl border font-mono ${
                        sec1Result.code === 200
                          ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                          : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                      }`}>
                        <div className="flex justify-between items-center border-b border-current/20 pb-1 mb-2 text-[10px] font-bold">
                          <span>RESPONSE HEADERS (Simulated REST API)</span>
                          <span>STATUS: {sec1Result.code}</span>
                        </div>
                        <p className="text-[10px] leading-relaxed font-mono">
                          {sec1Result.message}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* 9. TC-SEC-02 (Prueba de Carga) Workspace */}
                {currentTestCase.id === 'TC-SEC-02' && (
                  <div className="bg-[#08172e]/60 rounded-2xl p-4 border border-cyan-500/15 space-y-4 text-xs">
                    <div className="flex items-center justify-between border-b border-cyan-500/10 pb-1.5">
                      <span className="font-bold text-slate-300">Simulador de Concurrencia de Servidores</span>
                      <span className="text-[10px] bg-slate-900 border border-slate-700 text-slate-300 px-2 py-0.5 rounded font-bold font-mono">Lapso: 15m</span>
                    </div>

                    <div className="grid grid-cols-3 gap-3.5 text-center">
                      <div className="bg-[#050f20] p-3 rounded-2xl border border-cyan-500/10">
                        <p className="text-[9px] text-slate-400 font-bold uppercase">Actas Recibidas</p>
                        <p className="text-lg font-black text-cyan-300 mt-1">{sec2Metrics.processed.toLocaleString()}</p>
                      </div>
                      <div className="bg-[#050f20] p-3 rounded-2xl border border-cyan-500/10">
                        <p className="text-[9px] text-slate-400 font-bold uppercase">Latencia Promedio</p>
                        <p className="text-lg font-black text-cyan-300 mt-1">{sec2Metrics.latency}s</p>
                      </div>
                      <div className="bg-[#050f20] p-3 rounded-2xl border border-cyan-500/10">
                        <p className="text-[9px] text-slate-400 font-bold uppercase">Disponibilidad</p>
                        <p className="text-lg font-black text-cyan-300 mt-1">{sec2Metrics.availability}%</p>
                      </div>
                    </div>

                    {/* Progress Loader */}
                    {sec2LoadTesting && (
                      <div className="space-y-2 bg-[#050f20] p-3 rounded-2xl border border-cyan-500/10">
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-300">
                          <span>Simulando estrés en Datacenter (Bogotá)...</span>
                          <span className="font-mono">{sec2Progress}%</span>
                        </div>
                        <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-cyan-500/20">
                          <div 
                            className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full rounded-full transition-all duration-1000"
                            style={{ width: `${sec2Progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <button
                      onClick={runTC_SEC_02}
                      disabled={sec2LoadTesting}
                      className={`w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg ${
                        sec2LoadTesting ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <Activity className="w-4 h-4 animate-pulse" />
                      <span>Iniciar Test de Carga (100k Actas / 4:00 PM)</span>
                    </button>
                  </div>
                )}

                {/* 10. TC-SEC-03 (Auditoría Logs) Workspace */}
                {currentTestCase.id === 'TC-SEC-03' && (
                  <div className="bg-[#08172e]/60 rounded-2xl p-4 border border-cyan-500/15 space-y-4 text-xs">
                    <div className="space-y-2">
                      <p className="text-xs text-slate-400">Verificación criptográfica de registros del syslog electoral. Cada log contiene la firma digital SHA-256 inmutable vinculada al hash del registro anterior.</p>
                      
                      <div className="bg-[#050f20] p-3 rounded-2xl border border-cyan-500/10 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                        <div>
                          <p className="font-bold text-slate-200">Algoritmo de Validación:</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">Merkle-Chain Link hashing (Inmutabilidad de logs electoral)</p>
                        </div>
                        <button
                          onClick={runTC_SEC_03}
                          className="px-4 py-2 bg-[#0c223f] border border-cyan-500/40 rounded-xl font-bold text-cyan-300 hover:bg-cyan-900/40 cursor-pointer shadow-md"
                        >
                          Verificar Hashes Syslog
                        </button>
                      </div>
                    </div>

                    {logIntegrityResult && (
                      <div className="p-3.5 bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 rounded-2xl space-y-1.5">
                        <div className="flex items-center gap-2 font-bold uppercase text-[10px]">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>INTEGRIDAD DE ARCHIVOS DE AUDITORÍA: COMPLETA</span>
                        </div>
                        <p className="text-[10px] opacity-80 leading-relaxed font-mono">
                          Los logs están encadenados criptográficamente de forma segura. Firma criptográfica SHA-256 validada y sin brechas. Cero alteraciones encontradas.
                        </p>
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>
          )}

          {/* Cryptographic Audit Console (Bottom Right) */}
          <div className="bg-[#061021] border border-cyan-500/30 rounded-3xl p-5 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2">
              <div className="flex items-center gap-2 text-cyan-300">
                <Terminal className="w-4 h-4" />
                <h3 className="text-xs font-black uppercase tracking-wider">Consola de Auditoría Criptográfica</h3>
              </div>
              <button 
                onClick={() => setLogs([])}
                className="text-[10px] text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Limpiar Consola
              </button>
            </div>

            {/* Glowing Terminal Container */}
            <div className="h-44 bg-[#020712] rounded-2xl border border-cyan-500/10 p-3 overflow-y-auto font-mono text-[9px] text-slate-300 space-y-2.5 custom-scrollbar">
              {logs.length === 0 ? (
                <div className="text-slate-500 italic text-center py-10 font-mono">No se han registrado transacciones de prueba en esta sesión.</div>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className="flex items-start gap-1 font-mono hover:bg-slate-900/40 p-1 rounded transition-colors">
                    <span className="text-slate-500 shrink-0 select-none">[{log.timestamp}]</span>
                    <span className={`shrink-0 font-bold ${
                      log.status === 'SUCCESS' ? 'text-emerald-400' :
                      log.status === 'ERROR' ? 'text-rose-500 animate-pulse' :
                      log.status === 'ALERT' ? 'text-rose-400 font-bold' :
                      log.status === 'WARNING' ? 'text-amber-400' : 'text-cyan-400'
                    }`}>
                      [{log.status}]
                    </span>
                    <span className="text-slate-400 font-bold shrink-0">{log.caseId}:</span>
                    <span className="text-slate-200 flex-1 leading-normal">{log.message}</span>
                    <span className="text-slate-500 text-[8px] font-mono shrink-0 select-none opacity-60 ml-2" title="Firma Criptográfica">{log.signature}</span>
                  </div>
                ))
              )}
              <div ref={consoleEndRef} />
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
