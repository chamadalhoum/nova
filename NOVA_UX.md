# NOVA UX

## UX North Star

NOVA should feel like a calm execution assistant, not a chatbot full of buttons.

The user experience should answer one question immediately:

> What do you need to get done?

## First Screen

Mobile home concept:

```text
NOVA

What can I help you get done?

[ Write what you need... ]

Microphone    Camera

Suggestions:
Repair something
Organize something
Buy something
Book something
Plan something
```

Suggestions are secondary. The primary action is natural input.

## Core Flow

```text
User prompt
Understanding state
Intent summary
Missing question if needed
Task draft
User confirmation if needed
Task created
Next action or tracking
Completion
```

Example:

```text
User: N7eb wa7ed ysala7li l clim ghodwa.

NOVA: I understand you need air conditioning repair tomorrow.
Missing: What city or area should I search in?

User: Ariana.

NOVA: I created a repair task and can look for available AC technicians in Ariana.
```

## Task UX

Task cards should show:

- Title
- Status
- Next step
- Due date if known
- Last update
- Primary action

Status language must be human:

- Draft: “NOVA is preparing this task.”
- Needs info: “NOVA needs one detail from you.”
- Planned: “NOVA has a plan.”
- Searching: “NOVA is looking for options.”
- Waiting confirmation: “Review and confirm before NOVA continues.”
- Booked: “Confirmed.”
- Completed: “Done.”

## Confirmation UX

Medium-risk and high-risk actions require confirmation.

Example:

```text
I found 3 available technicians.

Recommended option:
Mohamed
Rating: 4.8 from verified jobs
Available: tomorrow at 15:00
Travel fee: 10 DT
Estimate: 40-70 DT

Why this recommendation:
Specialized in air conditioning
Available at your requested time
Close to your area

[Book] [See others] [Modify]
```

If data is estimated or demo-only, the UI must say so clearly.

## Navigation

Mobile tabs:

- Home
- Tasks
- Discover
- Passport
- Profile

Web navigation:

- Home
- Tasks
- Discover
- Passport
- Notifications
- Profile

## Empty States

Tasks:

```text
No tasks yet.
Tell NOVA what you want to get done.
[Start a task]
```

Passport:

```text
No assets yet.
Add appliances, vehicles, or documents so NOVA can help faster next time.
[Add asset]
```

Notifications:

```text
No reminders.
NOVA will only notify you when it is useful.
```

## Error States

Do not show raw API errors.

Bad:

```text
HTTP 422 validation error
```

Good:

```text
I could not understand what you want to book. Can you describe the service you need?
```

## Loading States

Use clear work states:

- Understanding your request
- Checking what information is missing
- Preparing your task
- Looking for options
- Comparing results
- Waiting for your confirmation

## Accessibility

Requirements:

- Keyboard navigation on web
- Screen reader labels
- Sufficient contrast
- 44px minimum touch targets on mobile
- Dynamic font sizing
- RTL support
- Reduced motion support
- No horizontal overflow at 320px+

## Localization

No hardcoded UI text in components.

Initial supported locales:

- English
- French
- Arabic

The UX must support LTR and RTL layouts.
