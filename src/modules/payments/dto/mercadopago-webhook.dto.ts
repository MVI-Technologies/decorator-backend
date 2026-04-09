import { IsString, IsObject, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Payload enviado pelo Mercado Pago no webhook.
 * Referência: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 *
 * NOTA: O campo `type` é intencionalmente permissivo (@IsOptional + @IsString)
 * pois o Mercado Pago pode enviar tipos novos (ex: preapproval_payment,
 * subscription_authorized) que não devem causar um 400 e impedir o processamento.
 * A filtragem por tipo é feita manualmente dentro de cada handler.
 */
export class MercadoPagoWebhookDto {
  @ApiProperty({ example: '123456789' })
  @IsString()
  id: string;

  @ApiPropertyOptional({ example: 'payment.updated' })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ example: 'payment' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ example: 'payment' })
  @IsOptional()
  @IsString()
  topic?: string;

  @ApiPropertyOptional({ example: { id: '987654321' } })
  @IsOptional()
  @IsObject()
  data?: { id: string };

  @ApiPropertyOptional()
  @IsOptional()
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
