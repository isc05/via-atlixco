import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /incident-types
 * Retrieves active road closure categories available for citizen reports (RF-13).
 */
export async function GET() {
  try {
    const incidentTypes = await prisma.incidentTypes.findMany({
      where: {
        available_for: {
          in: ['CIUDADANO', 'AMBOS'],
        },
      },
      orderBy: {
        id: 'asc',
      },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        default_duration_hours: true,
      },
    });

    return NextResponse.json(incidentTypes, { status: 200 });
  } catch (error) {
    console.error('[GET /incident-types] Error fetching catalog:', error);
    return NextResponse.json(
      { error: 'No se pudo cargar el catálogo de categorías de cierre.' },
      { status: 500 }
    );
  }
}