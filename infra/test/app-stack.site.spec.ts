import { Match } from 'aws-cdk-lib/assertions';
import { build } from './stacks';

const { api } = build();

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

  it('turns off browser features the store never uses and isolates the page from other windows', () => {
    api.hasResourceProperties('AWS::CloudFront::ResponseHeadersPolicy', {
      ResponseHeadersPolicyConfig: Match.objectLike({
        CustomHeadersConfig: {
          Items: Match.arrayWith([
            {
              Header: 'Permissions-Policy',
              Value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
              Override: true,
            },
            { Header: 'Cross-Origin-Opener-Policy', Value: 'same-origin', Override: true },
            { Header: 'Cross-Origin-Resource-Policy', Value: 'same-origin', Override: true },
          ]),
        },
      }),
    });
  });

  it('does not announce which service answers', () => {
    api.hasResourceProperties('AWS::CloudFront::ResponseHeadersPolicy', {
      ResponseHeadersPolicyConfig: Match.objectLike({
        RemoveHeadersConfig: { Items: [{ Header: 'Server' }] },
      }),
    });
  });

  it('does not require cross-origin embedding, which would block the call to the payment service', () => {
    const policy = JSON.stringify(api.findResources('AWS::CloudFront::ResponseHeadersPolicy'));
    expect(policy).not.toContain('Cross-Origin-Embedder-Policy');
  });

  it('exposes the public URL as an output', () => {
    expect(api.toJSON().Outputs).toHaveProperty('SiteUrl');
  });
});
