# Eppo Javascript SDK

[![Test and lint SDK](https://github.com/Eppo-exp/js-client-sdk/actions/workflows/lint-test-sdk.yml/badge.svg)](https://github.com/Eppo-exp/js-client-sdk/actions/workflows/lint-test-sdk.yml)
[![](https://data.jsdelivr.com/v1/package/npm/@eppo/js-client-sdk/badge)](https://www.jsdelivr.com/package/npm/@eppo/js-client-sdk)

[Eppo](https://www.geteppo.com/) is a modular flagging and experimentation analysis tool that supports a wide range of flagging use cases, from simple features toggles to A/B/n experiments to highly personalized contextual bandits. 

Eppo's Javascript SDK is built to make assignments for single user client applications that run in a web browser. For the server side equivalent, use Eppo's [Node SDK](https://github.com/Eppo-exp/node-server-sdk). Before proceeding you'll need an Eppo account.

## Installation

```
npm install @eppo/js-client-sdk
```

## Usage

Initialization creates a singleton instance of Eppo's client and fetches the account's flag configuration, which is cached using local storage. Once initialized, assignments can be made anywhere in your app.

#### Initialize once

```javascript
import { init } from "@eppo/js-client-sdk";

await init({ apiKey: "<SDK-KEY-FROM-UI>" });
```


#### Assign anywhere

```javascript
import * as EppoSdk from "@eppo/js-client-sdk";

const eppoClient = EppoSdk.getInstance();
const user = getCurrentUser();

const variation = eppoClient.getStringAssignment('new-feature', user.id, { 
  'country': user.country,
  'device': user.device,
}, false);
```

The function `getStringAssignment` is part of a set of typed assignment functions. takes in a subject ID, a flag key, and an optional map of subject metadata used for targeting.

## Initialization options

The `init` function accepts the following configuration options.

| Option | Description | Default |
| ------ | ----------- | ------- | 
| **`assignmentLogger`** ([IAssignmentLogger](https://github.com/Eppo-exp/js-client-sdk-common/blob/75c2ea1d91101d579138d07d46fca4c6ea4aafaf/src/assignment-logger.ts#L55-L62)) | A callback that sends each assignment to your data warehouse. Required for experiment analysis. See example below. | `null` |
| **`requestTimeoutMs`** (number) | Timeout in milliseconds for HTTPS requests for the experiment configurations. | `5000` |
| **`numInitialRequestRetries`** (number) | Number of _additional_ times the initial configurations request will be attempted if it fails. This is the request typically synchronously waited (via `await`) for completion. A small wait will be done between requests. | `1` |
| **`pollAfterSuccessfulInitialization`** (boolean) | Poll for new configurations (every 30 seconds) after successfully requesting the initial configurations. | `false` |
| **`pollAfterFailedInitialization`** (boolean) | Poll for new configurations even if the initial configurations request failed. | `false` |
| **`throwOnFailedInitialization`** (boolean) | Throw an error (reject the promise) if unable to fetch initial configurations during initialization. | `true` |
| **`numPollRequestRetries`** (number) | If polling for updated configurations after initialization, the number of additional times a request will be attempted before giving up. Subsequent attempts are done using an exponential backoff. | `7` |

#### Typed assignment functions

Every Eppo flag has a return type that is set once on creation in the dashboard. Once a flag is created, assignments in code should be made using the corresponding typed function: 

```javascript
getBoolAssignment(...)
getNumericAssignment(...)
getIntegerAssignment(...)
getStringAssignment(...)
getJSONAssignment(...)
```

Each function has the same signature, but returns the type in the function name. For strings use `getStringAssignment`, which has the following signature:

```javascript
getStringAssignment: (
  flagKey: string,
  subjectKey: string,
  subjectAttributes: Record<string, any>,
  defaultValue: string,
) => string
  ```

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

## React

Visit the [Eppo docs](https://docs.geteppo.com/sdks/client-sdks/javascript#usage-in-react) for best practices when using this SDK within a React context.



