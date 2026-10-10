This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Prisma y Azure SQL

El proyecto usa Prisma 6 con el proveedor `sqlserver`; no necesita `prisma.config.ts` ni un adaptador. Define `DATABASE_URL` en el `.env` de la raíz para desarrollo y como variable secreta en el entorno donde despliegues:

```dotenv
DATABASE_URL="sqlserver://<servidor>.database.windows.net:1433;database=<base_de_datos>;user=<usuario>;password=<contraseña>;encrypt=true;trustServerCertificate=false"
```

Usa las credenciales de SQL Server que correspondan a tu Azure SQL y codifica los caracteres reservados de la contraseña para una URL. Permite también la conexión desde la IP/red del entorno de ejecución en el firewall de Azure SQL.

Después de cambiar el esquema o instalar dependencias, valida y genera el cliente con:

```bash
pnpm exec prisma validate
pnpm exec prisma generate
```

Prisma 6 no modela los índices filtrados definidos anteriormente sobre `core.Reports`. Se omiten del esquema para que la validación y generación funcionen; si ya existen en Azure SQL, no los elimines ni ejecutes `prisma db push` sin revisar antes el efecto en esa base de datos.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
