import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed script para popular o banco com dados iniciais.
 * Cria: 1 admin, 1 cliente, 1 profissional com perfil, estilos e portfólio.
 *
 * Uso: npx prisma db seed || npm run prisma:seed
 */
async function main() {
  console.log('🌱 Iniciando seed...\n');

  // ─── ADMIN ────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: 'admin@decorador.net' },
    update: {},
    create: {
      email: 'admin@decorador.net',
      name: 'Admin Decorador',
      role: 'ADMIN',
      supabaseAuthId: 'seed-admin-auth-id',
    },
  });
  console.log(`✅ Admin: ${admin.email} (${admin.id})`);

  // ─── CLIENTE ────────────────────────────────────────
  const client = await prisma.user.upsert({
    where: { email: 'cliente@teste.com' },
    update: {},
    create: {
      email: 'cliente@teste.com',
      name: 'Maria Silva',
      role: 'CLIENT',
      supabaseAuthId: 'seed-client-auth-id',
      phone: '(11) 99999-1111',
      clientProfile: {
        create: {
          address: 'Rua das Flores, 123',
          city: 'São Paulo',
          state: 'SP',
          zipCode: '01234-567',
          preferredStyles: ['Moderno', 'Minimalista'],
        },
      },
    },
  });
  console.log(`✅ Cliente: ${client.email} (${client.id})`);

  // ─── PROFISSIONAL ────────────────────────────────────
  const professional = await prisma.user.upsert({
    where: { email: 'profissional@teste.com' },
    update: {},
    create: {
      email: 'profissional@teste.com',
      name: 'João Designer',
      role: 'PROFESSIONAL',
      supabaseAuthId: 'seed-professional-auth-id',
      phone: '(11) 99999-2222',
      professionalProfile: {
        create: {
          displayName: 'João Designer de Interiores',
          bio: 'Designer de interiores com 8 anos de experiência, especializado em espaços modernos e minimalistas.',
          experienceYears: 8,
          city: 'São Paulo',
          state: 'SP',
          status: 'APPROVED',
          pixKey: 'joao@teste.com',
          styles: {
            create: [
              { name: 'Moderno', description: 'Design contemporâneo com linhas limpas' },
              { name: 'Minimalista', description: 'Menos é mais, foco na funcionalidade' },
              { name: 'Industrial', description: 'Elementos brutos e urbanos' },
            ],
          },
          portfolioItems: {
            create: [
              {
                title: 'Sala de Estar Moderna',
                description: 'Projeto de sala com tons neutros e mobiliário contemporâneo',
                imageUrl: 'https://placehold.co/800x600/e2e8f0/64748b?text=Sala+Moderna',
                category: 'Sala de estar',
                order: 0,
              },
              {
                title: 'Cozinha Integrada',
                description: 'Cozinha americana com ilha central',
                imageUrl: 'https://placehold.co/800x600/e2e8f0/64748b?text=Cozinha',
                category: 'Cozinha',
                order: 1,
              },
            ],
          },
        },
      },
    },
  });
  console.log(`✅ Profissional: ${professional.email} (${professional.id})`);

  // ─── PROJETO DE EXEMPLO ────────────────────────────

  const profProfile = await prisma.professionalProfile.findUnique({
    where: { userId: professional.id },
  });

  if (profProfile) {
    const project = await prisma.project.upsert({
      where: { id: 'seed-project-id' },
      update: {},
      create: {
        id: 'seed-project-id',
        clientId: client.id,
        professionalProfileId: profProfile.id,
        title: 'Reforma da Sala de Estar',
        status: 'IN_PROGRESS',
        price: 3500,
        packageType: 'Premium',
        startedAt: new Date(),
        briefing: {
          create: {
            roomType: 'Sala de estar',
            roomSize: '30m²',
            budget: 5000,
            description: 'Quero uma sala moderna com tons neutros e toque minimalista.',
            stylePreferences: ['Moderno', 'Minimalista'],
            requirements: 'Manter o sofá existente, trocar mesa de centro',
          },
        },
        payment: {
          create: {
            amount: 3500,
            platformFee: 525,
            professionalAmount: 2975,
            status: 'IN_ESCROW',
            escrowStartedAt: new Date(),
          },
        },
      },
    });
    console.log(`✅ Projeto: "${project.title}" (${project.id})`);
  }

  console.log('\n🎉 Seed concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
