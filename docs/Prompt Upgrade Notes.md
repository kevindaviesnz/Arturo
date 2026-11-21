# Prompt Upgrade Notes

Arturo’s built-in model prompts now use the supplied eight-section design standard. This was a development-time conversion: the application fills reviewed templates directly and makes no additional transformation model call. Existing stored task text, procedures, and records were not rewritten; their content is supplied to the updated execution templates when used.

## Improvement summary

- Centralized 23 base templates covering worker execution, classification, workflow planning and repair, business discovery, mission synthesis, recommendations, staffing, read-only chat, runtime decisions, revisions, terminal setup, and Office requests.
- Defined inputs, required and optional values, task scope, ordered execution, output contracts, and task-specific acceptance checks. Removed unsupported “expert” labels from worker roles.
- Added evidence, uncertainty, conflict, unavailable-tool, and authorization rules while preserving the existing worker and Office restrictions. Compact conversation, classification, and terminal prompts use safeguards relevant to their narrower tasks.
- Preserved JSON schemas, YES/NO routing, terminal single-line replies, and READY and NAME markers. These remain execution responses; the transformation prompt’s Component A and Component B wrapper is not sent to downstream models.
- Kept corrections within the original task structure and output contract, encoded rejected responses as untrusted repair data, and supplied the original user request to workflow-plan repair. Documented schema-compatible failure behavior instead of adding incompatible status fields.
- Exported 46 portable prompts: 23 base templates, 16 worker roles, two workflow review variants, and five correction variants. The export uses the same source templates, includes Office command schemas, and contains placeholders rather than live business data.

## Source and maintenance

- `cli/src/prompts/enterprisePromptTemplates.ts`: task-specific template content.
- `cli/src/prompts/enterprisePrompt.ts`: section formatting, shared safeguards, one-pass substitution, and correction composition.
- `cli/src/agents/archetypeRegistry.ts`: existing worker roles and capability restrictions.
- `cli/src/prompts/officePromptContext.ts`: existing Office command contract shared by execution and export.
- `cli/src/prompts/portablePrompts.ts`: export variants and expansion of shared rules.
- `cli/scripts/exportPrompts.ts`: writes the named Markdown files and guide. Run `npm run prompts:export` from `cli` after changing a template.

## Validation and limits

Verification completed: TypeScript build passed; all 2,600 tests across 345 test files passed; `git diff --check` passed.

Automated checks cover template sections and placeholder definitions, single-pass substitution, repair-data boundaries, output schemas, worker evidence and role context, Office access restrictions, review decisions, and exact agreement between source templates and exported files. Existing application tests also check the surrounding workflows.

No live model comparison or accuracy benchmark was performed. The changes establish consistent instructions and test code integration; they do not prove a numerical quality improvement or guarantee model compliance. Existing validators, approval gates, and tool authorization remain necessary. Some expanded prompts use more input tokens, even though no additional model call was added.

Start with the [Prompt Guide](<Exported Prompts/Prompt Guide.md>).
