# Separate BAP signing for inscriptions

Local role selection supports different payment, identity, and ordinals keys.
BAP-signed inscriptions currently require identity and ordinals to share a
wallet context. BSV MCP rejects an unsupported combination before invoking the
inscription action.

The installed `@1sat/actions` version 0.0.207 passes one wallet into
`applyP1SatCreateAction` and `applyInscribeSigma`. The latter reconstructs its
context from that wallet, creates the anchor transaction, and calls `sealSigma`.
`sealSigma` resolves the BAP record and signs through the same wallet. An outer
MCP context replacement alone therefore cannot select another identity.

An SDK extension should accept an explicit BAP signer through the apply
pipeline. BAP record lookup, current-key resolution, public-key derivation, and
Sigma message signing belong to that signer. Anchor funding, input signing,
change, output ownership, transaction storage, and broadcast stay with the
ordinals wallet. The selection must survive permission-module dispatch and
must never fall back to the funding identity when the requested signer fails.

Acceptance should verify the resulting Sigma signature against the selected
published BAP identity with distinct synthetic keys. It should also cover
unpublished/rotated identity records, missing or locked signers, permission
refusal, anchor cleanup, and unchanged ownership/funding behavior. This is an
SDK follow-up, not a claim that cross-wallet inscription signing is supported.
