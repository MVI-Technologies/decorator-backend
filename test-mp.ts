import MercadoPagoConfig, { PreApprovalPlan } from 'mercadopago';

async function test() {
  const client = new MercadoPagoConfig({ accessToken: 'TEST-5890694430679314-031320-6b04e22e69d5d5c064c33fa0c21bab8b-323913758' });
  const preApprovalPlan = new PreApprovalPlan(client);
  
  const body = {
    reason: 'Assinatura Decornet - Profissional (Teste 5B)',
    back_url: 'https://decorador-net-studio.vercel.app',
    auto_recurring: {
      frequency: 1,
      frequency_type: 'months',
      transaction_amount: 10.00,
      currency_id: 'BRL',
    },
  };
  
  try {
    const response = await preApprovalPlan.create({ body });
    console.log(response);
  } catch (error: any) {
    console.error(error.response ? error.response.data : error);
  }
}
test();
