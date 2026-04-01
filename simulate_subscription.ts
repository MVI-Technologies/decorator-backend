import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { SubscriptionsService } from './src/modules/payments/subscriptions.service';
import { MercadoPagoService } from './src/modules/payments/mercadopago.service';
import { PrismaService } from './src/prisma/prisma.service';

async function bootstrap() {
  console.log('Iniciando simulador...');
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const prisma = app.get(PrismaService);
  const subscriptionsService = app.get(SubscriptionsService);
  const mercadoPagoService = app.get(MercadoPagoService);

  const email = 'profissional3@teste.com';
  
  // 1. Encontrar o usuário
  const user = await prisma.user.findUnique({
    where: { email },
    include: { professionalProfile: true },
  });

  if (!user || !user.professionalProfile) {
    console.error(`Usuário ${email} não encontrado ou não é profissional.`);
    await app.close();
    return;
  }

  const profileId = user.professionalProfile.id;
  console.log(`Profissional encontrado: ${user.name} (Profile ID: ${profileId})`);

  // 2. Simular o aceite da assinatura (gerar o Plan ID e salvar no banco como se tivesse clicado em "Assinar")
  console.log('Simulando a intent de assinatura (chamando subscribe)...');
  const subscribeResult = await subscriptionsService.subscribe(user.id);
  console.log(`Link de checkout gerado: ${subscribeResult.checkoutUrl}`);

  // O subscribe() já salva o mpPreapprovalPlanId no professionalProfile
  const updatedProfile = await prisma.professionalProfile.findUnique({
    where: { id: profileId },
  });
  const planId = updatedProfile?.mpPreapprovalPlanId;
  console.log(`Plan ID atrelado ao profissional: ${planId}`);

  // 3. Mockar o getSubscription do MercadoPagoService para retornar dados falsos de uma assinatura paga
  console.log('Mockando a resposta do Mercado Pago...');
  const fakeSubscriptionId = 'simulated_sub_12345';
  
  mercadoPagoService.getSubscription = async (id: string) => {
    console.log(`[Mock MP] getSubscription chamado com id: ${id}`);
    return {
      id: fakeSubscriptionId,
      status: 'authorized',
      reason: 'Assinatura Decornet - Profissional',
      preapproval_plan_id: planId,
      external_reference: profileId, // Opcional, mas vamos simular que o MP enviou
      payer_id: 12345678,
    } as any;
  };

  // 4. Disparar o fluxo do Webhook passando pelo SubscriptionsService
  console.log('Disparando handleSubscriptionWebhook() como se fosse o Controller...');
  await subscriptionsService.handleSubscriptionWebhook(fakeSubscriptionId);

  // 5. Verificar o resultado final no banco
  const finalProfile = await prisma.professionalProfile.findUnique({
    where: { id: profileId },
  });

  console.log('--- RESULTADO FINAL ---');
  console.log(`Status de Assinatura: ${finalProfile?.subscriptionStatus}`);
  console.log(`Expira em: ${finalProfile?.subscriptionExpiresAt}`);
  console.log(`MP Subscription ID salvo: ${finalProfile?.mpSubscriptionId}`);

  if (finalProfile?.subscriptionStatus === 'ACTIVE') {
    console.log('✅ SUCCESSO! O perfil foi ativado usando o fluxo das funções.');
  } else {
    console.log('❌ FALHA! O status da assinatura não foi atualizado.');
  }

  await app.close();
}

bootstrap().catch(console.error);
