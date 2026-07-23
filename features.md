# Feature Landscape for School Management, LMS, CRM/Leads, and WhatsApp SaaS (Inspired by Top CodeCanyon Scripts)

## Overview

This report synthesizes the feature sets of top‑selling CodeCanyon systems for:

- School Management / School ERP
- Learning Management Systems (LMS)
- CRM / Leads Management
- WhatsApp Business API / WhatsApp CRM SaaS

Representative products include Smart School, InfixEdu, Global Multi School, and eSchool SaaS for school management; Rocket LMS and similar marketplace LMS scripts; Perfex CRM and LeadPro SAAS for CRM/leads; and WhatsApp CRM SaaS tools such as WhatsCRM and Wapi. The goal is to extract the most common, modern, and attractive features you can use when designing a unified platform that combines School ERP, LMS, lead management, and WhatsApp automation.[^1][^2][^3][^4][^5][^6][^7][^8][^9][^10]

Ratings for usefulness and complexity in the following tables are architectural estimates, not empirical market scores. They are based on how consistently features appear across leading products and how difficult they are to implement and operate in a SaaS context.

***

## Scoring Model Used

For each feature, the following scores are used:

- **Usefulness (1–5)**: How critical this feature is to real‑world users and purchasing decisions across popular CodeCanyon scripts (5 = must‑have, 1 = niche).
- **Complexity (1–5)**: Architectural and implementation complexity in a multi‑tenant SaaS (5 = very hard, multi‑service + infra work; 1 = straightforward CRUD + simple UI).

Notes briefly explain why the feature matters, often referencing evidence from leading scripts.

***

## Platform‑Level SaaS Features (Across All Modules)

Top CodeCanyon school ERPs, LMSs, CRMs, and WhatsApp tools are increasingly shipped as multi‑tenant SaaS platforms with super‑admin, plan management, and tenant isolation. They also emphasize billing, localization, responsive dashboards, and extensibility via modules/add‑ons.[^2][^3][^4][^7][^8][^11][^10][^1]

| Feature | Usefulness (1–5) | Complexity (1–5) | Notes |
|--------|------------------|------------------|-------|
| Multi‑tenant architecture (multi‑school / multi‑workspace) | 5 | 5 | Core for selling as SaaS; used by eSchool SaaS, Mighty School, Rocket LMS SaaS packages, WhatsApp CRM SaaS, and Perfex SaaS modules.[^1][^12][^4][^7][^13] |
| Super admin panel with tenant management | 5 | 4 | Central console to manage all schools/organizations, domains, quotas, and billing.[^1][^14][^4][^7] |
| Plan / package management (feature & usage limits) | 5 | 4 | SaaS packages limiting course count, live sessions, students, or WA quota are now standard in LMS and WhatsApp SaaS tools.[^4][^7][^10] |
| Subscription billing & one‑time payments | 5 | 4 | Support recurring subscriptions, one‑time licenses, coupons, and multiple gateways (Stripe, PayPal, local gateways, etc.).[^4][^6] |
| Multi‑currency support | 4 | 3 | Rocket LMS and multi‑school scripts often support multi‑currency for global selling.[^4][^6] |
| Multi‑language & RTL support | 5 | 3 | Top school ERPs and LMSs ship with multilingual and RTL support out of the box.[^3][^4][^6] |
| Role‑based access control (RBAC) & permissions | 5 | 3 | Smart School ships 8+ user roles; Perfex CRM and LMS scripts allow fine‑grained permissions for staff, clients, instructors, agents.[^2][^4][^8][^7] |
| Responsive admin & user dashboards | 5 | 2 | Modern dashboards with KPIs, charts, and real‑time analytics are a key selling point in eSchool SaaS, WhatsApp CRM, and LMS scripts.[^1][^4][^7] |
| Theming (color schemes, dark mode) | 3 | 2 | Many scripts expose theme settings and color presets or multiple frontend themes.[^4][^6][^7] |
| Custom pages & CMS (landing, FAQ, blog) | 4 | 2 | Dynamic landing pages, testimonials, FAQs, and content sections are common in SaaS products and school front‑sites.[^1][^6][^7] |
| Notification center (email/SMS/WhatsApp/push) | 5 | 4 | Central notification engine with templates, logs, and multi‑channel delivery across all modules.[^2][^4][^7] |
| Audit logs & activity history | 4 | 3 | Tracking user actions, logins, and changes is becoming standard in premium LMS and CRM products.[^4][^8] |
| API access & webhooks | 4 | 4 | WhatsApp CRMs and CRMs like Perfex emphasize API access and automation hooks for integrations.[^7][^8][^11] |
| Pluggable module system / add‑ons | 4 | 4 | Perfex CRM has 300+ modules; LMS/ERP scripts offer modules for HR, store, forums, etc., making a modular architecture important.[^8][^11][^4][^2] |
| File storage abstraction (local/S3, limits) | 4 | 3 | Needed for course media, documents, and chat attachments with per‑tenant quotas.[^4][^7] |
| Security hardening (2FA, device limits, IP blocking) | 4 | 4 | Rocket LMS adds device limits and IP/access management; school ERPs add 2FA options for admins.[^4][^1] |

***

## School Management System / School ERP Features

Leading school ERPs such as Smart School, InfixEdu, Global Multi School, Mighty School, and eSchool SaaS provide comprehensive academic, finance, HR, and communication modules from admission to graduation.[^3][^6][^14][^1][^2]

### Core Academic & Student Management

| Feature | Usefulness | Complexity | Notes |
|--------|-----------|-----------|-------|
| Student admission & enrollment workflow | 5 | 3 | End‑to‑end admission, including online forms, document upload, approval, and class assignment is a baseline capability.[^2][^3][^1] |
| Student information system (SIS) & profiles | 5 | 2 | Centralized student profiles with demographics, guardians, history, custom fields (height, weight, photos, etc.).[^3][^2] |
| Multi‑session / academic year & semester management | 5 | 3 | Session‑wise data management, promotion to next session, and session‑aware reports are standard.[^2][^1] |
| Class, section, subject, and timetable management | 5 | 3 | Manage classes/sections, assign teachers, manage subjects, and auto‑generate timetables.[^2][^3][^6] |
| ID card and certificate generation | 4 | 3 | Scripts support configurable ID cards and certificates per class/role.[^3][^6][^1] |
| Student category & grouping (houses, skill‑based, etc.) | 3 | 2 | Grouping by caste, skill, house, or custom categories for reporting and events.[^2][^3] |
| Student history, timeline, and notes | 4 | 2 | InfixEdu adds timeline and history views to track a learner’s lifecycle.[^3] |
| Multi‑child / guardian relationships | 4 | 3 | Single parent account linked to multiple students, staff who are also parents, etc.[^3] |

### Attendance, Exams, and Academics

| Feature | Usefulness | Complexity | Notes |
|--------|-----------|-----------|-------|
| Student attendance (class, day, and subject‑wise) | 5 | 3 | Fast attendance entry with monthly reports per class/section is a key screen.[^2][^3] |
| Staff attendance (with device integration) | 4 | 4 | Attendance devices and timesheets for staff; sometimes integrated with biometric or RFID systems.[^3][^6] |
| Attendance analytics & reports | 4 | 3 | Monthly and yearly views, filters per class/section, exportable reports.[^2][^1] |
| Exam creation, scheduling, and grading | 5 | 4 | Manage offline and online exams, schedules, marks entry, and grading schemes.[^2][^1] |
| Marksheet / progress card & transcript generation | 5 | 3 | Automated report cards with grades, ranks, subject‑wise and yearly views.[^2][^1] |
| Online exams / quizzes | 4 | 4 | Online exam modules with concurrency handling, question banks, and evaluation.[^1][^2] |
| Homework and assignments (with evaluation) | 4 | 3 | Homework modules with submission, file upload, and homework evaluation reports.[^3][^2][^6] |
| Lesson plan module | 3 | 3 | Teachers plan lessons, attach resources, and track completion.[^6] |

### Fees, Finance, and Accounting

| Feature | Usefulness | Complexity | Notes |
|--------|-----------|-----------|-------|
| Flexible fee structures (types, groups, masters) | 5 | 4 | Smart School has advanced fee mechanisms: fee groups, masters, free‑hand fees, due dates, fines, discounts, and multi‑criteria allotment.[^2] |
| Student fee collection with partial payments | 5 | 3 | Partial fee submission, fee receipts, and due fee reports are heavily used.[^2][^1] |
| Online payments in student/parent panel | 5 | 3 | Direct payment from portal or app using gateways like Stripe, Razorpay, local providers.[^3][^1][^6] |
| Fee discounts, waivers, and scholarships | 4 | 3 | Support for discounts and scholarship management modules.[^6][^2] |
| Other income & expense tracking | 4 | 3 | Manage income/expense heads with receipt uploads and finance reports.[^2] |
| Transport and hostel billing integration | 3 | 3 | Auto‑added transport/hostel charges to fee structure based on assignments.[^2][^3] |

### HR, Assets, and Operations

| Feature | Usefulness | Complexity | Notes |
|--------|-----------|-----------|-------|
| Staff/HR management (roles, departments) | 5 | 3 | Manage staff info, roles, departments, and permissions.[^2][^3][^6] |
| Leave management (staff & students) | 4 | 3 | Leave requests, approvals, and session‑wise leave reports.[^2][^3] |
| Payroll & salary slips | 4 | 4 | Configurable payroll with allowances, deductions, and payslip generation. Often a separate module or add‑on.[^3][^8] |
| Library management | 4 | 3 | Books, members, issue/return, and reports.[^2][^3] |
| Transport (vehicles, routes, drivers) | 4 | 3 | Vehicle, route, and driver management with student transport assignments and reports.[^2][^6] |
| Hostel management | 3 | 3 | Hostel, room types, room allocation, and occupant tracking.[^2][^3] |
| Inventory and asset tracking | 3 | 3 | Track assets and consumables, sometimes via dedicated modules.[^3][^6] |

### Communication, Portals, and Front‑Site

| Feature | Usefulness | Complexity | Notes |
|--------|-----------|-----------|-------|
| Student, parent, teacher, and staff portals | 5 | 3 | Smart School ships 8 in‑built users; each role has its own panel.[^2] |
| Notice board & announcements | 5 | 2 | Central notices visible in web and app, plus scheduled announcements.[^1][^2][^6] |
| Internal messaging & chat (with attachments) | 4 | 4 | Role‑based chat system; eSchool SaaS includes notifications for attachments and chat history filters.[^1] |
| Email/SMS gateways integration | 4 | 3 | Multiple SMS gateways and email providers used for notifications.[^6][^2] |
| Front website & CMS (news, events, gallery) | 4 | 2 | Many ERPs bundle a school website with dynamic news/events/gallery and sliders.[^6][^1] |
| Online admission forms on front‑site | 4 | 3 | Embedded admission forms integrated into academic workflows and CRM/leads.[^1][^3] |
| Calendar with events & to‑do | 3 | 2 | Calendar with events, to‑do lists, and drag‑drop event updates.[^3][^1] |

***

## LMS / E‑Learning Features

Marketplace‑style LMS scripts such as Rocket LMS, Mentor LMS, and others on CodeCanyon emphasize course selling, live classes, gamification, marketplaces, and SaaS monetization.[^4][^15][^16][^17]

### Course Authoring and Delivery

| Feature | Usefulness | Complexity | Notes |
|--------|-----------|-----------|-------|
| Course, chapter, and lesson management | 5 | 3 | Hierarchical course structures with sections/chapters and multiple content types.[^4] |
| Support for video, document, and SCORM content | 5 | 4 | Rocket LMS supports SCORM packages, in‑app live classes, and PDF viewers.[^4] |
| Drip content and access period | 5 | 4 | Time‑based content release and course access periods to improve retention and monetization.[^4] |
| Quizzes, assignments, and homework | 5 | 3 | Question banks, quiz attempts, and assignments/homework tied to each course.[^4] |
| Course completion certificates | 5 | 3 | Auto‑generated certificates with dynamic tags and custom templates.[^4] |
| Prerequisites and course requirements | 4 | 3 | Control enrollment based on prerequisites, skill level, or progress in other courses.[^4] |
| Course bundles and packages | 4 | 3 | Sell course bundles as separate products or within subscriptions.[^4] |
| Private/internal courses (B2B LMS) | 4 | 3 | Private mode for internal company/school training, only visible to enrolled users.[^4] |

### Commerce, Monetization, and Marketing

| Feature | Usefulness | Complexity | Notes |
|--------|-----------|-----------|-------|
| One‑time purchase and subscriptions | 5 | 4 | Support for one‑off purchases and unlimited subscription models with recurring billing.[^4] |
| Multi‑currency and multi‑gateway support | 4 | 4 | Rocket LMS exposes numerous gateways including Stripe, Mollie, Klarna, etc.[^4] |
| Coupons, discounts, and cart‑level promotions | 4 | 3 | Cart discounts and coupon codes are used to increase conversion and AOV.[^4] |
| Abandoned cart recovery | 4 | 4 | Automatic reminders and coupons when users abandon carts.[^4] |
| Sales pop‑ups & social proof | 3 | 2 | Real‑time sales notifications shown on the front‑end.[^4] |
| Affiliate/referral program | 4 | 4 | Reward points and affiliate/referral systems for user‑driven growth.[^4] |

### Engagement, Community, and Analytics

| Feature | Usefulness | Complexity | Notes |
|--------|-----------|-----------|-------|
| In‑app live classes & meetings | 5 | 4 | Live sessions (Zoom‑like) with scheduling and reminders.[^4] |
| Forum & community features | 4 | 3 | Global community, course‑level forums, and Q&A boards.[^4] |
| Course discussions & Q&A | 4 | 3 | Threaded Q&A under each lesson/section.[^4] |
| Course notes for learners | 3 | 2 | Learners can store private notes linked to course content.[^4] |
| Tutor/instructor finder | 3 | 3 | Search and match instructors based on subject, rating, or availability.[^4] |
| Gamification (points, badges, rewards) | 4 | 3 | Reward points for purchases, quiz completions, reviews, and referrals.[^4] |
| Learning analytics & course statistics | 5 | 3 | Track enrollments, completion rates, quiz performance, and revenue.[^4] |

### Admin & Site Experience

| Feature | Usefulness | Complexity | Notes |
|--------|-----------|-----------|-------|
| Drag‑and‑drop homepage builder | 4 | 3 | LMS admins can design landing pages with heroes, carousels, and content blocks.[^4] |
| SEO settings per course and page | 4 | 2 | Meta tags, structured data, and slugs for better search visibility.[^4] |
| Mobile‑app‑only mode / PWA | 3 | 3 | Some LMS scripts support modes optimized for mobile‑only usage.[^4] |
| Frontend article/blog submission | 3 | 3 | Users or instructors submit blog posts/articles to build content marketing.[^4] |
| Device limits and session control | 4 | 4 | Restrict simultaneous sessions and monitor IPs, devices, OS, and locations.[^4] |

***

## CRM / Leads Management Features

Perfex CRM and its ecosystem of modules, along with dedicated lead management SaaS tools such as LeadPro SAAS, define the dominant pattern for self‑hosted CRM and lead platforms on CodeCanyon.[^8][^11][^18][^9][^19]

### Leads, Contacts, and Pipelines

| Feature | Usefulness | Complexity | Notes |
|--------|-----------|-----------|-------|
| Lead capture and central repository | 5 | 3 | Centralize leads from multiple sources (forms, calls, imports) into one database, as LeadPro emphasizes.[^9] |
| Lead pipelines with stages & Kanban view | 5 | 3 | Visual pipelines to track deals through stages are central to Perfex and similar CRMs.[^8] |
| Lead scoring and prioritization | 4 | 3 | Score leads based on activity and attributes; often available via add‑ons or custom workflows.[^11][^8] |
| Contacts & organizations (B2B accounts) | 5 | 2 | Maintain clients and companies with full history and segmentation.[^8] |
| Lead logs, notes, and activities | 5 | 2 | Log calls, emails, meetings, and notes (LeadPro mentions lead logs and notes explicitly).[^9][^8] |
| Dynamic/embedded lead forms & landing pages | 4 | 3 | Dynamic form builders and embedded forms are common modules in Perfex and lead tools.[^11][^9] |

### Sales, Projects, and Customer Operations

| Feature | Usefulness | Complexity | Notes |
|--------|-----------|-----------|-------|
| Deals / opportunities with value & forecast | 5 | 3 | Track opportunities with estimated values, close probability, and expected close dates.[^8] |
| Estimates, proposals, and contract management | 4 | 3 | Perfex CRM emphasizes proposals, contracts, and client approvals.[^8] |
| Invoicing, payments, and revenue tracking | 5 | 4 | Full invoicing, payment tracking, and revenue reports in Perfex CRM.[^8] |
| Project & task management | 4 | 3 | RISE and Perfex bundle project tracking with tasks, milestones, and timesheets.[^8][^20] |
| Client portal for project and billing | 4 | 3 | Secure client portal for tracking projects, invoices, and support tickets.[^8] |
| Ticketing & support management | 4 | 3 | Support tickets with SLA‑like workflows integrated into CRM.[^8] |

### Automation, Campaigns, and Analytics

| Feature | Usefulness | Complexity | Notes |
|--------|-----------|-----------|-------|
| Email templates and campaigns | 4 | 3 | LeadPro features email templates; Perfex supports email automation and webmail modules.[^9][^11] |
| Workflow automation & triggers | 4 | 4 | Modules for automated follow‑ups, task creation, and outreach based on lead status.[^11][^8] |
| Call center / telephony integration | 3 | 4 | LeadPro SAAS bundles call center capabilities for handling sales calls.[^9] |
| Dashboards & sales analytics | 5 | 3 | KPIs for leads, conversion, revenue, and pipeline health are a must for CRMs.[^8][^19] |
| Import/export & CSV mapping tools | 4 | 2 | ImportSync and similar modules simplify bulk data operations.[^11] |
| Permissions, roles, and team quotas | 4 | 3 | Role‑based access and sales targets per team/person.[^8] |

### Modern/Advanced CRM Capabilities

| Feature | Usefulness | Complexity | Notes |
|--------|-----------|-----------|-------|
| AI assistants for email, notes, and insights | 4 | 4 | MailboxAI and OpenAI Agents & Workflows modules enhance Perfex with AI for email and automation.[^11] |
| Predictive analytics and forecasting | 3 | 4 | Modules like PrediX provide predictive analytics for CRM data.[^11] |
| HRM inside CRM (attendance, payroll via modules) | 3 | 4 | Perfex HRM add‑ons add attendance, leave, payroll, and performance on top of CRM.[^8][^11] |

***

## WhatsApp Business API / WhatsApp CRM SaaS Features

WhatsApp SaaS tools on CodeCanyon (WhatsCRM, Wapi, WhatsML, etc.) combine WhatsApp Cloud API, CRM, chatbot flow builders, and automation.[^5][^7][^21][^10]

### Messaging Core and Inbox

| Feature | Usefulness | Complexity | Notes |
|--------|-----------|-----------|-------|
| Connection to official WhatsApp Cloud API | 5 | 4 | Core requirement; WhatsCRM and similar tools explicitly use Meta’s Cloud API as a paid backend.[^7][^5] |
| Multi‑number / multi‑tenant WhatsApp accounts | 5 | 4 | Allow multiple WA numbers per tenant and isolation per workspace/tenant.[^7][^10] |
| Advanced shared inbox | 5 | 4 | Inbox for managing chats, labels, and client data across agents.[^7] |
| Message status tracking (delivered, seen, failed) | 4 | 3 | Track delivery and read status for compliance and debugging.[^7] |
| Agent assignment and ticketing | 4 | 3 | Assign chats/tickets to agents with SLA‑like behavior.[^7] |
| Contact/phonebook management with labels/tags | 5 | 2 | Central contact storage with tags used for campaigns.[^7] |

### Chatbot, Automation, and Campaigns

| Feature | Usefulness | Complexity | Notes |
|--------|-----------|-----------|-------|
| Visual drag‑and‑drop chatbot flow builder | 5 | 4 | WhatsCRM and Wapi highlight graphical chatbot builders for flows and decision trees.[^7][^5][^10] |
| Automated chatbot for FAQs and workflows | 5 | 4 | Automated replies, menus, and flows reduce human workload.[^7][^5] |
| WhatsApp broadcasting (bulk sender) | 5 | 4 | Bulk campaign sending with metrics is a core selling point for WhatsApp SaaS scripts.[^7][^21] |
| Broadcast and campaign analytics | 4 | 3 | Track sent, delivered, read, and response metrics per broadcast.[^7][^10] |
| Template management & API send templates | 4 | 3 | Manage WhatsApp message templates and trigger them via API.[^7] |
| Automation triggers (webhooks, events) | 4 | 4 | Trigger flows or campaigns from external events or CRM actions via API/webhooks.[^7][^8] |
| Quick replies and canned responses | 4 | 2 | Agent‑friendly canned replies and shortcuts.[^7] |

### SaaS, Integration, and UX

| Feature | Usefulness | Complexity | Notes |
|--------|-----------|-----------|-------|
| SaaS multi‑tenant backend (Node/React/Laravel, etc.) | 5 | 5 | WhatsCRM is SaaS‑ready with multi‑tenant architecture and plan management.[^7][^10] |
| Plan management (message quota, chatbot limits) | 5 | 4 | WhatsApp SaaS scripts use plans to cap channels, chatbots, or monthly messages.[^7][^10] |
| Social login and SSO | 3 | 3 | Social login options are used in newer updates for UX and onboarding speed.[^7] |
| Theme/color customization | 3 | 2 | Theme settings for user panel and frontend marketing site.[^7] |
| Dynamic chat widget for websites | 4 | 3 | Embeddable widget that connects website visitors to WhatsApp.[^7] |
| API access for custom integrations | 5 | 4 | Exposed API endpoints to send messages and integrate WA with external systems.[^7][^5] |

### AI and Modern Enhancements (WhatsApp + CRM)

| Feature | Usefulness | Complexity | Notes |
|--------|-----------|-----------|-------|
| AI‑powered replies and chatbots | 4 | 5 | Many scripts offer or plan AI plug‑ins (WhatsCRM lists AI plugin separately; Perfex has OpenAI modules).[^7][^11] |
| AI‑generated campaigns and templates | 3 | 4 | Use LLMs to suggest message copy, flows, or templates from campaign goals.[^11] |
| Unified omnichannel view (WA + email + web chat) | 4 | 5 | Some CRM SaaS tools (LivaChat, etc.) combine multiple channels in one panel.[^10] |

***

## Cross‑Module "Modern & Attractive" Features to Prioritize

Across all these ecosystems, a set of higher‑level patterns appears repeatedly in the latest updates and premium add‑ons.[^7][^11][^1][^4][^8]

- **SaaS monetization & packaging**: Multi‑tenant, plan‑based access, feature gating, and per‑tenant limits on students, leads, courses, WA messages, or agents.
- **Deep analytics and reporting**: School‑wide analytics, learning analytics, CRM dashboards, WA campaign stats, and device/IP‑level security analytics.
- **Automation & workflows**: Triggers and rules across ERP, LMS, CRM, and WA for things like fee reminders, enrollment messages, lead follow‑up sequences, and cart recovery.
- **AI add‑ons**: AI content generation (course descriptions, SEO text, proposals), AI assistants for email and CRM, predictive analytics modules, and AI‑augmented chatbots.[^11][^4][^7]
- **Rich communication stack**: Email, SMS, in‑app notifications, and WhatsApp all connected via a unified template and notification system.
- **Customization tooling**: Form builders, page builders, custom fields, and drag‑and‑drop UIs for non‑technical admins to tailor the system.[^1][^4][^11]
- **Security & compliance**: Device limits, IP restrictions, data deletion requests (GDPR), audit logs, and 2FA for admins and staff.[^4][^1]

Designing your platform around these cross‑cutting capabilities will help you match and exceed the most modern CodeCanyon products while keeping a coherent architecture that supports School ERP, LMS, CRM, and WhatsApp automation in a single ecosystem.

---

## References

1. [eSchool SaaS – School Management System with Student/Parent ...](https://codecanyon.net/item/eschool-saas-school-management-system-with-student-parents-teacher-flutter-app-laravel-admin/49307764)

2. [Smart School : School Management System by QDOCS | CodeCanyon](https://codecanyon.net/item/smart-school-school-management-system/19426018) - Avis

3. [InfixEdu School ERP - Online School Management System Software](https://codecanyon.net/item/infix-school-academic-management-system/23876323)

4. [Rocket LMS - Learning Management System - CodeCanyon](https://codecanyon.net/item/rocket-lms-learning-management-academy-script/33120735) - Avis

5. [Whatsapp Cloud Api Saas Plugins, Code & Scripts | CodeCanyon](https://codecanyon.net/search/whatsapp%20cloud%20api%20saas) - Get 15 whatsapp cloud api saas plugins, code & scripts on CodeCanyon such as Wapi – WhatsApp CRM Saa...

6. [Global - Multi School Management System Express - CodeCanyon](https://codecanyon.net/item/global-multi-school-management-system-express/21975378) - Avis

7. [Chatbot, Flow Builder, API Access, WhatsApp CRM SAAS System](https://codecanyon.net/item/whatscrm-chatbot-flow-builder-api-access-whatsapp-crm-saas-system/51122205) - User Panel Features · Dashboard with quick overview and analytics · Advanced inbox to manage chats, ...

8. [Most Popular CRM Script on CodeCanyon – Perfex CRM](https://codesforest.in/blog/articles/most-popular-crm-script-on-codecanyon-perfex-crm) - Perfex CRM is the most popular CodeCanyon CRM script for managing leads, projects, invoices, HR, and...

9. [LeadPro SAAS - Lead & Call Center Management CRM by codeifly](https://codecanyon.net/item/leadpro-saas-lead-call-center-management-crm/48075171) - LeadPro is a lead and call center CRM designed to help businesses for managing and track their sales...

10. [CRM Saas Plugins, Code & Scripts | CodeCanyon](https://codecanyon.net/search/crm%20saas) - Get 161 CRM saas plugins, code & scripts on CodeCanyon such as Wapi – WhatsApp CRM SaaS with Chatbot...

11. [Perfex Client Plugins, Code & Scripts | CodeCanyon](https://codecanyon.net/search/perfex%20client) - Get 91 perfex client plugins, code & scripts on CodeCanyon such as Mailbox - Webmail Client & Email ...

12. [School Management System Saas Plugins, Code & Scripts](https://codecanyon.net/search/school%20management%20system%20saas) - Get 17 school management system saas plugins, code & scripts on CodeCanyon such as Ekattor 8 Laravel...

13. [Transform Your Perfex CRM into a Powerful Multi-Tenancy Solution](https://code-canyon.com/product/perfex-crm-saas-module-transform-your-perfex-crm-into-a-powerful-multi-tenancy-solution-official-licence/) - Key Features of the Perfex CRM SaaS Module. 1. User-Friendly Interface: The Perfex CRM SaaS Module r...

14. [School Management System (ERP, Multi-Branch, SaaS) by Fuedevs](https://codecanyon.net/item/mighty-school-pro-school-management-system-erp-multibranch-saas-all-in-one/57385565) - Avis

15. [Lms Marketplace PHP Scripts - CodeCanyon](https://codecanyon.net/category/php-scripts?term=lms+marketplace) - Get 12 lms marketplace PHP scripts on CodeCanyon such as Lara LMS - Online Course Selling Marketplac...

16. [Lms PHP Scripts | CodeCanyon](https://codecanyon.net/category/php-scripts?term=lms) - Get 167 lms PHP scripts on CodeCanyon such as Mentor LMS - Learning Management System, Rocket LMS - ...

17. [Learning Management System PHP Scripts | CodeCanyon](https://codecanyon.net/category/php-scripts?term=learning+management+system) - Get 133 learning management system PHP scripts on CodeCanyon such as Mentor LMS - Learning Managemen...

18. [Lead Management Saas PHP Scripts | CodeCanyon](https://codecanyon.net/category/php-scripts?term=lead+management+saas) - Get 6 lead management saas PHP scripts on CodeCanyon such as LeadPro SAAS - Lead & Call Center Manag...

19. [CRM Saas PHP Scripts - CodeCanyon](https://codecanyon.net/category/php-scripts?term=crm+saas) - Get 108 CRM saas PHP scripts on CodeCanyon such as Grow CRM SaaS ... LeadPro SAAS - Lead & Call Cent...

20. [Rise CRM PHP Project Management Tool - CodeCanyon](https://codecanyon.net/category/php-scripts/project-management-tools?term=rise+crm) - Get 1 rise CRM PHP project management tool on CodeCanyon such as RISE - Ultimate Project Manager & C...

21. [Whatsapp Saas PHP Scripts - CodeCanyon](https://codecanyon.net/category/php-scripts?term=whatsapp+saas) - Get 53 whatsapp saas PHP scripts on CodeCanyon such as WhatsML – AI-Based Marketing & Chat Automatio...

