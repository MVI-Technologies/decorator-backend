import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // We'll just grab the controller and call it directly
  const subscriptionsController = app.get('SubscriptionsController');
  const prisma = app.get('PrismaService');
  
  const user = await prisma.user.findFirst({ where: { role: 'PROFESSIONAL' } });
  
  if(!user) {
    console.log('No user found');
    process.exit(0);
  }

  console.log('Testing subscribe for user', user.id);
  try {
    const res = await subscriptionsController.subscribe({ id: user.id } as any);
    console.log('Success:', res);
  } catch (err: any) {
    console.error('--- ERROR CAUGHT ---');
    console.error(err.message);
    if(err.response) {
      console.error('Data:', JSON.stringify(err.response.data, null, 2) || err.response);
    }
  }

  await app.close();
}

bootstrap();
