/**
 * fix-subscription-pix.ts
 * Ativa manualmente uma assinatura PIX aprovada no Mercado Pago.
 * Usa Prisma Client e SDK do MP diretamente (sem NestJS).
 *
 * Uso:
 *   npx ts-node fix-subscription-pix.ts
 *   npx ts-node fix-subscription-pix.ts <email-do-profissional>
 */

import { PrismaClient } from '@prisma/client';
import MercadoPagoConfig, { Payment } from 'mercadopago';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const TARGET_EMAIL = process.argv[2] || null;

const prisma = new PrismaClient();
const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
});
const paymentClient = new Payment(mpClient);

async function run() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  Fix: Ativação Manual de Assinatura PIX');
  console.log('═══════════════════════════════════════════════════\n');

  const whereClause: any = { role: 'PROFESSIONAL' };
  if (TARGET_EMAIL) {
    whereClause.email = TARGET_EMAIL;
    console.log(`🎯 Filtrando pelo email: ${TARGET_EMAIL}\n`);
  }

  const users = await prisma.user.findMany({
    where: whereClause,
    include: { professionalProfile: true },
    orderBy: { createdAt: 'desc' },
  });

  if (!users.length) {
    console.error('❌ Nenhum profissional encontrado.');
    process.exit(1);
  }

  console.log(`👥 Profissionais encontrados: ${users.length}\n`);

  for (const user of users) {
    const profile = user.professionalProfile as any;
    if (!profile) {
      console.log(`⚠️  ${user.email} sem perfil profissional — pulando`);
      continue;
    }

    console.log(`─────────────────────────────────────────────────`);
    console.log(`👤 ${user.email}`);
    console.log(`   profileId:          ${profile.id}`);
    console.log(`   subscriptionStatus: ${profile.subscriptionStatus}`);
    console.log(`   mpSubscriptionId:   ${profile.mpSubscriptionId || '(vazio)'}`);
    console.log(`   mpPreapprovalPlanId: ${profile.mpPreapprovalPlanId || '(vazio)'}`);

    if (profile.subscriptionStatus === 'ACTIVE' && profile.subscriptionExpiresAt > new Date()) {
      console.log(`   ✅ Já está ATIVO e válido. Pulando.\n`);
      continue;
    }

    // Buscar pagamentos aprovados no MP com external_reference = profile.id
    console.log(`\n   🌐 Buscando pagamentos no Mercado Pago...`);

    let payments: any[] = [];
    try {
      const result = await paymentClient.search({
        options: {
          external_reference: profile.id,
          sort: 'date_created',
          criteria: 'desc',
          limit: 10,
        } as any,
      });
      payments = (result as any).results || [];
    } catch (err: any) {
      console.error(`   ❌ Falha ao buscar no MP: ${err.message}`);
      continue;
    }

    console.log(`   📦 Pagamentos encontrados: ${payments.length}`);

    if (!payments.length) {
      console.log(`   ⚠️  Nenhum pagamento com external_reference=${profile.id}`);
      console.log(`   💡 Verifique o painel do MP e anote o payment_id`);
      continue;
    }

    let bestPayment: any = null;

    for (const p of payments) {
      const isSub =
        p.metadata?.is_subscription === true ||
        p.metadata?.is_subscription === 'true';

      const statusIcon = p.status === 'approved' ? '✅' : p.status === 'pending' ? '⏳' : '❌';
      console.log(
        `   ${statusIcon} payment_id=${p.id} | status=${p.status} | ` +
          `is_subscription=${p.metadata?.is_subscription ?? 'N/A'} | ` +
          `valor=R$${p.transaction_amount} | ` +
          `data=${new Date(p.date_created).toLocaleString('pt-BR')}`,
      );

      if (p.status === 'approved' && !bestPayment) {
        bestPayment = p;
      }
      if (p.status === 'approved' && isSub) {
        bestPayment = p; // preferência para o que tem a flag
        break;
      }
    }

    if (!bestPayment) {
      console.log(`\n   ❌ Nenhum pagamento APROVADO encontrado. Assinatura não ativada.`);
      continue;
    }

    const isSub =
      bestPayment.metadata?.is_subscription === true ||
      bestPayment.metadata?.is_subscription === 'true';

    if (!isSub) {
      console.log(
        `\n   ⚠️  ATENÇÃO: Pagamento aprovado mas metadata.is_subscription não está presente.`,
      );
      console.log(`   Isso indica que o metadata não foi propagado pelo MP (bug conhecido com PIX).`);
      console.log(`   Ativando mesmo assim pois é o único pagamento aprovado para este perfil.\n`);
    }

    // Idempotência
    if (profile.mpSubscriptionId === bestPayment.id && profile.subscriptionStatus === 'ACTIVE') {
      console.log(`\n   ✅ Já foi ativado com este paymentId. Nada a fazer.\n`);
      continue;
    }

    // Ativar assinatura
    const expDate = new Date();
    expDate.setMonth(expDate.getMonth() + 1);

    await prisma.professionalProfile.update({
      where: { id: profile.id },
      data: {
        subscriptionStatus: 'ACTIVE',
        subscriptionExpiresAt: expDate,
        mpSubscriptionId: bestPayment.id,
      } as any,
    });

    console.log(`\n   🎉 ASSINATURA ATIVADA COM SUCESSO!`);
    console.log(`   paymentId:  ${bestPayment.id}`);
    console.log(`   valor:      R$${bestPayment.transaction_amount}`);
    console.log(`   expira em:  ${expDate.toLocaleDateString('pt-BR')}\n`);
  }

  console.log('═══════════════════════════════════════════════════');
  console.log('  Script concluído.');
  console.log('═══════════════════════════════════════════════════\n');
}

run()
  .catch((err) => {
    console.error('\n❌ Erro fatal:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
