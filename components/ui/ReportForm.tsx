'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import * as turf from '@turf/turf';
import type { Feature, FeatureCollection, LineString, MultiLineString } from 'geojson';
import type { IncidentTypes, Prisma } from '@/lib/generated/prisma';
import iconDark from "@/assets/logo/icon-dark.png";

type IncidentCategoryOption = Pick<
  IncidentTypes,
  'id' | 'code' | 'name' | 'description' | 'default_duration_hours'
>;

export type CreatedReportResponse = Prisma.ReportsGetPayload<{
  include: {
    IncidentTypes: { select: { name: true; code: true } };
    Users: {
      select: {
        first_name: true;
        last_name_paternal: true;
        collaboration_level: true;
        action_points: true;
      };
    };
  };
}>;

interface ReportFormProps {
  isOpen: boolean;
  onClose: () => void;
  onReportCreated?: (report: CreatedReportResponse) => void;
}

interface SnappedLocation {
  latitude: number;
  longitude: number;
  street_osm_id: string;
  street_name: string | null;
}

const MAX_SNAP_DISTANCE_METERS = 60;

export default function ReportForm({
  isOpen,
  onClose,
  onReportCreated,
}: ReportFormProps) {
  const [categories, setCategories] = useState<IncidentCategoryOption[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState<boolean>(true);

  const [selectedTypeId, setSelectedTypeId] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);

  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [locationData, setLocationData] = useState<SnappedLocation | null>(null);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'locating' | 'ready' | 'error'>('idle');
  const [geoError, setGeoError] = useState<string | null>(null);

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const streetsCacheRef = useRef<FeatureCollection<LineString | MultiLineString> | null>(null);

  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  }, []);

  const resetFormState = useCallback(() => {
    stopCameraStream();
    if (photoPreviewUrl) {
      URL.revokeObjectURL(photoPreviewUrl);
    }
    setSelectedTypeId('');
    setDescription('');
    setPhotoBlob(null);
    setPhotoPreviewUrl(null);
    setIsLoadingCategories(true);
    setCameraError(null);
    setLocationData(null);
    setGeoStatus('idle');
    setGeoError(null);
    setFormError(null);
    setIsSubmitting(false);
  }, [photoPreviewUrl, stopCameraStream]);

  const handleClose = useCallback(() => {
    resetFormState();
    onClose();
  }, [onClose, resetFormState]);

  const fetchIncidentCategories = useCallback(async () => {
    try {
      const response = await fetch('/incident-types');
      if (!response.ok) {
        throw new Error('No se pudieron obtener las categorías.');
      }
      const data = (await response.json()) as IncidentCategoryOption[];
      setCategories(data);
    } catch {
      setFormError('Error al cargar las categorías de cierre desde el servidor.');
    } finally {
      setIsLoadingCategories(false);
    }
  }, []);

  const resolveGpsAndStreet = useCallback(async () => {
    setGeoStatus('locating');
    setGeoError(null);
    setLocationData(null);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (typeof window === 'undefined') {
          reject(new Error('Tu navegador no soporta geolocalización GPS.'));
          return;
        }

        if (!window.isSecureContext) {
          reject(
            new Error('La ubicación requiere HTTPS o probar desde localhost (conexión segura).')
          );
          return;
        }

        if (!('geolocation' in navigator)) {
          reject(new Error('Tu navegador no soporta geolocalización GPS.'));
          return;
        }

        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      const latitude = Number(position.coords.latitude.toFixed(6));
      const longitude = Number(position.coords.longitude.toFixed(6));

      if (!streetsCacheRef.current) {
        const res = await fetch('/streets-atlixco.json');
        if (!res.ok) {
          setGeoStatus('error');
          setGeoError('No se pudo cargar el catálogo de calles de Atlixco.');
          return;
        }
        streetsCacheRef.current =
          (await res.json()) as FeatureCollection<LineString | MultiLineString>;
      }

      let nearestOsmId: string | null = null;
      let nearestStreetName: string | null = null;
      let minDistanceMeters = Infinity;

      if (streetsCacheRef.current?.features) {
        const userPoint = turf.point([longitude, latitude]);

        for (const feature of streetsCacheRef.current.features) {
          if (
            feature.geometry?.type !== 'LineString' &&
            feature.geometry?.type !== 'MultiLineString'
          ) {
            continue;
          }

          const lineFeature = feature as Feature<LineString | MultiLineString>;
          const snapped = turf.nearestPointOnLine(lineFeature, userPoint, {
            units: 'meters',
          });
          const dist = snapped.properties?.dist ?? Infinity;

          if (dist < minDistanceMeters) {
            minDistanceMeters = dist;
            const props = feature.properties ?? {};
            nearestOsmId =
              String(
                props.osmid ?? props.osm_id ?? props['@id'] ?? props.id ?? feature.id ?? ''
              ) || null;
            nearestStreetName =
              (props.name as string | undefined) ??
              (props.street_name as string | undefined) ??
              'Vialidad de Atlixco';
          }
        }
      }

      if (
        streetsCacheRef.current &&
        Number.isFinite(minDistanceMeters) &&
        minDistanceMeters > MAX_SNAP_DISTANCE_METERS
      ) {
        setGeoStatus('error');
        setGeoError('Debes encontrarte sobre o junto a una calle de Atlixco para reportar.');
        return;
      }

      if (!nearestOsmId) {
        setGeoStatus('error');
        setGeoError('No se pudo identificar la calle de tu ubicación. Intenta de nuevo.');
        return;
      }

      setLocationData({
        latitude,
        longitude,
        street_osm_id: nearestOsmId,
        street_name: nearestStreetName,
      });
      setGeoStatus('ready');
    } catch (error) {
      setGeoStatus('error');
      setGeoError(
        error instanceof Error ? error.message : 'Activa el permiso de ubicación GPS para continuar.'
      );
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const requestId = window.setTimeout(() => {
      void fetchIncidentCategories();
      void resolveGpsAndStreet();
    }, 0);

    return () => {
      window.clearTimeout(requestId);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [fetchIncidentCategories, isOpen, resolveGpsAndStreet]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClose, isOpen]);

  const startLiveCamera = async () => {
    setCameraError(null);
    setFormError(null);

    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('Este navegador no permite acceso directo a la cámara.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      setIsCameraActive(true);

      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {
            setCameraError('No se pudo iniciar la vista previa de la cámara.');
          });
        }
      });
    } catch {
      setCameraError('Permiso de cámara denegado. Es obligatorio tomar la foto en vivo.');
    }
  };

  const captureLivePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) return;

    context.drawImage(video, 0, 0, width, height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError('No se pudo procesar la fotografía capturada.');
          return;
        }

        if (photoPreviewUrl) {
          URL.revokeObjectURL(photoPreviewUrl);
        }

        setPhotoBlob(blob);
        setPhotoPreviewUrl(URL.createObjectURL(blob));
        stopCameraStream();
      },
      'image/jpeg',
      0.85
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (!selectedTypeId) {
      setFormError('Selecciona una categoría del cierre.');
      return;
    }

    if (!description.trim()) {
      setFormError('Ingresa una descripción del incidente.');
      return;
    }

    if (!photoBlob) {
      setFormError('Captura una fotografía en vivo como evidencia.');
      return;
    }

    if (geoStatus !== 'ready' || !locationData) {
      setFormError(geoError ?? 'Se requiere ubicación GPS válida para reportar.');
      return;
    }

    const payload = new FormData();
    payload.append('incident_type_id', selectedTypeId);
    payload.append('description', description.trim());
    payload.append('latitude', String(locationData.latitude));
    payload.append('longitude', String(locationData.longitude));
    payload.append('street_osm_id', locationData.street_osm_id);
    if (locationData.street_name) {
      payload.append('street_name', locationData.street_name);
    }
    payload.append('photo', photoBlob, 'evidencia.jpg');

    try {
      setIsSubmitting(true);
      const response = await fetch('/reports', {
        method: 'POST',
        body: payload,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? 'No se pudo registrar el reporte.');
      }

      if (onReportCreated) {
        onReportCreated(result as CreatedReportResponse);
      }

      handleClose();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'Error de conexión al enviar el reporte.'
      );
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-night-sky/55 p-4 transition-opacity md:pointer-events-none md:items-end md:justify-end md:bg-transparent md:p-0 md:pb-24 md:pr-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="pointer-events-auto relative w-full max-w-82.5 rounded-[22px] bg-tourist-flower p-5 shadow-2xl"
      >
        <button
          type="button"
          onClick={handleClose}
          aria-label="Cerrar formulario de reporte"
          className="absolute right-4 top-3.5 cursor-pointer text-night-sky transition hover:opacity-75"
        >
          <span className="material-icons-round text-3xl leading-none select-none">
            close
          </span>
        </button>

        <div className="mb-4 flex items-center justify-center gap-2 text-volcano-snow">
          <Image
            src={iconDark}
            alt=""
            aria-hidden="true"
            width={28}
            height={28}
            className="h-7 w-7 object-contain select-none"
            draggable={false}
          />
          <h2
            id="report-modal-title"
            className="text-header-2 font-bold tracking-tight text-volcano-snow"
          >
            Reportar
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
          <div className="relative flex items-center rounded-xl border-2 border-olive-seasoning bg-volcano-snow px-3 py-2.5 shadow-inner">
            <span
              className="material-icons-round pointer-events-none mr-2 text-3xl leading-none text-night-sky select-none"
              aria-hidden="true"
            >
              arrow_drop_down
            </span>
            <select
              id="incident-type-select"
              value={selectedTypeId}
              onChange={(e) => setSelectedTypeId(e.target.value)}
              disabled={isLoadingCategories}
              required
              aria-label="Categoría del cierre"
              className="w-full cursor-pointer appearance-none bg-transparent text-normal-text font-medium text-night-sky focus:outline-none disabled:opacity-60"
            >
              <option value="" disabled>
                {isLoadingCategories ? 'Cargando categorías...' : 'Categoría del cierre'}
              </option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="relative flex items-start rounded-xl border-2 border-olive-seasoning bg-volcano-snow p-3 shadow-inner">
            <span
              className="material-icons-round mr-2 mt-0.5 text-3xl leading-none text-night-sky select-none"
              aria-hidden="true"
            >
              rate_review
            </span>
            <textarea
              id="report-description"
              rows={4}
              maxLength={1000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción"
              required
              aria-label="Descripción"
              className="w-full resize-none bg-transparent text-normal-text font-medium text-night-sky placeholder:text-night-sky/80 focus:outline-none"
            />
          </div>

          {!isCameraActive && !photoPreviewUrl && (
            <button
              type="button"
              onClick={startLiveCamera}
              className="flex w-full cursor-pointer items-center rounded-xl border-2 border-olive-seasoning bg-volcano-snow px-3 py-2.5 text-left shadow-inner transition hover:opacity-95"
            >
              <span
                className="material-icons-round mr-3 text-3xl leading-none text-night-sky select-none"
                aria-hidden="true"
              >
                add_a_photo
              </span>
              <span className="text-normal-text font-medium text-night-sky">
                Adjuntar foto
              </span>
            </button>
          )}

          {isCameraActive && (
            <div className="overflow-hidden rounded-xl border-2 border-olive-seasoning bg-night-sky">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-40 w-full object-cover"
              />
              <div className="flex items-center justify-between bg-volcano-snow px-3 py-2">
                <button
                  type="button"
                  onClick={stopCameraStream}
                  className="cursor-pointer text-xs font-semibold text-enphasis-red hover:underline"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={captureLivePhoto}
                  className="flex cursor-pointer items-center gap-1 rounded-full bg-night-sky px-3.5 py-1 text-xs font-semibold text-volcano-snow hover:opacity-90"
                >
                  <span className="material-icons-round text-3xl leading-none">
                    photo_camera
                  </span>
                  Capturar
                </button>
              </div>
            </div>
          )}

          {photoPreviewUrl && !isCameraActive && (
            <div className="overflow-hidden rounded-xl border-2 border-olive-seasoning bg-volcano-snow p-2">
              <Image
                src={photoPreviewUrl}
                alt="Evidencia capturada en vivo"
                width={400}
                height={112}
                unoptimized
                className="h-28 w-full rounded-lg object-cover"
              />
              <div className="mt-1.5 flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-night-sky">
                  Evidencia lista
                </span>
                <button
                  type="button"
                  onClick={startLiveCamera}
                  className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-night-sky hover:underline"
                >
                  <span className="material-icons-round text-3xl leading-none">
                    refresh
                  </span>
                  Volver a tomar
                </button>
              </div>
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />

          <div className="flex items-center justify-between rounded-lg bg-volcano-snow/25 px-2.5 py-1.5 text-xs font-medium text-volcano-snow">
            <span className="flex items-center gap-1.5 truncate">
              <span className="material-icons-round text-3xl leading-none select-none" draggable={false}>
                {geoStatus === 'ready'
                  ? 'my_location'
                  : geoStatus === 'locating'
                    ? 'location_searching'
                    : 'location_disabled'}
              </span>
              <span className="truncate">
                {geoStatus === 'locating' && 'Obteniendo ubicación GPS...'}
                {geoStatus === 'ready' &&
                  (locationData?.street_name ?? 'Ubicación verificada')}
                {geoStatus === 'error' && 'GPS no disponible'}
                {geoStatus === 'idle' && 'Obteniendo ubicación GPS...'}
              </span>
            </span>
            {geoStatus === 'error' && (
              <button
                type="button"
                onClick={() => {
                  setGeoStatus('locating');
                  setGeoError(null);
                  void resolveGpsAndStreet();
                }}
                className="ml-2 shrink-0 cursor-pointer underline"
              >
                Reintentar
              </button>
            )}
          </div>

          {(cameraError || geoError || formError) && (
            <p
              role="alert"
              className="rounded-lg bg-night-sky/90 px-3 py-2 text-center text-xs font-medium text-volcano-snow"
            >
              {formError ?? cameraError ?? geoError}
            </p>
          )}

          <div className="pt-1 text-center">
            <button
              type="submit"
              disabled={isSubmitting}
              className="cursor-pointer rounded-full bg-night-sky px-9 py-2.5 text-normal-text font-semibold text-volcano-snow shadow-md transition hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Enviando...' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}