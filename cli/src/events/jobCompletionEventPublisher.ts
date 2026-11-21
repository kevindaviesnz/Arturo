import fs from "node:fs";

import {
  getArtefact,
  getArtefactVersion,
  verifyArtefactVersionIntegrity,
} from "../artefacts/artefactStore";

import {
  parseArtefactReference,
} from "../artefacts/artefact";

import {
  getBusinessFunctionDefinition,
  getBusinessFunctionDefinitionByRuntimeId,
  listBusinessFunctionDefinitionsByEnterprise,
} from "../business/businessFunctionDefinitionStore";

import type {
  BusinessFunctionDefinition,
} from "../business/businessFunctionDefinition";

import {
  listBusinessFunctions,
} from "../business/businessFunctionRuntimeStore";

import {
  getEnterprise,
} from "../enterprise/enterpriseStore";

import type {
  Job,
} from "../runtime/jobQueue";

import type {
  RuntimeSignalReasoner,
} from "../runtime/businessFunctionRuntimeEvaluator";

import {
  hasPersistedJobCompletionEventEmission,
  savePersistedJobCompletionEventEmission,
} from "../storage/jobCompletionEventRuleRepository";

import {
  listJobCompletionEventRules,
} from "./jobCompletionEventRuleStore";

import type {
  JobCompletionEventRule,
} from "./jobCompletionEventRule";

import {
  publishOrganisationalEventToRuntimes,
  type OrganisationalEventPublication,
} from "./organisationalEventBus";

export type VerifiedWebSearchEvidence = {
  readonly artefactReferences:
    readonly string[];
  readonly query:
    string;
  readonly retrievedAt:
    string;
  readonly resultCount:
    number;
};

export type JobCompletionEventRuleEvaluation = {
  readonly rule:
    JobCompletionEventRule;
  readonly status:
    | "published"
    | "skipped"
    | "already_published";
  readonly reason?:
    string;
  readonly eventId?:
    string;
  readonly publication?:
    OrganisationalEventPublication;
};

type WebSearchEvidenceDocument = {
  readonly evidenceType?:
    unknown;
  readonly query?:
    unknown;
  readonly retrievedAt?:
    unknown;
  readonly results?:
    unknown;
};

/** Resolves the Business Function that owns a Job through its Runtime. */
export function resolveJobBusinessFunction(
  job:
    Job
): BusinessFunctionDefinition |
  undefined {
  if (job.owningJobId) {
    return getBusinessFunctionDefinition(
      job.owningJobId
    );
  }

  const runtime =
    listBusinessFunctions()
      .find(
        (candidate) =>
          candidate.jobIds
            .includes(
              job.id
            )
      );

  return runtime
    ? getBusinessFunctionDefinitionByRuntimeId(
        runtime.id
      )
    : undefined;
}

/** Verifies captured, local, hashed Web Search evidence belonging to a Job. */
export function resolveVerifiedWebSearchEvidence(
  job:
    Job,
  enterpriseId:
    string
): VerifiedWebSearchEvidence |
  undefined {
  const verified:
    {
      readonly reference:
        string;
      readonly document:
        WebSearchEvidenceDocument;
    }[] = [];

  for (
    const value of
      job.inputArtefactRefs ??
      []
  ) {
    try {
      const reference =
        parseArtefactReference(
          value
        );
      const artefact =
        getArtefact(
          reference.artefactId
        );
      const version =
        getArtefactVersion(
          reference
        );
      if (
        !artefact ||
        !version ||
        artefact.enterpriseId !==
          enterpriseId ||
        artefact.kind !==
          "evidence" ||
        version.sourceJobId !==
          job.id ||
        version.mediaType !==
          "application/json" ||
        !version.localPath ||
        verifyArtefactVersionIntegrity(
          version
        ).status !==
          "verified"
      ) {
        continue;
      }

      const document =
        JSON.parse(
          fs.readFileSync(
            version.localPath,
            "utf8"
          )
        ) as
          WebSearchEvidenceDocument;
      if (
        document.evidenceType !==
          "governed-web-search" ||
        typeof document.query !==
          "string" ||
        !document.query.trim() ||
        typeof document.retrievedAt !==
          "string" ||
        !document.retrievedAt.trim() ||
        !Array.isArray(
          document.results
        ) ||
        document.results.length ===
          0
      ) {
        continue;
      }

      verified.push({
        reference:
          value,
        document,
      });
    } catch {
      // Malformed, missing, changed, or non-JSON evidence cannot satisfy a rule.
    }
  }

  if (
    verified.length ===
    0
  ) {
    return undefined;
  }

  const primary =
    verified[0]
      .document;

  return {
    artefactReferences:
      verified.map(
        (item) =>
          item.reference
      ),
    query:
      String(
        primary.query
      ),
    retrievedAt:
      String(
        primary.retrievedAt
      ),
    resultCount:
      verified.reduce(
        (
          total,
          item
        ) =>
          total +
          (
            Array.isArray(
              item.document
                .results
            )
              ? item.document
                  .results
                  .length
              : 0
          ),
        0
      ),
  };
}

/**
 * Applies configured post-Job Event rules after a Job has completed.
 *
 * The model cannot call this path. A Web Search rule fires only when Arturo
 * can verify the exact captured evidence file and its recorded hash.
 */
export async function publishConfiguredEventsForCompletedJob(
  job:
    Job,
  reasoner?:
    RuntimeSignalReasoner
): Promise<
  readonly JobCompletionEventRuleEvaluation[]
> {
  if (
    job.status !==
    "completed"
  ) {
    return [];
  }

  const sourceDefinition =
    resolveJobBusinessFunction(
      job
    );
  if (!sourceDefinition) {
    return [];
  }
  const enterprise =
    getEnterprise(
      sourceDefinition
        .enterpriseId
    );
  if (!enterprise) {
    return [];
  }

  const applicableRules =
    listJobCompletionEventRules()
      .filter(
        (rule) =>
          rule.enabled &&
          rule.enterpriseId ===
            enterprise.id &&
          rule.sourceBusinessFunctionId ===
            sourceDefinition.id &&
          (
            !rule.requiredCapability ||
            (
              job.requiredCapabilities ??
              []
            ).includes(
              rule.requiredCapability
            )
          )
      );
  const evaluations:
    JobCompletionEventRuleEvaluation[] =
    [];

  for (
    const rule of
      applicableRules
  ) {
    if (
      hasPersistedJobCompletionEventEmission(
        rule.id,
        job.id
      )
    ) {
      evaluations.push({
        rule,
        status:
          "already_published",
        reason:
          "This rule has already published an Event for the completed Task.",
      });
      continue;
    }

    const webSearchEvidence =
      rule.requiredCapability ===
        "web-research"
        ? resolveVerifiedWebSearchEvidence(
            job,
            enterprise.id
          )
        : undefined;
    if (
      rule.requiredCapability ===
        "web-research" &&
      !webSearchEvidence
    ) {
      evaluations.push({
        rule,
        status:
          "skipped",
        reason:
          "The Task completed without a verified governed Web Search evidence Artefact containing results.",
      });
      continue;
    }

    const targetRuntimeIds =
      listBusinessFunctionDefinitionsByEnterprise(
        enterprise.id
      )
        .filter(
          (definition) =>
            definition.id !==
              sourceDefinition.id &&
            Boolean(
              definition.runtimeId
            )
        )
        .map(
          (definition) =>
            definition.runtimeId!
        );
    const publication =
      await publishOrganisationalEventToRuntimes(
        {
          label:
            rule
              .publishedEventLabel,
          enterpriseName:
            enterprise.name,
          sourceBusinessFunction:
            sourceDefinition
              .label,
          payload: {
            trigger:
              rule.triggerType,
            triggerEventRuleId:
              rule.id,
            sourceJobId:
              job.id,
            sourceBusinessFunctionId:
              sourceDefinition.id,
            worker:
              job.worker ??
              job.selectedWorker ??
              "unassigned",
            completedAt:
              new Date(
                job.completedAt ??
                Date.now()
              ).toISOString(),
            requiredCapability:
              rule
                .requiredCapability ??
              "none",
            evidenceStatus:
              webSearchEvidence
                ? "captured-unverified-web-search-evidence"
                : "job-completion-only",
            evidenceArtefacts:
              webSearchEvidence
                ?.artefactReferences
                .join(
                  ","
                ) ??
              "",
            searchQuery:
              webSearchEvidence
                ?.query ??
              "",
            evidenceRetrievedAt:
              webSearchEvidence
                ?.retrievedAt ??
              "",
            searchResultCount:
              webSearchEvidence
                ?.resultCount ??
              0,
          },
        },
        reasoner,
        targetRuntimeIds
      );
    const eventId =
      publication.records[0]
        .id;

    savePersistedJobCompletionEventEmission({
      ruleId:
        rule.id,
      jobId:
        job.id,
      eventId,
    });
    evaluations.push({
      rule,
      status:
        "published",
      eventId,
      publication,
    });
  }

  return evaluations;
}
