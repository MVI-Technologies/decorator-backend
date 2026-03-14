import MercadoPagoConfig, { PreApprovalPlan } from 'mercadopago';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
dotenv.config();

const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN! });
const preApprovalPlan = new PreApprovalPlan(client);

async function run() {
  try {
    const plan = await preApprovalPlan.create({
      body: {
        reason: 'Assinatura Decorador.net - Profissional',
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: 21.90,
          currency_id: 'BRL',
        },
        back_url: 'https://decorador-net-studio.vercel.app/app/configuracoes/assinatura',
      },
    });
    fs.writeFileSync('plan-output.json', JSON.stringify(plan, null, 2));
    console.log('Saved to plan-output.json');
  } catch (err: any) {
    fs.writeFileSync('plan-error.json', JSON.stringify(err, null, 2));
    console.log('Error saved to plan-error.json');
  }
}

run();
