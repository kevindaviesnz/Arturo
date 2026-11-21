import type {
  Artefact,
  ArtefactVersion,
} from "../artefacts/artefact";

import {
  runtimeDb,
} from "./runtimeDatabase";

/** Saves one Artefact identity record. */
export function saveArtefact(
  artefact: Artefact
): void {
  runtimeDb.prepare(`
    INSERT OR REPLACE INTO artefacts (
      id, enterprise_id, name, kind, created_at
    ) VALUES (
      @id, @enterpriseId, @name, @kind, @createdAt
    )
  `).run({
    id:
      artefact.id,
    enterpriseId:
      artefact.enterpriseId,
    name:
      artefact.name,
    kind:
      artefact.kind,
    createdAt:
      artefact.createdAt,
  });
}

/** Saves one immutable file version and its current review state. */
export function saveArtefactVersion(
  version: ArtefactVersion
): void {
  runtimeDb.prepare(`
    INSERT OR REPLACE INTO artefact_versions (
      artefact_id, version, uri, local_path, media_type, sha256, size_bytes,
      created_by, source_job_id, source_human_task_id, notes, created_at,
      review_status, review_task_id, reviewer, reviewed_at, review_notes,
      review_signature
    ) VALUES (
      @artefactId, @version, @uri, @localPath, @mediaType, @sha256, @sizeBytes,
      @createdBy, @sourceJobId, @sourceHumanTaskId, @notes, @createdAt,
      @reviewStatus, @reviewTaskId, @reviewer, @reviewedAt, @reviewNotes,
      @reviewSignature
    )
  `).run({
    ...version,
    localPath:
      version.localPath ??
      null,
    sha256:
      version.sha256 ??
      null,
    sizeBytes:
      version.sizeBytes ??
      null,
    sourceJobId:
      version.sourceJobId ??
      null,
    sourceHumanTaskId:
      version.sourceHumanTaskId ??
      null,
    notes:
      version.notes ??
      null,
    reviewTaskId:
      version.reviewTaskId ??
      null,
    reviewer:
      version.reviewer ??
      null,
    reviewedAt:
      version.reviewedAt ??
      null,
    reviewNotes:
      version.reviewNotes ??
      null,
    reviewSignature:
      version.reviewSignature ??
      null,
  });
}

/** Loads all persisted Artefacts with versions in ascending order. */
export function loadArtefacts(): Artefact[] {
  const artefacts =
    runtimeDb.prepare(`
      SELECT id, enterprise_id as enterpriseId, name, kind,
        created_at as createdAt
      FROM artefacts
      ORDER BY created_at ASC, id ASC
    `).all() as Array<
      Omit<Artefact, "versions">
    >;

  const versions =
    runtimeDb.prepare(`
      SELECT artefact_id as artefactId, version, uri,
        local_path as localPath, media_type as mediaType, sha256,
        size_bytes as sizeBytes, created_by as createdBy,
        source_job_id as sourceJobId,
        source_human_task_id as sourceHumanTaskId, notes,
        created_at as createdAt, review_status as reviewStatus,
        review_task_id as reviewTaskId, reviewer,
        reviewed_at as reviewedAt, review_notes as reviewNotes,
        review_signature as reviewSignature
      FROM artefact_versions
      ORDER BY artefact_id ASC, version ASC
    `).all() as ArtefactVersion[];

  return artefacts.map(
    (artefact) => ({
      ...artefact,
      versions:
        versions
          .filter(
            (version) =>
              version.artefactId ===
              artefact.id
          )
          .map(
            (version) => ({
              ...version,
              localPath:
                version.localPath ??
                undefined,
              sha256:
                version.sha256 ??
                undefined,
              sizeBytes:
                version.sizeBytes ??
                undefined,
              sourceJobId:
                version.sourceJobId ??
                undefined,
              sourceHumanTaskId:
                version.sourceHumanTaskId ??
                undefined,
              notes:
                version.notes ??
                undefined,
              reviewTaskId:
                version.reviewTaskId ??
                undefined,
              reviewer:
                version.reviewer ??
                undefined,
              reviewedAt:
                version.reviewedAt ??
                undefined,
              reviewNotes:
                version.reviewNotes ??
                undefined,
              reviewSignature:
                version.reviewSignature ??
                undefined,
            })
          ),
    })
  );
}

/** Deletes Artefact identities and versions. */
export function clearPersistedArtefacts(): void {
  runtimeDb
    .prepare(
      "DELETE FROM artefact_versions"
    )
    .run();
  runtimeDb
    .prepare(
      "DELETE FROM artefacts"
    )
    .run();
}
