import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildPortablePrompts } from "../src/prompts/portablePrompts";

const directory = resolve(__dirname, "../../docs/Exported Prompts");
mkdirSync(directory, { recursive: true });
const prompts = buildPortablePrompts();
for (const [name, prompt] of Object.entries(prompts)) {
  writeFileSync(resolve(directory, `${name}.md`), `${prompt}\n`);
}
const links = Object.keys(prompts).sort().map(name => `- [${name}](<${name}.md>)`).join("\n");
writeFileSync(resolve(directory, "Prompt Guide.md"), `# Arturo Prompt Library

${Object.keys(prompts).length} reusable prompts, exported from the templates used by Arturo. Filenames use meaningful names with spaces. These files contain no live enterprise records or conversation history.

## Using a prompt outside Arturo

1. Choose a prompt. For ordinary work, start with a named Worker prompt such as Research Worker or Content Creation Worker.
2. Replace each {{UPPER_SNAKE_CASE}} placeholder using its definition in INPUTS. Supply required values. Use an empty string or the documented none marker for optional context; do not invent missing information. An unfilled required placeholder means the prompt is not ready to execute.
3. Paste the whole prompt into your chosen AI application. Keep its output schema if another program will read the response.
4. Supply any records or captured evidence explicitly. These prompts do not connect the AI to Arturo, grant tools, or execute actions. Capability labels describe the role; the host application must provide and authorize actual tools.

An Enterprise means the business or organisation. A Function means an ongoing responsibility. A Task means a bounded unit of work. The setup, staffing, runtime, and Office prompts use these concepts and require their documented context. The terminal setup prompt requires an Arturo-compatible command interface; it is not a general business assistant. Office commands require an adapter implementing the listed schemas and authorization checks; in a chat application they are proposals only.

Initial Workflow Review evaluates the first submission. Revised Workflow Review evaluates a later submission against the original criteria and required revisions. Correction prompts preserve their original contracts and accept a rejected response and actual validator error. Escape quotes, backslashes, and newlines when filling their JSON string values.

The one-time transformation review and improvement summary are documented in [Prompt Upgrade Notes](<../Prompt Upgrade Notes.md>). They are not appended to execution prompts.

## Prompts

${links}

## Regenerating the export

From the cli directory run: npm run prompts:export

Edit the source templates, then regenerate this directory. Editing an exported file alone does not change Arturo. The export is deterministic and does not call a model or read business databases.
`);
console.log(`Exported ${Object.keys(prompts).length} prompts to ${directory}`);
