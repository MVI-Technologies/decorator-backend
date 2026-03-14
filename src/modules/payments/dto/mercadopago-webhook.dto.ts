import { IsString, IsObject, IsIn, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Payload enviado pelo Mercado Pago no webhook.
 * Referência: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 */
export class MercadoPagoWebhookDto {
  @ApiProperty({ example: '123456789' })
  @IsString()
  id: string;

  @ApiProperty({ example: 'payment.updated' })
  @IsString()
  action: string;

  @ApiProperty({ example: 'payment' })
  @IsString()
  @IsIn(['payment', 'merchant_order', 'plan', 'subscription'])
  type: string;

  @ApiProperty({ example: { id: '987654321' } })
  @IsObject()
  data: { id: string };

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  live_mode?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  date_created?: string;

  @ApiPropertyOptional()
  @IsOptional()
  user_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  api_version?: string;
}
