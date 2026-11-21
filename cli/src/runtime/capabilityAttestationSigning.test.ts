import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  CapabilityAttestation,
} from "./capabilityAttestation";

import {
  createCanonicalJson,
  signCapabilityAttestation,
} from "./capabilityAttestationSigning";

describe(
  "capabilityAttestationSigning",
  () => {
    it(
      "creates the same canonical JSON for nested objects with different insertion order",
      () => {
        const first = {
          worker: "AI-Researcher",
          capability: {
            evidence: {
              b: "second",
              a: "first",
            },
            name: "research",
          },
        };

        const second = {
          capability: {
            name: "research",
            evidence: {
              a: "first",
              b: "second",
            },
          },
          worker: "AI-Researcher",
        };

        expect(
          createCanonicalJson(
            first
          )
        ).toBe(
          createCanonicalJson(
            second
          )
        );
      }
    );

    it(
      "creates the same signature for semantically identical nested attestations",
      () => {
        const secret = "test-secret";

        const first = {
          workerId: "worker-1",
          capability: "research",
          claims: {
            evidence: {
              b: "second",
              a: "first",
            },
          },
        } as unknown as CapabilityAttestation;

        const second = {
          claims: {
            evidence: {
              a: "first",
              b: "second",
            },
          },
          capability: "research",
          workerId: "worker-1",
        } as unknown as CapabilityAttestation;

        expect(
          signCapabilityAttestation(
            first,
            secret
          )
        ).toBe(
          signCapabilityAttestation(
            second,
            secret
          )
        );
      }
    );
  }
);