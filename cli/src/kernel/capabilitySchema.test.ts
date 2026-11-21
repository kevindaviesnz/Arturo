import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createCapabilityInputValidationError,
  createCapabilitySchema,
  createObjectCapabilitySchema,
  getRuntimeSchemaType,
  isRecordValue,
  validateCapabilitySchemaValue,
  validateRequiredObjectFields,
} from "./capabilitySchema";

describe(
  "capability schema",
  () => {
    it(
      "creates capability schema",
      () => {
        expect(
          createCapabilitySchema(
            "string"
          )
        ).toEqual({
          type: "string",
        });
      }
    );

    it(
      "creates object capability schema with required fields",
      () => {
        expect(
          createObjectCapabilitySchema({
            to:
              createCapabilitySchema(
                "string"
              ),
            subject:
              createCapabilitySchema(
                "string"
              ),
          })
        ).toEqual({
          type: "object",
          required: {
            to: {
              type: "string",
            },
            subject: {
              type: "string",
            },
          },
        });
      }
    );

    it(
      "detects runtime schema types",
      () => {
        expect(
          getRuntimeSchemaType(
            "hello"
          )
        ).toBe("string");

        expect(
          getRuntimeSchemaType(
            42
          )
        ).toBe("number");

        expect(
          getRuntimeSchemaType(
            true
          )
        ).toBe("boolean");

        expect(
          getRuntimeSchemaType(
            {
              value: true,
            }
          )
        ).toBe("object");

        expect(
          getRuntimeSchemaType([
            "a",
          ])
        ).toBe("array");
      }
    );

    it(
      "detects record values",
      () => {
        expect(
          isRecordValue({
            value: true,
          })
        ).toBe(true);

        expect(
          isRecordValue(null)
        ).toBe(false);

        expect(
          isRecordValue([
            "a",
          ])
        ).toBe(false);

        expect(
          isRecordValue("hello")
        ).toBe(false);
      }
    );

    it(
      "validates primitive values against schemas",
      () => {
        expect(
          validateCapabilitySchemaValue(
            createCapabilitySchema(
              "string"
            ),
            "hello"
          )
        ).toBe(true);

        expect(
          validateCapabilitySchemaValue(
            createCapabilitySchema(
              "string"
            ),
            123
          )
        ).toBe(false);

        expect(
          validateCapabilitySchemaValue(
            createCapabilitySchema(
              "any"
            ),
            {
              anything: true,
            }
          )
        ).toBe(true);
      }
    );

    it(
      "validates required object fields",
      () => {
        const required = {
          to:
            createCapabilitySchema(
              "string"
            ),
          subject:
            createCapabilitySchema(
              "string"
            ),
        };

        expect(
          validateRequiredObjectFields(
            required,
            {
              to:
                "person@example.com",
              subject:
                "Hello",
            }
          )
        ).toBe(true);

        expect(
          validateRequiredObjectFields(
            required,
            {
              to:
                "person@example.com",
            }
          )
        ).toBe(false);

        expect(
          validateRequiredObjectFields(
            required,
            {
              to:
                "person@example.com",
              subject: 42,
            }
          )
        ).toBe(false);
      }
    );

    it(
      "validates object schemas with required fields",
      () => {
        const emailSchema =
          createObjectCapabilitySchema({
            to:
              createCapabilitySchema(
                "string"
              ),
            subject:
              createCapabilitySchema(
                "string"
              ),
            body:
              createCapabilitySchema(
                "string"
              ),
          });

        expect(
          validateCapabilitySchemaValue(
            emailSchema,
            {
              to:
                "person@example.com",
              subject:
                "Hello",
              body:
                "Message",
            }
          )
        ).toBe(true);

        expect(
          validateCapabilitySchemaValue(
            emailSchema,
            {
              to:
                "person@example.com",
              subject:
                "Hello",
            }
          )
        ).toBe(false);

        expect(
          validateCapabilitySchemaValue(
            emailSchema,
            [
              "not",
              "object",
            ]
          )
        ).toBe(false);
      }
    );

    it(
      "creates validation error messages",
      () => {
        expect(
          createCapabilityInputValidationError(
            "research",
            "string",
            "object"
          )
        ).toBe(
          "Invalid input for capability research: expected string, received object"
        );
      }
    );
  }
);