import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function seedInitialAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const name = process.env.ADMIN_NAME?.trim();

  if (!email || !name) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_NAME in apps/api/.env first.');
  }
  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    name.length > 120
  ) {
    throw new Error('ADMIN_EMAIL or ADMIN_NAME is invalid.');
  }

  await prisma.$transaction(
    async (transaction) => {
      const existingAdmin = await transaction.user.findFirst({
        where: { role: UserRole.ADMIN },
        select: { id: true },
      });
      if (existingAdmin) {
        throw new Error(
          'An administrator already exists. This setup script only creates the first administrator.',
        );
      }

      const existingUser = await transaction.user.findUnique({
        where: { email },
      });
      if (existingUser) {
        throw new Error(
          'ADMIN_EMAIL already belongs to a user. Change the environment value or manage the user through the application.',
        );
      }

      await transaction.user.create({
        data: { email, name, role: UserRole.ADMIN, isActive: true },
      });
    },
    { isolationLevel: 'Serializable' },
  );
  console.info(`Created the initial administrator account for ${email}.`);
}

try {
  await seedInitialAdmin();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
