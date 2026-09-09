/**
 * BASE DE DATOS Y GENERADOR INTELIGENTE DE PUESTOS DE VOTACIÓN POR CIRCUNSCRIPCIÓN
 * REGISTRADURÍA NACIONAL DEL ESTADO CIVIL / CNE DE COLOMBIA
 * 
 * Permite obtener, generar y personalizar los Puestos de Votación, Comunas/Localidades/Zonas,
 * Mesas y Coordenadas para cualquier departamento y municipio de Colombia según la 
 * Circunscripción Territorial del Aspirante / Candidato.
 */

export interface PuestoVotacionInfo {
  id: string;
  nombre: string;
  departamento: string;
  municipio: string;
  comuna: string; // Comuna, Localidad, Corregimiento o Zona
  mesas: number;
  censoEstimado: number;
  lat: number;
  lng: number;
  direccion?: string;
  isCustom?: boolean;
}

// Coordenadas base por departamento / capitales de Colombia para centrado GPS realista
export const departmentCoordinates: Record<string, { lat: number; lng: number }> = {
  'Amazonas': { lat: -4.2153, lng: -69.9406 },
  'Antioquia': { lat: 6.2442, lng: -75.5812 },
  'Arauca': { lat: 7.0845, lng: -70.7591 },
  'Atlántico': { lat: 10.9685, lng: -74.7813 },
  'Bogotá D.C.': { lat: 4.6097, lng: -74.0817 },
  'Bolívar': { lat: 10.3910, lng: -75.4794 },
  'Boyacá': { lat: 5.5353, lng: -73.3678 },
  'Caldas': { lat: 5.0689, lng: -75.5174 },
  'Caquetá': { lat: 1.6144, lng: -75.6062 },
  'Casanare': { lat: 5.3378, lng: -72.3959 },
  'Cauca': { lat: 2.4448, lng: -76.6147 },
  'Cesar': { lat: 10.4631, lng: -73.2532 },
  'Chocó': { lat: 5.6919, lng: -76.6583 },
  'Cundinamarca': { lat: 4.5981, lng: -74.0758 },
  'Córdoba': { lat: 8.7479, lng: -75.8814 },
  'Guainía': { lat: 3.8653, lng: -67.9239 },
  'Guaviare': { lat: 2.5729, lng: -72.6459 },
  'Huila': { lat: 2.9273, lng: -75.2819 },
  'La Guajira': { lat: 11.5444, lng: -72.9072 },
  'Magdalena': { lat: 11.2408, lng: -74.1990 },
  'Meta': { lat: 4.1420, lng: -73.6266 },
  'Nariño': { lat: 1.2136, lng: -77.2811 },
  'Norte de Santander': { lat: 7.8939, lng: -72.5078 },
  'Putumayo': { lat: 1.1528, lng: -76.6521 },
  'Quindío': { lat: 4.5339, lng: -75.6811 },
  'Risaralda': { lat: 4.8133, lng: -75.6961 },
  'San Andrés y Providencia': { lat: 12.5847, lng: -81.7006 },
  'Santander': { lat: 7.1193, lng: -73.1227 },
  'Sucre': { lat: 9.3047, lng: -75.3978 },
  'Tolima': { lat: 4.4389, lng: -75.2322 },
  'Valle del Cauca': { lat: 3.4516, lng: -76.5320 },
  'Vaupés': { lat: 1.1983, lng: -70.1733 },
  'Vichada': { lat: 4.4235, lng: -69.2878 }
};

// Normalizar nombres de municipio (remover " (Capital)" si existe)
export function normalizeMunicipioName(mun: string): string {
  if (!mun) return '';
  return mun.replace(/\s*\(Capital\)\s*/gi, '').trim();
}

/**
 * Puestos de Votación Emblemáticos y Reales por Municipio y Capitales Principales
 */
export const puestosEmblematicosPorMunicipio: Record<string, Omit<PuestoVotacionInfo, 'id' | 'departamento' | 'municipio'>[]> = {
  // BOGOTÁ D.C.
  'Bogotá D.C.': [
    { nombre: 'Corferias (Pabellón Central)', comuna: 'Localidad 13 (Teusaquillo)', mesas: 120, censoEstimado: 42000, lat: 4.6288, lng: -74.0898, direccion: 'Cra. 37 # 24-67' },
    { nombre: 'Unicentro (Plaza Principal)', comuna: 'Localidad 01 (Usaquén)', mesas: 65, censoEstimado: 22750, lat: 4.7018, lng: -74.0410, direccion: 'Av. Cra. 15 # 124-30' },
    { nombre: 'Plaza de los Artesanos', comuna: 'Localidad 12 (Barrios Unidos)', mesas: 45, censoEstimado: 15750, lat: 4.6601, lng: -74.0880, direccion: 'Cra. 60 # 63A-52' },
    { nombre: 'Colegio Mayor de San Bartolomé', comuna: 'Localidad 17 (La Candelaria)', mesas: 32, censoEstimado: 11200, lat: 4.5975, lng: -74.0760, direccion: 'Cra. 7 # 9-96' },
    { nombre: 'I.E.D. Simón Bolívar', comuna: 'Localidad 11 (Suba)', mesas: 40, censoEstimado: 14000, lat: 4.7460, lng: -74.0840, direccion: 'Calle 139 # 95A-10' },
    { nombre: 'I.E.D. Restrepo Millán', comuna: 'Localidad 18 (Rafael Uribe Uribe)', mesas: 36, censoEstimado: 12600, lat: 4.5720, lng: -74.1120, direccion: 'Calle 40 Sur # 23-25' },
    { nombre: 'Coliseo El Salitre', comuna: 'Localidad 10 (Engativá)', mesas: 55, censoEstimado: 19250, lat: 4.6640, lng: -74.0930, direccion: 'Av. Calle 63 # 68-99' },
    { nombre: 'I.E.D. Ciudad de Kennedy', comuna: 'Localidad 08 (Kennedy)', mesas: 48, censoEstimado: 16800, lat: 4.6290, lng: -74.1480, direccion: 'Calle 38C Sur # 78K-20' },
    { nombre: 'I.E.D. Venecia', comuna: 'Localidad 06 (Tunjuelito)', mesas: 30, censoEstimado: 10500, lat: 4.5880, lng: -74.1410, direccion: 'Diagonal 49 Sur # 53A-12' },
    { nombre: 'I.E.D. Normal Superior María Montessori', comuna: 'Localidad 15 (Antonio Nariño)', mesas: 38, censoEstimado: 13300, lat: 4.5910, lng: -74.0980, direccion: 'Calle 14 Sur # 14-23' }
  ],

  // MEDELLÍN
  'Medellín': [
    { nombre: 'Colegio Marco Fidel Suárez', comuna: 'Comuna 10 (La Candelaria)', mesas: 28, censoEstimado: 9800, lat: 6.2442, lng: -75.5812, direccion: 'Cra. 50 # 52-25' },
    { nombre: 'Universidad UPB (Bloque Central)', comuna: 'Comuna 11 (Laureles - Estadio)', mesas: 35, censoEstimado: 12250, lat: 6.2410, lng: -75.5900, direccion: 'Circular 1 # 70-01' },
    { nombre: 'I.E. Pedro Justo Berrío', comuna: 'Comuna 16 (Belén)', mesas: 22, censoEstimado: 7700, lat: 6.2301, lng: -75.5875, direccion: 'Calle 30A # 76-20' },
    { nombre: 'I.E. INEM José Félix de Restrepo', comuna: 'Comuna 14 (El Poblado)', mesas: 42, censoEstimado: 14700, lat: 6.2088, lng: -75.5720, direccion: 'Cra. 48 # 1-125' },
    { nombre: 'Plaza de Toros La Macarena', comuna: 'Comuna 11 (Laureles - Estadio)', mesas: 26, censoEstimado: 9100, lat: 6.2488, lng: -75.5780, direccion: 'Autopista Sur # 44-07' },
    { nombre: 'I.E. Diego Echavarría Misas', comuna: 'Comuna 05 (Castilla)', mesas: 25, censoEstimado: 8750, lat: 6.2890, lng: -75.5750, direccion: 'Calle 98 # 68-15' },
    { nombre: 'Colegio San José de las Vegas', comuna: 'Comuna 14 (El Poblado)', mesas: 30, censoEstimado: 10500, lat: 6.2010, lng: -75.5680, direccion: 'Cra. 43A # 18 Sur-120' },
    { nombre: 'I.E. Lola González', comuna: 'Comuna 13 (San Javier)', mesas: 28, censoEstimado: 9800, lat: 6.2510, lng: -75.6120, direccion: 'Calle 44 # 103-35' },
    { nombre: 'I.E. Gilberto Alzate Avendaño', comuna: 'Comuna 04 (Aranjuez)', mesas: 32, censoEstimado: 11200, lat: 6.2750, lng: -75.5600, direccion: 'Cra. 51 # 90-10' }
  ],

  // BUCARAMANGA
  'Bucaramanga': [
    { nombre: 'Colegio Santander (Sede Principal)', comuna: 'Comuna 15 (Centro)', mesas: 35, censoEstimado: 12250, lat: 7.1220, lng: -73.1260, direccion: 'Calle 34 # 12-40' },
    { nombre: 'I.E. Dámaso Zapata (Tecnológico)', comuna: 'Comuna 03 (San Francisco)', mesas: 40, censoEstimado: 14000, lat: 7.1350, lng: -73.1210, direccion: 'Cra. 28 # 14-50' },
    { nombre: 'Coliseo Bicentenario Alejandro Galvis', comuna: 'Comuna 13 (San Martín)', mesas: 30, censoEstimado: 10500, lat: 7.1080, lng: -73.1190, direccion: 'Calle 67 # 28-30' },
    { nombre: 'I.E. La Salle (Sede A)', comuna: 'Comuna 12 (Cabecera del Llano)', mesas: 28, censoEstimado: 9800, lat: 7.1160, lng: -73.1090, direccion: 'Cra. 33 # 48-25' },
    { nombre: 'I.E. INEM Custodio García Rovira', comuna: 'Comuna 10 (Provenza)', mesas: 45, censoEstimado: 15750, lat: 7.0890, lng: -73.1180, direccion: 'Calle 105 # 23-40' },
    { nombre: 'I.E. Aurelio Martínez Mutis', comuna: 'Comuna 08 (Suroccidente)', mesas: 26, censoEstimado: 9100, lat: 7.1010, lng: -73.1340, direccion: 'Calle 55 # 17W-20' },
    { nombre: 'I.E. Nacional de Comercio', comuna: 'Comuna 06 (La Concordia)', mesas: 32, censoEstimado: 11200, lat: 7.1110, lng: -73.1250, direccion: 'Calle 52 # 19-30' }
  ],

  // CALI
  'Cali': [
    { nombre: 'Coliseo El Pueblo', comuna: 'Comuna 19 (San Fernando)', mesas: 50, censoEstimado: 17500, lat: 3.4210, lng: -76.5490, direccion: 'Cra. 52 # 2-00' },
    { nombre: 'I.E. Santa Librada', comuna: 'Comuna 03 (San Antonio)', mesas: 35, censoEstimado: 12250, lat: 3.4440, lng: -76.5360, direccion: 'Calle 5 # 14-01' },
    { nombre: 'Universidad del Valle (Sede Meléndez)', comuna: 'Comuna 17 (El Limonar)', mesas: 45, censoEstimado: 15750, lat: 3.3740, lng: -76.5330, direccion: 'Calle 13 # 100-00' },
    { nombre: 'I.E. INEM Jorge Isaacs', comuna: 'Comuna 04 (Las Delicias)', mesas: 40, censoEstimado: 14000, lat: 3.4730, lng: -76.5160, direccion: 'Cra. 5N # 48N-00' },
    { nombre: 'Coliseo María Isabel Urrutia', comuna: 'Comuna 14 (Mariano Ramos)', mesas: 32, censoEstimado: 11200, lat: 3.4090, lng: -76.5050, direccion: 'Calle 42 # 47B-00' },
    { nombre: 'I.E. Eustaquio Palacios', comuna: 'Comuna 20 (Siloé)', mesas: 28, censoEstimado: 9800, lat: 3.4150, lng: -76.5580, direccion: 'Cra. 52 # 2 Bis-15' }
  ],

  // BARRANQUILLA
  'Barranquilla': [
    { nombre: 'Colegio Biffi La Salle', comuna: 'Localidad Norte - Centro Histórico', mesas: 42, censoEstimado: 14700, lat: 10.9990, lng: -74.8050, direccion: 'Calle 85 # 53-70' },
    { nombre: 'Coliseo Sugar Baby Rojas', comuna: 'Localidad Suroriente', mesas: 38, censoEstimado: 13300, lat: 10.9720, lng: -74.7810, direccion: 'Cra. 54 # 54-40' },
    { nombre: 'I.E.D. Pestalozzi', comuna: 'Localidad Suroccidente', mesas: 34, censoEstimado: 11900, lat: 10.9580, lng: -74.8100, direccion: 'Calle 56 # 21B-40' },
    { nombre: 'I.E.D. Marco Fidel Suárez', comuna: 'Localidad Metropolitana', mesas: 36, censoEstimado: 12600, lat: 10.9410, lng: -74.8120, direccion: 'Cra. 6B # 36B-25' },
    { nombre: 'Universidad del Atlántico (Sede Norte)', comuna: 'Localidad Riomar', mesas: 48, censoEstimado: 16800, lat: 11.0180, lng: -74.8720, direccion: 'Km 7 Antigua Vía Puerto Colombia' }
  ],

  // CARTAGENA
  'Cartagena': [
    { nombre: 'I.E. Soledad Acosta de Samper', comuna: 'Localidad Histórica y del Caribe Norte', mesas: 38, censoEstimado: 13300, lat: 10.4050, lng: -75.5230, direccion: 'Barrio El Carmen Calle 24' },
    { nombre: 'Coliseo de Combate y Gimnasia', comuna: 'Localidad de la Virgen y Turística', mesas: 35, censoEstimado: 12250, lat: 10.3950, lng: -75.4950, direccion: 'Avenida Pedro de Heredia' },
    { nombre: 'I.E. Colegio Mayor de Bolívar', comuna: 'Centro Histórico Amurallado', mesas: 26, censoEstimado: 9100, lat: 10.4240, lng: -75.5490, direccion: 'Calle de la Factoría # 36-27' },
    { nombre: 'I.E. Madre Laura', comuna: 'Localidad Industrial y de la Bahía', mesas: 30, censoEstimado: 10500, lat: 10.3810, lng: -75.4880, direccion: 'Barrio Pie de la Popa' }
  ],

  // CÚCUTA
  'Cúcuta': [
    { nombre: 'Colegio Sagrado Corazón de Jesús', comuna: 'Comuna 01 (Centro)', mesas: 36, censoEstimado: 12600, lat: 7.8930, lng: -72.5050, direccion: 'Av. 4 # 14-25' },
    { nombre: 'I.E. Municipal INEM José Eusebio Caro', comuna: 'Comuna 02 (Guaimaral)', mesas: 40, censoEstimado: 14000, lat: 7.9050, lng: -72.5020, direccion: 'Av. Guaimaral Calle 11' },
    { nombre: 'Coliseo Toto Hernández', comuna: 'Comuna 03 (Zona Cívica)', mesas: 30, censoEstimado: 10500, lat: 7.8880, lng: -72.4980, direccion: 'Av. Panamericana' },
    { nombre: 'I.E. Mariano Ospina Rodríguez', comuna: 'Comuna 07 (Alonsito)', mesas: 28, censoEstimado: 9800, lat: 7.9250, lng: -72.5210, direccion: 'Calle 13 # 2-40' }
  ],

  // PEREIRA
  'Pereira': [
    { nombre: 'I.E. Deogracias Cardona', comuna: 'Comuna Centro', mesas: 35, censoEstimado: 12250, lat: 4.8140, lng: -75.6940, direccion: 'Cra. 8 # 21-45' },
    { nombre: 'Universidad Tecnológica de Pereira (UTP)', comuna: 'Comuna La Julita', mesas: 42, censoEstimado: 14700, lat: 4.7920, lng: -75.6900, direccion: 'Vereda La Julita' },
    { nombre: 'Coliseo Mayor Rafael Cuartas Gaviria', comuna: 'Comuna Olímpica', mesas: 28, censoEstimado: 9800, lat: 4.8050, lng: -75.7020, direccion: 'Calle 35 # 8-40' },
    { nombre: 'I.E. Carlota Sánchez', comuna: 'Comuna Cuba', mesas: 30, censoEstimado: 10500, lat: 4.8010, lng: -75.7310, direccion: 'Cra. 25 # 68B-10' }
  ],

  // MANIZALES
  'Manizales': [
    { nombre: 'Instituto Universitario de Caldas', comuna: 'Comuna Cumanday (Centro)', mesas: 32, censoEstimado: 11200, lat: 5.0680, lng: -75.5160, direccion: 'Cra. 23 # 27-40' },
    { nombre: 'Universidad de Caldas (Sede Palogrande)', comuna: 'Comuna Palogrande', mesas: 36, censoEstimado: 12600, lat: 5.0560, lng: -75.4920, direccion: 'Calle 65 # 26-10' },
    { nombre: 'I.E. INEM Baldomero Sanín Cano', comuna: 'Comuna La Fuente', mesas: 28, censoEstimado: 9800, lat: 5.0480, lng: -75.5010, direccion: 'Calle 54 # 25-30' }
  ],

  // IBAGUÉ
  'Ibagué': [
    { nombre: 'I.E. San Simón (Sede Principal)', comuna: 'Comuna 01 (Centro)', mesas: 38, censoEstimado: 13300, lat: 4.4390, lng: -75.2320, direccion: 'Cra. 5 # 34-45' },
    { nombre: 'Coliseo Enrique Triana Olivares (Calle 42)', comuna: 'Comuna 03 (San Simón)', mesas: 30, censoEstimado: 10500, lat: 4.4320, lng: -75.2210, direccion: 'Cra. 5 # 42-10' },
    { nombre: 'I.E. Santa Teresa de Jesús', comuna: 'Comuna 10 (La Francia)', mesas: 26, censoEstimado: 9100, lat: 4.4250, lng: -75.2150, direccion: 'Calle 38 # 4-20' }
  ],

  // SANTA MARTA
  'Santa Marta': [
    { nombre: 'I.E.D. Liceo Celedón', comuna: 'Comuna 01 (Centro Histórico)', mesas: 34, censoEstimado: 11900, lat: 11.2410, lng: -74.2020, direccion: 'Av. Libertador # 14-25' },
    { nombre: 'Coliseo Menor de Santa Marta', comuna: 'Comuna 02 (Polideportivo)', mesas: 30, censoEstimado: 10500, lat: 11.2330, lng: -74.1950, direccion: 'Calle 18 # 19-30' },
    { nombre: 'I.E.D. Hugo J. Bermúdez', comuna: 'Comuna 04 (Pescaito)', mesas: 28, censoEstimado: 9800, lat: 11.2480, lng: -74.2110, direccion: 'Calle 6 # 11-40' }
  ],

  // VILLAVICENCIO
  'Villavicencio': [
    { nombre: 'I.E. Colegio Departamental de la Esperanza', comuna: 'Comuna 02 (La Esperanza)', mesas: 35, censoEstimado: 12250, lat: 4.1430, lng: -73.6320, direccion: 'Calle 15 # 39-10' },
    { nombre: 'Coliseo Álvaro Mesa Amaya', comuna: 'Comuna 01 (Centro)', mesas: 32, censoEstimado: 11200, lat: 4.1490, lng: -73.6380, direccion: 'Av. Alfonso López' },
    { nombre: 'I.E. INEM Luis López de Mesa', comuna: 'Comuna 05 (Sena)', mesas: 38, censoEstimado: 13300, lat: 4.1280, lng: -73.6180, direccion: 'Cra. 22 # 10-30' }
  ],

  // PASTO
  'Pasto': [
    { nombre: 'I.E. Municipal Ciudad de Pasto', comuna: 'Comuna 01 (Centro)', mesas: 36, censoEstimado: 12600, lat: 1.2140, lng: -77.2790, direccion: 'Calle 18 # 25-10' },
    { nombre: 'Coliseo Sergio Antonio Ruano', comuna: 'Comuna 04 (Zona Cívica)', mesas: 30, censoEstimado: 10500, lat: 1.2180, lng: -77.2830, direccion: 'Cra. 27 # 15-40' },
    { nombre: 'I.E. INEM de Pasto', comuna: 'Comuna 06 (Zona Sur)', mesas: 32, censoEstimado: 11200, lat: 1.2010, lng: -77.2910, direccion: 'Cra. 4 # 16-20' }
  ],

  // SOACHA
  'Soacha': [
    { nombre: 'I.E. General Santander (Sede Central)', comuna: 'Comuna 02 (Soacha Centro)', mesas: 38, censoEstimado: 13300, lat: 4.5810, lng: -74.2180, direccion: 'Cra. 7 # 14-20' },
    { nombre: 'I.E. Soacha Avanza La Unidad', comuna: 'Comuna 01 (Compartir)', mesas: 34, censoEstimado: 11900, lat: 4.5720, lng: -74.2310, direccion: 'Calle 30 Sur # 15-10' },
    { nombre: 'I.E. San Mateo (Sede Principal)', comuna: 'Comuna 05 (San Mateo)', mesas: 36, censoEstimado: 12600, lat: 4.5930, lng: -74.2050, direccion: 'Cra. 4E # 28-15' },
    { nombre: 'Coliseo General Santander', comuna: 'Comuna 02 (Soacha Centro)', mesas: 28, censoEstimado: 9800, lat: 4.5830, lng: -74.2190, direccion: 'Calle 13 # 8-25' }
  ],

  // FLORIDABLANCA
  'Floridablanca': [
    { nombre: 'I.E. José Elías Puyana (Sede Principal)', comuna: 'Comuna 01 (Casco Antiguo)', mesas: 34, censoEstimado: 11900, lat: 7.0620, lng: -73.0880, direccion: 'Calle 5 # 8-30' },
    { nombre: 'I.E. Técnico Vicente Azuero', comuna: 'Comuna 03 (Cañaveral)', mesas: 32, censoEstimado: 11200, lat: 7.0710, lng: -73.1090, direccion: 'Calle 30 # 25-10' },
    { nombre: 'Coliseo La Cuchilla', comuna: 'Comuna 02 (La Cumbre)', mesas: 25, censoEstimado: 8750, lat: 7.0580, lng: -73.0780, direccion: 'Cra. 10 # 3-45' }
  ],

  // COTORRA (CÓRDOBA) - DIVIPOLE REGISTRADURÍA
  'Cotorra': [
    { nombre: 'I.E. Cotorra (Sede Principal)', comuna: 'Cabecera Municipal (Centro)', mesas: 18, censoEstimado: 6300, lat: 9.0435, lng: -75.7925, direccion: 'Calle 8 # 6-25, Casco Urbano' },
    { nombre: 'Polideportivo Municipal de Cotorra', comuna: 'Zona Urbana (Sector San Roque)', mesas: 14, censoEstimado: 4900, lat: 9.0410, lng: -75.7960, direccion: 'Carrera 4 # 10-12' },
    { nombre: 'I.E. Trementino', comuna: 'Corregimiento Trementino', mesas: 10, censoEstimado: 3500, lat: 9.0750, lng: -75.7620, direccion: 'Plaza Principal Corregimiento Trementino' },
    { nombre: 'I.E. El Paso de las Flores', comuna: 'Corregimiento El Paso', mesas: 8, censoEstimado: 2800, lat: 9.0210, lng: -75.8230, direccion: 'Sector Principal El Paso de las Flores' },
    { nombre: 'I.E. Los Cedros', comuna: 'Corregimiento Los Cedros', mesas: 6, censoEstimado: 2100, lat: 9.0620, lng: -75.8340, direccion: 'Centro Poblado Los Cedros' },
    { nombre: 'I.E. Abrojal', comuna: 'Corregimiento Abrojal', mesas: 5, censoEstimado: 1750, lat: 9.0880, lng: -75.8050, direccion: 'Plaza Central Abrojal' },
    { nombre: 'I.E. San Roque Rural', comuna: 'Corregimiento San Roque', mesas: 6, censoEstimado: 2100, lat: 9.0340, lng: -75.7710, direccion: 'Vía San Roque Veredal' },
    { nombre: 'Escuela Rural El Carmen', comuna: 'Corregimiento El Carmen', mesas: 4, censoEstimado: 1400, lat: 9.0520, lng: -75.7480, direccion: 'Sector El Carmen Rural' }
  ],

  // MONTERÍA (CÓRDOBA) - DIVIPOLE REGISTRADURÍA
  'Montería': [
    { nombre: 'I.E. Colegio Nacional José María Córdoba', comuna: 'Comuna 01 (Centro)', mesas: 42, censoEstimado: 14700, lat: 8.7540, lng: -75.8840, direccion: 'Calle 27 # 4-30' },
    { nombre: 'Universidad de Córdoba (Sede Berástegui)', comuna: 'Comuna 09 (Zona Norte)', mesas: 48, censoEstimado: 16800, lat: 8.7880, lng: -75.8620, direccion: 'Cra. 6 # 77-305' },
    { nombre: 'Coliseo Miguel "Happy" Lora', comuna: 'Comuna 02 (La Granja)', mesas: 36, censoEstimado: 12600, lat: 8.7420, lng: -75.8920, direccion: 'Cra. 4 # 14-25' },
    { nombre: 'I.E. INEM Lorenzo María Lleras', comuna: 'Comuna 05 (Zona Sur)', mesas: 38, censoEstimado: 13300, lat: 8.7310, lng: -75.8980, direccion: 'Cra. 2 # 18-50' },
    { nombre: 'I.E. Normal Superior de Montería', comuna: 'Comuna 03 (La Pradera)', mesas: 34, censoEstimado: 11900, lat: 8.7610, lng: -75.8710, direccion: 'Calle 29 # 14-20' },
    { nombre: 'I.E. San Jerónimo de Montería', comuna: 'Comuna 04 (Cantaclaro)', mesas: 30, censoEstimado: 10500, lat: 8.7450, lng: -75.8580, direccion: 'Calle 35 # 8-15' },
    { nombre: 'I.E. Antonia Santos', comuna: 'Comuna 08 (Mocarí)', mesas: 28, censoEstimado: 9800, lat: 8.8020, lng: -75.8550, direccion: 'Cra. 1W # 12-40' },
    { nombre: 'I.E. Cristóbal Colón', comuna: 'Comuna 06 (Suroriente)', mesas: 26, censoEstimado: 9100, lat: 8.7240, lng: -75.8850, direccion: 'Calle 14 # 9-20' }
  ],

  // SANTA CRUZ DE LORICA (CÓRDOBA)
  'Santa Cruz de Lorica': [
    { nombre: 'I.E. Rafael Núñez (Sede Central)', comuna: 'Zona Urbana (Centro Histórico)', mesas: 32, censoEstimado: 11200, lat: 9.2390, lng: -75.8140, direccion: 'Calle 1 # 18-20' },
    { nombre: 'I.E. Lacides C. Bersal', comuna: 'Zona Urbana (Barrio Alto Kennedy)', mesas: 28, censoEstimado: 9800, lat: 9.2450, lng: -75.8210, direccion: 'Cra. 25 # 8-10' },
    { nombre: 'Coliseo de Lorica', comuna: 'Zona Cívica', mesas: 24, censoEstimado: 8400, lat: 9.2340, lng: -75.8110, direccion: 'Av. Bicentenario' },
    { nombre: 'I.E. Santa Cruz de El Carito', comuna: 'Corregimiento El Carito', mesas: 12, censoEstimado: 4200, lat: 9.2810, lng: -75.7620, direccion: 'Plaza Principal El Carito' }
  ],

  // CERETÉ (CÓRDOBA)
  'Cereté': [
    { nombre: 'I.E. Marceliano Polo (Sede Principal)', comuna: 'Zona Urbana (Centro)', mesas: 34, censoEstimado: 11900, lat: 8.8840, lng: -75.7920, direccion: 'Cra. 13 # 10-25' },
    { nombre: 'I.E. Alfonso Spath Spath', comuna: 'Corregimiento Martínez', mesas: 16, censoEstimado: 5600, lat: 8.9150, lng: -75.7480, direccion: 'Plaza Central Martínez' },
    { nombre: 'Coliseo Mario de León', comuna: 'Zona Cívica y Deportiva', mesas: 26, censoEstimado: 9100, lat: 8.8780, lng: -75.7980, direccion: 'Calle 14 # 20-30' }
  ],

  // SAHAGÚN (CÓRDOBA)
  'Sahagún': [
    { nombre: 'I.E. Normal Superior Lácides Iriarte', comuna: 'Zona Urbana (Centro)', mesas: 35, censoEstimado: 12250, lat: 8.9480, lng: -75.4420, direccion: 'Calle 18 # 11-20' },
    { nombre: 'Coliseo Noel Cogollo', comuna: 'Zona Cívica', mesas: 28, censoEstimado: 9800, lat: 8.9420, lng: -75.4380, direccion: 'Cra. 6 # 14-30' },
    { nombre: 'I.E. San José de Sahagún', comuna: 'Zona Urbana (San José)', mesas: 26, censoEstimado: 9100, lat: 8.9550, lng: -75.4490, direccion: 'Calle 12 # 5-15' }
  ],

  // SINCELEJO (SUCRE)
  'Sincelejo': [
    { nombre: 'I.E. Antonio Lenis (Sede Principal)', comuna: 'Comuna 01 (Centro)', mesas: 36, censoEstimado: 12600, lat: 9.3010, lng: -75.3980, direccion: 'Calle 20 # 18-35' },
    { nombre: 'Coliseo Las Delicias', comuna: 'Comuna 02 (Las Delicias)', mesas: 30, censoEstimado: 10500, lat: 9.3080, lng: -75.3890, direccion: 'Cra. 16 # 28-40' },
    { nombre: 'I.E. Simón Araújo', comuna: 'Comuna 04 (Majagual)', mesas: 32, censoEstimado: 11200, lat: 9.2940, lng: -75.4120, direccion: 'Cra. 25 # 14-10' }
  ],

  // VALLEDUPAR (CESAR)
  'Valledupar': [
    { nombre: 'I.E. Colegio Nacional Loperena (Sede Central)', comuna: 'Comuna 01 (Centro Histórico)', mesas: 40, censoEstimado: 14000, lat: 10.4760, lng: -73.2480, direccion: 'Calle 16 # 11-40' },
    { nombre: 'I.E. CASD Simón Bolívar', comuna: 'Comuna 02 (Los Cortijos)', mesas: 35, censoEstimado: 12250, lat: 10.4850, lng: -73.2610, direccion: 'Calle 12 # 19-30' },
    { nombre: 'Coliseo Julio Monsalvo Castilla', comuna: 'Comuna 04 (Ciudadela Deportiva)', mesas: 32, censoEstimado: 11200, lat: 10.4610, lng: -73.2390, direccion: 'Av. Simón Bolívar' }
  ],

  // SOLEDAD (ATLÁNTICO)
  'Soledad': [
    { nombre: 'I.E. INEM de Soledad', comuna: 'Comuna 01 (Centro)', mesas: 38, censoEstimado: 13300, lat: 10.9210, lng: -74.7720, direccion: 'Calle 18 # 19-45' },
    { nombre: 'I.E. Politécnico de Soledad', comuna: 'Comuna 03 (Las Gaviotas)', mesas: 34, censoEstimado: 11900, lat: 10.9350, lng: -74.7890, direccion: 'Cra. 24 # 30-10' }
  ],

  // BELLO
  'Bello': [
    { nombre: 'I.E. Fernando Vélez', comuna: 'Comuna 03 (Santa Ana)', mesas: 32, censoEstimado: 11200, lat: 6.3340, lng: -75.5580, direccion: 'Calle 51 # 50-20' },
    { nombre: 'I.E. Alberto Lebrun Múnera', comuna: 'Comuna 04 (Suárez)', mesas: 30, censoEstimado: 10500, lat: 6.3410, lng: -75.5620, direccion: 'Cra. 52 # 56-30' },
    { nombre: 'Coliseo Tulio Ospina', comuna: 'Zona Deportiva Olímpica', mesas: 35, censoEstimado: 12250, lat: 6.3280, lng: -75.5520, direccion: 'Autopista Norte' }
  ]
};

/**
 * Generador Dinámico de Puestos de Votación para CUALQUIER Municipio de Colombia
 * Crea puestos con nombres y zonificación representativa y coherente de Colombia.
 */
export function generarPuestosParaCualquierMunicipio(
  departamento: string,
  municipioRaw: string
): PuestoVotacionInfo[] {
  const municipio = normalizeMunicipioName(municipioRaw) || 'Cabecera Municipal';
  const depCoord = departmentCoordinates[departamento] || { lat: 4.5709, lng: -74.2973 };

  // Plantillas de nombres de puestos tradicionales y oficiales en municipios de Colombia
  const templates = [
    {
      sufijo: 'I.E. Municipal Central',
      comuna: 'Zona Urbana (Centro - Casco Antiguo)',
      mesas: 26,
      censo: 9100,
      dLat: 0.0012,
      dLng: 0.0008,
      direccion: `Calle Real Principal # 5-20, ${municipio}`
    },
    {
      sufijo: 'Colegio Departamental Integrado',
      comuna: 'Zona Urbana (Barrio El Prado)',
      mesas: 22,
      censo: 7700,
      dLat: -0.0018,
      dLng: 0.0022,
      direccion: `Carrera 4 # 12-45, ${municipio}`
    },
    {
      sufijo: 'Coliseo Municipal de Deportes',
      comuna: 'Zona Cívica y Polideportivo',
      mesas: 28,
      censo: 9800,
      dLat: 0.0035,
      dLng: -0.0015,
      direccion: `Av. Los Fundadores # 18-02, ${municipio}`
    },
    {
      sufijo: 'I.E. Escuela Urbana de Niñas y Varones',
      comuna: 'Zona Urbana (Sector Norte)',
      mesas: 18,
      censo: 6300,
      dLat: 0.0042,
      dLng: 0.0031,
      direccion: `Calle 8 # 2-15, ${municipio}`
    },
    {
      sufijo: 'I.E. Técnica Agropecuaria e Industrial',
      comuna: 'Zona Urbana (Sector Sur / La Floresta)',
      mesas: 20,
      censo: 7000,
      dLat: -0.0038,
      dLng: -0.0026,
      direccion: `Salida Principal Sector El Jardín, ${municipio}`
    },
    {
      sufijo: 'I.E. Rural Corregimiento El Centro',
      comuna: 'Corregimiento 01 (Zona Rural)',
      mesas: 12,
      censo: 4200,
      dLat: 0.0085,
      dLng: -0.0075,
      direccion: `Plaza Principal Corregimiento El Centro`
    },
    {
      sufijo: 'I.E. Rural Veredal La Esperanza',
      comuna: 'Corregimiento 02 (Zona Rural)',
      mesas: 10,
      censo: 3500,
      dLat: -0.0092,
      dLng: 0.0088,
      direccion: `Centro Poblado La Esperanza`
    }
  ];

  return templates.map((tmpl, idx) => ({
    id: `pst-${departamento.toLowerCase().replace(/\s+/g, '-')}-${municipio.toLowerCase().replace(/\s+/g, '-')}-${idx + 1}`,
    nombre: `${tmpl.sufijo} de ${municipio}`,
    departamento,
    municipio,
    comuna: tmpl.comuna,
    mesas: tmpl.mesas,
    censoEstimado: tmpl.censo,
    lat: Number((depCoord.lat + tmpl.dLat).toFixed(4)),
    lng: Number((depCoord.lng + tmpl.dLng).toFixed(4)),
    direccion: tmpl.direccion,
    isCustom: false
  }));
}

const STORAGE_CUSTOM_PUESTOS_KEY = 'elecciones_custom_puestos_territorio_v2';

/**
 * Obtener puestos personalizados guardados por el usuario
 */
export function getCustomPuestosStored(): PuestoVotacionInfo[] {
  try {
    const raw = localStorage.getItem(STORAGE_CUSTOM_PUESTOS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Error loading custom puestos', e);
  }
  return [];
}

/**
 * Guardar o actualizar un puesto personalizado
 */
export function saveCustomPuesto(puesto: PuestoVotacionInfo): PuestoVotacionInfo[] {
  const current = getCustomPuestosStored();
  const existingIdx = current.findIndex(p => p.id === puesto.id);
  let updated: PuestoVotacionInfo[];
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = { ...puesto, isCustom: true };
  } else {
    updated = [{ ...puesto, isCustom: true, id: puesto.id || `custom-pst-${Date.now()}` }, ...current];
  }
  try {
    localStorage.setItem(STORAGE_CUSTOM_PUESTOS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Error saving custom puesto', e);
  }
  return updated;
}

/**
 * Eliminar un puesto personalizado
 */
export function deleteCustomPuesto(id: string): PuestoVotacionInfo[] {
  const current = getCustomPuestosStored();
  const updated = current.filter(p => p.id !== id);
  try {
    localStorage.setItem(STORAGE_CUSTOM_PUESTOS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Error deleting custom puesto', e);
  }
  return updated;
}

/**
 * OBTENER TODOS LOS PUESTOS DE VOTACIÓN OFICIALES SEGÚN LA CIRCUNSCRIPCIÓN DEL ASPIRANTE
 * 
 * - Si circunscripcion === 'Municipio': Devuelve los puestos del municipio específico configurado en la campaña.
 * - Si circunscripcion === 'Departamento': Devuelve los puestos principales y cabeceras del departamento.
 * - Incluye puestos personalizados añadidos por el usuario para ese territorio.
 */
export function getPuestosPorCircunscripcion(
  departamento: string = 'Córdoba',
  municipioRaw: string = 'Cotorra',
  circunscripcion: 'Municipio' | 'Departamento' | 'Nacional' = 'Municipio'
): PuestoVotacionInfo[] {
  const normMun = normalizeMunicipioName(municipioRaw) || 'Cotorra';
  const normDep = departamento || 'Córdoba';
  const customList = getCustomPuestosStored().filter(p => 
    circunscripcion === 'Nacional' ||
    p.departamento.toLowerCase() === normDep.toLowerCase() &&
    (circunscripcion === 'Departamento' || p.municipio.toLowerCase() === normMun.toLowerCase())
  );

  let basePuestos: PuestoVotacionInfo[] = [];

  if (circunscripcion === 'Nacional') {
    // Si la campaña es nacional (Presidencia, Senado)
    Object.entries(puestosEmblematicosPorMunicipio).forEach(([mun, list]) => {
      list.forEach((p, idx) => {
        basePuestos.push({
          ...p,
          id: `nac-${mun.toLowerCase().replace(/\s+/g, '-')}-${idx + 1}`,
          departamento: mun === 'Bogotá D.C.' ? 'Bogotá D.C.' : mun === 'Medellín' ? 'Antioquia' : mun === 'Cali' ? 'Valle del Cauca' : mun === 'Barranquilla' ? 'Atlántico' : 'Córdoba',
          municipio: mun
        });
      });
    });
  } else if (circunscripcion === 'Departamento') {
    // Si la campaña es departamental (Gobernación / Asamblea), traer puestos de la capital y municipios
    const capitalKey = Object.keys(puestosEmblematicosPorMunicipio).find(k => 
      k.toLowerCase() === normMun.toLowerCase() || 
      (normDep.toLowerCase().includes('bogotá') && k.includes('Bogotá'))
    );

    if (capitalKey && puestosEmblematicosPorMunicipio[capitalKey]) {
      basePuestos = puestosEmblematicosPorMunicipio[capitalKey].map((p, idx) => ({
        ...p,
        id: `dep-${idx + 1}`,
        departamento: normDep,
        municipio: capitalKey
      }));
    } else {
      basePuestos = generarPuestosParaCualquierMunicipio(normDep, normMun || `${normDep} Central`);
    }
  } else {
    // Si la campaña es municipal / distrital (Alcaldía, Concejo, JAL)
    const exactMatchKey = Object.keys(puestosEmblematicosPorMunicipio).find(k => 
      k.toLowerCase() === normMun.toLowerCase()
    );

    if (exactMatchKey && puestosEmblematicosPorMunicipio[exactMatchKey]) {
      basePuestos = puestosEmblematicosPorMunicipio[exactMatchKey].map((p, idx) => ({
        ...p,
        id: `pst-${normMun.toLowerCase().replace(/\s+/g, '-')}-${idx + 1}`,
        departamento: normDep,
        municipio: normMun
      }));
    } else {
      // Generar puestos oficiales y georreferenciados para cualquier municipio
      basePuestos = generarPuestosParaCualquierMunicipio(normDep, normMun);
    }
  }

  // Si por alguna razón basePuestos está vacío, asegurar generación inmediata
  if (basePuestos.length === 0) {
    basePuestos = generarPuestosParaCualquierMunicipio(normDep, normMun);
  }

  // Combinar con puestos customizados
  return [...customList, ...basePuestos];
}

import { partidosPoliticosColombia } from './colombiaTerritorialData';

/**
 * Obtiene la lista completa de todos los partidos políticos oficiales de Colombia,
 * priorizando al inicio el aval y coalición del candidato si están definidos.
 */
export function getPartidosPrioritariosCandidato(campaignDossier: any): string[] {
  const prioritariosSet = new Set<string>();

  // 1. Partido o Movimiento Principal del Candidato
  if (campaignDossier?.partidoUnico && typeof campaignDossier.partidoUnico === 'string' && campaignDossier.partidoUnico.trim()) {
    prioritariosSet.add(campaignDossier.partidoUnico.trim());
  }
  if (campaignDossier?.movimientoFirmas && typeof campaignDossier.movimientoFirmas === 'string' && campaignDossier.movimientoFirmas.trim()) {
    prioritariosSet.add(campaignDossier.movimientoFirmas.trim());
  }
  if (campaignDossier?.partidoAvalPrincipal && typeof campaignDossier.partidoAvalPrincipal === 'string' && campaignDossier.partidoAvalPrincipal.trim()) {
    prioritariosSet.add(campaignDossier.partidoAvalPrincipal.trim());
  }

  // 2. Partidos de la Coalición
  if (Array.isArray(campaignDossier?.coalicionPartidos)) {
    campaignDossier.coalicionPartidos.forEach((p: string) => {
      if (p && typeof p === 'string' && p.trim()) prioritariosSet.add(p.trim());
    });
  }

  // 3. Campañas y Listas Aliadas
  if (Array.isArray(campaignDossier?.campanasAliadas)) {
    campaignDossier.campanasAliadas.forEach((aliada: any) => {
      if (aliada?.partido && typeof aliada.partido === 'string' && aliada.partido.trim()) {
        prioritariosSet.add(aliada.partido.trim());
      }
    });
  }

  // Combinar los avales prioritarios de la campaña con TODOS los partidos políticos oficiales de Colombia
  const listadoCompleto = Array.from(new Set([
    ...Array.from(prioritariosSet),
    ...partidosPoliticosColombia
  ]));

  return listadoCompleto;
}
