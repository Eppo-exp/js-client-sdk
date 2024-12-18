# Eppo Javascript SDK

[![Test and lint SDK](https://github.com/Eppo-exp/js-client-sdk/actions/workflows/lint-test-sdk.yml/badge.svg)](https://github.com/Eppo-exp/js-client-sdk/actions/workflows/lint-test-sdk.yml)
[![](https://data.jsdelivr.com/v1/package/npm/@eppo/js-client-sdk/badge)](https://www.jsdelivr.com/package/npm/@eppo/js-client-sdk)

## Getting Started

Refer to our [SDK documentation](https://docs.geteppo.com/sdks/client-sdks/javascript) for how to install and use the SDK.

### Publishing Releases

When publishing releases, the following rules apply:

- **Standard Release**: 
  - Create a release with tag format `vX.Y.Z` (e.g., `v4.3.5`)
  - Keep "Set as latest release" checked
  - Package will be published to NPM with the `latest` tag

- **Pre-release**:
  - Create a release with tag format `vX.Y.Z-label.N` (e.g., `v4.3.5-alpha.1`)
  - Check the "Set as pre-release" option
  - Package will be published to NPM with the pre-release label as its tag (e.g., `alpha.1`)

**Note**: The release will not be published if:
- A pre-release is marked as "latest"
- A pre-release label is used without checking "Set as pre-release"
