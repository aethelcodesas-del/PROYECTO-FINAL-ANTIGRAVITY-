/**
 * useCampaignGeo — Hook de datos geográficos de la campaña activa
 *
 * Lee la circunscripción del CampaignContext y retorna:
 *   - La lista real de corregimientos/barrios/localidades del municipio
 *   - El label correcto del campo ("Barrio", "Corregimiento", "Localidad"…)
 *   - Un resumen de contexto listo para inyectar en prompts de IA
 *   - La etiqueta del cargo electoral
 */

import { useMemo } from 'react';
import { useCampaignData } from '../contexts/CampaignContext';
import { getSubdivisiones, getOfficeLabel } from '../services/geoContextService';

export interface CampaignGeoContext {
  /** Nombre singular del tipo de subdivisión: "Corregimiento / Vereda", "Barrio", "Localidad" */
  subdivisionLabel: string;
  /** Nombre plural: "Corregimientos / Veredas", "Barrios", "Localidades" */
  subdivisionLabelPlural: string;
  /** Lista real de subdivisiones del municipio de la campaña */
  subdivisions: string[];
  /** Tipo de circunscripción: MUNICIPAL | DEPARTAMENTAL | NACIONAL */
  campaignScope: string;
  /** Label del cargo: "Alcaldía", "Gobernación", "Senado"… */
  officeLabel: string;
  /** Adjetivo del ámbito: "Municipal", "Departamental", "Nacional" */
  officeAdjective: string;
  /** Municipio limpio (sin "(Capital)") */
  municipality: string;
  /** Departamento de la campaña */
  department: string;
  /** Territorio completo formateado: "Cotorra, Córdoba" */
  territory: string;
  /**
   * Bloque de contexto para inyectar al inicio de cualquier prompt de IA.
   * Garantiza que todas las respuestas de IA se refieran al territorio real.
   */
  aiContextBlock: string;
}

export function useCampaignGeo(): CampaignGeoContext {
  const campaign = useCampaignData();

  return useMemo(() => {
    const mun   = campaign.municipality || '';
    const dep   = campaign.department   || '';
    const scope = campaign.circunscripcion || 'MUNICIPAL';
    const office = getOfficeLabel(campaign.officeType || '');
    const geoResult = getSubdivisiones(mun, dep, scope);

    const territory = campaign.territory ||
      (scope === 'NACIONAL' ? 'Colombia' :
       scope === 'DEPARTAMENTAL' ? dep :
       [mun, dep].filter(Boolean).join(', '));

    const subdivisionList = geoResult.lista.slice(0, 30).join(', ');

    const aiContextBlock = campaign.candidateName
      ? `CONTEXTO DE CAMPAÑA (NO IGNORAR):
Candidato/a: ${campaign.candidateName}
Cargo aspirado: ${office.singular} (${campaign.officeType})
Circunscripción: ${scope}
Territorio: ${territory}
Partido/Coalición: ${campaign.partyAlliance || 'Independiente'}
Slogan: ${campaign.slogan || 'Sin slogan definido'}
Subdivisiones territoriales del municipio: ${subdivisionList}

INSTRUCCIÓN CRÍTICA: Todas tus respuestas deben referirse EXCLUSIVAMENTE al territorio "${territory}". NO menciones otras ciudades, municipios o departamentos que no sean parte de esta circunscripción. Adapta tu lenguaje, ejemplos y propuestas al contexto real de ${territory}.`
      : '';

    return {
      subdivisionLabel:       geoResult.tipo,
      subdivisionLabelPlural: geoResult.tipoPlural,
      subdivisions:           geoResult.lista,
      campaignScope:          scope,
      officeLabel:            office.singular,
      officeAdjective:        office.adjective,
      municipality:           mun,
      department:             dep,
      territory,
      aiContextBlock,
    };
  }, [campaign]);
}
