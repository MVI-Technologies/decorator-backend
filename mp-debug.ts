import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const mpService = app.get('MercadoPagoService');
  const prisma = app.get('PrismaService');
  
  const user = await prisma.user.findFirst({ where: { role: 'PROFESSIONAL' }, include: { professionalProfile: true } });
  
  if(!user) {
    console.log('No user found');
    process.exit(0);
  }

  console.log('Testing PreApproval plan creation for user', user.email);
  try {
    const planId = await mpService.createSubscriptionPlan(21.90);
    console.log('Created Plan:', planId);
    
    console.log('Testing createSubscriptionLink...');
    const link = await mpService.createSubscriptionLink(planId, user.professionalProfile.id, user.email);
    console.log('Success link:', link);
  } catch (err: any) {
    console.error('--- MP ERROR CAUGHT ---');
    console.error('Message:', err.message);
    if(err.response) {
      console.error('Response data:', JSON.stringify(err.response.data, null, 2));
    } else {
      console.error('Full Error:', err);
    }
  }

  await app.close();
}

bootstrap();
