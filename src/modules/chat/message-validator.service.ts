import { Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';

@Injectable()
export class MessageContentValidator {
  private normalizerDict: Record<string, string> = {
    arroba: '@',
    ponto: '.',
    dot: '.',
    zero: '0',
    um: '1',
    dois: '2',
    tres: '3',
    quatro: '4',
    cinco: '5',
    seis: '6',
    sete: '7',
    oito: '8',
    nove: '9',
  };

  private readonly PHONE_REGEX =
    /(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}[-\s]?\d{4}/;
  private readonly EMAIL_REGEX =
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  private readonly LINK_REGEX =
    /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]+\.(com|net|io|br))/i;

  validate(content: string): void {
    if (!content) return;

    // 1. Validação literal
    this.testContent(content);

    // 2. Normalização Anti-Bypass
    let normalized = content.toLowerCase();

    // Substituições fonéticas
    for (const [word, symbol] of Object.entries(this.normalizerDict)) {
      normalized = normalized.split(word).join(symbol);
    }

    // Remove espaços entre números para testar bypass de telefone
    normalized = normalized.replace(/(?<=\d)\s+(?=\d)/g, '');

    // 3. Validação normalizada
    this.testContent(normalized);
  }

  private testContent(text: string) {
    if (
      this.EMAIL_REGEX.test(text) ||
      this.PHONE_REGEX.test(text) ||
      this.LINK_REGEX.test(text)
    ) {
      throw new WsException({
        status: 'error',
        message:
          'Mensagem bloqueada: não é permitido compartilhar contatos externos ou links. Mantenha a comunicação na plataforma.',
      });
    }
  }
}
