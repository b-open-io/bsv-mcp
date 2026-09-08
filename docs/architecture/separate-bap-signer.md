# Separate identity for SIGMA signatures

AIP and SIGMA are data-signature protocols. BAP records describe identity
registration, rotation, and attestations. There is no separate BAP signature
protocol.

The installed `@1sat/actions` version 0.0.207 exposes the inscription option
`signWithBAP`, documented as “Sign with BAP identity (Sigma protocol).” It
selects the current key from a published BAP identity record and adds a SIGMA
signature. This option does not require the signing key to be the funding key.

BSV MCP uses the SDK's existing local pipeline. `withSigmaIdentity` supplies a
wallet interface that routes BAP basket reads and SIGMA-protocol public-key and
signature calls to the identity wallet. Anchor funding, input signing, change,
output ownership, transaction storage, and broadcast remain on the ordinals
wallet. The SDK passes this interface through its apply and signing stages;
no SDK modification is required.

The tool checks the selected identity before transaction creation. A disabled,
unpublished, or unavailable identity fails without consulting the funding
wallet's identity. Both wallets must use the same network. This integration
uses the local pipeline; it does not claim separate-role dispatch through an
external permission module.

A regression test runs the SDK inscription pipeline with distinct synthetic
root keys, verifies the resulting SIGMA signature against the identity key,
and verifies that anchor input signing uses the ordinals key. The SDK also
validates that input script before completing the action.
