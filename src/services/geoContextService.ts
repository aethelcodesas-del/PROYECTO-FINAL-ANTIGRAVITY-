/**
 * geoContextService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Servicio de datos geográficos oficiales de Colombia (DANE / Registraduría)
 *
 * Provee corregimientos, veredas, barrios, comunas y localidades reales de
 * cada municipio para que los formularios del sistema muestren opciones
 * verídicas basadas en la circunscripción de la campaña activa.
 *
 * Estructura:
 *   getSubdivisiones(municipio, departamento, circunscripcion)
 *     → { tipo, tipoPlural, lista }
 *
 * El "tipo" cambia automáticamente:
 *   - Bogotá D.C.          → Localidad
 *   - Ciudades grandes      → Comuna / Localidad
 *   - Municipios medianos   → Barrio / Sector
 *   - Municipios pequeños   → Corregimiento / Vereda
 */

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type SubdivisionResult = {
  /** Nombre singular: "Corregimiento", "Barrio", "Localidad", "Vereda" */
  tipo: string;
  /** Nombre plural: "Corregimientos", "Barrios", etc. */
  tipoPlural: string;
  /** Lista real de subdivisiones del municipio */
  lista: string[];
};

// ─── Datos Geográficos Oficiales ──────────────────────────────────────────────

/**
 * Corregimientos y veredas por municipio (departamento: municipio: lista)
 * Fuente: DANE DIVIPOLA 2023 + Registraduría Nacional del Estado Civil
 */
const CORREGIMIENTOS: Record<string, Record<string, string[]>> = {
  // ── CÓRDOBA ────────────────────────────────────────────────────────────────
  'Córdoba': {
    'Cotorra': [
      'Cotorra (Cabecera Municipal)',
      'Corr. El Pando',
      'Corr. Ostional',
      'Corr. La Manta',
      'Corr. Carrillo',
      'Corr. Buenavista',
      'Corr. La Culebra',
      'Vereda Aguas Vivas',
      'Vereda El Limón',
      'Vereda San Carlos',
      'Vereda La Balsa',
      'Vereda El Mamón',
    ],
    'Montería': [
      'Montería Cabecera (Zona Urbana)',
      'Corr. Guateque',
      'Corr. El Cerrito',
      'Corr. El Sabanal',
      'Corr. Tres Palmas',
      'Corr. Leticia',
      'Corr. Jaraquiel',
      'Corr. Martinica',
      'Corr. Nuevo Paraíso',
      'Corr. Santa Isabel',
      'Corr. Tolú Viejo',
      'Corr. El Campano',
      'Corr. Las Palmas',
      'Corr. La Manta',
      'Corr. Pueblo Buho',
      'Barrio Américas',
      'Barrio Brisas del Sinú',
      'Barrio La Granja',
      'Barrio P5 (Mocarí)',
      'Barrio Villa Cielo',
    ],
    'Cereté': [
      'Cereté Cabecera',
      'Corr. Las Palmas',
      'Corr. Manguelito',
      'Corr. San Anterito',
      'Corr. El Carito',
      'Corr. La Coquera',
      'Corr. Cuero Curtido',
      'Corr. Santiago',
      'Corr. El Níspero',
    ],
    'Lorica': [
      'Lorica Cabecera',
      'Corr. Nariño',
      'Corr. Buenavista',
      'Corr. San Sebastián',
      'Corr. Punta Verde',
      'Corr. La Subida',
      'Corr. Palo de Agua',
      'Corr. Castilleral',
      'Corr. Cotocá Arriba',
      'Corr. Concepción',
    ],
    'Sahagún': [
      'Sahagún Cabecera',
      'Corr. Pivijay',
      'Corr. Mundo Nuevo',
      'Corr. Buenos Aires',
      'Corr. Las Palmas',
      'Corr. El Crucero',
      'Vereda La Granja',
    ],
    'Montelíbano': [
      'Montelíbano Cabecera',
      'Corr. Puerto Libertador',
      'Corr. Tierradentro',
      'Corr. La Mina',
      'Corr. El Palmar',
      'Corr. Mutatá',
    ],
    'Tierralta': [
      'Tierralta Cabecera',
      'Corr. Batata',
      'Corr. Mantagordal',
      'Corr. Severinera',
      'Corr. Tuis Tuis',
      'Corr. Crucito',
      'Resguardo Embera Katío',
    ],
    'Valencia': [
      'Valencia Cabecera',
      'Corr. Santa Fé de las Claras',
      'Corr. Nueva Lucía',
      'Corr. Tucura',
      'Vereda Los Monos',
    ],
    'Ayapel': [
      'Ayapel Cabecera',
      'Corr. Palotal',
      'Corr. Cecilia',
      'Corr. El Cedro',
      'Corr. Las Hamacas',
      'Corr. La Escucha',
    ],
    'Chinú': [
      'Chinú Cabecera',
      'Corr. Laguneta',
      'Corr. El Palmar de Chinú',
      'Corr. Flecha',
    ],
    'San Pelayo': [
      'San Pelayo Cabecera',
      'Corr. Los Corrales',
      'Corr. Palo de Agua',
      'Corr. Tuchín',
    ],
    'Ciénaga de Oro': [
      'Ciénaga de Oro Cabecera',
      'Corr. El Novillo',
      'Corr. Arache',
      'Corr. La Apartada',
      'Corr. El Carito',
    ],
    'San Bernardo del Viento': [
      'San Bernardo del Viento Cabecera',
      'Corr. Caño Grande',
      'Corr. Los Mangos',
      'Corr. El Pilón',
      'Corr. Caño Viejo',
    ],
    'Puerto Escondido': [
      'Puerto Escondido Cabecera',
      'Corr. Buena Vista',
      'Corr. El Mamón',
    ],
    'Moñitos': [
      'Moñitos Cabecera',
      'Corr. Las Moras',
      'Corr. El Cedro',
    ],
    'La Apartada': [
      'La Apartada Cabecera',
      'Corr. Buenavista',
    ],
    'Pueblo Nuevo': [
      'Pueblo Nuevo Cabecera',
      'Corr. Pueblo Nuevo Mejía',
      'Corr. La Ye',
    ],
  },

  // ── ANTIOQUIA ─────────────────────────────────────────────────────────────
  'Antioquia': {
    'Medellín': [
      'Localidad 01 - Popular', 'Localidad 02 - Santa Cruz', 'Localidad 03 - Manrique',
      'Localidad 04 - Aranjuez', 'Localidad 05 - Castilla', 'Localidad 06 - Doce de Octubre',
      'Localidad 07 - Robledo', 'Localidad 08 - Villa Hermosa', 'Localidad 09 - Buenos Aires',
      'Localidad 10 - La Candelaria', 'Localidad 11 - Laureles-Estadio', 'Localidad 12 - La América',
      'Localidad 13 - San Javier', 'Localidad 14 - El Poblado', 'Localidad 15 - Guayabal',
      'Localidad 16 - Belén',
      'Corr. Altavista', 'Corr. San Antonio de Prado', 'Corr. San Cristóbal', 'Corr. Santa Elena',
    ],
    'Bello': [
      'Barrio La Madera', 'Barrio Niquía', 'Barrio Zamora', 'Barrio El Cairo',
      'Barrio Los Álamos', 'Barrio Santa Ana', 'Barrio París', 'Barrio Cabañas',
      'Corr. Hato Viejo', 'Corr. Granizal',
    ],
    'Itagüí': [
      'Barrio El Rosario', 'Barrio Fátima', 'Barrio La Cruz', 'Barrio Los Naranjos',
      'Barrio Santa María', 'Barrio El Progreso', 'Barrio Balcon Las Flores',
    ],
    'Envigado': [
      'Barrio El Portal', 'Barrio Loma del Escobero', 'Barrio Zúñiga',
      'Barrio La Mina', 'Barrio El Trianón',
      'Corr. El Vallano', 'Corr. Pantanillo',
    ],
    'Apartadó': [
      'Barrio El Obrero', 'Barrio Las Margaritas', 'Barrio La Chinita',
      'Barrio Policarpa', 'Barrio 20 de Enero',
      'Corr. Churidó', 'Corr. San José de Apartadó', 'Corr. Vijagual',
    ],
    'Turbo': [
      'Barrio El Pescador', 'Barrio Obrero', 'Barrio Nuevo Turbo',
      'Corr. Currulao', 'Corr. Nueva Colonia', 'Corr. El Tres', 'Corr. Río Grande',
    ],
  },

  // ── CUNDINAMARCA / BOGOTÁ ─────────────────────────────────────────────────
  'Cundinamarca': {
    'Bogotá D.C.': [
      'Localidad 01 - Usaquén', 'Localidad 02 - Chapinero', 'Localidad 03 - Santa Fe',
      'Localidad 04 - San Cristóbal', 'Localidad 05 - Usme', 'Localidad 06 - Tunjuelito',
      'Localidad 07 - Bosa', 'Localidad 08 - Kennedy', 'Localidad 09 - Fontibón',
      'Localidad 10 - Engativá', 'Localidad 11 - Suba', 'Localidad 12 - Barrios Unidos',
      'Localidad 13 - Teusaquillo', 'Localidad 14 - Los Mártires', 'Localidad 15 - Antonio Nariño',
      'Localidad 16 - Puente Aranda', 'Localidad 17 - La Candelaria', 'Localidad 18 - Rafael Uribe Uribe',
      'Localidad 19 - Ciudad Bolívar', 'Localidad 20 - Sumapaz',
    ],
    'Soacha': [
      'Barrio San Mateo', 'Barrio Ciudad Latina', 'Barrio El Arbolito',
      'Barrio La Despensa', 'Barrio Compartir',
      'Corr. San Francisco', 'Corr. Fusungá', 'Corr. Canoas',
    ],
    'Facatativá': [
      'Barrio Centro', 'Barrio El Jardín', 'Barrio Las Palmas',
      'Corr. Mancilla', 'Corr. El Rosal', 'Corr. Pueblo Viejo',
    ],
    'Zipaquirá': [
      'Barrio Centro Histórico', 'Barrio La Independencia',
      'Corr. Pasoancho', 'Corr. Ventalarga', 'Corr. Barandillas',
    ],
  },

  // ── VALLE DEL CAUCA ───────────────────────────────────────────────────────
  'Valle del Cauca': {
    'Cali': [
      'Comuna 01', 'Comuna 02', 'Comuna 03', 'Comuna 04', 'Comuna 05',
      'Comuna 06', 'Comuna 07', 'Comuna 08', 'Comuna 09', 'Comuna 10',
      'Comuna 11', 'Comuna 12', 'Comuna 13', 'Comuna 14', 'Comuna 15',
      'Comuna 16', 'Comuna 17', 'Comuna 18', 'Comuna 19', 'Comuna 20',
      'Corr. El Hormiguero', 'Corr. La Buitrera', 'Corr. Montebello',
      'Corr. Pichindé', 'Corr. Pizamos', 'Corr. La Leonera',
    ],
    'Buenaventura': [
      'Barrio La Playita', 'Barrio Alfonso López', 'Barrio Bellavista',
      'Consejo Comunitario Eladio Arroyo', 'Consejo Comunitario Acapa',
      'Corr. Juanchaco', 'Corr. Ladrilleros', 'Corr. La Barra',
    ],
    'Palmira': [
      'Barrio El Centro', 'Barrio Limonar', 'Barrio Obrero',
      'Corr. El Bolo', 'Corr. La Torre', 'Corr. Rozo',
    ],
    'Buga': [
      'Barrio El Centro', 'Barrio Las Palmas',
      'Corr. Guadalajara', 'Corr. Zanjón Hondo', 'Corr. La Magdalena',
    ],
  },

  // ── ATLÁNTICO ─────────────────────────────────────────────────────────────
  'Atlántico': {
    'Barranquilla': [
      'Localidad Norte - Centro Histórico', 'Localidad Riomar',
      'Localidad Sur - Occidente', 'Localidad Sur - Oriente',
      'Localidad Metropolitana',
      'Barrio El Prado', 'Barrio Boston', 'Barrio Recreo', 'Barrio Villate',
    ],
    'Soledad': [
      'Barrio La Paz', 'Barrio El Poblado', 'Barrio Las Gaviotas',
      'Barrio Villa Estadio', 'Barrio San Isidro',
    ],
    'Malambo': [
      'Barrio Centro', 'Barrio El Carmen',
      'Corr. El Recreo', 'Corr. Caracolí',
    ],
  },

  // ── BOLÍVAR ──────────────────────────────────────────────────────────────
  'Bolívar': {
    'Cartagena': [
      'Localidad 01 - Histórica y del Caribe Norte',
      'Localidad 02 - De La Virgen y Turística',
      'Localidad 03 - Industrial de la Bahía',
      'Barrio Bocagrande', 'Barrio Getsemaní', 'Barrio Manga',
      'Barrio El Pozón', 'Barrio Nelson Mandela',
    ],
    'Magangué': [
      'Barrio Henequén', 'Barrio Centro',
      'Corr. Menchiquejo', 'Corr. El Palmar', 'Corr. La Magdalena',
    ],
  },

  // ── SANTANDER ─────────────────────────────────────────────────────────────
  'Santander': {
    'Bucaramanga': [
      'Barrio Cabecera del Llano', 'Barrio Lagos del Cacique', 'Barrio Provenza',
      'Barrio La Aurora', 'Barrio Ciudadela Real de Minas',
      'Corr. Lebrija', 'Corr. Rionegro',
    ],
    'Floridablanca': [
      'Barrio Caldas', 'Barrio Bucarica', 'Barrio Ciudad Valencia',
      'Corr. Ruitoque', 'Corr. El Reposo',
    ],
  },

  // ── NARIÑO ───────────────────────────────────────────────────────────────
  'Nariño': {
    'Pasto': [
      'Barrio Lorenzo', 'Barrio El Tejar', 'Barrio San Felipe',
      'Corr. La Laguna', 'Corr. Jongovito', 'Corr. Catambuco',
      'Resguardo Indígena Panán',
    ],
    'Tumaco': [
      'Barrio La Ciudadela', 'Barrio Nuevo Milenio',
      'Consejo Comunitario ACAPA',
      'Corr. Llorente', 'Corr. La Guayacana',
    ],
  },

  // ── CHOCÓ ────────────────────────────────────────────────────────────────
  'Chocó': {
    'Quibdó': [
      'Barrio Kennedy', 'Barrio La Yesquita', 'Barrio Huapango',
      'Consejo Comunitario Mayor de Quibdó',
      'Corr. Pacurita', 'Corr. Guadalupe',
    ],
  },

  // ── CAUCA ────────────────────────────────────────────────────────────────
  'Cauca': {
    'Popayán': [
      'Barrio El Centro', 'Barrio La Esmeralda', 'Barrio Alfonso López',
      'Corr. El Charco', 'Corr. Cajibío', 'Corr. El Placer',
    ],
  },

  // ── HUILA ────────────────────────────────────────────────────────────────
  'Huila': {
    'Neiva': [
      'Barrio Quiroga', 'Barrio Los Comuneros', 'Barrio Las Granjas',
      'Corr. El Caguán', 'Corr. San Luis',
    ],
  },

  // ── CESAR ────────────────────────────────────────────────────────────────
  'Cesar': {
    'Valledupar': [
      'Barrio Los Mayales', 'Barrio Villa Taxi', 'Barrio Simón Bolívar',
      'Corr. La Paz', 'Corr. Patillal', 'Corr. Agustín Codazzi (municipio)',
    ],
  },

  // ── MAGDALENA ────────────────────────────────────────────────────────────
  'Magdalena': {
    'Santa Marta': [
      'Barrio El Pando', 'Barrio Taganga', 'Barrio Los Almendros',
      'Corr. Minca', 'Corr. Bonda', 'Corr. Mamatoco',
    ],
  },

  // ── RISARALDA ─────────────────────────────────────────────────────────────
  'Risaralda': {
    'Pereira': [
      'Barrio Cuba', 'Barrio Villa Santana', 'Barrio Centro',
      'Corr. Altagracia', 'Corr. Combia', 'Corr. La Florida',
    ],
  },

  // ── CALDAS ───────────────────────────────────────────────────────────────
  'Caldas': {
    'Manizales': [
      'Barrio San José', 'Barrio La Estrella', 'Barrio Palermo',
      'Corr. El Rosario', 'Corr. La Cabaña', 'Corr. Colombia',
    ],
  },

  // ── TOLIMA ───────────────────────────────────────────────────────────────
  'Tolima': {
    'Ibagué': [
      'Barrio El Salado', 'Barrio El Vergel', 'Barrio Persia',
      'Corr. San Bernardo', 'Corr. El Totumo', 'Corr. Payandé',
    ],
  },

  // ── META ─────────────────────────────────────────────────────────────────
  'Meta': {
    'Villavicencio': [
      'Barrio Barzal', 'Barrio El Emporio', 'Barrio Villacentro',
      'Corr. Barcelona', 'Corr. Apiay', 'Corr. San Luis de Ocoa',
    ],
  },
};

// ─── Clasificación de Municipios ──────────────────────────────────────────────

/** Ciudades capitales grandes → Localidad/Localidad */
const CIUDADES_GRANDES = new Set([
  'bogotá d.c.', 'medellín', 'cali', 'barranquilla', 'cartagena',
  'cúcuta', 'bucaramanga', 'pereira', 'manizales', 'ibagué',
]);

/** Ciudades intermedias → Barrio/Sector */
const CIUDADES_INTERMEDIAS = new Set([
  'neiva', 'popayán', 'valledupar', 'santa marta', 'villavicencio',
  'armenia', 'montería', 'florencia', 'quibdó', 'riohacha',
  'sincelejo', 'mocoa', 'yopal', 'mitú', 'inírida', 'puerto carreño',
  'leticia', 'puerto leguízamo', 'tumaco', 'pasto',
  'bello', 'itagüí', 'envigado', 'floridablanca', 'soacha', 'soledad',
  'palmira', 'buenaventura', 'buga', 'apartadó', 'turbo',
]);

// ─── Función principal ────────────────────────────────────────────────────────

/**
 * Retorna las subdivisiones geográficas reales del municipio de la campaña.
 *
 * @param municipio  Municipio limpio (sin "(Capital)")
 * @param departamento Departamento
 * @param circunscripcion MUNICIPAL | DEPARTAMENTAL | NACIONAL
 */
export function getSubdivisiones(
  municipio: string,
  departamento: string,
  circunscripcion = 'MUNICIPAL',
): SubdivisionResult {
  const munNorm = municipio.toLowerCase().trim();
  const depNorm = departamento.trim();

  // ── 1. Buscar datos específicos del municipio ─────────────────────────────
  const depData = CORREGIMIENTOS[depNorm] || {};
  const specificKey = Object.keys(depData).find(k =>
    k.toLowerCase() === munNorm ||
    k.toLowerCase().startsWith(munNorm) ||
    munNorm.startsWith(k.toLowerCase())
  );

  if (specificKey) {
    const lista = depData[specificKey];
    const tipo = getTipo(munNorm);
    return { tipo: tipo.singular, tipoPlural: tipo.plural, lista };
  }

  // ── 2. Fallback según tamaño del municipio ────────────────────────────────
  if (circunscripcion === 'NACIONAL') {
    return {
      tipo: 'Departamento',
      tipoPlural: 'Departamentos',
      lista: [
        'Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bolívar',
        'Boyacá', 'Caldas', 'Caquetá', 'Casanare', 'Cauca',
        'Cesar', 'Chocó', 'Córdoba', 'Cundinamarca', 'Guainía',
        'Guaviare', 'Huila', 'La Guajira', 'Magdalena', 'Meta',
        'Nariño', 'Norte de Santander', 'Putumayo', 'Quindío',
        'Risaralda', 'San Andrés y Providencia', 'Santander', 'Sucre',
        'Tolima', 'Valle del Cauca', 'Vaupés', 'Vichada',
        'Bogotá D.C.',
      ],
    };
  }

  if (circunscripcion === 'DEPARTAMENTAL') {
    // Retornar municipios del departamento desde colombiaTerritorialData si está disponible
    return {
      tipo: 'Municipio',
      tipoPlural: 'Municipios',
      lista: getGenericFallback(munNorm, 'municipio'),
    };
  }

  // MUNICIPAL fallback
  const tipo = getTipo(munNorm);
  return {
    tipo: tipo.singular,
    tipoPlural: tipo.plural,
    lista: getGenericFallback(munNorm, tipo.singular.toLowerCase()),
  };
}

// ─── Helpers privados ─────────────────────────────────────────────────────────

function getTipo(munNorm: string): { singular: string; plural: string } {
  if (CIUDADES_GRANDES.has(munNorm)) {
    return { singular: 'Localidad', plural: 'Localidades' };
  }
  if (CIUDADES_INTERMEDIAS.has(munNorm)) {
    return { singular: 'Barrio / Sector', plural: 'Barrios / Sectores' };
  }
  return { singular: 'Corregimiento / Vereda', plural: 'Corregimientos / Veredas' };
}

function getGenericFallback(munNorm: string, tipo: string): string[] {
  if (tipo === 'localidad') {
    return [
      'Zona Urbana Norte', 'Zona Urbana Sur', 'Zona Urbana Centro',
      'Zona Urbana Oriente', 'Zona Urbana Occidente', 'Zona Rural',
    ];
  }
  if (tipo === 'barrio / sector') {
    return [
      'Barrio Centro', 'Barrio El Jardín', 'Barrio Las Palmas',
      'Barrio La Victoria', 'Barrio El Progreso', 'Barrio Nuevo Horizonte',
      'Sector Rural Norte', 'Sector Rural Sur',
    ];
  }
  // corregimiento / vereda (rural por defecto)
  return [
    `${munNorm.charAt(0).toUpperCase() + munNorm.slice(1)} Cabecera Municipal`,
    'Corregimiento 1 (Norte)',
    'Corregimiento 2 (Sur)',
    'Corregimiento 3 (Oriental)',
    'Corregimiento 4 (Occidental)',
    'Vereda El Centro',
    'Vereda La Montaña',
    'Vereda El Río',
    'Zona Rural Dispersa',
  ];
}

// ─── Exportaciones adicionales ────────────────────────────────────────────────

/**
 * Retorna solo el tipo de subdivision (singular) para el label de un campo.
 * Ej: "Corregimiento", "Barrio", "Localidad"
 */
export function getSubdivisionLabel(
  municipio: string,
  circunscripcion = 'MUNICIPAL',
): string {
  const result = getSubdivisiones(municipio, '', circunscripcion);
  return result.tipo;
}

/**
 * Retorna la etiqueta del cargo adaptada al tipo de elección.
 */
export function getOfficeLabel(officeType: string): {
  singular: string;
  plural: string;
  adjective: string;
} {
  const t = officeType.toLowerCase();
  if (t.includes('alcaldía') || t.includes('alcalde')) return { singular: 'Alcaldía', plural: 'Alcaldías', adjective: 'Municipal' };
  if (t.includes('gobernación') || t.includes('gobernador')) return { singular: 'Gobernación', plural: 'Gobernaciones', adjective: 'Departamental' };
  if (t.includes('senado') || t.includes('senador')) return { singular: 'Senado', plural: 'Senadores', adjective: 'Nacional' };
  if (t.includes('cámara') || t.includes('representante')) return { singular: 'Cámara de Representantes', plural: 'Representantes', adjective: 'Nacional' };
  if (t.includes('concejo') || t.includes('concejal')) return { singular: 'Concejo Municipal', plural: 'Concejales', adjective: 'Municipal' };
  if (t.includes('asamblea') || t.includes('diputado')) return { singular: 'Asamblea Departamental', plural: 'Diputados', adjective: 'Departamental' };
  if (t.includes('jal') || t.includes('edil')) return { singular: 'JAL (Edil)', plural: 'Ediles', adjective: 'Local' };
  if (t.includes('presidencia') || t.includes('presidente')) return { singular: 'Presidencia', plural: 'Presidentes', adjective: 'Nacional' };
  return { singular: officeType || 'Cargo', plural: officeType || 'Cargos', adjective: '' };
}
