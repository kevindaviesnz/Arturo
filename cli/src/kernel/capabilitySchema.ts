export type CapabilitySchemaType =
  | "any"
  | "string"
  | "number"
  | "boolean"
  | "object"
  | "array";

export type CapabilitySchema = {
  type: CapabilitySchemaType;
  required?: Record<
    string,
    CapabilitySchema
  >;
};

/**
 * Creates a capability schema.
 *
 * @param type Primitive capability schema type.
 * @returns Capability schema.
 *
 * PURE: No side effects.
 */
export function createCapabilitySchema(
  type: CapabilitySchemaType
): CapabilitySchema {
  return {
    type,
  };
}

/**
 * Creates an object capability schema with required fields.
 *
 * @param required Required field schemas.
 * @returns Object capability schema.
 *
 * PURE: No side effects.
 */
export function createObjectCapabilitySchema(
  required: Record<
    string,
    CapabilitySchema
  >
): CapabilitySchema {
  return {
    type: "object",
    required: {
      ...required,
    },
  };
}

/**
 * Gets the runtime schema type for a value.
 *
 * @param value Value to inspect.
 * @returns Runtime schema type.
 *
 * PURE: No side effects.
 */
export function getRuntimeSchemaType(
  value: any
): CapabilitySchemaType {
  if (Array.isArray(value)) {
    return "array";
  }

  if (value === null) {
    return "object";
  }

  const valueType =
    typeof value;

  if (
    valueType === "string" ||
    valueType === "number" ||
    valueType === "boolean"
  ) {
    return valueType;
  }

  if (valueType === "object") {
    return "object";
  }

  return "any";
}

/**
 * Checks whether a value is a non-null plain object.
 *
 * @param value Value to inspect.
 * @returns True if value is an object and not an array/null.
 *
 * PURE: No side effects.
 */
export function isRecordValue(
  value: any
): value is Record<string, any> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

/**
 * Validates required object fields against their schemas.
 *
 * @param required Required field schemas.
 * @param value Object value to validate.
 * @returns True when all required fields are present and valid.
 *
 * PURE: No side effects.
 */
export function validateRequiredObjectFields(
  required: Record<
    string,
    CapabilitySchema
  >,
  value: Record<string, any>
): boolean {
  return Object.entries(
    required
  ).every(
    ([
      key,
      fieldSchema,
    ]) =>
      Object.prototype.hasOwnProperty.call(
        value,
        key
      ) &&
      validateCapabilitySchemaValue(
        fieldSchema,
        value[key]
      )
  );
}

/**
 * Validates a value against a capability schema.
 *
 * @param schema Capability schema.
 * @param value Value to validate.
 * @returns True when value matches schema.
 *
 * PURE: No side effects.
 */
export function validateCapabilitySchemaValue(
  schema: CapabilitySchema,
  value: any
): boolean {
  if (schema.type === "any") {
    return true;
  }

  if (
    getRuntimeSchemaType(
      value
    ) !== schema.type
  ) {
    return false;
  }

  if (
    schema.type === "object" &&
    schema.required
  ) {
    if (
      !isRecordValue(
        value
      )
    ) {
      return false;
    }

    return validateRequiredObjectFields(
      schema.required,
      value
    );
  }

  return true;
}

/**
 * Creates a validation error message for a capability input.
 *
 * @param capability Capability id.
 * @param expected Expected schema type.
 * @param actual Actual schema type.
 * @returns Validation error message.
 *
 * PURE: No side effects.
 */
export function createCapabilityInputValidationError(
  capability: string,
  expected: CapabilitySchemaType,
  actual: CapabilitySchemaType
): string {
  return `Invalid input for capability ${capability}: expected ${expected}, received ${actual}`;
}

/**
 * Creates a validation error message for a capability output.
 *
 * @param capability Capability id.
 * @param expected Expected schema type.
 * @param actual Actual schema type.
 * @returns Validation error message.
 *
 * PURE: No side effects.
 */
export function createCapabilityOutputValidationError(
  capability: string,
  expected: CapabilitySchemaType,
  actual: CapabilitySchemaType
): string {
  return `Invalid output for capability ${capability}: expected ${expected}, received ${actual}`;
}