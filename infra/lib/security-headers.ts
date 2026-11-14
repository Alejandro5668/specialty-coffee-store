import { Duration } from 'aws-cdk-lib';
import {
  HeadersFrameOption,
  HeadersReferrerPolicy,
  ResponseHeadersPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { Construct } from 'constructs';

/**
 * Headers CloudFront adds to every page. The page may only talk to itself and to the payment
 * service. Cross-Origin-Embedder-Policy is left out on purpose: requiring it can block the
 * browser's call to the payment service.
 */
export const securityHeaders = (scope: Construct, paymentOrigin: string) =>
  new ResponseHeadersPolicy(scope, 'SecurityHeaders', {
    // The S3 origin would otherwise show `Server: AmazonS3`; CloudFront adds its own name.
    removeHeaders: ['Server'],
    customHeadersBehavior: {
      customHeaders: [
        {
          header: 'Permissions-Policy',
          value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
          override: true,
        },
        { header: 'Cross-Origin-Opener-Policy', value: 'same-origin', override: true },
        { header: 'Cross-Origin-Resource-Policy', value: 'same-origin', override: true },
      ],
    },
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
