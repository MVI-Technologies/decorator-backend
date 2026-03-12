import { PrismaClient } from '@prisma/client';
import { generatePublicId } from '../src/common/utils/public-id.util';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando o backfill de public IDs...');

  // 1. Backfill ClientProfiles
  const clientsWithoutId = await prisma.clientProfile.findMany({
    where: { publicId: null },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`Clientes encontrados sem publicId: ${clientsWithoutId.length}`);
  
  for (let i = 0; i < clientsWithoutId.length; i++) {
    const client = clientsWithoutId[i];
    const newId = generatePublicId('C', i);
    await prisma.clientProfile.update({
      where: { id: client.id },
      data: { publicId: newId },
    });
    console.log(`Cliente ${client.userId} atualizado com publicId: ${newId}`);
  }

  // 2. Backfill ProfessionalProfiles
  const professionalsWithoutId = await prisma.professionalProfile.findMany({
    where: { publicId: null },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`Profissionais encontrados sem publicId: ${professionalsWithoutId.length}`);
  
  for (let i = 0; i < professionalsWithoutId.length; i++) {
    const pro = professionalsWithoutId[i];
    const newId = generatePublicId('P', i);
    await prisma.professionalProfile.update({
      where: { id: pro.id },
      data: { publicId: newId },
    });
    console.log(`Profissional ${pro.userId} atualizado com publicId: ${newId}`);
  }

  // 3. Backfill Projects
  const projectsWithoutId = await prisma.project.findMany({
    where: { publicId: null },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`Projetos encontrados sem publicId: ${projectsWithoutId.length}`);
  
  for (let i = 0; i < projectsWithoutId.length; i++) {
    const proj = projectsWithoutId[i];
    const newId = generatePublicId('A', i);
    await prisma.project.update({
      where: { id: proj.id },
      data: { publicId: newId },
    });
    console.log(`Projeto ${proj.id} atualizado com publicId: ${newId}`);
  }

  console.log('Backfill concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error('Erro durante o backfill:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
