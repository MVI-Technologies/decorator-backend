import { Controller, Get, Res } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';
import { Response } from 'express';

/**
 * Rotas na raiz (/) para evitar 404 quando alguém abre http://localhost:3000/
 * ou o navegador pede /favicon.ico.
 */
@Controller()
@Public()
export class RootController {
  @Get()
  root() {
    return {
      name: 'Decorador.net API',
      version: '0.1.0',
      docs: '/api/docs',
      health: '/api/v1/health',
      api: '/api/v1',
    };
  }

  @Get('favicon.ico')
  favicon(@Res() res: Response) {
    res.status(204).send();
  }
}
