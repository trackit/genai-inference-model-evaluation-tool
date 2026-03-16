import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { handler } from './health.js';

describe('Health Handler', () => {
  // Feature: project-base-setup, Property 1: Health handler always returns 200 with valid JSON body
  it('should always return 200 with valid JSON body for any event', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          version: fc.constant('2.0'),
          routeKey: fc.string(),
          rawPath: fc.string(),
          rawQueryString: fc.string(),
          headers: fc.dictionary(fc.string(), fc.string()),
          requestContext: fc.record({
            accountId: fc.string(),
            apiId: fc.string(),
            domainName: fc.string(),
            domainPrefix: fc.string(),
            http: fc.record({
              method: fc.string(),
              path: fc.string(),
              protocol: fc.string(),
              sourceIp: fc.string(),
              userAgent: fc.string(),
            }),
            requestId: fc.string(),
            routeKey: fc.string(),
            stage: fc.string(),
            time: fc.string(),
            timeEpoch: fc.integer(),
          }),
          isBase64Encoded: fc.boolean(),
        }),
        async (event) => {
          const result = await handler(event as APIGatewayProxyEventV2);

          // Verify status code is 200
          expect(result.statusCode).toBe(200);

          // Verify body is valid JSON
          expect(() => JSON.parse(result.body)).not.toThrow();

          // Verify parsed body contains status: ok
          const parsed = JSON.parse(result.body);
          expect(parsed).toHaveProperty('status', 'ok');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should return correct response structure', async () => {
    const mockEvent = {
      version: '2.0',
      routeKey: 'GET /health',
      rawPath: '/health',
      rawQueryString: '',
      headers: {},
      requestContext: {
        accountId: '123456789012',
        apiId: 'api-id',
        domainName: 'example.com',
        domainPrefix: 'api',
        http: {
          method: 'GET',
          path: '/health',
          protocol: 'HTTP/1.1',
          sourceIp: '127.0.0.1',
          userAgent: 'test-agent',
        },
        requestId: 'test-request-id',
        routeKey: 'GET /health',
        stage: '$default',
        time: '01/Jan/2024:00:00:00 +0000',
        timeEpoch: 1704067200000,
      },
      isBase64Encoded: false,
    } as APIGatewayProxyEventV2;

    const result = await handler(mockEvent);

    expect(result).toEqual({
      statusCode: 200,
      body: JSON.stringify({ status: 'ok' }),
    });
  });
});
