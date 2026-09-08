# Project Overview and Instructions before completing the code - Textbook PWA

## Project Overview

A portable checklist/todo PWA (Progressive Web App) built with React 19, TypeScript, and SCSS. Features nested categories, multiple lists with tab navigation, IndexedDB local storage, and Google Drive sync.

## Tech Stack

- **Framework**: React 19.2.8 (functional components, hooks)
- **Language**: TypeScript 6.0
- **Styling**: SCSS (no CSS-in-JS, no Tailwind)
- **Build Tool**: Vite 8.2.2
- **Storage**: IndexedDB (local) + Google Drive API (sync)
- **PWA**: vite-plugin-pwa with service worker (no backend project)

# Coding standards, conventions and rules to check before **generating** the code

> **Purpose**
>
> This document defines the general coding, architecture, TypeScript, JavaScript, React, styling, Git, documentation, refactoring, security, performance, and code-review standards that an AI coding agent must follow.
>
> It is intended to be usable in this project.
>
> These rules apply when:
>
> - generating new code
> - modifying existing code
> - fixing bugs
> - refactoring
> - creating hooks
> - creating stores
> - creating API integrations
> - modifying configuration
> - preparing commits
> - reviewing code before a commit or PR
>
> The AI must not consider code complete merely because it compiles or passes linting.
>
> It must also verify correctness, architecture, type safety, maintainability, behavior, performance, accessibility, security, and consistency.

---

# 1. Rule Priority

When multiple implementations are possible, optimize in this order:

1. Correctness
2. Security
3. Type safety
4. Existing architecture consistency
5. Readability
6. Maintainability
7. Simplicity
8. Reusability
9. Testability
10. Accessibility
11. Performance
12. Developer experience

Never sacrifice correctness or readability for fewer lines of code.

Never introduce complexity solely for theoretical architectural purity.

Prefer code that another developer can understand six months later.

---

# 2. AI Agent Operating Rules

Before generating or modifying code, the AI must first understand the surrounding codebase.

The AI must:

- inspect related files before introducing a new pattern
- search for existing implementations solving the same problem
- reuse existing helpers when appropriate
- reuse existing constants when appropriate
- reuse existing types when appropriate
- reuse existing components when appropriate
- reuse existing stores/hooks when appropriate
- reuse existing API/error-handling patterns
- inspect naming conventions
- inspect directory conventions
- inspect linting/formatting rules
- inspect existing architectural boundaries

Do not assume a pattern simply because it is common in another project.

Existing project conventions take precedence unless they are clearly incorrect or dangerous.

---

# 3. Minimal Change Policy

When modifying existing code:

- make the smallest change necessary to solve the requested problem
- do not refactor unrelated files
- do not rename unrelated variables
- do not reformat unrelated code
- do not reorganize directories without necessity
- do not change public APIs without necessity
- do not introduce new abstractions unless they solve a real problem
- preserve existing behavior unless a behavior change is explicitly required

A bug fix should not secretly become an architecture rewrite.

---

# 4. Correctness

Before considering code complete, verify:

- expected success behavior
- failure behavior
- empty states
- null values
- undefined values
- empty strings
- empty arrays
- malformed API responses
- unexpected API responses
- missing optional fields
- asynchronous failures
- loading states
- retry behavior if relevant
- invalid route parameters
- invalid form values
- permission failures
- stale state
- duplicate actions
- race conditions
- cleanup behavior

Check for:

- inverted conditions
- incorrect boolean logic
- incorrect return values
- unreachable code
- missing returns
- forgotten awaits
- accidental fall-through
- stale values
- mutations
- incorrect default values

Do not rely only on the happy path.

---

# 5. Function Style

Prefer arrow functions assigned to `const`.

Use:

```ts
const getUser = () => {};
```

Avoid:

```ts
function getUser() {}
```

Application code should generally avoid `this`.

Do not introduce class-based application logic unless required by an existing framework/library architecture.

Avoid unnecessary:

```ts
public;
private;
protected;
```

Prefer functional composition.

---

# 6. Early Return Policy

Prefer guard clauses and early returns.

Good:

```ts
const processItems = (items: Item[]) => {
  if (!items.length) return [];

  return items.map(mapItem);
};
```

Avoid unnecessary nesting:

```ts
const processItems = (items: Item[]) => {
  if (items.length) {
    return items.map(mapItem);
  }

  return [];
};
```

Avoid deeply nested logic.

Prefer:

```ts
if (!user) return;
if (!user.isActive) return;
if (!user.hasPermission) return;
```

over multiple nested `if` blocks.

After a return, avoid unnecessary `else`.

---

# 7. Control Flow

Keep control flow easy to scan.

Avoid:

- deeply nested conditions
- long switch statements when a typed lookup is clearer
- boolean parameters whose meaning is unclear
- multiple state flags describing the same state
- complicated ternaries
- chained ternaries
- side effects inside array transformations

For complex conditions, extract a meaningful boolean.

Prefer:

```ts
const canSubmit = hasPermission && isValid && !isLoading;

if (!canSubmit) return;
```

rather than repeating the full condition.

---

# 8. TypeScript – Strict Type Safety

TypeScript should help prove correctness, not simply silence errors.

## Never use `any` by default

Avoid:

```ts
const data: any = response;
```

Prefer:

```ts
const data: unknown = response;
```

Then:

```text
unknown
→ validate
→ normalize
→ map
→ strongly typed result
```

Avoid `any` in:

- production code
- mocks
- adapters
- mappers
- stores
- hooks
- utility functions

---

# 9. Type Assertions

Avoid using `as` simply to force TypeScript to accept incorrect code.

Bad:

```ts
const user = response as User;
```

if the API response has not been validated.

Type assertions are acceptable only when:

- TypeScript cannot infer something that is actually guaranteed
- the guarantee is understood
- the assertion is narrow
- no safer alternative exists

Do not use:

```ts
as unknown as SomeType
```

to bypass type errors unless absolutely unavoidable and documented.

---

# 10. Type Design

Prefer domain-specific types.

Avoid generic objects such as:

```ts
Record<string, any>;
```

Prefer:

```ts
interface User {
  id: string;
  name: string;
}
```

Use union types where values are restricted.

Prefer:

```ts
type Status = "pending" | "success" | "error";
```

instead of:

```ts
status: string;
```

when the values are known.

---

# 11. Type Reuse

Before creating a new interface or type:

- search for an existing equivalent
- check API/entity/domain types
- check component prop types
- check shared types

Avoid defining several slightly different versions of the same concept.

Shared types should live in an appropriate shared/domain/types location.

Keep component-specific types close to the component when they are not reusable.

---

# 12. Null and Undefined Safety

Never assume backend data is complete.

Consider:

```text
undefined
null
''
[]
{}
```

where relevant.

Use:

```ts
value ?? fallback;
```

when `null` and `undefined` require fallback.

Do not incorrectly use:

```ts
value || fallback;
```

when valid values may include:

```text
0
false
''
```

Use optional chaining when appropriate:

```ts
user?.address?.city;
```

---

# 13. Avoid Non-Null Assertions

Avoid:

```ts
user!.name;
```

unless the value is genuinely guaranteed.

Prefer explicit validation:

```ts
if (!user) return;

return user.name;
```

---

# 14. Immutable Data

Prefer immutable updates.

Avoid mutating:

- props
- store values unintentionally
- API response objects
- function arguments
- shared arrays
- cached objects

Remember that:

```ts
array.sort();
```

mutates the original array.

Prefer:

```ts
array.toSorted(...)
```

where supported, or:

```ts
[...array].sort(...)
```

---

# 15. Naming

Names must describe intent.

Good:

```ts
isLoading;
hasPermission;
canSubmit;
selectedUser;
mappedItems;
requestParams;
cachedUserId;
```

Avoid:

```ts
flag;
obj;
data1;
temp;
item2;
valueX;
testVar;
```

---

# 16. Boolean Naming

Boolean variables should generally use:

```text
is
has
can
should
was
did
```

Examples:

```ts
isLoading;
hasAccess;
canDelete;
shouldRefresh;
```

Avoid:

```ts
loadingFlag;
accessStatus;
checkUser;
```

---

# 17. Collection Naming

Collections should normally use plural names:

```ts
users;
orders;
messages;
items;
```

Individual objects should use singular names:

```ts
user;
order;
message;
item;
```

---

# 18. Function Naming

Function names should clearly describe actions.

Examples:

```ts
fetchUsers;
createUser;
updateUser;
deleteUser;
mapUser;
normalizeUser;
validateEmail;
handleSubmit;
refreshUsers;
```

Avoid vague names such as:

```ts
doIt;
process;
handleData;
execute;
manage;
```

unless the surrounding context makes their purpose completely clear.

---

# 19. Magic Values

Avoid unexplained magic:

- numbers
- strings
- status names
- route paths
- timeouts
- storage keys
- API fragments
- feature flags

Bad:

```ts
setTimeout(callback, 5000);
```

Prefer:

```ts
setTimeout(callback, REQUEST_TIMEOUT_MS);
```

Do not create constants for trivial one-use values when doing so reduces readability.

---

# 20. DRY – Duplication

Actively detect duplication in:

- functions
- conditions
- constants
- transformations
- mocks
- configuration
- types
- API paths
- labels
- CSS
- validation
- error handling

Before extracting duplicated code, confirm that the pieces represent the **same responsibility**.

Similar-looking code does not always mean shared responsibility.

---

# 21. Scope-Safe Deduplication

Never merge code/configuration solely because a value is duplicated.

Before consolidation, verify:

1. same purpose
2. same scope
3. same dependencies
4. same inherited configuration
5. same side effects
6. same lifecycle
7. same future change reason

Example:

Two ESLint overrides may both contain:

```ts
'no-console': 'off'
```

but must remain separate if one also inherits test-specific rules.

The AI must detect both:

- unnecessary duplication
- intentionally separate configuration

Do not trade correctness for DRY.

---

# 22. KISS – Keep It Simple

Avoid:

- unnecessary design patterns
- generic abstractions with one caller
- premature factories
- premature dependency injection
- wrappers around trivial native APIs
- unnecessary hooks
- unnecessary stores
- unnecessary libraries

Before adding abstraction, ask:

> What concrete problem does this abstraction solve?

If the answer is unclear, do not introduce it.

---

# 23. YAGNI

Do not implement functionality because it "might be useful later."

Build what is required now while leaving the design maintainable enough for future extension.

Avoid speculative:

- configuration
- generic types
- plugins
- extensibility layers
- unused props
- unused parameters
- unused callbacks
- feature toggles

---

# 24. Single Responsibility

One function should have one primary purpose.

One component should have one primary UI responsibility.

One mapper should map one related concept.

One adapter should normalize one API/domain boundary.

One store should own a coherent state domain.

Split code when multiple independent responsibilities become mixed.

Do not split code merely to reduce line count.

---

# 25. Function Size

Prefer small, readable functions.

As a guideline, investigate functions larger than roughly 30–50 lines.

Large functions are acceptable when splitting would make control flow harder to understand.

Readability is more important than arbitrary size limits.

---

# 26. Hexagonal Architecture

When a project uses Hexagonal/Clean-style frontend architecture, maintain clear boundaries.

Typical flow:

```text
UI
↓
Component / View
↓
Hook / Store
↓
Application logic
↓
Ports / Adapters
↓
HTTP / Browser / External infrastructure
```

A practical frontend variation may use:

```text
API
↓
Adapter
↓
Mapper
↓
Store / Hook
↓
Component
↓
View
```

The exact folder names may vary.

Responsibilities must remain separated.

---

# 27. API Layer Responsibility (apiService.ts)

API/services should contain infrastructure concerns such as:

- HTTP method
- URL
- query parameters
- headers
- request invocation
- API client
- interceptor integration

API code should not normally contain:

- UI labels
- formatting
- component logic
- DOM behavior
- toast behavior

Keep raw network behavior isolated.

---

# 28. Adapter Responsibility

Use an adapter when external/backend data requires normalization.

Adapters may:

- normalize inconsistent structures
- rename external properties
- remove unwanted fields
- sanitize invalid values
- normalize optional/null values
- convert external representation into an internal model
- protect the application from backend inconsistencies

Adapters should not contain:

- UI labels
- icons
- presentation formatting
- JSX/templates
- router behavior

Do not create an adapter when the external API already returns a clean internal-compatible model and the adapter would add no value.

---

# 29. Mapper Responsibility

Mappers prepare data for another clearly defined representation.

UI mappers may:

- format dates
- format display values
- attach labels
- attach icons
- group fields
- sort display collections
- derive UI state
- generate UI-ready objects

Mappers should normally be pure.

A mapper should not:

- call an API
- navigate
- update a store
- display a toast
- mutate input
- access global application state

---

# 30. Store Responsibility

A store may own:

- application state
- shared state
- orchestration
- loading state
- error state
- persistence
- caching
- business actions

A store should not become a dumping ground.

Avoid UI HTML/JSX/template generation inside stores.

Avoid copying state into both store and component unless local draft state is intentionally required.

---

# 31. Hooks

Hooks should represent reusable stateful behavior.

Examples:

```text
useUsers
useAuthentication
usePagination
useModal
useSearch
```

A hook should have a clear responsibility.

Prefer exposing meaningful values:

```text
data
isLoading
error
actions
derived state
```

Avoid hooks containing unrelated features simply because they are used by the same page.

---

# 32. Component Responsibility

Components should primarily manage:

- rendering
- props
- events
- UI interaction
- local UI state
- composition of child components

Avoid:

- backend normalization
- large business transformations
- duplicated API error parsing
- complicated sorting/filtering logic directly in templates/JSX
- infrastructure logic

Components should preferably receive data in a shape close to what they need to render.

---

# 33. Views / Pages

Views/pages coordinate page-level behavior.

They may compose:

- templates
- organisms/features
- routing state
- page-level hooks
- stores

Avoid putting every implementation detail directly into the page component.

---

# 34. Atomic Design

When using Atomic Design:

```text
Atoms
Molecules
Organisms
Templates
Pages / Views
```

## Atom

Small reusable primitive.

Examples:

```text
Button
Badge
Icon
Input
Divider
```

Atoms should not contain domain-specific orchestration.

## Molecule

Small combination of atoms representing a focused UI concept.

Examples:

```text
SearchField
LabelValueRow
FormField
```

## Organism

A meaningful section or feature.

Examples:

```text
UserHeader
SearchResults
ActivityPanel
```

## Template

Defines page layout/composition.

## View/Page

Connects routing/data/page behavior.

Do not create unnecessary Atomic Design levels simply to satisfy terminology.

Choose the level according to responsibility, not component size.

---

# 35. Component Reusability

Before creating a new component, check whether:

- an existing component can be reused
- an existing component can reasonably accept a prop
- the new UI represents a genuinely different responsibility

Do not make a generic component accept dozens of unrelated props just to avoid creating another component.

Reusability must not destroy clarity.

---

# 36. JavaScript Array Methods

Prefer expressive array methods when they improve readability:

```ts
map;
filter;
find;
findIndex;
some;
every;
flatMap;
reduce;
```

Use loops when loops are genuinely clearer.

Avoid forcing complicated logic into `reduce()` solely to appear functional.

---

# 37. Pure Functions

Prefer pure functions for:

- mapping
- formatting
- validation
- calculations
- transformations

A pure function:

- does not mutate inputs
- produces predictable output
- has no hidden external side effects

Pure functions are easier to test and maintain.

---

# 38. Side Effects

Side effects include:

- API calls
- localStorage writes
- navigation
- DOM manipulation
- analytics
- logging
- timers
- subscriptions

Keep side effects explicit.

Do not hide side effects inside innocent-looking mapper/helper functions.

---

# 39. Async Functions

When calling asynchronous code:

- handle success
- handle failure
- restore state
- avoid duplicate execution
- validate parameters first
- ensure return values are meaningful

Avoid:

```ts
someAsyncFunction();
```

when the Promise needs to be handled.

Use:

```ts
await someAsyncFunction();
```

or intentionally:

```ts
void someAsyncFunction();
```

when the caller explicitly does not need the Promise result and rejection behavior is already handled.

---

# 40. Loading State

Loading must begin before an asynchronous operation.

Example:

```ts
isLoading.value = true;
```

Loading must be cleared regardless of success or failure.

Prefer:

```ts
try {
  ...
} catch (error: unknown) {
  ...
} finally {
  isLoading.value = false
}
```

when cleanup must always occur.

Avoid code paths that return from `try` before cleanup executes unless `finally` guarantees cleanup.

---

# 41. Return Values From Async Actions

Be explicit about action result semantics.

If an action returns:

```ts
Promise<boolean>;
```

then:

```text
true = operation succeeded
false = operation failed / did not execute
```

must remain consistent.

Never accidentally set success state inside a catch block.

Prefer throwing errors when callers need detailed failure information.

Choose one convention and remain consistent.

---

# 42. Race Conditions

Consider concurrent requests when:

- search input changes quickly
- route changes during requests
- several refreshes can run
- pagination changes
- autocomplete runs
- components unmount

When needed, use:

- AbortController
- request IDs
- stale-response guards
- library cancellation mechanisms

Do not allow older responses to overwrite newer data.

---

# 43. API Validation

Validate required parameters before network calls.

Example:

```ts
if (!userId) return;
```

Validate API boundaries whenever backend data cannot be trusted.

For runtime validation, use the project's existing validation solution.

Do not introduce a validation library solely for one trivial check.

---

# 44. Error Handling

Error handling should be centralized where practical.

Avoid repeating:

```text
Axios parsing
status extraction
backend message extraction
fallback logic
```

throughout the application.

Prefer a centralized error normalizer such as:

```ts
normalizeHttpError(error);
```

The exact utility name should follow the project.

---

# 45. Error UX

Differentiate where useful:

```text
validation error
authentication failure
authorization failure
not found
rate limit
network failure
server failure
unknown failure
```

Do not expose internal stack traces or raw technical errors directly to end users.

User-facing messages should be understandable and actionable.

---

# 46. Empty vs Error State

Do not confuse:

```text
request succeeded but returned no data
```

with:

```text
request failed
```

These should usually produce different UI states.

---

# 47. Cache Design

Cache only when it solves a real problem.

Cache keys must use stable identifiers.

Avoid:

- array index cache keys
- labels
- display names
- unstable UI state

A cache should define:

- key
- lifetime
- invalidation
- refresh behavior
- ownership
- stale-data behavior

---

# 48. Refresh Pattern

When data supports explicit refresh:

```text
getData()
refreshData()
```

may share the underlying implementation.

For example:

```ts
getData({ refresh: true });
```

Refresh should bypass an otherwise valid cache when expected.

---

# 49. State Ownership

Every piece of state should have a clear owner.

Ask:

> Which component/store/hook should be authoritative for this value?

Avoid keeping synchronized copies without necessity.

Derived state should generally be derived rather than independently stored.

---

# 50. Derived State

Avoid storing values that can easily be derived.

Bad conceptually:

```text
firstName
lastName
fullName state
```

Prefer deriving:

```ts
const fullName = `${firstName} ${lastName}`;
```

Framework-specific derivation tools should be used appropriately.

---

# 51. React Rules

React code must follow modern functional React practices.

Use functional components.

Prefer:

```tsx
const UserCard = () => {
  ...
}
```

Avoid class components unless maintaining legacy code.

Do not use `this`.

---

# 52. React Hooks

Hooks must:

- follow the Rules of Hooks
- be called at the top level
- never be conditionally called
- have clear dependencies
- avoid unnecessary effects

Custom hooks should start with:

```text
use
```

Example:

```ts
useUser;
useSearch;
usePagination;
```

---

# 53. React useEffect

Do not use `useEffect` for values that can be derived during render.

Avoid effects merely to synchronize one state variable with another.

Use effects for genuine external synchronization/side effects such as:

- subscriptions
- network behavior tied to lifecycle
- browser APIs
- external libraries

Review effect dependencies carefully.

Never suppress dependency warnings without understanding why.

---

# 54. React Derived Values

Do not automatically use `useMemo`.

Use normal calculations when inexpensive.

Use `useMemo` only when:

- calculation is meaningfully expensive
- referential stability matters
- dependency semantics are correct

Memoization is an optimization, not a default coding style.

---

# 55. React Callbacks

Do not automatically wrap every callback in `useCallback`.

Use it when referential stability provides a real benefit.

Avoid premature memoization.

---

# 56. React State

Keep state as local as practical.

Move state upward/shared only when multiple consumers genuinely require the same source of truth.

Do not use global state for every value.

Choose between:

- component state
- context
- server-state library
- application store

according to responsibility.

---

# 57. React Context

Use Context for values naturally shared across a subtree.

Avoid large contexts that cause unrelated consumers to rerender.

Do not turn Context into an unstructured application-wide data dump.

---

# 58. React Props

Define proper prop types.

Do not use:

```ts
React.FC<any>;
```

Avoid overly generic prop interfaces.

Prefer explicit props.

Do not mutate props.

---

# 59. React JSX

Keep JSX readable.

Avoid:

- large inline calculations
- large nested ternaries
- inline transformations repeated every render
- complicated permission/business logic

Move complex values into:

- variables
- hooks
- mappers
- small components

as appropriate.

---

# 60. React Keys

Never use an array index as a React key when items have a stable unique identity.

Prefer:

```tsx
key={item.id}
```

Index keys are acceptable only for genuinely static lists where items cannot reorder, insert, or delete.

---

# 61. React Event Handlers

Prefer named handlers when they improve readability.

Example:

```ts
const handleDelete = () => {};
```

Avoid complex multi-line logic directly inside JSX.

---

# 62. React Data Fetching

Do not duplicate server data unnecessarily in global/local state.

If the project uses a server-state library such as TanStack Query, follow its caching/loading/error conventions instead of rebuilding them manually.

Do not introduce a new state/data library without justification.

---

# 75. Routing – General

Route URLs may be user-controlled.

Validate or safely handle route/query parameters.

Do not assume query parameters contain expected values.

Use named routes where supported.

Avoid duplicating route definitions throughout components.

---

# 76. Authentication

Authentication answers:

> Who is the user?

Authorization answers:

> What is the user allowed to do?

Do not confuse them.

---

# 77. Authorization

Frontend authorization improves UX but cannot replace backend authorization.

The UI may:

- hide unavailable actions
- disable unavailable actions
- prevent navigation

But the backend must still enforce permissions.

Do not assume a hidden button provides security.

---

# 78. Role/Permission Checks

Centralize permission checks where practical.

Prefer:

```ts
canEditUser;
hasWriteAccess;
```

instead of repeatedly checking raw role strings across components.

Avoid scattering:

```ts
roles.includes("SOME_ROLE");
```

everywhere.

---

# 79. Security – Frontend

Never expose:

- passwords
- API secrets
- private keys
- service credentials
- privileged tokens

in frontend source code.

Anything shipped to the browser must be considered public.

---

# 80. Environment Variables

Do not commit secrets into:

```text
.env
source files
examples
config
```

Only expose browser-safe environment variables to client bundles.

Review environment variable prefixes and bundler behavior.

---

# 81. XSS

Never inject untrusted HTML without sanitization.

React:

```tsx
dangerouslySetInnerHTML;
```

must be treated as security-sensitive.

Avoid them unless necessary.

Sanitize external content using an approved strategy.

---

# 82. URL Safety

Do not construct unsafe URLs from unvalidated user input.

When accepting external URLs:

- validate schemes
- avoid `javascript:`
- encode parameters correctly
- use URL APIs where practical

---

# 83. Browser Storage

Do not store sensitive secrets unnecessarily in:

```text
localStorage
sessionStorage
IndexedDB
```

Understand the security implications before storing authentication material.

Follow the authentication architecture of the application.

---

# 84. Styling Principles

Styling should be:

- maintainable
- scoped appropriately
- responsive
- accessible
- consistent with the design system

Avoid styling implementation that duplicates existing design-system functionality.

---

# 85. CSS / SCSS

Use semantic class names.

Prefer:

```scss
.user-card
.user-card__header
.user-card__content
```

over:

```scss
.box1
.red-container
.div2
```

Keep selector specificity reasonable.

Avoid excessive nesting.

Avoid `!important` unless genuinely required.

---

# 86. CSS Scope

Prefer locally scoped styles for component-specific styling.

Use global CSS only for genuine global concerns such as:

- reset
- typography
- design tokens
- theme
- application-level utilities

---

# 87. Tailwind

When using Tailwind:

- follow the project's established style
- avoid extremely long unreadable class strings
- reuse components/utility abstractions appropriately
- avoid arbitrary values when design tokens exist
- maintain responsive behavior
- maintain dark-mode behavior where required

If the project prefers SCSS + `@apply`, follow that convention.

Do not impose `@apply` on a project that intentionally uses utility-first templates.

---

# 88. CSS Duplication

Detect repeated style blocks.

Before extracting, verify the styles represent the same visual concept.

Prefer:

- tokens
- shared utilities
- reusable components

over copying the same values repeatedly.

---

# 89. Responsive Design

Review common viewport sizes.

Check:

- overflow
- wrapping
- tables
- modals
- menus
- navigation
- long text
- touch targets

Do not assume desktop-only behavior unless explicitly required.

---

# 90. Dark Mode

When dark mode exists:

- check contrast
- check hover states
- check focus states
- check disabled states
- check icons
- check borders
- check backgrounds

Do not simply invert light-mode colors.

---

# 91. Accessibility

Accessibility is part of correctness.

Review:

- semantic HTML
- keyboard navigation
- labels
- focus behavior
- contrast
- ARIA usage
- screen-reader text
- form errors
- modal focus handling

---

# 92. Semantic HTML

Prefer semantic elements:

```html
button nav main header section article label input
```

Do not use clickable `<div>` elements when a button is appropriate.

---

# 93. Buttons and Links

Use:

```text
button → performs an action
link → navigates
```

Do not use anchors as buttons without valid reason.

Do not use buttons for ordinary navigation when links are semantically correct.

---

# 94. Keyboard Accessibility

Every interactive feature should work without a mouse when appropriate.

Check:

```text
Tab
Enter
Space
Escape
Arrow keys
```

depending on component behavior.

---

# 95. Focus

Visible focus states must not be removed without an accessible replacement.

Modals/dialogs should manage focus correctly.

---

# 96. Forms

Forms must distinguish:

- required validation
- format validation
- server validation
- submission failure

Do not rely solely on disabled submit buttons to communicate invalid state.

---

# 97. Form Data

Keep form state predictable.

Avoid maintaining multiple conflicting copies of form values.

Validate at appropriate boundaries.

Do not send unnecessary fields to APIs.

---

# 98. UX States

Every data-driven UI should consider:

```text
initial
loading
success
empty
error
refreshing
disabled
unauthorized
```

when relevant.

---

# 99. Loading UX

Do not cause unnecessary layout shifts.

Use the appropriate project pattern:

- spinner
- skeleton
- inline loading
- disabled action state

Avoid blocking the entire application for a small local operation.

---

# 100. Error UX

Error messages should tell the user what happened when possible.

Avoid exposing:

```text
ECONNABORTED
AxiosError
500 stack traces
JSON parser errors
```

directly.

---

# 101. Toasts

Use toast notifications for transient feedback.

Do not use toasts for information that users must retain or act on for an extended period.

Avoid duplicate toasts for the same failure.

---

# 102. Performance

Do not optimize blindly.

First avoid obvious problems:

- unnecessary renders
- unnecessary API calls
- repeated mapping
- expensive calculations on every render
- unnecessary deep reactivity
- duplicate event listeners
- leaking timers/subscriptions
- huge initial bundles

---

# 103. Memoization

Memoization has a maintenance cost.

Use memoization only when:

- profiling identifies a meaningful issue
- calculation is expensive
- referential identity matters

Do not automatically memoize every value/function.

---

# 104. Large Lists

For large collections, consider:

- pagination
- virtualization
- incremental loading

only when data size justifies it.

Do not introduce virtualization for tiny lists.

---

# 105. Code Splitting

Use lazy loading/code splitting for meaningful application boundaries when it improves initial load performance.

Do not fragment tiny components into unnecessary chunks.

---

# 106. Images and Assets

Avoid unnecessarily large assets.

Use appropriate:

- formats
- dimensions
- lazy loading
- responsive images

when relevant.

Always provide meaningful alt text for informative images.

Decorative images should not create screen-reader noise.

---

# 107. Memory and Cleanup

Clean up:

- subscriptions
- event listeners
- timers
- observers
- sockets
- external library instances

when component lifecycle requires it.

---

# 118. ESLint

Lint rules should improve correctness and consistency.

Do not disable rules globally to fix a local issue.

Prefer the narrowest appropriate scope.

---

# 119. ESLint Overrides

When combining override blocks, verify all inherited configurations.

Example review questions:

- Which files match this block?
- Which plugins apply?
- Which recommended configs are spread here?
- Will merging broaden those configs accidentally?
- Are parser options affected?
- Are globals affected?

Duplicate rules may be intentional when override scopes differ.

---

# 120. ESLint Disable Comments

Before adding:

```ts
// eslint-disable-next-line
```

ask whether the underlying issue can be solved correctly.

If disabling is genuinely required:

- keep the scope minimal
- consider adding a reason when non-obvious

---

# 121. Formatting

Use the project's formatter.

Do not manually fight automated formatting.

Avoid formatting-only changes mixed with functional changes unless requested.

---

# 122. Imports

Remove:

- unused imports
- duplicate imports
- unused default imports
- obsolete imports

Respect the project's import ordering convention.

Avoid circular dependencies.

---

# 123. Circular Dependencies

Watch for circular dependency patterns such as:

```text
store → helper → store
component → mapper → component
index barrel → module → index barrel
```

Do not create barrel exports that introduce difficult cycles.

---

# 124. Barrel Files

Use barrel files only when they genuinely simplify public module boundaries.

Avoid massive `index.ts` files that hide dependencies and encourage circular imports.

---

# 125. Project Structure

Files should live according to responsibility.

Typical structure may include:

```text
api/
adapters/
components/
features/
hooks/
mappers/
pages/
router/
stores/
types/
utils/
constants/
```

Do not create random utility folders or duplicate concepts such as:

```text
helpers/
utils/
common/
shared-utils/
```

without a defined distinction.

---

# 126. Utility Functions

Utilities should be:

- generic enough for their location
- pure where possible
- clearly named

Domain-specific logic should not automatically live in `utils`.

Place logic according to responsibility.

---

# 127. Constants Organization

Avoid one enormous constants file.

Group constants by coherent domain/feature/config responsibility.

Avoid duplicating the same value in several files.

---

# 128. Dependency Management

Before adding a dependency, ask:

1. Can the existing stack solve this?
2. Is the dependency actively maintained?
3. Does it significantly increase bundle size?
4. Does it introduce security concerns?
5. Is its functionality worth the maintenance cost?
6. Does the project already have an equivalent dependency?

Do not add libraries for trivial helpers.

---

# 129. Dependency Versions

Do not casually upgrade dependencies as part of unrelated work.

Dependency upgrades should be intentional.

Review:

- breaking changes
- peer dependencies
- lockfile changes
- build compatibility

---

# 130. Package Lock Files

Do not manually edit lockfiles.

Use the package manager.

Do not commit lockfile changes unrelated to dependency changes.

---

# 131. Configuration Files

Treat configuration as production code.

Review:

- scopes
- globs
- inheritance
- precedence
- environment behavior
- plugin behavior
- duplicated settings

Never simplify configuration without understanding inheritance.

---

# 132. Environment-Specific Logic

Avoid scattered checks such as:

```ts
if (environment === 'production')
```

throughout application code.

Centralize environment configuration where practical.

---

# 133. Logging

Do not leave debug:

```ts
console.log;
console.table;
debugger;
```

in production code.

Use the project's logger when logging is required.

Appropriate logging should have:

- meaningful context
- correct severity
- no sensitive data

---

# 134. Sensitive Logging

Never log:

- access tokens
- passwords
- personal secrets
- authorization headers
- sensitive user data

Production browser logs can be inspected by users.

---

# 135. Documentation

Document **why**, not obvious **what**.

Avoid:

```ts
// increment counter
counter++;
```

Useful:

```ts
// The API may return duplicate IDs during migration, so deduplicate here.
```

---

# 136. Code Comments

Comments should explain:

- non-obvious business constraints
- unusual browser behavior
- intentional workarounds
- external limitations
- important architectural decisions

Remove obsolete comments when code changes.

---

# 137. TODO Comments

Avoid vague:

```ts
// TODO fix later
```

Prefer:

```ts
// TODO(PROJ-123): Remove fallback after API v2 migration.
```

when the project uses tracked TODOs.

Do not commit forgotten temporary TODOs.

---

# 138. Function Documentation

Do not add JSDoc to every obvious function.

Use documentation where:

- public utility behavior is non-obvious
- parameters have constraints
- return semantics matter
- external consumers need documentation

Types often provide sufficient documentation.

---

# 139. README Documentation

Update README/developer documentation when a change affects:

- setup
- environment variables
- scripts
- architecture
- local development
- build
- deployment
- major conventions

Do not let code and documentation contradict each other.

---

# 140. Architectural Documentation

For major architectural decisions, document:

- problem
- chosen solution
- alternatives considered
- consequences

Use ADRs when the project follows ADR practices.

---

# 141. Git – Commit Scope

A commit should contain one coherent change where practical.

Do not mix:

```text
feature
unrelated refactor
formatting
dependency upgrade
random cleanup
```

in the same commit without reason.

---

# 142. Git Diff Review

Before committing, review:

```bash
git diff
git diff --staged
```

Check for:

- accidental files
- debugging code
- formatting noise
- secrets
- unrelated changes
- generated files
- unexpected lockfile changes

---

# 143. Commit Messages

Follow the project's commit convention.

If Conventional Commits are used:

```text
feat:
fix:
refactor:
docs:
chore:
style:
perf:
```

Commit messages should describe the intent of the change.

Avoid:

```text
update
changes
fix stuff
work
```

---

# 144. Branches

Use meaningful branch names according to the team's convention.

Examples:

```text
feature/...
fix/...
refactor/...
```

Avoid ambiguous branch names.

---

# 145. Pull Requests

A PR should clearly explain:

- problem
- solution
- important implementation choices
- behavior changes
- screenshots for UI changes when appropriate
- known limitations
- related ticket

Keep PR scope focused.

---

# 146. PR Self-Review

Before requesting review:

- reread the entire diff
- remove temporary code
- verify naming
- verify architecture
- verify types
- verify loading/error behavior
- verify accessibility
- verify UI states
- verify configuration impact

The author should try to catch reviewer comments before the reviewer does.

---

# 147. Refactoring

Refactoring should preserve behavior unless explicitly intended otherwise.

Before refactoring, ask:

- Is this duplicated?
- Is this actually the same responsibility?
- Can nesting be reduced?
- Can naming improve?
- Is this abstraction useful?
- Does this logic belong in another layer?
- Can an existing utility be reused?
- Is the function doing too much?

---

# 148. Avoid Refactoring for Personal Preference

Do not change:

```text
valid existing style A
```

to:

```text
valid style B
```

merely because the AI prefers B.

Consistency beats personal preference.

---

# 149. Code Smells to Detect

Actively search for:

- long functions
- large components
- duplicated logic
- duplicated constants
- duplicated state
- prop drilling that has become excessive
- unnecessary global state
- unsafe casts
- broad types
- magic values
- deep nesting
- boolean flag overload
- dead code
- hidden side effects
- circular dependencies
- giant utility files
- giant store files
- giant mapper files
- repeated API requests
- stale caches
- unhandled promises
- impossible states represented by multiple booleans

---

# 150. Impossible States

Prefer data models that make invalid combinations difficult.

Instead of:

```ts
isLoading: boolean;
isSuccess: boolean;
isError: boolean;
```

when several impossible combinations can occur, consider a discriminated state:

```ts
type RequestState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: Data }
  | { status: "error"; error: string };
```

Use this when it genuinely simplifies the code.

Do not introduce it for trivial state unnecessarily.

---

# 151. Avoid Premature Abstraction

Three similar lines do not automatically require a helper.

Extract when:

- logic is duplicated meaningfully
- abstraction has a clear name
- it represents one concept
- it improves maintenance
- it reduces risk

Do not extract merely to satisfy DRY mechanically.

---

# 152. Avoid Premature Optimization

Do not introduce:

- caching
- memoization
- virtualization
- workers
- complex state selectors

without a meaningful need.

Correctness and simplicity come first.

---

# 153. Browser Compatibility

Follow the project's browser support target.

Before using a new browser API:

- verify support
- provide fallback if required
- consider TypeScript target
- consider transpilation

Do not add polyfills without necessity.

---

# 154. Date and Time

Dates are a common bug source.

Clarify whether values represent:

- UTC
- local time
- date-only
- timezone-aware datetime

Do not parse ambiguous date strings casually.

Avoid manual timezone arithmetic.

Use the project's existing date utility.

---

# 155. Numeric Values

Be careful with:

- `NaN`
- floating-point precision
- numeric strings
- zero values
- currency

Do not use truthiness when zero is valid.

Example:

Bad:

```ts
if (!amount) return;
```

if `0` is valid.

---

# 156. String Handling

Normalize input intentionally.

Consider:

```text
whitespace
case sensitivity
Unicode
empty strings
```

Do not call `.trim()` blindly if whitespace has business meaning.

---

# 157. URLs and Query Parameters

Use URL/query utilities rather than manual string concatenation when complexity increases.

Encode values correctly.

Do not double-encode.

Do not assume route/API parameter values are safe.

---

# 158. IDs

Treat IDs according to their real domain type.

Do not convert identifiers to numbers unless they are genuinely numeric quantities.

Identifiers may contain:

- leading zeros
- letters
- special formatting

---

# 159. API Pagination

When pagination exists, clearly define:

- page/index semantics
- page size
- total count
- next page behavior
- loading state
- cache strategy

Avoid off-by-one errors.

---

# 160. Search

For user-triggered search:

- trim/normalize only according to requirements
- prevent invalid requests
- consider debounce when appropriate
- cancel/stale-guard previous requests
- preserve useful search state if required

Do not debounce actions that should execute immediately.

---

# 161. Accessibility Testing

Where applicable, consider automated accessibility tools alongside manual review.

Automated checks do not replace keyboard and screen-reader reasoning.

---

# 162. Design System

When a project uses a design system:

1. check whether an existing component solves the need
2. use documented component APIs
3. avoid rebuilding equivalent functionality manually
4. avoid overriding internal styles unnecessarily
5. preserve accessibility behavior

Do not wrap every design-system component unless the wrapper adds genuine application value.

---

# 163. Framework-Specific APIs

Before writing custom functionality, check whether the framework already provides an appropriate supported API.

However, do not replace an established working project abstraction solely because a newer framework API exists.

---

# 164. Backward Compatibility

Before modifying:

- shared component props
- utility signatures
- store APIs
- public hooks
- route names
- persisted data

search for consumers.

Avoid breaking existing callers accidentally.

---

# 165. Persisted State

When changing persisted state shape:

- consider old stored data
- validate before reading
- migrate or invalidate when necessary
- do not assume existing users have the newest structure

---

# 166. LocalStorage / SessionStorage

Wrap parsing safely.

Bad:

```ts
JSON.parse(localStorage.getItem("state")!);
```

Prefer validation/error handling.

Storage values may be:

- missing
- outdated
- manually modified
- malformed

---

# 167. Feature Flags

Feature flags should have:

- meaningful names
- defined owner/lifecycle
- clear fallback behavior

Remove obsolete flags after rollout.

Do not leave permanent dead branches.

---

# 168. Internationalization

If the project uses i18n:

- avoid hardcoded user-facing text
- reuse translation keys
- consider pluralization
- consider interpolation
- avoid concatenating translated sentence fragments

Do not introduce i18n infrastructure if the project does not require it.

---

# 169. Error Boundaries

In React applications, use error boundaries at meaningful UI/application boundaries when runtime rendering failures need graceful recovery.

Do not use error boundaries as replacements for normal API error handling.

---

# 170. File Size

Very large files should trigger architectural review.

Potential candidates for splitting:

```text
mapper
store
component
utility module
configuration
```

Split by responsibility rather than arbitrary line count.

---

# 171. Public API Surface

Keep module/component APIs as small as practical.

Do not expose internal values merely because they are available.

Every exported function/type increases maintenance responsibility.

---

# 172. Exports

Before exporting something, ask whether another module genuinely needs it.

Avoid exporting internals "just in case."

---

# 173. Default vs Named Exports

Follow the existing project's convention.

Do not mix styles arbitrarily.

For reusable utilities/types/hooks, named exports often improve refactoring, but consistency takes precedence.

---

# 174. Error Suppression

Avoid:

```ts
try {
  ...
} catch {}
```

unless ignoring the failure is explicitly intentional.

When intentionally ignoring an error, make the reasoning clear.

---

# 175. Promise Handling

Detect:

- floating promises
- forgotten `await`
- double-await patterns
- unnecessary `new Promise`
- Promise constructors wrapping already-Promise APIs

Do not create:

```ts
new Promise(async ...)
```

---

# 176. Timers

Store timer IDs when cleanup is required.

Clear timers appropriately.

Avoid hidden timers inside reusable helpers without clear lifecycle ownership.

---

# 177. Event Listeners

When manually adding listeners:

```ts
addEventListener;
```

ensure corresponding cleanup:

```ts
removeEventListener;
```

when lifecycle requires it.

---

# 178. DOM Manipulation

Prefer framework mechanisms over direct DOM manipulation.

Direct DOM access is acceptable for:

- focus
- measurement
- third-party integrations
- browser APIs

when appropriate.

Keep it isolated.

---

# 179. Third-Party Components

Do not depend on undocumented internal behavior.

Use public APIs.

Wrap third-party behavior only when the wrapper provides useful isolation or application semantics.

---

# 180. Configuration Scope Review

Configuration changes require special review.

The AI must ask:

- What files are affected?
- What config is inherited?
- Does this broaden scope?
- Does this affect production?
- Does this affect build output?
- Does this affect lint behavior?
- Does this affect editor behavior?
- Does this create conflicting configuration?

Configuration duplication may be safer than incorrect consolidation.

---

# 181. AI Code Generation Procedure

Before generating code:

### Step 1 – Understand

Determine:

- requested behavior
- existing architecture
- relevant files
- data flow
- existing patterns
- framework conventions

### Step 2 – Search

Look for:

- similar implementations
- reusable helpers
- types
- constants
- stores
- components

### Step 3 – Design

Choose the smallest solution that fits the architecture.

### Step 4 – Implement

Follow all coding standards.

### Step 5 – Self-review

Review the implementation as if reviewing another developer's PR.

### Step 6 – Validate

Run or recommend relevant:

```text
formatter
lint
type-check
build
```

### Step 7 – Diff Review

Check only intended changes remain.

---

# 182. AI Must Not Blindly Follow a Requested Implementation

If the requested technical implementation contains a probable bug, architectural violation, security issue, or unnecessary complexity:

- identify the concern
- explain it briefly
- recommend the safer implementation

Do not blindly produce harmful code merely because a specific implementation was requested.

Respect the user's functional goal.

---

# 183. AI Must Distinguish Rules From Preferences

Classify findings mentally as:

```text
correctness issue
security issue
architecture issue
type-safety issue
maintainability issue
performance issue
accessibility issue
style preference
```

Do not present personal stylistic preference as a defect.

---

# 184. AI Code Review Severity

Use severity when reviewing.

## Critical

Examples:

- security vulnerability
- data corruption
- broken authentication
- destructive production behavior

## High

Examples:

- functional bug
- incorrect API behavior
- race condition affecting users
- authorization failure
- major state bug

## Medium

Examples:

- architecture violation
- unsafe typing
- significant duplication
- likely maintainability problem

## Low

Examples:

- minor cleanup
- naming improvement
- small readability issue

Avoid overwhelming reviews with low-value comments.

---

# 185. Code Review Finding Format

For each meaningful issue, provide:

```text
Severity:
Category:
Location:
Issue:
Why it matters:
Recommended change:
```

The recommendation should normally be the smallest maintainable fix.

---

# 186. Code Review Categories

Use categories such as:

```text
bug
security
architecture
type-safety
state-management
async
performance
accessibility
maintainability
configuration
documentation
cleanup
```

---

# 187. Code Review Priority

Review in this order:

1. Security
2. Correctness
3. Authorization
4. Data integrity
5. Async/state correctness
6. Type safety
7. Architecture
8. Error handling
9. Accessibility
10. Maintainability
11. Performance
12. Styling
13. Cleanup

Do not spend review effort on formatting while a functional bug remains unnoticed.

---

# 188. Code Review Questions

For every change, ask:

### Behavior

- Does it do what is required?
- What happens when it fails?
- What happens with empty data?
- What happens with unexpected data?

### Architecture

- Is the logic in the correct layer?
- Is responsibility clear?

### Types

- Are types accurate?
- Is anything being forced with `as`?
- Can invalid states exist?

### State

- Who owns the state?
- Could it become stale?
- Is state duplicated?

### Async

- Is loading always cleared?
- Is failure handled?
- Could requests race?

### Reuse

- Does this duplicate existing behavior?
- Is duplication intentional because scopes differ?

### Security

- Are permissions enforced?
- Is untrusted input handled?
- Is sensitive data exposed?

### UX

- Loading?
- Empty?
- Error?
- Disabled?
- Accessibility?

---

# 189. Required Pre-Commit Checks

Before committing, verify:

- [ ] implementation matches requirements
- [ ] no known functional bugs
- [ ] no `any`
- [ ] no unjustified unsafe casts
- [ ] no unnecessary non-null assertions
- [ ] no accidental mutation
- [ ] no unreachable code
- [ ] no incorrect return values
- [ ] no floating promises
- [ ] no forgotten async cleanup
- [ ] no unnecessary nesting
- [ ] early returns used where clearer
- [ ] no duplicated logic without justification
- [ ] no overlapping configuration without scope review
- [ ] no unnecessary abstraction
- [ ] no unused imports
- [ ] no unused variables
- [ ] no dead code
- [ ] no commented-out old implementation
- [ ] no temporary mocks
- [ ] no debug console statements
- [ ] no `debugger`
- [ ] no hardcoded secrets
- [ ] no accidental environment files
- [ ] no unrelated file modifications
- [ ] architectural boundaries respected
- [ ] API layer responsibilities respected
- [ ] adapters used appropriately
- [ ] mappers remain pure
- [ ] state ownership is clear
- [ ] components remain focused
- [ ] React framework conventions respected
- [ ] loading states correct
- [ ] errors handled consistently
- [ ] cache behavior correct
- [ ] refresh behavior correct
- [ ] route behavior correct
- [ ] authorization considered
- [ ] user input considered untrusted
- [ ] accessibility checked
- [ ] responsive behavior considered
- [ ] formatter passes
- [ ] ESLint passes
- [ ] TypeScript type-check passes
- [ ] production build passes when relevant
- [ ] final Git diff reviewed manually

---

# 190. Required PR Review Checks

Before approving a PR, verify:

## Correctness

- [ ] behavior is correct
- [ ] edge cases are handled
- [ ] failure paths are handled

## Architecture

- [ ] responsibilities remain separated
- [ ] no business transformation has leaked into presentation
- [ ] abstractions match the existing architecture

## TypeScript

- [ ] strong types
- [ ] no avoidable assertions
- [ ] no `any`
- [ ] nullability handled correctly

## Framework

- [ ] React conventions followed
- [ ] hooks correct
- [ ] lifecycle behavior correct
- [ ] no unnecessary effects/watchers

## State

- [ ] ownership is clear
- [ ] no duplicated derived state
- [ ] no stale state risk

## Async

- [ ] loading/failure cleanup correct
- [ ] no races where relevant
- [ ] promises handled

## API

- [ ] params validated
- [ ] response normalized appropriately
- [ ] error behavior consistent

## Security

- [ ] authorization checked
- [ ] untrusted data handled
- [ ] no exposed secrets

## UI

- [ ] empty/error/loading states
- [ ] accessibility
- [ ] responsive behavior
- [ ] design-system consistency

## Maintainability

- [ ] no harmful duplication
- [ ] no unnecessary abstraction
- [ ] names are clear
- [ ] future developer can understand the code

## Git

- [ ] no unrelated changes
- [ ] no debugging code
- [ ] no accidental generated files
- [ ] commit/PR scope is coherent

---

# 191. AI Final Self-Review

Before returning generated code, silently ask:

1. Is this correct?
2. Is this the smallest reasonable implementation?
3. Does it follow the existing architecture?
4. Am I duplicating something that probably already exists?
5. If I merged duplication, did I verify its scope and side effects?
6. Are the types accurate?
7. Did I use `any`?
8. Did I hide a type problem with `as`?
9. Can null/undefined break this?
10. Can async behavior leave stale loading state?
11. Can concurrent execution cause a race?
12. Is business logic in the correct layer?
13. Is state owned by the correct place?
14. Is derived state unnecessarily stored?
15. Is a component doing too much?
16. Is a hook doing too much?
17. Is a mapper pure?
18. Is an adapter actually necessary?
19. Are errors handled consistently?
20. Are permissions/security considered?
21. Is the UI accessible?
22. Is there dead/debug code?
23. Did I modify unrelated behavior?
24. Would I approve this code in a professional PR?

If any answer reveals a problem, fix it before presenting the final implementation.

---

# 192. Final Engineering Principle

Never optimize code merely to make it:

- shorter
- more clever
- more abstract
- more fashionable

Optimize it to make it:

- correct
- secure
- predictable
- understandable
- type-safe
- testable
- maintainable
- consistent with its codebase

The best frontend code is not the code that demonstrates the most advanced technique.

It is the code that solves the problem correctly, clearly, safely, and remains easy for the next developer to maintain.
