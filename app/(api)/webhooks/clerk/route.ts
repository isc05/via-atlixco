import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma'; 

export async function POST(req: Request) {
  try {
    const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

    if (!WEBHOOK_SECRET) {
      console.error('Error de configuración: WEBHOOK_SECRET no está definido.');
      return new Response('Error de configuración del servidor', { status: 500 });
    }

    const headerPayload = await headers();
    const svix_id = headerPayload.get("svix-id");
    const svix_timestamp = headerPayload.get("svix-timestamp");
    const svix_signature = headerPayload.get("svix-signature");

    if (!svix_id || !svix_timestamp || !svix_signature) {
      return new Response('Faltan cabeceras de validación Svix', { status: 400 });
    }

    // Se extrae el cuerpo en texto crudo para garantizar que la validación de la firma criptográfica no falle
    // por alteraciones en el formato JSON por parte de Next.js.
    const payload = await req.text();
    const wh = new Webhook(WEBHOOK_SECRET);

    // 1. Verificación criptográfica estricta. Si la firma es inválida, se interrumpe la ejecución y se envía un error 400.
    try {
      wh.verify(payload, {
        "svix-id": svix_id,
        "svix-timestamp": svix_timestamp,
        "svix-signature": svix_signature,
      });
    } catch (err) {
      console.error('Error de validación criptográfica Svix:', err);
      return new Response('Validación criptográfica fallida', { status: 400 });
    }

    // 2. Parseo seguro e independiente del payload validado. 
    // Se desacopla de la respuesta de wh.verify para asegurar que TypeScript asigne correctamente la interfaz WebhookEvent.
    const evt = JSON.parse(payload) as WebhookEvent;

    // Evitar excepciones en tiempo de ejecución ("Cannot read properties of undefined")
    if (!evt || !evt.type) {
      console.error('El payload del webhook carece de estructura válida.');
      return new Response('Estructura de evento no reconocida', { status: 400 });
    }

    const eventType = evt.type;

    // Sincronización transaccional con la base de datos de SQL Server
    if (eventType === 'user.created' || eventType === 'user.updated') {
      const { id, email_addresses, first_name, last_name, image_url } = evt.data;
      
      const primaryEmail = email_addresses && email_addresses.length > 0 
        ? email_addresses[0].email_address 
        : `no-email-${id}@via-atlixco.com`;
      
      const lastNames = last_name ? last_name.split(' ') : [];
      const paternalName = lastNames[0] || null;
      const maternalName = lastNames.length > 1 ? lastNames.slice(1).join(' ') : null;
      /*
       * Sincronización de estado del usuario delegada al motor de base de datos.
       * Se utiliza upsert para manejar tanto la creación como la actualización 
       * de forma idempotente, mitigando problemas de concurrencia o webhooks desordenados.
       */
      await prisma.users.upsert({
        where: { clerk_id: id },
        create: {
          clerk_id: id,
          email: primaryEmail,
          first_name: first_name || null,
          last_name_paternal: paternalName,
          last_name_maternal: maternalName,
          avatar_url: image_url || null,
        },
        update: {
          email: primaryEmail,
          first_name: first_name || null,
          last_name_paternal: paternalName,
          last_name_maternal: maternalName,
          avatar_url: image_url || null,
        }
      });
    } else if (eventType === 'user.deleted') {
      const { id } = evt.data;
      
      if (id) {
        // 1. Asegurar la existencia del Usuario Fantasma del sistema
        const GHOST_USER_EMAIL = 'eliminado@via-atlixco.com';

        const ghostUser = await prisma.users.upsert({
          where: { email: GHOST_USER_EMAIL },
          create: {
            clerk_id: 'ghost_system_account',
            email: GHOST_USER_EMAIL,
            first_name: 'Usuario',
            last_name_paternal: 'Eliminado',
            role: 'CIUDADANO',
            status: 'ACTIVE' // Activo para que sus reportes asignados sigan siendo válidos
          },
          update: {} 
        });

        // 2. Ejecutar la purga y reasignación utilizando una transacción interactiva de Prisma
        await prisma.$transaction(async (tx) => {
          const userToDelete = await tx.users.findUnique({
            where: { clerk_id: id },
            select: { id: true }
          });

          if (!userToDelete) return;

          // A. Reasignar todos los reportes activos/históricos al Usuario Fantasma
          await tx.reports.updateMany({
            where: { user_id: userToDelete.id },
            data: { user_id: ghostUser.id }
          });

          // B. Eliminar dependencias sociales y de gamificación que bloquean la eliminación
          await tx.reportRatings.deleteMany({
            where: { user_id: userToDelete.id }
          });

          await tx.userBadges.deleteMany({
            where: { user_id: userToDelete.id }
          });

          await tx.userActionLogs.deleteMany({
            where: { user_id: userToDelete.id }
          });

          // C. Eliminar referencias en denuncias (ya sea como reportador o como reportado)
          await tx.denuncias.deleteMany({
            where: {
              OR: [
                { reporter_user_id: userToDelete.id },
                { reported_user_id: userToDelete.id }
              ]
            }
          });

          // D. Ejecutar la eliminación dura (Hard Delete) del usuario, liberando su email y clerk_id
          await tx.users.delete({
            where: { id: userToDelete.id }
          });
        });
      }
    }

    return new Response('Webhook procesado exitosamente', { status: 200 });

  } catch (error) {
    console.error('Excepción global en el procesamiento del Webhook:', error);
    return new Response('Error interno del servidor', { status: 500 });
  }
}