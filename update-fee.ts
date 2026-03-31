import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const key = 'PROFESSIONAL_MONTHLY_FEE';
  const newValue = '1.00';

  console.log(`Tentando atualizar ${key} para ${newValue}...`);

  const config = await prisma.systemConfig.upsert({
    where: { key },
    update: { value: newValue },
    create: { key, value: newValue },
  });

  console.log('✅ Configuração atualizada com sucesso no banco de dados:');
  console.log(config);
}

main()
  .catch((e) => {
    console.error('❌ Erro ao atualizar:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
