/**
 * A thin wrapper around @simplewebauthn/server. userVerification is
 * required (off-terminal sign-off brief). Tests may replace the verify
 * steps; production always uses the library.
 *
 * SIDE EFFECT: The real verify functions check authenticator responses.
 */

import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";

export type PasskeyPublic = {
  readonly credentialId: string;
  readonly publicKey: Uint8Array;
  readonly counter: number;
  readonly deviceDescription: string;
  readonly transports?: string[];
};

export type RegistrationVerifier = (input: {
  readonly response: RegistrationResponseJSON;
  readonly expectedChallenge: string;
  readonly expectedOrigin: string;
  readonly expectedRPID: string;
}) => Promise<{ readonly verified: boolean; readonly credential?: PasskeyPublic }>;

export type AuthenticationVerifier = (input: {
  readonly response: AuthenticationResponseJSON;
  readonly expectedChallenge: string;
  readonly expectedOrigin: string;
  readonly expectedRPID: string;
  readonly credential: PasskeyPublic;
}) => Promise<{ readonly verified: boolean; readonly newCounter?: number }>;

let registrationVerifier: RegistrationVerifier | undefined;
let authenticationVerifier: AuthenticationVerifier | undefined;

/** Test-only: replaces library verification. Never call from production code. */
export function setWebAuthnVerifiersForTests(input: {
  readonly registration?: RegistrationVerifier;
  readonly authentication?: AuthenticationVerifier;
} | undefined): void {
  registrationVerifier = input?.registration;
  authenticationVerifier = input?.authentication;
}

export async function beginRegistration(input: {
  readonly rpName: string;
  readonly rpID: string;
  readonly userName: string;
  readonly userDisplayName: string;
  readonly excludeCredentialIds?: readonly string[];
}): Promise<PublicKeyCredentialCreationOptionsJSON> {
  return generateRegistrationOptions({
    rpName: input.rpName,
    rpID: input.rpID,
    userName: input.userName,
    userDisplayName: input.userDisplayName,
    attestationType: "none",
    authenticatorSelection: {
      userVerification: "required",
      residentKey: "preferred",
    },
    excludeCredentials: (input.excludeCredentialIds ?? []).map((id) => ({ id })),
  });
}

export async function completeRegistration(input: {
  readonly response: RegistrationResponseJSON;
  readonly expectedChallenge: string;
  readonly expectedOrigin: string;
  readonly expectedRPID: string;
}): Promise<{ readonly verified: boolean; readonly credential?: PasskeyPublic }> {
  if (registrationVerifier) {
    return registrationVerifier(input);
  }
  const result = await verifyRegistrationResponse({
    response: input.response,
    expectedChallenge: input.expectedChallenge,
    expectedOrigin: input.expectedOrigin,
    expectedRPID: input.expectedRPID,
    requireUserVerification: true,
  });
  if (!result.verified || !result.registrationInfo) {
    return { verified: false };
  }
  const info = result.registrationInfo;
  const meta = info.passkeyProviderMetadata;
  return {
    verified: true,
    credential: {
      credentialId: info.credential.id,
      publicKey: info.credential.publicKey,
      counter: info.credential.counter,
      deviceDescription: (meta?.friendlyNames && Object.values(meta.friendlyNames)[0]) || "Their device",
      ...(info.credential.transports ? { transports: info.credential.transports } : {}),
    },
  };
}

export async function beginAuthentication(input: {
  readonly rpID: string;
  readonly allowCredentialIds?: readonly string[];
}): Promise<PublicKeyCredentialRequestOptionsJSON> {
  return generateAuthenticationOptions({
    rpID: input.rpID,
    userVerification: "required",
    allowCredentials: (input.allowCredentialIds ?? []).map((id) => ({ id })),
  });
}

export async function completeAuthentication(input: {
  readonly response: AuthenticationResponseJSON;
  readonly expectedChallenge: string;
  readonly expectedOrigin: string;
  readonly expectedRPID: string;
  readonly credential: PasskeyPublic;
}): Promise<{ readonly verified: boolean; readonly newCounter?: number; readonly assertion?: AuthenticationResponseJSON }> {
  if (authenticationVerifier) {
    const result = await authenticationVerifier(input);
    return { ...result, assertion: input.response };
  }
  const result = await verifyAuthenticationResponse({
    response: input.response,
    expectedChallenge: input.expectedChallenge,
    expectedOrigin: input.expectedOrigin,
    expectedRPID: input.expectedRPID,
    credential: {
      id: input.credential.credentialId,
      publicKey: new Uint8Array(input.credential.publicKey),
      counter: input.credential.counter,
    },
    requireUserVerification: true,
  });
  if (!result.verified) {
    return { verified: false };
  }
  return {
    verified: true,
    newCounter: result.authenticationInfo.newCounter,
    assertion: input.response,
  };
}
