# Attachments Book Reference Tools and Repositories

Verified: 2026-08-01. Re-check versions, transitive licenses, advisories, and deployment support before adoption.

## Recommended upload UI: Uppy

- Repository: https://github.com/transloadit/uppy
- Documentation: https://uppy.io/docs/
- License: MIT.
- Why: modular React-capable UI, metadata editing, progress, recovery, accessibility, and tus support.
- Use: upload client only; Lango remains responsible for authorization, target metadata, quota, and publish lifecycle.

## Recommended resumable protocol/server: tus and tusd

- Server: https://github.com/tus/tusd
- Protocol: https://github.com/tus/tus-resumable-upload-protocol
- Documentation: https://tus.github.io/tusd/
- License: MIT.
- Why: official resumable-upload reference server with local, GCS, AWS S3, and S3-compatible storage support.
- Use: isolated upload service with pre-create/pre-finish hooks back to Lango. Never expose an unauthenticated arbitrary upload endpoint.

## Object storage candidate: SeaweedFS

- Repository: https://github.com/seaweedfs/seaweedfs
- License: Apache-2.0.
- Why: actively maintained S3-compatible self-hosted storage, efficient small-file handling, replication and lifecycle capabilities.
- Use: optional self-hosted BlobStore backend, not business metadata or authorization source.
- Caveat: operating distributed storage is substantial; managed S3-compatible storage may be safer for a small team. Run durability, upgrade, backup/restore, IAM, and failure tests before selection.

## Malware scanning: ClamAV

- Repository: https://github.com/Cisco-Talos/clamav
- Documentation: https://docs.clamav.net/
- License: GPL-2.0.
- Why: established malware scanning engine with container deployment.
- Use: separate scanning service/process called over its supported interface; do not copy/link GPL source into proprietary application code without legal review.
- Caveat: scanning reduces risk but does not make active content safe. Keep MIME controls, sandboxed previews, quarantine, signatures updates, and resource limits.

## Metadata/text extraction: Apache Tika

- Repository: https://github.com/apache/tika
- Documentation: https://tika.apache.org/
- License: Apache-2.0 for the collective work; inspect bundled parser notices.
- Why: detection and bounded metadata/text extraction across many document formats.
- Use: optional isolated worker/service for search indexing and metadata. Never render extracted HTML as trusted content.

## Product inspiration only

- Nextcloud server: https://github.com/nextcloud/server (AGPL-3.0). Useful for versioning, sharing, activity, trash, retention, and file UX patterns; do not copy into Lango without legal review.
- ResourceSpace: https://www.resourcespace.com/ and its official source distribution. Useful DAM taxonomy, metadata, permissions, previews, and usage patterns; verify its current license/source before any reuse.

## Selection recommendation

1. Uppy + tusd for reliable uploads.
2. Lango-owned BlobStore abstraction with local development and production S3-compatible adapters.
3. Managed object storage first unless self-hosting requirements justify SeaweedFS operations.
4. ClamAV before publish and Apache Tika only as a sandboxed optional worker.
5. Nextcloud/ResourceSpace as UX/domain inspiration, not embedded dependencies.

