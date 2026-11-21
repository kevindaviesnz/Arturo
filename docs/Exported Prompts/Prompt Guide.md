# Arturo Prompt Library

46 reusable prompts, exported from the templates used by Arturo. Filenames use meaningful names with spaces. These files contain no live enterprise records or conversation history.

## Using a prompt outside Arturo

1. Choose a prompt. For ordinary work, start with a named Worker prompt such as Research Worker or Content Creation Worker.
2. Replace each {{UPPER_SNAKE_CASE}} placeholder using its definition in INPUTS. Supply required values. Use an empty string or the documented none marker for optional context; do not invent missing information. An unfilled required placeholder means the prompt is not ready to execute.
3. Paste the whole prompt into your chosen AI application. Keep its output schema if another program will read the response.
4. Supply any records or captured evidence explicitly. These prompts do not connect the AI to Arturo, grant tools, or execute actions. Capability labels describe the role; the host application must provide and authorize actual tools.

An Enterprise means the business or organisation. A Function means an ongoing responsibility. A Task means a bounded unit of work. The setup, staffing, runtime, and Office prompts use these concepts and require their documented context. The terminal setup prompt requires an Arturo-compatible command interface; it is not a general business assistant. Office commands require an adapter implementing the listed schemas and authorization checks; in a chat application they are proposals only.

Initial Workflow Review evaluates the first submission. Revised Workflow Review evaluates a later submission against the original criteria and required revisions. Correction prompts preserve their original contracts and accept a rejected response and actual validator error. Escape quotes, backslashes, and newlines when filling their JSON string values.

The one-time transformation review and improvement summary are documented in [Prompt Upgrade Notes](<../Prompt Upgrade Notes.md>). They are not appended to execution prompts.

## Prompts

- [Analysis Worker](<Analysis Worker.md>)
- [Bounded Task Suggestions](<Bounded Task Suggestions.md>)
- [Business Discovery Conversation Interview](<Business Discovery Conversation Interview.md>)
- [Business Discovery Conversation Reply](<Business Discovery Conversation Reply.md>)
- [Business Function Explanations](<Business Function Explanations.md>)
- [Business Function Recommendation Repair](<Business Function Recommendation Repair.md>)
- [Business Function Recommendations](<Business Function Recommendations.md>)
- [Business Name Suggestion](<Business Name Suggestion.md>)
- [Business Signal Assessment](<Business Signal Assessment.md>)
- [Business Signal Assessment Correction](<Business Signal Assessment Correction.md>)
- [Coaching Worker](<Coaching Worker.md>)
- [Content Creation Worker](<Content Creation Worker.md>)
- [Decision Advice Worker](<Decision Advice Worker.md>)
- [Enterprise Mission Synthesis](<Enterprise Mission Synthesis.md>)
- [General Assistance Worker](<General Assistance Worker.md>)
- [Human Requested Revision](<Human Requested Revision.md>)
- [Information Conversion Worker](<Information Conversion Worker.md>)
- [Initial Workflow Review](<Initial Workflow Review.md>)
- [Monitoring Worker](<Monitoring Worker.md>)
- [Negotiation Worker](<Negotiation Worker.md>)
- [Objective Classification](<Objective Classification.md>)
- [Objective Classification Correction](<Objective Classification Correction.md>)
- [Office Tool Request](<Office Tool Request.md>)
- [Office Tool Request Correction](<Office Tool Request Correction.md>)
- [Operational Readiness Worker](<Operational Readiness Worker.md>)
- [Optimization Worker](<Optimization Worker.md>)
- [Planning Worker](<Planning Worker.md>)
- [Quality Review Worker](<Quality Review Worker.md>)
- [Read Only Worker Chat](<Read Only Worker Chat.md>)
- [Research Worker](<Research Worker.md>)
- [Review Rejection Revision](<Review Rejection Revision.md>)
- [Revised Workflow Review](<Revised Workflow Review.md>)
- [Risk and Safeguards Worker](<Risk and Safeguards Worker.md>)
- [Scenario Simulation Worker](<Scenario Simulation Worker.md>)
- [Sensitive Work Classification](<Sensitive Work Classification.md>)
- [Task Outcome Assessment](<Task Outcome Assessment.md>)
- [Task Outcome Assessment Correction](<Task Outcome Assessment Correction.md>)
- [Terminal Setup Next Action](<Terminal Setup Next Action.md>)
- [Worker Archetype Selection](<Worker Archetype Selection.md>)
- [Worker Staffing Plan](<Worker Staffing Plan.md>)
- [Worker Staffing Plan Correction](<Worker Staffing Plan Correction.md>)
- [Worker Task Execution](<Worker Task Execution.md>)
- [Workflow Coordination Worker](<Workflow Coordination Worker.md>)
- [Workflow Plan Repair](<Workflow Plan Repair.md>)
- [Workflow Planning](<Workflow Planning.md>)
- [Workflow Step Execution](<Workflow Step Execution.md>)

## Regenerating the export

From the cli directory run: npm run prompts:export

Edit the source templates, then regenerate this directory. Editing an exported file alone does not change Arturo. The export is deterministic and does not call a model or read business databases.
