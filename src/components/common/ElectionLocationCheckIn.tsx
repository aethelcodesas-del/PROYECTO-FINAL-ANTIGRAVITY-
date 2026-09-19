import React, { useEffect, useState } from 'react';
import { CheckCircle2, Locate, MapPin, ShieldCheck, WifiOff } from 'lucide-react';
import type { AuthUser } from '../../types';
import { supabase } from '../../lib/supabase';

type PersonType = 'witness' | 'juror';

interface ElectionLocationCheckInProps {
  authUser: AuthUser | null;
  personType: PersonType;
}

interface AssignmentRecord {
  id: string;
  puesto: string;
  mesa: string;
  observaciones: string | null;
}

interface CheckInData {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  distanceMeters: number;
  checkedInAt: string;
  status: 'EN_MESA' | 'FUERA_DEL_PERIMETRO' | 'UBICACION_CAPTURADA';
  consent: true;
}

const CHECK_IN_RADIUS_METERS = 150;

const distanceInMeters = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const earthRadius = 6371000;
  const toRadians = (value: number) => value * Math.PI / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const readMetadata = (value: string | null) => {
  try { return JSON.parse(value || '{}'); } catch { return {}; }
};

export const ElectionLocationCheckIn: React.FC<ElectionLocationCheckInProps> = ({ authUser, personType }) => {
  const [assignment, setAssignment] = useState<AssignmentRecord | null>(null);
  const [checkIn, setCheckIn] = useState<CheckInData | null>(null);
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const [showPermissionModal, setShowPermissionModal] = useState(
    authUser?.role === 'testigo_electoral' || authUser?.role === 'jurado_mesa'
  );

  useEffect(() => {
    const loadAssignment = async () => {
      setLoading(true);
      setError('');
      try {
        if (!authUser?.email) throw new Error('La sesión no tiene un correo asociado.');
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id;
        if (!userId) throw new Error('Debes iniciar sesión para confirmar tu ubicación.');
        const { data: profile, error: profileError } = await supabase
          .from('profiles').select('client_id').eq('id', userId).maybeSingle();
        if (profileError) throw profileError;
        if (!profile?.client_id) throw new Error('Tu usuario no tiene una campaña asignada.');

        const result = personType === 'witness'
          ? await supabase.from('witnesses').select('id,puesto,mesa,observaciones,email').eq('client_id', profile.client_id)
          : await supabase.from('jurors').select('id,puesto,mesa,observaciones').eq('client_id', profile.client_id);
        const data = result.data as any[] | null;
        const queryError = result.error;
        if (queryError) throw queryError;
        const normalizedEmail = authUser.email.trim().toLowerCase();
        const row = (data || []).find((item: any) => {
          if (personType === 'witness') return String(item.email || '').trim().toLowerCase() === normalizedEmail;
          return String(readMetadata(item.observaciones)?.jurorMeta?.email || '').trim().toLowerCase() === normalizedEmail;
        });
        if (!row) throw new Error(`No existe una asignación de ${personType === 'witness' ? 'testigo' : 'jurado'} vinculada a este correo.`);
        setAssignment(row);
        const savedCheckIn = readMetadata(row.observaciones)?.locationCheckIn;
        if (savedCheckIn?.checkedInAt) {
          setCheckIn(savedCheckIn);
          setConsent(true);
          setShowPermissionModal(false);
        }
      } catch (loadError: any) {
        const message = loadError?.message || 'No fue posible cargar la asignación electoral.';
        setError(/no tiene una campaña asignada/i.test(message) ? '' : message);
      } finally {
        setLoading(false);
      }
    };
    void loadAssignment();
  }, [authUser?.email, personType]);

  const assignmentMetadata = readMetadata(assignment?.observaciones || null);
  const coordinateSource = assignmentMetadata.pollingPlaceCoordinates || assignmentMetadata.coordinates || {};
  const assignedLatitude = Number(coordinateSource.latitude ?? coordinateSource.lat ?? assignmentMetadata.latitude);
  const assignedLongitude = Number(coordinateSource.longitude ?? coordinateSource.lng ?? assignmentMetadata.longitude);
  const hasAssignedCoordinates = Number.isFinite(assignedLatitude) && Number.isFinite(assignedLongitude)
    && assignedLatitude !== 0 && assignedLongitude !== 0;

  const confirmArrival = (authorized = consent) => {
    if (!assignment || !authorized) return;
    if (!navigator.geolocation) return setError('Este dispositivo no permite obtener ubicación GPS.');
    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(async position => {
      try {
        const distanceMeters = hasAssignedCoordinates ? distanceInMeters(
          position.coords.latitude, position.coords.longitude, assignedLatitude, assignedLongitude
        ) : 0;
        const locationCheckIn: CheckInData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: Math.round(position.coords.accuracy),
          distanceMeters,
          checkedInAt: new Date().toISOString(),
          status: hasAssignedCoordinates
            ? (distanceMeters <= CHECK_IN_RADIUS_METERS ? 'EN_MESA' : 'FUERA_DEL_PERIMETRO')
            : 'UBICACION_CAPTURADA',
          consent: true
        };
        const metadata = readMetadata(assignment.observaciones);
        const payload: Record<string, unknown> = {
          observaciones: JSON.stringify({ ...metadata, locationCheckIn }),
          updated_at: new Date().toISOString()
        };
        if (personType === 'witness') payload.estado = locationCheckIn.status === 'EN_MESA' ? 'EN_MESA' : 'ACREDITADO';
        const { error: updateError } = await supabase
          .from(personType === 'witness' ? 'witnesses' : 'jurors')
          .update(payload).eq('id', assignment.id);
        if (updateError) throw updateError;
        setCheckIn(locationCheckIn);
        setShowPermissionModal(false);
      } catch (saveError: any) {
        setError(saveError?.message || 'No fue posible guardar la ubicación.');
      } finally {
        setLocating(false);
      }
    }, geoError => {
      setLocating(false);
      setError(geoError.code === geoError.PERMISSION_DENIED
        ? 'Debes autorizar la ubicación GPS para confirmar la llegada.'
        : 'No fue posible obtener una ubicación precisa. Activa el GPS e inténtalo nuevamente.');
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  };

  const requestMandatoryLocation = () => {
    setConsent(true);
    confirmArrival(true);
  };

  const statusLabel = checkIn?.status === 'EN_MESA'
    ? 'En mesa asignada'
    : checkIn?.status === 'UBICACION_CAPTURADA'
      ? 'Ubicación capturada'
      : checkIn ? 'Fuera del perímetro' : 'Sin ubicación';

  return (
    <>
    {showPermissionModal && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md election-location-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="location-permission-title">
        <div className="election-location-modal w-full max-w-md rounded-3xl border border-cyan-400/40 bg-[#07162b] p-6 shadow-2xl shadow-cyan-950/50">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/40 bg-cyan-500/15 text-cyan-300 election-location-icon">
            <MapPin className="h-7 w-7" />
          </div>
          <h2 id="location-permission-title" className="text-center text-xl font-black text-white election-location-title">Permitir ubicación</h2>
          <p className="mt-3 text-center text-sm leading-6 text-slate-300 election-location-desc">
            Para ingresar al panel de {personType === 'witness' ? 'testigo electoral' : 'jurado de mesa'}, debe permitir la ubicación del dispositivo. Se usará exclusivamente para registrar su llegada al puesto asignado.
          </p>
          {loading && <p className="mt-4 text-center text-xs text-cyan-300">Verificando su asignación…</p>}
          {error && <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-xs text-rose-200">{error}</p>}
          <button
            type="button"
            onClick={requestMandatoryLocation}
            disabled={loading || locating || !assignment}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-3 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40 election-location-btn"
          >
            <Locate className={`h-5 w-5 ${locating ? 'animate-pulse' : ''}`} />
            {locating ? 'Obteniendo ubicación…' : 'Permitir ubicación y continuar'}
          </button>
          <p className="mt-3 text-center text-[10px] text-slate-500">Si el navegador bloqueó el permiso, actívelo desde el icono de ubicación de la barra de direcciones y vuelva a intentarlo.</p>
        </div>
      </div>
    )}
    <section className="election-checkin-banner rounded-2xl border border-cyan-500/30 bg-[#041126] p-4 text-xs shadow-lg">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <h3 className="flex items-center gap-2 font-black text-white election-checkin-title">
            <MapPin className="h-4 w-4 text-cyan-400 shrink-0" /> Confirmación GPS de llegada
          </h3>
          {loading ? <p className="text-slate-400">Consultando asignación real…</p> : assignment ? (
            <p className="text-slate-300 election-checkin-details">{assignment.puesto} · {assignment.mesa} · Radio permitido: {CHECK_IN_RADIUS_METERS} m</p>
          ) : <p className="text-slate-400">No hay una asignación disponible para esta sesión.</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className={`election-checkin-status rounded-lg border px-3 py-2 font-bold ${
            checkIn?.status === 'EN_MESA'
              ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
              : checkIn
                ? 'border-rose-500/40 bg-rose-500/15 text-rose-300'
                : 'border-slate-700 bg-slate-900 text-slate-400'
          }`}>
            {checkIn?.status === 'EN_MESA' ? <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" /> : <WifiOff className="mr-1 inline h-3.5 w-3.5" />}
            {statusLabel}{checkIn ? ` · ${checkIn.distanceMeters} m` : ''}
          </span>
          <button
            type="button"
            onClick={() => confirmArrival()}
            disabled={loading || locating || !assignment || !consent}
            className="election-checkin-btn flex items-center gap-2 rounded-xl bg-cyan-500 px-3 py-2 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Locate className={`h-4 w-4 ${locating ? 'animate-pulse' : ''}`} />
            {locating ? 'Ubicando…' : 'Confirmar llegada'}
          </button>
        </div>
      </div>

      <label className="mt-3 flex cursor-pointer items-start gap-2 border-t border-cyan-500/15 pt-3 text-slate-300 election-checkin-consent">
        <input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} className="mt-0.5" />
        <span><ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-emerald-400" />Autorizo registrar mi ubicación únicamente para verificar mi presencia en el puesto y mesa asignados durante la jornada electoral.</span>
      </label>
      {!hasAssignedCoordinates && assignment && <p className="mt-2 text-amber-300 election-checkin-warning">La ubicación del dispositivo se registrará, pero el puesto aún no tiene coordenadas para validar el perímetro.</p>}
      {error && <p className="mt-2 text-rose-300">{error}</p>}
      {checkIn && <p className="mt-2 font-mono text-[10px] text-slate-500">Último reporte: {new Date(checkIn.checkedInAt).toLocaleString('es-CO')} · Precisión ±{checkIn.accuracyMeters} m</p>}
    </section>
    </>
  );
};
