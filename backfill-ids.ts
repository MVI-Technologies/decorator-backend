import { PrismaClient } from '@prisma/client';
import { generatePublicId } from './src/common/utils/public-id.util';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting backfill for publicIds...');

  // 1. ClientProfiles
  const clients = await prisma.clientProfile.findMany({
    orderBy: { createdAt: 'asc' },
  });
  console.log(`Found ${clients.length} ClientProfiles.`);
  for (let i = 0; i < clients.length; i++) {
    if (!clients[i].publicId) {
      await prisma.clientProfile.update({
        where: { id: clients[i].id },
        data: { publicId: generatePublicId('C', i) },
      });
      console.log(`Updated ClientProfile ${clients[i].id} -> ${generatePublicId('C', i)}`);
    }
  }

  // 2. ProfessionalProfiles
  const professionals = await prisma.professionalProfile.findMany({
    orderBy: { createdAt: 'asc' },
  });
  console.log(`Found ${professionals.length} ProfessionalProfiles.`);
  for (let i = 0; i < professionals.length; i++) {
    if (!professionals[i].publicId) {
      await prisma.professionalProfile.update({
        where: { id: professionals[i].id },
        data: { publicId: generatePublicId('P', i) },
      });
      console.log(`Updated ProfessionalProfile ${professionals[i].id} -> ${generatePublicId('P', i)}`);
    }
  }

  // 3. Projects
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: 'asc' },
  });
  console.log(`Found ${projects.length} Projects.`);
  for (let i = 0; i < projects.length; i++) {
    if (!projects[i].publicId) {
      await prisma.project.update({
        where: { id: projects[i].id },
        data: { publicId: generatePublicId('A', i) },
      });
      console.log(`Updated Project ${projects[i].id} -> ${generatePublicId('A', i)}`);
    }
  }

  console.log('Backfill completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
