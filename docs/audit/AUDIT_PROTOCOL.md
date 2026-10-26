# Audit protocol

Use this file for every branch. It replaces the older three-prompt block. The change: audits now check **surfaces** (can a real user find and use the feature) and **proof quality** (is it really working), not only whether code exists.

Flow: **A. Audit → B. Fix batches (rules → stubs → missing → surfaces → UI) → C. Re-audit → commit → merge into the next branch**

Status words (use only these):
- **Done**: works end to end, reachable from the nav, proven by a real test.
- **Partial**: exists but incomplete, mocked-only proof, or reachable only through a side door.
- **Embedded-only**: logic works but the feature lives only inside another page (for example invoice only inside a job card). Counts as Partial for the "Done when" row.
- **Stub**: UI or code that pretends (link that is never sent, placeholder page, hard-coded data).
- **Missing**: not built.

---

## A. Audit prompt (no code changes)

```markdown
Do not change any code. Read docs/PRODUCT_SPEC.md, docs/ARCHITECTURE.md,
docs/ROADMAP.md, the prompt(s) for this branch in docs/PROMPTS.md, the contract
at the top of the "Prompts 11 onward" section, .cursor/rules/garage.mdc and
.cursor/rules/ui-flows.mdc.

Audit this branch and write docs/audit/<branch-name>.md. Use only the status
words Done, Partial, Embedded-only, Stub, Missing. Every Done needs a file path
AND a test name that proves it. If you are not sure, write Partial.

1. Requirement checklist: every requirement in the prompt and every "Done when"
   row, with status and proof.

2. Surface map (most important section). For every entity this branch adds or
   changes, fill this table from the real code, not from the prompt:

   | Entity | Top-level route | Nav item (desktop + mobile) | List page | Search | Filters | Detail page | Create | Edit | Roles that can reach it | Dashboard widget |

   Then answer in plain words:
   - Which entities a user would look for later have no list page of their own?
   - Which pages are reachable only by opening another record first?
   - Which nav items lead to a placeholder, a redirect, or a modal only?
   - Which entities in prisma/schema.prisma added by this branch have no UI at all?

3. End-user walkthrough. Act as an Owner, a Manager, a Technician and an
   Accountant. For each, write the 5 most likely tasks for this feature (for
   example "find all unpaid invoices this month") and list the clicks. Mark any
   task that needs more than 3 clicks, needs a direct URL, or is impossible.

4. UI problems, checked against ui-flows.mdc and garage.mdc: pages with no
   loading Skeleton, empty (no data) or error state; empty (no search match)
   missing; hard-coded English (including placeholders, PDF labels, audit
   notes, export headers, provider-facing text); missing hi/gu keys; key parity
   between en/hi/gu; layouts that break at 360px or look empty or
   narrow-column at 1440px; pages missing title, description, breadcrumb or
   having more than one primary button; status shown as plain text instead of
   Badge; status change done with a dropdown of every status instead of one
   "next step" button; list rows without a DropdownMenu of row actions; tables
   that do not become cards on phones; tap targets under 44px; forms not using
   react-hook-form + zod with inline errors; native input/select instead of
   shadcn; destructive actions without a confirm dialog; async actions without
   a loading button and success/error toast; database terms in labels instead
   of garage language; code comments added; missing flow map for the feature.

5. Rule violations: queries without garageId; garageId taken from request
   input; Prisma outside repo.ts (include src/lib); floats used for money;
   stock changed outside StockMovement; missing audit log writes for money,
   stock, approvals and roles; missing Zod validation; secrets outside env.

6. Stubbed or fake features: invites that only create a link, OTPs or messages
   that are never sent, buttons that only copy, hard-coded data, features that
   only work with a mocked provider, TODO or console.log left in code.

7. Proof quality. For each Done row, classify its proof:
   - unit (pure logic), mocked-service, local-Postgres (same DATABASE_URL /
     docker as the app — not a separate DB), Playwright-from-nav.
   Flag every row whose only proof is mocked and whose rule is about money,
   stock, numbering, concurrency, permissions or isolation.

8. Role matrix: for each new route, what happens for Owner, Manager,
   Technician, Accountant (allowed, hidden from nav, 403/404).

9. Summary: counts of Done / Partial / Embedded-only / Stub / Missing, the 5
   highest-impact gaps, and a suggested fix order.

Be strict.
```

---

## B. Fix prompts (run in batches, never all at once)

Run in this order. One batch per Cursor chat. Paste 3 to 6 rows.

**B1. Rule violations**
```markdown
Read docs/audit/<branch-file>.md. Fix only the rule-violation rows listed
below: [paste rows].
For each: say in two lines what is wrong and which files change, fix it fully,
add a test that fails before and passes after, update its row in the audit file
with the file path and test name. Do not touch other items.
Finish with a checklist of the rows you were given.
```

**B2. Stubs and fakes**
```markdown
Read docs/audit/<branch-file>.md. Replace these stubs with real behaviour:
[paste rows].
No placeholder data. Anything that sends something must really send in
development (Mailpit or provider test mode) and write a log row. Prove it with
a test that reads the log row or the Mailpit message. If a provider key is
missing, show a clear setup message in Settings; never a fake success.
Update audit rows. Finish with a checklist.
```

**B3. Missing items**
```markdown
Read docs/audit/<branch-file>.md. Build these missing items: [paste rows].
Before coding, list tables, routes and files you will change. Follow the
Prompts 11 onward contract (Surface Map, real behaviour, proof). Update audit rows.
Finish with a checklist.
```

**B4. Surface gaps (new)**
```markdown
Read docs/audit/<branch-file>.md section 2 (Surface map) and section 3
(walkthrough). Fix only these surface rows: [paste rows, e.g. "Invoice is
Embedded-only"].
First write the Surface Map for the entity: route, nav item, roles, list,
search, filters, detail, create/edit, dashboard widget. Build the list and
detail pages on top of the EXISTING service layer; do not duplicate logic.
Keep the old entry point as a secondary link to the new page.
Add a Playwright test that starts from the nav click. Update audit rows.
Finish with a checklist and the exact clicks to reach each new page.
```

**B5. UI states and i18n**
```markdown
Read docs/audit/<branch-file>.md section 4. Fix only these UI rows: [paste rows].
Use shadcn components and shared Badge, EmptyState, Skeleton and toast helpers.
Move every user-facing string into messages/en.json, hi.json, gu.json with
identical keys, and run the i18n parity check. Check 360px and 1440px in
Playwright viewport tests. Update audit rows. Finish with a checklist.
```

---

## C. Re-audit prompt (no code changes)

```markdown
Re-audit this branch without changing code. Re-check every row in
docs/audit/<branch-file>.md against the real code and tests.

1. List every row marked Done that is not actually working or not reachable from
   the nav, with evidence (file path, route, test name, or the command output).
2. List every Done row whose proof is mocked-only for a rule about money, stock,
   numbering, concurrency, permissions or isolation.
3. Re-run the walkthrough from the original audit and report which tasks are
   now possible within 3 clicks.
4. Run npm run lint, npm run typecheck, npm test and npm run test:e2e and
   report results. Report skipped or flaky tests.
5. Report anything built but not mentioned in the audit file.
Update the audit file only to correct statuses. Do not fix code.
```

---

## D. Pre-merge checklist (paste into the PR description)

- [ ] Surface Map in the PR matches real routes
- [ ] Every new entity has nav entry, list, detail, empty states
- [ ] No hard-coded English; en, hi, gu keys identical
- [ ] One local-Postgres test (same DATABASE_URL) for money, stock, numbering or concurrency rules
- [ ] One Playwright test starting from the nav click
- [ ] Role matrix test passes
- [ ] Garage isolation test for every new table
- [ ] Audit file re-checked after the last code change
- [ ] ROADMAP row updated to the real status (not ahead of the tree)
- [ ] Everything committed (no important files untracked)
