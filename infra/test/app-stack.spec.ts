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

  it('can store and read deliveries, and nothing else on that table', () => {
    const statements = Object.values(api.findResources('AWS::IAM::Policy')).flatMap(
      (p) => p.Properties.PolicyDocument.Statement,
    );
    const onDeliveries = JSON.stringify(
      statements.filter((s: { Resource: unknown }) =>
        JSON.stringify(s.Resource).includes('deliveries'),
      ),
    );
    expect(onDeliveries).toContain('dynamodb:PutItem');
    expect(onDeliveries).toContain('dynamodb:GetItem');
    expect(onDeliveries).not.toContain('dynamodb:DeleteItem');
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

describe('AppStack: finding the project in the console', () => {
  // CDK's own helper that empties the bucket on destroy is a raw resource it cannot tag.
  const tagged = (type: string) =>
    Object.entries(api.findResources(type))
      .filter(([id]) => !id.startsWith('CustomS3AutoDelete'))
      .every(([, r]) =>
        JSON.stringify(r.Properties.Tags ?? r.Properties.TagSet ?? []).includes('coffee-store'),
      );

  it.each(['AWS::Lambda::Function', 'AWS::S3::Bucket', 'AWS::ApiGatewayV2::Api'])(
    'tags %s with the project',
    (type) => expect(tagged(type)).toBe(true),
  );

  it('tags the CloudFront distribution too, which the console does not list by itself', () => {
    const [dist] = Object.values(api.findResources('AWS::CloudFront::Distribution'));
    expect(dist.Properties.Tags).toEqual(
      expect.arrayContaining([{ Key: 'Project', Value: 'coffee-store' }]),
    );
  });

  it('creates one resource group that gathers everything with that tag', () => {
    api.resourceCountIs('AWS::ResourceGroups::Group', 1);
    api.hasResourceProperties('AWS::ResourceGroups::Group', {
      Name: 'coffee-store',
      ResourceQuery: {
        Type: 'TAG_FILTERS_1_0',
        Query: { TagFilters: [{ Key: 'Project', Values: ['coffee-store'] }] },
      },
    });
  });
});
