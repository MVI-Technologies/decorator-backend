import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator que extrai o usuário autenticado do request.
 * Uso: @CurrentUser() user: UserPayload
 *
 * Também aceita uma propriedade específica:
 * Uso: @CurrentUser('id') userId: string
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    // Se uma propriedade específica foi solicitada, retorna apenas ela
    return data ? user?.[data] : user;
  },
);
