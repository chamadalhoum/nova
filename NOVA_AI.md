# NOVA AI Architecture

## AI Principle

Do not put all intelligence into one giant prompt.

NOVA AI should be a pipeline of small, testable components with structured inputs and outputs.

## Pipeline

```text
User message
IntentClassifier
ContextManager
ConfidenceManager
QuestionManager
TaskPlanner
ToolSelector
SafetyGuard
ActionExecutor
Result
ResponseGenerator
```

## Components

### IntentClassifier

Classifies the user need into structured intent.

Examples:

- `service_request`
- `product_search`
- `event_planning`
- `travel_planning`
- `task_management`
- `document_help`
- `unknown`

### ContextManager

Retrieves only relevant context:

- User preferences
- Locale and timezone
- Recent task history
- Relevant controlled memories
- Household or asset context when applicable

### ConfidenceManager

Scores confidence for:

- Intent
- Extracted entities
- Missing information
- Recommended next action

Low confidence should trigger clarification, not hallucination.

### QuestionManager

Asks only necessary questions.

Example: For “Fix my AC tomorrow,” city/location may be necessary. Brand/model is useful but not mandatory.

### TaskPlanner

Creates a plan that can become a task.

Output should include:

- Title
- Description
- Category
- Intent
- Priority
- Due date if known
- Missing fields
- Suggested next steps

### ToolSelector

Chooses safe tools based on task type, context, permissions, and availability.

### SafetyGuard

Validates:

- Prompt injection risk
- Tool permission level
- User confirmation requirements
- Output schema
- Sensitive content handling
- Country/market constraints

### ActionExecutor

Executes only allowed actions through registered tools.

### MemoryManager

Stores durable memory only when useful and allowed.

Memory must be:

- Minimized
- Visible
- Editable
- Deletable
- Explainable

### ResponseGenerator

Produces the final user-facing response without exposing internal chain-of-thought.

## AI Provider Abstraction

Define a provider contract similar to:

```python
class AIProvider:
    async def generate(self, request): ...
    async def classify(self, request): ...
    async def embed(self, request): ...
```

Provider selection must come from configuration, not code changes.

Possible providers:

- OpenAI
- Anthropic
- Google
- Mistral
- Open-source providers

No API key should ever be committed.

## Structured Outputs

AI outputs used by the system must be validated with schemas before use.

Example intent output:

```json
{
  "intent": "service_request",
  "category": "air_conditioning",
  "language": "arabizi",
  "entities": {
    "date": "tomorrow",
    "time_period": "afternoon"
  },
  "missing_fields": ["location"],
  "confidence": 0.82
}
```

## Multilingual Requirements

Test cases must cover equivalent intents across:

- French
- English
- Arabic
- Tunisian dialect
- Arabizi

Initial intent dataset:

```text
Répare ma clim
N7eb wa7ed ysala7li clim
Need someone to fix my AC
نحب واحد يصلحلي الكليم
```

These should classify as the same intent family.

## Voice Architecture

MVP should create the interface, not necessarily a full production speech stack.

Pipeline:

```text
Voice input
Speech-to-text adapter
Intent pipeline
Task planner
```

## Image Architecture

MVP should accept image attachments and route them through a vision adapter when configured.

The system must distinguish:

- Identification
- Suggestion
- Estimate
- Professional diagnosis

Never present image interpretation as certainty.

## AI Testing

Tests should cover:

- Intent classification
- Missing information detection
- Tool selection
- Refusal and safety behavior
- Multilingual equivalence
- No invented provider data
- Confirmation requirements for medium/high-risk actions
