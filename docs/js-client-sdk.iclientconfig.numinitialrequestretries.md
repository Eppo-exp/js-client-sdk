<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@eppo/js-client-sdk](./js-client-sdk.md) &gt; [IClientConfig](./js-client-sdk.iclientconfig.md) &gt; [numInitialRequestRetries](./js-client-sdk.iclientconfig.numinitialrequestretries.md)

## IClientConfig.numInitialRequestRetries property

Number of additional times the initial configuration request will be attempted if it fails. This is the request typically synchronously waited (via await) for completion. A small wait will be done between requests. (Default: 1)

**Signature:**

```typescript
numInitialRequestRetries?: number;
```