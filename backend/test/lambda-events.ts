import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
  Context,
} from 'aws-lambda';

type Options = {
  body?: unknown;
  headers?: Record<string, string>;
  ip?: string;
  base64?: boolean;
  query?: string;
};

/** An event as API Gateway (HTTP API, payload 2.0) sends it to Lambda. */
export const event = (
  method: string,
  path: string,
  options: Options = {},
): APIGatewayProxyEventV2 => {
  const raw =
    options.body === undefined
      ? undefined
      : typeof options.body === 'string'
        ? options.body
        : JSON.stringify(options.body);
  return {
    version: '2.0',
    routeKey: '$default',
    rawPath: path,
    rawQueryString: options.query ?? '',
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
    requestContext: {
      accountId: '123456789012',
      apiId: 'api-id',
      domainName: 'api.example.test',
      domainPrefix: 'api',
      http: {
        method,
        path,
        protocol: 'HTTP/1.1',
        sourceIp: options.ip ?? '203.0.113.7',
        userAgent: 'jest',
      },
      requestId: 'request-id',
      routeKey: '$default',
      stage: '$default',
      time: '01/Jan/2026:00:00:00 +0000',
      timeEpoch: 1_767_225_600_000,
    },
    body:
      raw === undefined ? undefined : options.base64 ? Buffer.from(raw).toString('base64') : raw,
    isBase64Encoded: options.base64 ?? false,
  };
};

export const context = {
  functionName: 'coffee-api',
  awsRequestId: 'request-id',
  getRemainingTimeInMillis: () => 30_000,
} as unknown as Context;

export type Reply = APIGatewayProxyStructuredResultV2 & {
  statusCode: number;
  headers: Record<string, string>;
};
