import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Consulta a la tabla core.IncidentTypes
    const incidentTypes = await prisma.incidentTypes.findMany();
    return NextResponse.json({ success: true, data: incidentTypes });
  } catch (error) {
    console.error('Error al conectar con Azure SQL:', error);
    return NextResponse.json(
      { success: false, error: 'Error de conexión con la base de datos' },
      { status: 500 }
    );
  }
}