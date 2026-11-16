import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import * as turf from '@turf/turf';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import type { Feature, FeatureCollection, LineString, MultiLineString } from 'geojson';
import { prisma } from '@/lib/prisma';

const ATLIXCO_BOUNDS = {
  minLat: 18.84,
  maxLat: 18.97,
  minLng: -98.52,
  maxLng: -98.37,
};

type StreetFeature = Feature<LineString | MultiLineString>;

interface StreetFeatureIndex {
  features: StreetFeature[];
  byOsmId: Map<string, StreetFeature[]>;
  byName: Map<string, StreetFeature[]>;
}

let streetFeatureIndexPromise: Promise<StreetFeatureIndex> | null = null;

function getStreetOsmId(feature: StreetFeature): string | null {
  const properties = feature.properties ?? {};
  const rawId =
    properties.osmid ??
    properties.osm_id ??
    properties['@id'] ??
    properties.id ??
    feature.id;

  return String(rawId ?? '') || null;
}

function normalizeStreetName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

function addFeatureToIndex(
  index: Map<string, StreetFeature[]>,
  key: string,
  feature: StreetFeature
): void {
  const matchingFeatures = index.get(key);
  if (matchingFeatures) {
    matchingFeatures.push(feature);
  } else {
    index.set(key, [feature]);
  }
}

function getStreetFeatureIndex(): Promise<StreetFeatureIndex> {
  if (!streetFeatureIndexPromise) {
    streetFeatureIndexPromise = readFile(
      path.join(process.cwd(), 'public', 'streets-atlixco.json'),
      'utf8'
    )
      .then((contents) => {
        const collection = JSON.parse(contents) as FeatureCollection<
          LineString | MultiLineString
        >;
        const features = collection.features.filter(
          (feature): feature is StreetFeature =>
            feature.geometry?.type === 'LineString' ||
            feature.geometry?.type === 'MultiLineString'
        );
        const byOsmId = new Map<string, StreetFeature[]>();
        const byName = new Map<string, StreetFeature[]>();

        for (const feature of features) {
          const osmId = getStreetOsmId(feature);
          if (osmId) {
            addFeatureToIndex(byOsmId, osmId, feature);
          }

          const properties = feature.properties ?? {};
          const names = Array.isArray(properties.name)
            ? properties.name
            : [properties.name];
          for (const name of names) {
            if (typeof name === 'string' && name.trim()) {
              addFeatureToIndex(byName, normalizeStreetName(name), feature);
            }
          }
        }

        return { features, byOsmId, byName };
      })
      .catch((error: unknown) => {
        streetFeatureIndexPromise = null;
        throw error;
      });
  }

  return streetFeatureIndexPromise;
}

function findNearestStreetFeature(
  features: StreetFeature[],
  latitude: number,
  longitude: number
): StreetFeature | null {
  if (features.length === 0) {
    return null;
  }

  const point = turf.point([longitude, latitude]);
  let nearestFeature: StreetFeature | null = null;
  let minDistanceMeters = Infinity;

  for (const feature of features) {
    const snappedPoint = turf.nearestPointOnLine(feature, point, { units: 'meters' });
    const distanceMeters = snappedPoint.properties?.dist ?? Infinity;

    if (distanceMeters < minDistanceMeters) {
      minDistanceMeters = distanceMeters;
      nearestFeature = feature;
    }
  }

  return nearestFeature;
}

function getDisplayName(
  user: {
    first_name: string | null;
    last_name_paternal: string | null;
    last_name_maternal: string | null;
  },
  fallback: string
): string {
  const name = [
    user.first_name,
    user.last_name_paternal,
    user.last_name_maternal,
  ]
    .filter((part): part is string => Boolean(part?.trim()))
    .map((part) => part.trim())
    .join(' ');

  return name || fallback;
}

/**
 * Uploads evidence image to Cloudinary when configured, falling back to local public storage.
 */
async function storeEvidencePhoto(file: File): Promise<string> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (cloudName && apiKey && apiSecret) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const folder = 'via-atlixco/reports';
    const signaturePayload = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash('sha1').update(signaturePayload).digest('hex');

    const cloudForm = new FormData();
    cloudForm.append('file', file);
    cloudForm.append('api_key', apiKey);
    cloudForm.append('timestamp', timestamp);
    cloudForm.append('folder', folder);
    cloudForm.append('signature', signature);

    const uploadRes = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: 'POST', body: cloudForm }
    );

    if (!uploadRes.ok) {
      throw new Error('Error al subir la evidencia fotográfica al servicio en la nube.');
    }

    const uploadData = (await uploadRes.json()) as { secure_url: string };
    return uploadData.secure_url;
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'reports');
  await mkdir(uploadDir, { recursive: true });

  const fileName = `${crypto.randomUUID()}.jpg`;
  await writeFile(path.join(uploadDir, fileName), buffer);

  return `/uploads/reports/${fileName}`;
}

/**
 * GET /reports
 * Returns currently active citizen and official reports for the map (RF-11, RF-21).
 */
export async function GET() {
  try {
    const now = new Date();
    const [citizenReports, officialReports] = await Promise.all([
      prisma.reports.findMany({
        where: {
          status: { in: ['Reportado', 'Confirmado'] },
          expires_at: { gt: now },
        },
        orderBy: { created_at: 'desc' },
        include: {
          IncidentTypes: {
            select: { name: true },
          },
          Users: {
            select: {
              first_name: true,
              last_name_paternal: true,
              last_name_maternal: true,
            },
          },
        },
      }),
      prisma.officialReports.findMany({
        where: {
          status: { in: ['Reportado', 'Confirmado'] },
          scheduled_end_at: { gt: now },
        },
        orderBy: { created_at: 'desc' },
        include: {
          IncidentTypes: {
            select: { name: true },
          },
          Authorities: {
            include: {
              Users: {
                select: {
                  first_name: true,
                  last_name_paternal: true,
                  last_name_maternal: true,
                },
              },
            },
          },
        },
      }),
    ]);
    const streetFeatureIndex =
      citizenReports.length > 0 || officialReports.length > 0
        ? await getStreetFeatureIndex()
        : null;

    const mapReports = [
      ...citizenReports.map((report) => ({
        id: report.id,
        report_type: 'CIUDADANO' as const,
        title: report.IncidentTypes.name,
        latitude: Number(report.latitude),
        longitude: Number(report.longitude),
        authorName: getDisplayName(report.Users, 'Usuario desconocido'),
        streetSegment: streetFeatureIndex
          ? findNearestStreetFeature(
              streetFeatureIndex.byOsmId.get(report.street_osm_id) ?? [],
              Number(report.latitude),
              Number(report.longitude)
            )
          : null,
      })),
      ...officialReports.map((report) => ({
        id: report.id,
        report_type: 'OFICIAL' as const,
        title: report.IncidentTypes.name,
        latitude: Number(report.latitude),
        longitude: Number(report.longitude),
        authorName: getDisplayName(report.Authorities.Users, 'Autoridad'),
        streetSegment: streetFeatureIndex
          ? findNearestStreetFeature(
              streetFeatureIndex.byName.get(normalizeStreetName(report.street_name)) ??
                streetFeatureIndex.features,
              Number(report.latitude),
              Number(report.longitude)
            )
          : null,
      })),
    ];

    return NextResponse.json(mapReports, { status: 200 });
  } catch (error) {
    console.error('[GET /reports] Error fetching active reports:', error);
    return NextResponse.json(
      { error: 'Error al consultar los reportes activos.' },
      { status: 500 }
    );
  }
}

/**
 * POST /reports
 * Validates business rules (RN-01 to RN-05) and persists a new citizen report in Azure SQL.
 */
export async function POST(request: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json(
        { error: 'Debes iniciar sesión para generar un reporte.' },
        { status: 401 }
      );
    }

    const dbUser = await prisma.users.findUnique({
      where: { clerk_id: clerkId },
      include: { Authorities: true },
    });

    if (!dbUser) {
      return NextResponse.json(
        { error: 'Usuario no sincronizado en la base de datos.' },
        { status: 404 }
      );
    }

    if (dbUser.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Tu cuenta se encuentra suspendida o bloqueada para reportar.' },
        { status: 403 }
      );
    }

    if (dbUser.Authorities) {
      return NextResponse.json(
        { error: 'Los usuarios Autoridad generan reportes oficiales, no ciudadanos.' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const incidentTypeId = Number(formData.get('incident_type_id'));
    const description = String(formData.get('description') ?? '').trim();
    const latitude = Number(formData.get('latitude'));
    const longitude = Number(formData.get('longitude'));
    const streetOsmIdRaw = formData.get('street_osm_id');
    const streetNameRaw = formData.get('street_name');
    const photoFile = formData.get('photo');

    const streetOsmId =
      typeof streetOsmIdRaw === 'string' && streetOsmIdRaw.trim().length > 0
        ? streetOsmIdRaw.trim()
        : null;
    const streetName =
      typeof streetNameRaw === 'string' && streetNameRaw.trim().length > 0
        ? streetNameRaw.trim()
        : null;

    if (
      !Number.isInteger(incidentTypeId) ||
      incidentTypeId <= 0 ||
      !description ||
      description.length > 1000 ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      !streetOsmId ||
      !(photoFile instanceof File) ||
      photoFile.size === 0
    ) {
      return NextResponse.json(
        { error: 'La ubicación, la calle y la fotografía en vivo son obligatorias.' },
        { status: 400 }
      );
    }

    const isInsideAtlixco =
      latitude >= ATLIXCO_BOUNDS.minLat &&
      latitude <= ATLIXCO_BOUNDS.maxLat &&
      longitude >= ATLIXCO_BOUNDS.minLng &&
      longitude <= ATLIXCO_BOUNDS.maxLng;

    if (!isInsideAtlixco) {
      return NextResponse.json(
        { error: 'Tu ubicación GPS está fuera del radio de acción de Atlixco.' },
        { status: 403 }
      );
    }

    const incidentType = await prisma.incidentTypes.findUnique({
      where: { id: incidentTypeId },
    });

    if (!incidentType || incidentType.available_for === 'AUTORIDAD') {
      return NextResponse.json(
        { error: 'La categoría de cierre seleccionada no es válida.' },
        { status: 400 }
      );
    }

    const now = new Date();

    const duplicateStreetReport = await prisma.reports.findFirst({
      where: {
        street_osm_id: streetOsmId,
        status: { in: ['Reportado', 'Confirmado'] },
        expires_at: { gt: now },
      },
    });

    if (duplicateStreetReport) {
      return NextResponse.json(
        { error: 'Ya existe un reporte activo en esta calle.' },
        { status: 409 }
      );
    }

    const evidencePhotoUrl = await storeEvidencePhoto(photoFile);
    const durationHours = incidentType.default_duration_hours || 24;
    const expiresAt = new Date(now.getTime() + durationHours * 60 * 60 * 1000);

    const createdReport = await prisma.reports.create({
      data: {
        user_id: dbUser.id,
        incident_type_id: incidentType.id,
        report_type: 'CIUDADANO',
        title: incidentType.name,
        description,
        street_osm_id: streetOsmId,
        street_name: streetName,
        latitude,
        longitude,
        status: 'Reportado',
        evidence_photo_url: evidencePhotoUrl,
        expires_at: expiresAt,
      },
      include: {
        IncidentTypes: {
          select: { name: true, code: true },
        },
        Users: {
          select: {
            first_name: true,
            last_name_paternal: true,
            collaboration_level: true,
            action_points: true,
          },
        },
      },
    });

    return NextResponse.json(createdReport, { status: 201 });
  } catch (error) {
    console.error('[POST /reports] Error creating citizen report:', error);
    return NextResponse.json(
      { error: 'Error interno al registrar el reporte ciudadano.' },
      { status: 500 }
    );
  }
}