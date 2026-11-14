import { Match } from 'aws-cdk-lib/assertions';
import { build } from './stacks';

const { api } = build();
const policies = () =>
  JSON.stringify(Object.values(api.findResources('AWS::IAM::Policy')).map((p) => p.Properties));

describe('AppStack: the API', () => {
  it('runs on Node 22 and arm64, with a timeout below the API Gateway limit', () => {
    api.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs22.x',
      Architectures: ['arm64'],
      Handler: 'lambda.handler',
      Timeout: Match.anyValue(),
    });
    const fn = Object.values(api.findResources('AWS::Lambda::Function')).find(
      (f) => f.Properties.Handler === 'lambda.handler',
    )!;
    expect(fn.Properties.Timeout).toBeLessThanOrEqual(29);
  });

  it('gets its settings from the environment and its secrets by SSM name, never by value', () => {
    const fn = Object.values(api.findResources('AWS::Lambda::Function')).find(
      (f) => f.Properties.Handler === 'lambda.handler',
    )!;
    const env = fn.Properties.Environment.Variables;
    expect(env).toMatchObject({
      TABLE_PREFIX: 'coffee-store',
      PAYMENT_API_URL: 'https://payments.example.test/v1',
      PAYMENT_PUBLIC_KEY: 'pub_test_123',
      PAYMENT_PRIVATE_KEY_SSM: '/coffee-store/payment-private-key',
      PAYMENT_INTEGRITY_SECRET_SSM: '/coffee-store/payment-integrity-secret',
      PAYMENT_EVENTS_SECRET_SSM: '/coffee-store/payment-events-secret',
    });
    expect(Object.keys(env)).not.toEqual(
      expect.arrayContaining([
        'PAYMENT_PRIVATE_KEY',
        'PAYMENT_INTEGRITY_SECRET',
        'PAYMENT_EVENTS_SECRET',
      ]),
    );
  });

  it('trusts the two proxies in front of the Lambda, CloudFront and API Gateway', () => {
    const fn = Object.values(api.findResources('AWS::Lambda::Function')).find(
      (f) => f.Properties.Handler === 'lambda.handler',
    )!;
    expect(fn.Properties.Environment.Variables.TRUST_PROXY_HOPS).toBe('2');
  });

  it('closes CORS: the browser only ever calls the same origin', () => {
    const fn = Object.values(api.findResources('AWS::Lambda::Function')).find(
      (f) => f.Properties.Handler === 'lambda.handler',
    )!;
    expect(fn.Properties.Environment.Variables.CORS_ORIGIN).not.toContain('*');
    expect(fn.Properties.Environment.Variables.CORS_ORIGIN).toMatch(/^https:\/\//);
  });

  it('is limited to its own tables and its own three parameters', () => {
    const text = policies();
    expect(text).toContain('dynamodb:PutItem');
    expect(text).toContain('ssm:GetParameters');
    expect(text).toContain('/coffee-store/payment-private-key');
    expect(text).not.toMatch(/"Action":"\*"|"dynamodb:\*"|"ssm:\*"/);
    expect(text).not.toContain('dynamodb:DeleteTable');
  });

  it('reads the catalog without being able to change it', () => {
    const products = JSON.stringify(
      Object.values(api.findResources('AWS::IAM::Policy')).flatMap((p) =>
        p.Properties.PolicyDocument.Statement.filter((s: { Resource: unknown }) =>
          JSON.stringify(s.Resource).includes('products'),
        ),
      ),
    );
    expect(products).toContain('dynamodb:Scan');
    expect(products).not.toContain('dynamodb:PutItem');
    expect(products).not.toContain('dynamodb:UpdateItem');
  });

  it('keeps every secret out of the template', () => {
    expect(JSON.stringify(api.toJSON())).not.toMatch(/Bearer|prv_|events_|integrity_test/);
  });

  it('throttles the API below the account default', () => {
    api.hasResourceProperties('AWS::ApiGatewayV2::Stage', {
      DefaultRouteSettings: {
        ThrottlingBurstLimit: Match.anyValue(),
        ThrottlingRateLimit: Match.anyValue(),
      },
    });
  });
});

describe('AppStack: the site', () => {
  it('keeps the bucket private and reachable only through CloudFront', () => {
    api.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
    api.resourceCountIs('AWS::CloudFront::OriginAccessControl', 1);
  });

  it('redirects http to https', () => {
    api.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        DefaultCacheBehavior: Match.objectLike({ ViewerProtocolPolicy: 'redirect-to-https' }),
      }),
    });
  });

  it('sends /api/* to the API without caching it', () => {
    const [dist] = Object.values(api.findResources('AWS::CloudFront::Distribution'));
    const behaviors = dist.Properties.DistributionConfig.CacheBehaviors;
    expect(behaviors).toHaveLength(1);
    expect(behaviors[0].PathPattern).toBe('/api/*');
    expect(behaviors[0].AllowedMethods).toEqual(
      expect.arrayContaining(['GET', 'POST', 'HEAD', 'OPTIONS']),
    );
    expect(behaviors[0].ViewerProtocolPolicy).toBe('https-only');
  });

  it('does not rewrite errors for the whole distribution, which would hide API 404s', () => {
    const [dist] = Object.values(api.findResources('AWS::CloudFront::Distribution'));
    expect(dist.Properties.DistributionConfig.CustomErrorResponses).toBeUndefined();
  });

  it('has two functions: one strips /api, one sends app routes to index.html', () => {
    api.resourceCountIs('AWS::CloudFront::Function', 2);
    const code = Object.values(api.findResources('AWS::CloudFront::Function'))
      .map((f) => f.Properties.FunctionCode as string)
      .join('\n');
    expect(code).toContain('/index.html');
    expect(code).toMatch(/\/api/);
  });

  it('adds security headers, a CSP limited to self and the payment service, and HSTS', () => {
    api.hasResourceProperties('AWS::CloudFront::ResponseHeadersPolicy', {
      ResponseHeadersPolicyConfig: Match.objectLike({
        SecurityHeadersConfig: Match.objectLike({
          ContentSecurityPolicy: {
            Override: true,
            ContentSecurityPolicy: Match.stringLikeRegexp(
              "default-src 'self'.*connect-src 'self' https://payments\\.example\\.test.*frame-ancestors 'none'",
            ),
          },
          StrictTransportSecurity: Match.objectLike({ AccessControlMaxAgeSec: 63072000 }),
          ContentTypeOptions: { Override: true },
          FrameOptions: { FrameOption: 'DENY', Override: true },
          ReferrerPolicy: Match.anyValue(),
        }),
      }),
    });
  });

  it('exposes the public URL as an output', () => {
    expect(api.toJSON().Outputs).toHaveProperty('SiteUrl');
  });
});
