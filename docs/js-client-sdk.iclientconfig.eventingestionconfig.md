<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@eppo/js-client-sdk](./js-client-sdk.md) &gt; [IClientConfig](./js-client-sdk.iclientconfig.md) &gt; [eventIngestionConfig](./js-client-sdk.iclientconfig.eventingestionconfig.md)

## IClientConfig.eventIngestionConfig property

Configuration settings for the event dispatcher

**Signature:**

```typescript
eventIngestionConfig?: {
        deliveryIntervalMs?: number;
        retryIntervalMs?: number;
        maxRetryDelayMs?: number;
        maxRetries?: number;
        batchSize?: number;
    };
```