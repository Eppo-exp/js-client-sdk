<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@eppo/js-client-sdk](./js-client-sdk.md) &gt; [offlineInit](./js-client-sdk.offlineinit.md)

## offlineInit() function

Initializes the Eppo client with configuration parameters.

The purpose is for use-cases where the configuration is available from an external process that can bootstrap the SDK.

This method should be called once on application startup.

**Signature:**

```typescript
export declare function offlineInit(config: IClientConfigSync): EppoClient;
```

## Parameters

<table><thead><tr><th>

Parameter


</th><th>

Type


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

config


</td><td>

[IClientConfigSync](./js-client-sdk.iclientconfigsync.md)


</td><td>

client configuration


</td></tr>
</tbody></table>
**Returns:**

EppoClient

a singleton client instance

