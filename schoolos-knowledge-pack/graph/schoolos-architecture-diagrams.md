# 🗺️ SchoolOS Architectural & Relational Diagrams

This document contains Mermaid diagrams illustrating the core workflows, security pipelines, and subsystem relationships in SchoolOS.

---

## 1. High-Level Subsystem Topology

```mermaid
graph TD
    classDef core fill:#2487B8,stroke:#1B6C93,stroke-width:2px,color:#fff;
    classDef tenant fill:#059669,stroke:#047857,stroke-width:2px,color:#fff;
    classDef ext fill:#D97706,stroke:#B45309,stroke-width:2px,color:#fff;

    SA["Super Admin Platform"]:::core
    T["Tenant (School / Centre)"]:::tenant

    SA -->|Provisions & Subscriptions| T

    subgraph "Core Subsystems (Single PostgreSQL partitioned by tenant_id)"
        ACAD["Academics & Timetable"]:::tenant
        ASSESS["Assessment & /20 Grades"]:::tenant
        STUD["Students & Admissions"]:::tenant
        PAR["Parents & Guardians"]:::tenant
        FIN["Finance & Cashier POS"]:::tenant
        HR["HR & Staff Registry"]:::tenant
        WF["Workforce & Moroccan Payroll"]:::tenant
        COMM["Broadcast & Reminders"]:::tenant
        TRANS["Transport & Fleet"]:::tenant
        DOC["Document Studio & Seal"]:::tenant
    end

    T --> ACAD
    T --> ASSESS
    T --> STUD
    T --> PAR
    T --> FIN
    T --> HR
    T --> WF
    T --> COMM
    T --> TRANS
    T --> DOC

    subgraph "External Integrations"
        WAHA["WhatsApp WAHA Engine"]:::ext
        SMS["Moroccan Telcos (GSM-7)"]:::ext
        MASSAR["Massar (MEN)"]:::ext
        CMI["CMI / Stripe Gateway"]:::ext
        CAD["Caddy Reverse Proxy"]:::ext
    end

    COMM -->|Multi-Session API| WAHA
    COMM -->|GSM-7 Segments| SMS
    ACAD -->|Roster & Grade Sync| MASSAR
    FIN -->|Card Webhooks| CMI
    CAD -->|SSL & Routing| T
```

---

## 2. Multi-Tenant Request Context Pipeline

```mermaid
sequenceDiagram
    autonumber
    actor Client as Browser Client / Portal
    participant MW as Middleware & Auth Context
    participant Guard as Zod Strict & Capability Check
    participant DB as Drizzle ORM (PostgreSQL)
    participant Audit as Law 09-08 Audit Trail

    Client->>MW: HTTP Request + Bearer Token / Cookie
    MW->>MW: requireRequestContext(req, [roles])
    MW->>MW: requireTenant(ctx) -> Resolves ctx.tenantId
    MW->>Guard: requireCapability(ctx, 'permission')
    Guard->>Guard: Zod schema.strict().parse(body)
    Guard->>DB: execute query with eq(table.tenantId, ctx.tenantId)
    DB-->>Guard: Tenant-isolated rows
    Guard->>Audit: recordAudit(context, action, entity, id)
    Audit-->>Client: HTTP 200 JSON Response
```

---

## 3. WhatsApp Multi-Session & Meta Anti-Ban Engine

```mermaid
flowchart TD
    Start["School Triggers Reminder Dispatch"] --> CheckChannel{"Selected Channel?"}
    
    CheckChannel -->|SMS Direct| SMSGateway["Send via Moroccan GSM-7 SMS Direct"]
    CheckChannel -->|Simulation| LogOnly["Record in Internal Simulation Journal"]
    CheckChannel -->|WhatsApp| QuotaCheck["Fetch WhatsApp Quota for Tenant"]

    QuotaCheck --> CheckRemaining{"remainingToday >= recipientCount?"}
    CheckRemaining -->|No: Quota Exceeded| Barrier["Show Red Safety Barrier & Disable Send Button (HTTP 429)"]
    CheckRemaining -->|Yes: Quota OK| Loop["Iterate Recipients with 1,200ms Pacing Delay"]

    Loop --> ResolveSession["Resolve Dedicated Session: tenant_{tenantId}"]
    ResolveSession --> SendWAHA["POST /api/sendText on WAHA Container"]
    SendWAHA --> RecordMsg["Record in sms_messages & Increment Daily Counter"]
    RecordMsg --> Done["Update Live Quota in UI"]
```

---

## 4. Moroccan /20 Grading & Exam Term Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Draft: Administrator Creates Exam Term (e.g. 1er Semestre)
    Draft --> Open: Term Opened for Marks Entry
    
    state Open {
        [*] --> Entry: Teachers Enter /20 Grades in Marksheet Grid
        Entry --> AutoCalc: Live Recalculation with Subject Coefficients
        AutoCalc --> Rank: Compute Class Rank & Weighted Average
    }
    
    Open --> Locked: Grades Entry Locked for Inspection
    Locked --> Open: Re-opened for Corrections
    Locked --> Published: Administration Approves Report Cards
    Published --> Bulletins: Official Bulletins Scolaires Generated with School Seal
    Published --> [*]
```

---

## 5. Moroccan Statutory Payroll Calculation Flow

```mermaid
flowchart TD
    A["Base Salary + Allowances"] --> B["Gross Salary (Salaire Brut)"]
    
    B --> C["CNSS Calculation"]
    C -->|Dahir n° 1-72-184| C1["Cap at 6 000 DH/month * 4.48% (Max: 268.80 DH)"]
    
    B --> D["AMO Calculation"]
    D -->|Without Ceiling| D1["Gross * 2.26%"]
    
    B --> E["Net Taxable Salary (SBI)"]
    E --> F["Professional Expenses Abatement (35% capped)"]
    F --> G["Net Imposable Salary (SNI)"]
    G --> H["Apply Progressive Moroccan IR Brackets (0% to 38%)"]
    H --> I["Deduct Moroccan Family Dependent Abatement (30 DH/dependent, max 6)"]
    I --> J["Net IR Tax Withholding"]
    
    B --> K["Net Payable Calculation"]
    C1 --> K
    D1 --> K
    J --> K
    K --> L["Deduct Advances (Avances sur salaire)"]
    L --> M["Final Net Salary (Salaire Net à Payer)"]
    M --> N["Generate Official Bulletins de Paie + Bank RIB Transfer File"]
```
