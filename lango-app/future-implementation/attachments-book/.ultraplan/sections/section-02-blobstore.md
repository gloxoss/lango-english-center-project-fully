# Section 02: BlobStore Interface & Local-Disk Adapter

## Overview
Extends the existing `src/libs/api/uploads.ts` local-disk helper into a small `BlobStore` interface with exactly the operations this app needs (put/get/head/delete), backed by a `LocalDiskBlobStore` implementation using content-addressed, immutable version keys. Existing callers of `saveUploadedFile`/`readUploadedFile`/`copyUploadedFile` are untouched — this section adds new exports alongside them, it does not refactor existing call sites.

## Risk: [green] - additive, no existing code touched, small well-understood interface

## Dependencies
- Depends on: none
- Blocks: section-05
- Parallel batch: 1

## TDD Test Stubs
- Test: `blobKeyFor` produces the documented immutable key shape given tenant/asset/version/sha256 inputs
- Test: `LocalDiskBlobStore.put` then `.get` round-trips the exact bytes written
- Test: `LocalDiskBlobStore.head` returns null for a key that was never written (no throw)

## Tasks

<task type="auto" id="02-01">
  <name>Define the BlobStore interface and immutable key helper</name>
  <files>src/libs/api/blob-store.ts</files>
  <action>
    Create a new file (does not touch `uploads.ts`) exporting:
    ```ts
    export type BlobStore = {
      put: (key: string, bytes: Buffer) => Promise<void>;
      get: (key: string) => Promise<Buffer>;
      head: (key: string) => Promise<{ size: number } | null>;
      delete: (key: string) => Promise<void>;
    };

    export function blobKeyFor(tenantId: string, assetId: string, versionId: string, sha256: string): string {
      return `tenant/${tenantId}/assets/${assetId}/versions/${versionId}/${sha256}`;
    }
    ```
    This is the exact key shape from ATTACHMENTS-BOOK-ADDON.md's storage-architecture section, kept identical so a future S3 adapter needs zero business-logic changes (only a new class implementing the same interface, swapped in at the one call site created in section-05).
  </action>
  <verify>Types compile; `blobKeyFor` is a pure function with no I/O.</verify>
  <done>blob-store.ts exports the BlobStore type and blobKeyFor.</done>
</task>

<task type="auto" id="02-02">
  <name>Implement LocalDiskBlobStore</name>
  <files>src/libs/api/blob-store.ts</files>
  <action>
    In the same file, add:
    ```ts
    export class LocalDiskBlobStore implements BlobStore {
      async put(key: string, bytes: Buffer): Promise<void> {
        const fullPath = path.join(UPLOADS_ROOT, key);
        await mkdir(path.dirname(fullPath), { recursive: true });
        await writeFile(fullPath, bytes);
      }
      async get(key: string): Promise<Buffer> {
        return readFile(path.join(UPLOADS_ROOT, key));
      }
      async head(key: string): Promise<{ size: number } | null> {
        try {
          const s = await stat(path.join(UPLOADS_ROOT, key));
          return { size: s.size };
        } catch {
          return null;
        }
      }
      async delete(key: string): Promise<void> {
        await rm(path.join(UPLOADS_ROOT, key), { force: true });
      }
    }
    export const blobStore: BlobStore = new LocalDiskBlobStore();
    ```
    Import `UPLOADS_ROOT` from `./uploads` (already exported there) rather than redefining it, so both the old helper and the new BlobStore write under the same Docker volume root. Import `mkdir`, `readFile`, `writeFile`, `rm`, `stat` from `node:fs/promises`, and `path` from `node:path`.

    Note the deliberate key-shape difference from the existing `uploads.ts` paths: `uploads.ts` paths are `{tenantId}/{subpath}` (purpose-named, mutable-by-overwrite); BlobStore keys are `tenant/{tenantId}/assets/{assetId}/versions/{versionId}/{sha256}` (content-addressed, immutable — a version is never overwritten, only a new version is written to a new key). Both coexist under the same `UPLOADS_ROOT`, in different subtrees, with no collision.
  </action>
  <verify>A real round-trip: `await blobStore.put('tenant/t1/assets/a1/versions/v1/abc', Buffer.from('hi')); const b = await blobStore.get(...); b.toString() === 'hi'`. `blobStore.head` on a never-written key returns `null`, not a throw.</verify>
  <done>LocalDiskBlobStore is exported as the default `blobStore` instance, ready for section-05 to call.</done>
</task>

<task type="auto" id="02-03">
  <name>Add a quarantine-subpath helper for the pre-scan write location</name>
  <files>src/libs/api/blob-store.ts</files>
  <action>
    Add: `export function quarantineKeyFor(tenantId: string, uploadId: string): string { return \`tenant/\${tenantId}/quarantine/\${uploadId}\`; }`. Section-05's upload route writes the raw upload here first (via `blobStore.put`), scans it in place (section-03's scan client reads this same path), and only on a clean result does it get re-written to its final immutable `blobKeyFor(...)` key via `blobStore.put` + the quarantine copy is deleted via `blobStore.delete`. This keeps "never downloadable until scanned clean" true at the storage layer, not just at the app-logic layer (a request for the quarantine key is never routed to by the download route built in section-05, since nothing outside the quarantine pipeline ever knows a quarantine key from an asset's real version key).
  </action>
  <verify>`quarantineKeyFor` is a pure function; produces a key visibly distinct from `blobKeyFor`'s shape (no assets/versions path).</verify>
  <done>quarantineKeyFor exists and is exported for section-05's upload pipeline to use.</done>
</task>
