# Section 07: Automated SMS Dispatch & Communication Templates

## Overview
Implements the Communication feature module (`src/features/communication/`): Message Templates Editor with placeholders (`{{studentName}}`, `{{amountDue}}`, `{{date}}`), Automated SMS Dispatch Engine, Flagged-Student Reminders surface, and Delivery Log tracker matching `pre-dev/05-database-schema.md` tables `message_templates`, `reminder_batches`, `reminder_messages`.

## Risk: `yellow` — Gateway integration & delivery tracking

## Tasks

<task type="auto" id="07-01">
  <name>Create Communication Types & Schemas</name>
  <files>src/features/communication/model/types.ts, src/features/communication/validation/template.schema.ts</files>
  <action>
    Define TypeScript interfaces and Zod schemas for Message Templates, Reminder Batches, and Delivery Messages (SMS/WhatsApp).
  </action>
  <verify>Import communication types without compilation errors</verify>
  <done>Communication types & schemas defined</done>
</task>

<task type="auto" id="07-02">
  <name>Create Local SMS Gateway Integration Adapter</name>
  <files>src/libs/sms/index.ts, src/libs/sms/gateway-client.ts</files>
  <action>
    Build SMS gateway HTTP adapter to dispatch automated SMS messages to Moroccan guardian mobile numbers (`+212...`). Include fallback logger for dev environment.
  </action>
  <verify>Dispatching test SMS prints clean delivery payload in dev mode</verify>
  <done>SMS Gateway integration adapter created</done>
</task>

<task type="auto" id="07-03">
  <name>Create Communication Server Service</name>
  <files>src/features/communication/server/communication.service.ts</files>
  <action>
    Implement server-side logic for fetching templates, rendering placeholder strings, batch queueing reminder messages, and updating delivery webhooks.
  </action>
  <verify>Batch send creates reminder_batches and reminder_messages records</verify>
  <done>Communication service layer completed</done>
</task>

<task type="auto" id="07-04">
  <name>Create Message Templates Editor Component</name>
  <files>src/features/communication/ui/templates-editor-section.tsx, src/features/communication/ui/templates-editor-client.tsx</files>
  <action>
    Build interactive Message Template editor allowing admins to customize automated SMS copy for unexcused absences and overdue fee reminders.
  </action>
  <verify>Template editor previews interpolated variables in real-time</verify>
  <done>Message Templates Editor created</done>
</task>

<task type="auto" id="07-05">
  <name>Create Flagged Reminders Surface & Communication Pages</name>
  <files>src/features/communication/ui/reminders-dispatch-section.tsx, src/app/[locale]/(dashboard)/communication/reminders/page.tsx, src/app/[locale]/(dashboard)/communication/templates/page.tsx, src/app/api/communication/send/route.ts</files>
  <action>
    Build Flagged Reminders page displaying students with overdue fees or unexcused absences, one-click "Send SMS Reminders" trigger, and delivery status log.
  </action>
  <verify>Navigate to /fr/dashboard/communication/reminders and trigger test batch</verify>
  <done>Communication pages & API route active</done>
</task>
