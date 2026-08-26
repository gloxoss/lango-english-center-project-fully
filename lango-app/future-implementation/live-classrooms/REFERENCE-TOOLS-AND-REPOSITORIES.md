# Live Classrooms Reference Tools and Repositories

Verified: 2026-08-01. Re-check versions, licenses, security advisories, and provider terms before implementation.

## Recommended reference: BigBlueButton

- Repository: https://github.com/bigbluebutton/bigbluebutton
- Documentation: https://docs.bigbluebutton.org/
- License: LGPL-3.0.
- Why: purpose-built virtual classroom with slides/whiteboard, polls, breakout rooms, chat, recordings, and learning analytics.
- Use: primary external conferencing service and product/analytics reference. Integrate through its API; do not copy source into SchoolOS without a license review.
- Caveat: significant dedicated infrastructure and operations. Prove capacity, upgrades, recording storage, and monitoring in a spike.

## Alternative: LiveKit

- Server: https://github.com/livekit/livekit
- React components: https://github.com/livekit/components-js
- Egress/recording: https://github.com/livekit/egress
- Documentation: https://docs.livekit.io/
- License: Apache-2.0 for the referenced OSS repositories; verify each component.
- Why: excellent programmable WebRTC primitives, signed tokens, webhooks, React SDK, ingress/egress and recording.
- Use: best option if SchoolOS later wants a deeply custom classroom UI.
- Caveat: SchoolOS would need to build education workflows and analytics that BigBlueButton already has.

## Alternative: Jitsi Meet

- Repository: https://github.com/jitsi/jitsi-meet
- Docker deployment: https://github.com/jitsi/docker-jitsi-meet
- Documentation: https://jitsi.github.io/handbook/
- License: Apache-2.0 for Jitsi Meet; verify companion components.
- Why: mature embeddable conferencing, self-hosting, mobile SDKs, screen sharing, chat, polls and reactions.
- Use: reference for embedded meeting UX or a simpler general-conferencing provider.
- Caveat: education reports and recording infrastructure require additional design; Jibri is operationally heavy.

## External connectors

- Zoom, Google Meet and Microsoft Teams should be implemented only with their official APIs/SDKs and current commercial terms.
- Treat them as provider connectors, not open-source dependencies.
- Persist provider capabilities because attendance events, recordings, embedding, and licensing differ.

## Selection recommendation

1. BigBlueButton for v1 education-first functionality.
2. A provider-neutral adapter and fake test provider from day one.
3. External-link connector for schools that already pay for Meet/Zoom/Teams.
4. LiveKit only when custom UX/AI/media control becomes a product differentiator.
5. Jitsi when general self-hosted conferencing is valued more than built-in classroom analytics.

