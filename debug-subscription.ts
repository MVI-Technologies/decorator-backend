import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  // Using dynamic module resolution to bypass typescript symbol injection bugs in scripts
  const SubscriptionsService = app.get('SubscriptionsService');
  const PrismaService = app.get('PrismaService');

  try {
    const user = await PrismaService.user.findFirst({
      where: { role: 'PROFESSIONAL' }
    });
    
    if (!user) {
       console.log('No professional user found to test with.');
       process.exit(0);
    }
    
    console.log(`Testing with user ID: ${user.id}`);
    const result = await SubscriptionsService.subscribe(user.id);
    console.log('Result:', result);
    
  } catch (error: any) {
    console.log('ERROR CAUGHT, checking memory...');
    const fs = require('fs');
    const errData = {
      message: error.message,
      name: error.name,
      stack: error.stack,
      response: error.response?.data || error.response,
    }
    fs.writeFileSync('debug-err.json', JSON.stringify(errData, null, 2));
    console.log('Wrote to debug-err.json');
  } finally {
    await app.close();
  }
}

run();
