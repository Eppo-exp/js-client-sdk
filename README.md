# Eppo Javascript SDK

[![Test and lint SDK](https://github.com/Eppo-exp/js-client-sdk/actions/workflows/lint-test-sdk.yml/badge.svg)](https://github.com/Eppo-exp/js-client-sdk/actions/workflows/lint-test-sdk.yml)
[![](https://data.jsdelivr.com/v1/package/npm/@eppo/js-client-sdk/badge)](https://www.jsdelivr.com/package/npm/@eppo/js-client-sdk)

[Eppo](https://www.geteppo.com/) is a modular flagging and experimentation analysis tool. Eppo's Javascript SDK is built to make assignments for single user client applications that run in a web browser. Before proceeding you'll need an Eppo account.

## Features

- Feature gates
- Kill switches
- Progressive rollouts
- A/B/n experiments
- Mutually exclusive experiments (Layers)
- Global holdouts
- Dynamic configuration

## Installation

```bash
npm install @eppo/js-client-sdk
```

## Quick start

Begin by initializing a singleton instance of Eppo's client. Once initialized, the client can be used to make assignments anywhere in your app.

#### Initialize once

```javascript
import { init } from "@eppo/js-client-sdk";

await init({ apiKey: "<SDK-KEY-FROM-DASHBOARD>" });
```

#### Assign anywhere

```javascript
import * as EppoSdk from "@eppo/js-client-sdk";

const eppoClient = EppoSdk.getInstance();
const user = getCurrentUser();

const variation = eppoClient.getBooleanAssignment('show-new-feature', user.id, { 
  'country': user.country,
  'device': user.device,
}, false);
```

## Assignment functions

Every Eppo flag has a return type that is set once on creation in the dashboard. Once a flag is created, assignments in code should be made using the corresponding typed function: 

```javascript
getBooleanAssignment(...)
getNumericAssignment(...)
getIntegerAssignment(...)
getStringAssignment(...)
getJSONAssignment(...)
```

Each function has the same signature, but returns the type in the function name. For booleans use `getBooleanAssignment`, which has the following signature:

```javascript
getBooleanAssignment: (
  flagKey: string,
  subjectKey: string,
  subjectAttributes: Record<string, any>,
  defaultValue: string,
) => boolean
  ```

## Initialization options

The `init` function accepts the following optional configuration arguments.

| Option | Type | Description | Default |
| ------ | ----- | ----- | ----- | 
| **`assignmentLogger`**  | [IAssignmentLogger](https://github.com/Eppo-exp/js-client-sdk-common/blob/75c2ea1d91101d579138d07d46fca4c6ea4aafaf/src/assignment-logger.ts#L55-L62) | A callback that sends each assignment to your data warehouse. Required only for experiment analysis. See [example](#assignment-logger) below. | `null` |
| **`requestTimeoutMs`** | number | Timeout in milliseconds for HTTPS requests for the experiment configurations. | `5000` |
| **`numInitialRequestRetries`** | number | Number of _additional_ times the initial configurations request will be attempted if it fails. This is the request typically synchronously waited (via `await`) for completion. A small wait will be done between requests. | `1` |
| **`pollAfterSuccessfulInitialization`** | boolean | Poll for new configurations (every 30 seconds) after successfully requesting the initial configurations. | `false` |
| **`pollAfterFailedInitialization`** | boolean | Poll for new configurations even if the initial configurations request failed. | `false` |
| **`throwOnFailedInitialization`** | boolean | Throw an error (reject the promise) if unable to fetch initial configurations during initialization. | `true` |
| **`numPollRequestRetries`** | number | If polling for updated configurations after initialization, the number of additional times a request will be attempted before giving up. Subsequent attempts are done using an exponential backoff. | `7` |

## Off-line initialization

The SDK supports off-line initialization if you want to initialize the SDK with a configuration from your server SDK or other external process. In this mode the SDK will not attempt to fetch a configuration from Eppo's CDN, instead only using the provided values.

This function is synchronous and ready to handle assignments after it returns.

```javascript
import { offlineInit, Flag, ObfuscatedFlag } from "@eppo/js-client-sdk";

// configuration from your server SDK
const configurationJsonString: string = getConfigurationFromServer();
// The configuration will be not-obfuscated from your server SDK. If you have obfuscated flag values, you can use the `ObfuscatedFlag` type.
const flagsConfiguration: Record<string, Flag | ObfuscatedFlag> = JSON.parse(configurationJsonString);

offlineInit({ 
  flagsConfiguration,
  // If you have obfuscated flag values, you can use the `ObfuscatedFlag` type.
  isObfuscated: true,
 });
```

The `offlineInit` function accepts the following optional configuration arguments.

| Option | Type | Description | Default |
| ------ | ----- | ----- | ----- | 
| **`assignmentLogger`**  | [IAssignmentLogger](https://github.com/Eppo-exp/js-client-sdk-common/blob/75c2ea1d91101d579138d07d46fca4c6ea4aafaf/src/assignment-logger.ts#L55-L62) | A callback that sends each assignment to your data warehouse. Required only for experiment analysis. See [example](#assignment-logger) below. | `null` |
| **`flagsConfiguration`** | Record<string, Flag \| ObfuscatedFlag> | The flags configuration to use for the SDK. | `null` |
| **`isObfuscated`** | boolean | Whether the flag values are obfuscated. | `false` |
| **`throwOnFailedInitialization`** | boolean | Throw an error if an error occurs during initialization. | `true` |

## Assignment logger 

To use the Eppo SDK for experiments that require analysis, pass in a callback logging function to the `init` function on SDK initialization. The SDK invokes the callback to capture assignment data whenever a variation is assigned. The assignment data is needed in the warehouse to perform analysis.

The code below illustrates an example implementation of a logging callback using [Segment](https://segment.com/), but you can use any system you'd like. The only requirement is that the SDK receives a `logAssignment` callback function. Here we define an implementation of the Eppo `IAssignmentLogger` interface containing a single function named `logAssignment`:

```javascript
import { IAssignmentLogger } from "@eppo/js-client-sdk";
import { AnalyticsBrowser } from "@segment/analytics-next";

// Connect to Segment (or your own event-tracking system)
const analytics = AnalyticsBrowser.load({ writeKey: "<SEGMENT_WRITE_KEY>" });

const assignmentLogger: IAssignmentLogger = {
  logAssignment(assignment) {
    analytics.track({
      userId: assignment.subject,
      event: "Eppo Randomized Assignment",
      type: "track",
      properties: { ...assignment },
    });
  },
};
```

## Philosophy

Eppo's SDKs are built for simplicity, speed and reliability. Flag configurations are compressed and distributed over a global CDN (Fastly), typically reaching end users in under 15ms. Those configurations are then cached locally, ensuring that each assignment is made instantly. Each SDK is as light as possible, with evaluation logic at around [25 simple lines of code](https://github.com/Eppo-exp/js-client-sdk-common/blob/b903bbbca21ca75c0ab49d894951eb2f1fc6c85b/src/evaluator.ts#L34-L59). The simple typed functions listed above are all developers need to know about, abstracting away the complexity of the underlying set of features. 

## React

Visit the [Eppo docs](https://docs.geteppo.com/sdks/client-sdks/javascript#usage-in-react) for best practices when using this SDK within a React context.
