const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();

const token = process.env.MERCADOPAGO_ACCESS_TOKEN;

async function run() {
  if (!token) {
    console.log('Token não encontrado no .env!');
    return;
  }
  
  try {
    const response = await fetch('https://api.mercadopago.com/v1/payments/search?limit=3&sort=date_created&criteria=desc', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
        console.log("Últimas 3 tentativas de pagamento nesta conta Mercado Pago:");
        data.results.forEach(payment => {
            console.log(`- Data: ${payment.date_created}`);
            console.log(`  Valor: R$ ${payment.transaction_amount}`);
            console.log(`  Cartão: ${payment.payment_method_id}`);
            console.log(`  Status: ${payment.status} / ${payment.status_detail}`);
            console.log("-----------------------");
        });
    } else {
        console.log("Nenhum pagamento encontrado ou logado (talvez a tentativa nem chegou a virar um pagamento, foi barrada antes).");
    }

  } catch (error) {
    console.log("Erro ao buscar:", error);
  }
}

run();
