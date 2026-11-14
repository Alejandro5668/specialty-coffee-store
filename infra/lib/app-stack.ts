import { CfnOutput, Duration, RemovalPolicy, Stack, StackProps, Tags } from 'aws-cdk-lib';
import { HttpApi, HttpStage, HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import {
  AllowedMethods,
  CachePolicy,
  Distribution,
  Function as EdgeFunction,
  FunctionCode,
  FunctionEventType,
  FunctionRuntime,
  HeadersFrameOption,
  HeadersReferrerPolicy,
  OriginRequestPolicy,
  ResponseHeadersPolicy,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { HttpOrigin, S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { CfnGroup } from 'aws-cdk-lib/aws-resourcegroups';
import { Architecture, Code, Function as LambdaFunction, Runtime } from 'aws-cdk-lib/aws-lambda';
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';
import { PROJECT, TABLE_PREFIX, Tables } from './data-stack';

export const SECRET_PARAMETERS = {
  PAYMENT_PRIVATE_KEY: '/coffee-store/payment-private-key',
  PAYMENT_INTEGRITY_SECRET: '/coffee-store/payment-integrity-secret',
  PAYMENT_EVENTS_SECRET: '/coffee-store/payment-events-secret',
} as const;

export type AppStackProps = StackProps & {
  tables: Tables;
  /** Folder with the packaged backend (`npm run package:lambda -w backend`). */
  lambdaCodePath: string;
  /** Folder with the built frontend. */
  frontendPath: string;
  paymentApiUrl: string;
  paymentPublicKey: string;
  /** Proxies in front of the app whose X-Forwarded-For is trusted. */
  trustProxyHops?: number;
};

/** Runs on viewer-request for /api/*: the API does not know the prefix. */
const STRIP_API_PREFIX = `function handler(event) {
  var request = event.request;
  request.uri = request.uri.replace(/^\\/api/, '') || '/';
  return request;
}`;

/** Runs on viewer-request for the site: app routes (no file extension) get index.html. */
const SPA_FALLBACK = `function handler(event) {
  var request = event.request;
  if (!/\\.[A-Za-z0-9]+$/.test(request.uri)) request.uri = '/index.html';
  return request;
}`;

export class AppStack extends Stack {
  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);
    Tags.of(this).add('Project', PROJECT);

    const handler = new LambdaFunction(this, 'Api', {
      runtime: Runtime.NODEJS_22_X,
      architecture: Architecture.ARM_64,
      handler: 'lambda.handler',
      code: Code.fromAsset(props.lambdaCodePath),
      memorySize: 512,
      timeout: Duration.seconds(29),
      environment: {
        TABLE_PREFIX,
        PAYMENT_API_URL: props.paymentApiUrl,
        PAYMENT_PUBLIC_KEY: props.paymentPublicKey,
        // The browser only calls the site's own origin, so no other origin is allowed.
        CORS_ORIGIN: 'https://same-origin.invalid',
        TRUST_PROXY_HOPS: String(props.trustProxyHops ?? 2),
        PAYMENT_PRIVATE_KEY_SSM: SECRET_PARAMETERS.PAYMENT_PRIVATE_KEY,
        PAYMENT_INTEGRITY_SECRET_SSM: SECRET_PARAMETERS.PAYMENT_INTEGRITY_SECRET,
        PAYMENT_EVENTS_SECRET_SSM: SECRET_PARAMETERS.PAYMENT_EVENTS_SECRET,
      },
    });

    props.tables.products.grantReadData(handler);
    props.tables.variants.grantReadWriteData(handler);
    props.tables.customers.grantReadWriteData(handler);
    props.tables.transactions.grantReadWriteData(handler);
    handler.addToRolePolicy(
      new PolicyStatement({
        actions: ['ssm:GetParameters'],
        resources: Object.values(SECRET_PARAMETERS).map(
          (name) => `arn:${this.partition}:ssm:${this.region}:${this.account}:parameter${name}`,
        ),
      }),
    );
    handler.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['kms:Decrypt'],
        resources: [`arn:${this.partition}:kms:${this.region}:${this.account}:key/*`],
        conditions: { StringEquals: { 'kms:ViaService': `ssm.${this.region}.amazonaws.com` } },
      }),
    );

    const api = new HttpApi(this, 'HttpApi', {
      createDefaultStage: false,
      defaultIntegration: new HttpLambdaIntegration('Lambda', handler),
    });
    api.addRoutes({
      path: '/{proxy+}',
      methods: [HttpMethod.GET, HttpMethod.POST],
      integration: new HttpLambdaIntegration('Routes', handler),
    });
    new HttpStage(this, 'Stage', {
      httpApi: api,
      stageName: '$default',
      autoDeploy: true,
      throttle: { rateLimit: 50, burstLimit: 100 },
    });

    const bucket = new Bucket(this, 'Site', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const paymentOrigin = new URL(props.paymentApiUrl).origin;
    const headers = new ResponseHeadersPolicy(this, 'SecurityHeaders', {
      securityHeadersBehavior: {
        contentSecurityPolicy: {
          override: true,
          contentSecurityPolicy: [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self'",
            "img-src 'self' data:",
            "font-src 'self'",
            `connect-src 'self' ${paymentOrigin}`,
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "object-src 'none'",
          ].join('; '),
        },
        strictTransportSecurity: {
          override: true,
          accessControlMaxAge: Duration.seconds(63072000),
          includeSubdomains: true,
          preload: true,
        },
        contentTypeOptions: { override: true },
        frameOptions: { override: true, frameOption: HeadersFrameOption.DENY },
        referrerPolicy: {
          override: true,
          referrerPolicy: HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
        },
      },
    });

    const edge = (name: string, code: string) =>
      new EdgeFunction(this, name, {
        runtime: FunctionRuntime.JS_2_0,
        code: FunctionCode.fromInline(code),
      });

    const distribution = new Distribution(this, 'Cdn', {
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        responseHeadersPolicy: headers,
        functionAssociations: [
          {
            function: edge('SpaFallback', SPA_FALLBACK),
            eventType: FunctionEventType.VIEWER_REQUEST,
          },
        ],
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new HttpOrigin(`${api.apiId}.execute-api.${this.region}.${this.urlSuffix}`),
          viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: AllowedMethods.ALLOW_ALL,
          cachePolicy: CachePolicy.CACHING_DISABLED,
          originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          functionAssociations: [
            {
              function: edge('StripApiPrefix', STRIP_API_PREFIX),
              eventType: FunctionEventType.VIEWER_REQUEST,
            },
          ],
        },
      },
    });

    new BucketDeployment(this, 'Deploy', {
      sources: [Source.asset(props.frontendPath)],
      destinationBucket: bucket,
      distribution,
      distributionPaths: ['/*'],
    });

    // One view in the console (Resource Groups) with everything the project created.
    new CfnGroup(this, 'ProjectGroup', {
      name: PROJECT,
      description: 'Everything the coffee store created',
      resourceQuery: {
        type: 'TAG_FILTERS_1_0',
        query: {
          resourceTypeFilters: ['AWS::AllSupported'],
          tagFilters: [{ key: 'Project', values: [PROJECT] }],
        },
      },
    });

    new CfnOutput(this, 'SiteUrl', { value: `https://${distribution.distributionDomainName}` });
  }
}
