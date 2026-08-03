# SchoolOS Future Design and Interaction Contract

## Design thesis

SchoolOS should feel like a calm institutional control room: precise enough for finance and administration, fast enough for a teacher between classes, and reassuring enough for families. The interface uses clear information hierarchy, generous but efficient spacing, restrained SchoolOS blue, and explicit workflow states. It must not resemble the dark Ramom reference, a generic AI bento dashboard, or a collection of unrelated add-ons.

## Brand personality

- Trustworthy
- Operational
- Human
- Moroccan and multilingual
- Calm under pressure

Avoid ornamental gradients, glass-heavy cards, oversized empty canvases, fake urgency, ambiguous icon-only actions and low-contrast gray text.

## Tokens

```css
:root {
  --schoolos-ink: #16212b;
  --schoolos-blue: #2487b8;
  --schoolos-blue-strong: #0066ff;
  --schoolos-canvas: #f8fafc;
  --schoolos-surface: #ffffff;
  --schoolos-surface-muted: #f1f5f9;
  --schoolos-border: #e2e8f0;
  --schoolos-text: #16212b;
  --schoolos-text-muted: #64748b;
  --schoolos-success: #17a673;
  --schoolos-warning: #d97706;
  --schoolos-danger: #dc3545;
  --schoolos-info: #1b6c93;
  --schoolos-focus: #0066ff;
}
```

Use semantic aliases in components. Do not scatter raw hex values through new features.

## Typography

- French/English: Albert Sans, then Plus Jakarta Sans and system sans-serif.
- Arabic: Cairo, then IBM Plex Sans Arabic.
- Display: 40/48 desktop, 32/38 tablet, 28/34 mobile.
- Page heading: 28/34 desktop, 24/30 mobile.
- Section heading: 20/26; card heading: 16/22; body: 14–16/1.5; labels: 12–14/1.4.
- Financial and tabular numbers use tabular numerals and never rely on color alone.

## Layout system

- Desktop shell: 256px sticky sidebar, sticky top header, fluid content with 24px gutters and 1600px useful maximum.
- Portal shell: role-specific navigation and quick actions, never the full admin menu.
- Mobile shell: drawer or bottom navigation with 4–5 primary destinations.
- Grid: 12 columns desktop, 6 tablet, 4 mobile; 8px spacing rhythm.
- Administration pages use a page header, optional summary strip, filter/action bar, then the primary workspace.
- Forms use a readable 640–760px content width unless a preview or ledger needs a split canvas.

## Surface hierarchy

1. Canvas for the page background.
2. Primary white workspace with subtle border.
3. Muted inset areas for filters, summaries and read-only context.
4. Drawers/dialogs for focused create/edit workflows.
5. Destructive confirmation is a separate, clearly worded state.

Avoid cards inside cards unless the inner region is a distinct interactive workspace.

## Component language

### Navigation

- Active route uses blue surface and clear label, not color alone.
- Parent navigation opens automatically for the current route.
- Role badge and sign-out remain visible; module navigation scrolls independently.

### Tables and lists

- Server pagination, search, sort and filter state reflected in the URL.
- Sticky headers for long tables; mobile changes to prioritized rows/cards rather than horizontal compression.
- Batch selection displays a contextual action bar and selected count.

### Forms

- Visible labels, descriptions for complex policies, inline validation and preserved drafts.
- Required markers are explained once; errors connect to inputs and a summary on long forms.
- Provider secrets are write-only with masked existing-state indicators.

### Buttons

- One primary action per workspace.
- Secondary outline, tertiary text, destructive red with confirmation.
- Minimum 44px touch target; loading preserves button width and announces progress.

### Status

- Success green, warning amber, danger red, information blue, neutral slate.
- Always pair badge color with text/icon.
- Lifecycle pages show the permitted next actions, not every theoretical action.

### Data visualization

- Show definition, period, filters, last refresh and drill-through source.
- No 3D charts, decorative gauges or unexplained percentages.
- Official totals must reconcile with the source ledger.

## Interaction states

- Loading: skeleton matching final layout; no full-page spinner for local fetches.
- Empty: explain why empty and offer the permitted first action.
- Error: actionable message, retry, correlation reference for support when relevant.
- Offline: preserve safe drafts for attendance, exams and field operations only where designed.
- Success: confirm the resulting record/reference and next action.
- Conflict: show the conflicting record and resolution path.
- Read-only/closed period: show why editing is disabled and who can reopen.

## Motion

- 120–180ms for controls, 180–240ms for panels, ease-out on entry and ease-in on exit.
- Animate transform and opacity only.
- Respect reduced motion.
- Never animate financial totals, grades or urgent safety status in a distracting loop.

## Accessibility

- WCAG 2.2 AA contrast.
- Keyboard access and visible focus for every action.
- Logical heading hierarchy and landmarks.
- Accessible names for icon buttons and chart summaries for nonvisual users.
- Tables provide captions or nearby descriptions.
- RTL mirrors layout and directional icons without reversing dates, phone numbers or identifiers.
- Touch targets at least 44×44px on mobile.

## Asset direction

- Lucide-style line icons with consistent stroke.
- Realistic Moroccan names, MAD amounts, local phone formats and trilingual content.
- Student/employee imagery uses consent-safe placeholders in design previews.
- Document samples use fictional watermarked data.
- Maps and route previews must label tracking as simulated unless backed by live telemetry.

## Implementation notes

- Reuse `src/components/ui`, shared DataTable/filter/button patterns and semantic tokens.
- Put domain UI in `src/features/<domain>/ui`, server logic in domain services, and route handlers under `src/app/api/<domain>`.
- Pages compose domain components; they do not contain database logic.
- All prompts in the prompt packs inherit this contract.

## QA checklist

- [ ] Tenant, branch, role and object scope tested.
- [ ] FR/AR/EN and RTL verified.
- [ ] Keyboard, screen reader labels, focus and 200% text verified.
- [ ] Mobile, tablet and desktop layouts verified.
- [ ] Loading, empty, error, forbidden and success states implemented.
- [ ] No fake controls, data or compliance claims.
- [ ] Destructive and financial actions are confirmed and audited.
