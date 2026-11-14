import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

const config = new DocumentBuilder()
  .setTitle('Specialty Coffee Store API')
  .setVersion('1.0')
  .setDescription(
    'Amounts are always computed by the server. Errors answer `{ statusCode, code, message }`; ' +
      'the `code` is stable and the `message` is safe to show to a shopper.',
  )
  .build();

export const buildOpenApi = (app: INestApplication): OpenAPIObject =>
  SwaggerModule.createDocument(app, config);

/** Swagger UI at /docs and the raw document at /docs/openapi.json. */
export const setupSwagger = (app: INestApplication): void => {
  SwaggerModule.setup('docs', app, buildOpenApi(app), { jsonDocumentUrl: 'docs/openapi.json' });
};
