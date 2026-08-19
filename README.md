# 🛡️ SatyaShield

### Privacy-First Anti-Dowry Reporting & Case Coordination Platform

> **Report safely. Protect evidence. Coordinate responsibly.**

SatyaShield is a full-stack MERN platform designed to demonstrate how sensitive dowry-harassment complaints can be reported and managed while collecting as little personal identity information as possible.

Instead of creating a normal user account with a name, phone number, email, and profile, a reporter can create a complaint and receive a **private Case ID and Access Secret**.

That private case can then move through a controlled workflow involving:

**Reporter → Safety Triage → NGO → Investigator → Admin → Case Resolution**

SatyaShield also includes private evidence handling, role-based case access, real-time case communication, NGO routing, human-reviewed safety triage, internal escalation, SOS workflows, audit logging, bilingual support, and strong authentication for staff.

---

> [!CAUTION]
>
> ## 🚨 IMPORTANT NOTICE
>
> **SatyaShield is currently a demonstration and internal-evaluation project.**
>
> 🔴 **DO NOT use the public deployment for real complaints, emergencies, police assistance, ambulance dispatch, legal advice, or time-sensitive safety situations.**
>
> The current public version does **not** contact police, emergency responders, ambulances, public helplines, or real NGOs.
>
> A real-world deployment would require verified partner organizations, legal review, independent security audits, production monitoring, secure evidence storage, malware scanning, reliable notification providers, trained operators, and approved emergency-response procedures.

---

# 🌐 Live Application

### Web Application

**https://satya-shield-client.vercel.app/**

### GitHub Repository

**https://github.com/bharshit63880/SatyaShield**

### Backend API

**https://satyashield-api.onrender.com**

> The backend currently uses Render's free service tier. The first request after an idle period may take around 30–60 seconds.

---

# 💡 The Idea Behind SatyaShield

Most complaint systems begin with identity.

A user is usually asked to provide:

```text
Name
Email
Phone Number
Address
Password
Personal Profile
```

For a sensitive complaint, collecting all of this information may create additional privacy risk.

SatyaShield takes a different approach.

```text
Traditional Platform

User
  │
  ▼
Create Account
  │
  ├── Name
  ├── Email
  ├── Phone
  ├── Address
  └── Password
  │
  ▼
Submit Complaint
```

SatyaShield uses a case-first approach:

```text
SatyaShield

Reporter
   │
   ▼
Submit Complaint
   │
   ▼
Receive
Case ID + Private Access Secret
   │
   ▼
Access Only That Case
```

The reporter does not need a traditional identity-linked account for normal case access.

The goal is simple:

> **Collect only what is needed to operate the case, and give every participant only the access they actually need.**

---

# 🎯 What Problem Does SatyaShield Solve?

A person reporting dowry harassment may have several concerns:

* What if my identity is exposed?
* Who can read my complaint?
* Can another NGO see my case?
* Can an investigator access every complaint?
* Are my uploaded screenshots public?
* What happens if an NGO cannot handle my case?
* What if my risk level becomes critical?
* Can someone access another case by changing the URL?
* What happens if an employee account is compromised?
* What if someone near me suddenly checks my device?
* Does pressing SOS automatically contact police?

SatyaShield is designed around these questions.

Its architecture focuses on:

**Privacy + Least Privilege + Human Oversight + Secure Evidence + Controlled Coordination**

---

# 👥 Main Users

SatyaShield has several clearly separated roles.

| Role             | Main Responsibility                                |
| ---------------- | -------------------------------------------------- |
| Reporter         | Create and privately access a complaint            |
| NGO Staff        | Support acknowledged and assigned cases            |
| Investigator     | Work only on specifically assigned cases           |
| Admin            | Manage routing, assignments, triage and SOS queues |
| Superadmin       | Handle the most sensitive administrative actions   |
| System Scheduler | Run deadlines, retries and internal escalations    |

---

# 🔄 Complete Platform Flow

```text
                         ┌──────────────────────┐
                         │      REPORTER        │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │ Identity-Minimized   │
                         │ Complaint Form       │
                         └──────────┬───────────┘
                                    │
                     ┌──────────────┴──────────────┐
                     │                             │
                     ▼                             ▼
            Structured Safety               Optional Evidence
                 Answers                         Upload
                     │                             │
                     └──────────────┬──────────────┘
                                    ▼
                         ┌──────────────────────┐
                         │    CASE CREATED      │
                         │                      │
                         │ Case ID              │
                         │ + Access Secret      │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │ Deterministic Safety │
                         │      Triage          │
                         └──────────┬───────────┘
                                    │
                  ┌─────────────────┼──────────────────┐
                  │                 │                  │
                  ▼                 ▼                  ▼
              Standard            High             Critical
                  │                 │                  │
                  └─────────────────┴──────────┬───────┘
                                               │
                                               ▼
                                     Human Review Controls
                                               │
                                               ▼
                                     ┌─────────────────┐
                                     │   NGO ROUTING   │
                                     └────────┬────────┘
                                              │
                              ┌───────────────┴──────────────┐
                              │                              │
                              ▼                              ▼
                         NGO Accepts                    NGO Declines
                              │                              │
                              ▼                              ▼
                        Case Access                    Reassignment
                              │
                              ▼
                    ┌───────────────────┐
                    │ Case Coordination │
                    └─────────┬─────────┘
                              │
                 ┌────────────┼────────────┐
                 │            │            │
                 ▼            ▼            ▼
             Evidence       Chat      Investigator
              Review                     Assignment
                 │            │            │
                 └────────────┼────────────┘
                              ▼
                    Human Case Management
                              │
                     ┌────────┴─────────┐
                     │                  │
                     ▼                  ▼
                 Escalation        Internal SOS
                     │                  │
                     └────────┬─────────┘
                              ▼
                       Admin Oversight
```

---

# 📝 1. Identity-Minimized Complaint Reporting

A reporter can submit a complaint without being forced to create a traditional identity profile.

The public complaint form is designed to avoid requesting unnecessary information such as:

```text
Full Name        ✕
Phone Number     ✕
Email Address    ✕
Exact Address    ✕
Exact GPS        ✕
```

Instead, the platform can collect information required for the workflow, such as:

```text
Complaint Narrative
Safety Answers
State / District
Harassment Category
Consent Information
Optional Evidence
```

Example:

```text
District: Jhansi

Type:
✓ Financial Demand
✓ Threats
✓ Verbal Harassment

Immediate Safety Concern:
Yes

Children Involved:
Yes

Description:
"After marriage, repeated financial demands..."
```

This follows the principle of **data minimization**.

---

# 🔑 2. Private Case Access

After a complaint is successfully created, the reporter receives:

```text
CASE ID

+

PRIVATE ACCESS SECRET
```

Example:

```text
Case ID:
SATYA-8K2X91

Access Secret:
••••••••••••••
```

The secret is shown to the reporter and should be stored safely.

SatyaShield does not need to store the reusable raw secret.

Instead:

```text
Access Secret
      │
      ▼
Cryptographic Processing
      │
      ▼
Keyed Hash
      │
      ▼
MongoDB
```

Later:

```text
Case ID + Secret
        │
        ▼
Authentication
        │
        ▼
Short-Lived Case Token
        │
        ▼
ONLY THAT COMPLAINT
```

This creates **complaint-scoped authentication**.

---

# 🔐 Reporter Access Model

```text
Reporter A
    │
    ├────────────► Case A  ✓
    │
    ├────────────► Case B  ✕
    │
    └────────────► Admin   ✕
```

Possessing access to one complaint does not provide access to another complaint.

---

# ⚠️ 3. Structured Safety Triage

SatyaShield does not rely on external AI to decide whether a person is in danger.

Instead, it uses structured safety answers and explicit deterministic rules.

Example:

```text
Physical violence?       YES
Immediate threat?        YES
Forced confinement?      YES
Weapon involved?         NO
Children at risk?        NO
```

The rule engine can create an assessment such as:

```text
STANDARD
MEDIUM
HIGH
CRITICAL
```

Architecture:

```text
Structured Questions
        │
        ▼
Validated Answers
        │
        ▼
Deterministic Rules
        │
        ▼
Safety Assessment
        │
        ▼
Human Review
```

This is intentionally different from:

```text
Complaint Text
      │
      ▼
External AI
      │
      ▼
"Risk = 87%"
```

External AI scoring is not required for safety decisions.

---

# 👨‍⚖️ Human-in-the-Loop Safety

A Critical assessment does **not** automatically:

```text
Call Police
Dispatch Ambulance
Contact Emergency Services
Declare Someone Guilty
```

Instead:

```text
Critical Assessment
        │
        ▼
Protected Review Queue
        │
        ▼
Authorized Human Review
        │
        ▼
Controlled Decision
```

High-impact decisions remain under human oversight.

---

# 📜 Immutable Assessment History

Safety assessments should not silently overwrite previous decisions.

Example:

```text
10:00 AM
Risk → HIGH

10:20 AM
Reviewer → HIGH CONFIRMED

12:30 PM
New Safety Information

12:31 PM
Risk → CRITICAL
```

The system can preserve assessment history so authorized staff can understand how a case changed over time.

---

# 🏢 4. NGO Routing

A complaint should not simply be sent to a random organization.

SatyaShield models NGO routing using information such as:

```text
Verification Status
Coverage Area
Capabilities
Current Capacity
Assignment State
Acknowledgement State
```

Example:

```text
Complaint

District:
Jhansi

Needs:
Domestic Violence Support
Legal Guidance
Safety Support
```

### NGO A

```text
Verified: YES
Coverage: Delhi

Result: Not Suitable
```

### NGO B

```text
Verified: YES
Coverage: Jhansi
Capacity: FULL

Result: Currently Unavailable
```

### NGO C

```text
Verified: YES
Coverage: Jhansi

Capabilities:
✓ Domestic Violence
✓ Legal Support

Capacity:
AVAILABLE

Result:
Potential Match
```

---

# 🕶️ Privacy-Preserving NGO Preview

An NGO should not receive every private detail just because a case may be assigned to it.

Before acknowledgement, the platform can expose a minimized assignment preview.

Example:

```text
Region:
Jhansi

Priority:
High

Support Required:
Legal + Safety

Full Evidence:
HIDDEN

Private Chat:
HIDDEN

Sensitive Case Information:
HIDDEN
```

After the NGO accepts and acknowledges the assignment:

```text
NGO
 │
 ▼
Assignment Verified
 │
 ▼
Acknowledgement Verified
 │
 ▼
Authorized Case Access
```

---

# 🔄 NGO Reassignment

If an NGO:

* Declines the case
* Has no capacity
* Loses verification
* Is removed from the case
* Cannot continue support

the case can be reassigned.

```text
NGO A
  │
  ▼
Assigned
  │
  ▼
Unable to Continue
  │
  ▼
Assignment Withdrawn
  │
  ├────────► NGO A Access Revoked
  │
  ▼
Reassignment
  │
  ▼
NGO B
```

The previous organization should not keep access simply because it had access earlier.

---

# 🔎 5. Investigator Workflow

Investigators are separate from NGOs.

An Admin can assign an investigator when additional case review is required.

```text
Complaint
    │
    ▼
NGO Coordination
    │
    ▼
Investigation Required
    │
    ▼
Admin
    │
    ▼
Assign Investigator
    │
    ▼
Investigator Gets
Exact Case Access
```

An investigator should not automatically receive access to every complaint.

---

# 🧱 6. Exact-Resource Authorization

SatyaShield does not treat a role as unlimited permission.

Bad authorization:

```text
User is Investigator?

YES

Allow every complaint.
```

SatyaShield follows a stricter model:

```text
Is Investigator?
      │
      ▼
Is Investigator Assigned
To THIS Complaint?
      │
      ├── NO ──► DENY
      │
      └── YES ─► ALLOW
```

Example:

```text
Investigator #21

Assigned:
Case 100

Case 100 → ✓

Case 101 → ✕

Case 102 → ✕
```

Changing a complaint ID in the browser should not bypass this protection.

Authorization is enforced by the server.

Frontend route protection is only an additional user-interface layer.

---

# 🛡️ Authorization Model

```text
                         ┌───────────────┐
                         │   RESOURCE    │
                         │  Complaint A  │
                         └───────┬───────┘
                                 │
                                 ▼
                         Authentication
                                 │
                                 ▼
                          Role Validation
                                 │
                                 ▼
                       Exact Assignment Check
                                 │
                  ┌──────────────┴──────────────┐
                  │                             │
                Valid                         Invalid
                  │                             │
                  ▼                             ▼
               ALLOW                          DENY
```

---

# 📂 7. Private Evidence Vault

Evidence in a sensitive complaint system should not behave like a normal public file upload.

A basic application may do this:

```text
Upload
   │
   ▼
/public/uploads/file.jpg
   │
   ▼
Public URL
```

SatyaShield follows a private evidence model.

```text
Reporter
   │
   ▼
Upload Evidence
   │
   ▼
File Validation
   │
   ▼
Metadata Minimization
   │
   ▼
Authenticated Encryption
   │
   ▼
Private Storage
   │
   ▼
Evidence State
   │
   ▼
Authorization Check
   │
   ▼
Authorized Access
   │
   ▼
Audit Event
```

---

# 📦 Evidence Lifecycle

Evidence can have different states.

```text
              ┌─────────┐
              │ Pending │
              └────┬────┘
                   │
          ┌────────┴─────────┐
          │                  │
          ▼                  ▼
      Available          Rejected
          │
          ▼
Authorized Download
```

Other protected states may include:

```text
Quarantined
Missing
Unavailable
Pending
Rejected
```

Evidence that is not in a safe available state should fail closed.

```text
Evidence Safe?
     │
 ┌───┴────┐
 │        │
YES       NO
 │        │
 ▼        ▼
Auth     DENY
Check
 │
 ▼
Download
```

---

# 💬 8. Real-Time Case Communication

SatyaShield includes complaint-scoped real-time communication using Socket.IO.

The goal is not to build another general chat application.

The chat exists **inside the case workflow**.

```text
                    Complaint #A

                        │
          ┌─────────────┼─────────────┐
          │             │             │
          ▼             ▼             ▼
      Reporter         NGO       Investigator
          │             │             │
          └─────────────┼─────────────┘
                        │
                        ▼
                  Case Chat Room
```

A participant from Complaint B cannot automatically enter Complaint A.

---

# 🔌 Live Access Revocation

Realtime access is not treated as permanent after the socket connects.

Example:

```text
NGO A
 │
 ▼
Connected to Case Socket
 │
 ▼
Admin Reassigns Case
 │
 ▼
NGO A Assignment Removed
 │
 ▼
Authorization Rechecked
 │
 ▼
Socket Access Revoked
```

This reduces the risk of stale realtime permissions.

---

# 🔒 Chat Security

Current chat design provides:

```text
Encryption in Transit     ✓
Protected Server Storage  ✓
Complaint Authorization   ✓
End-to-End Encryption     ✕
```

SatyaShield does **not** claim that the current chat is end-to-end encrypted.

---

# 👨‍💼 9. Admin Workspace

Admin is not simply a dashboard viewer.

The Admin role coordinates sensitive operational workflows.

Typical Admin responsibilities include:

```text
NGO Review
NGO Routing
Case Reassignment
Investigator Assignment
Triage Review
Escalation Queue
SOS Queue
Access Revocation
Operational Oversight
```

---

# 👑 10. Superadmin

Superadmin exists for the highest-risk administrative actions.

Example responsibilities:

```text
Critical Risk Downgrade
Sensitive Governance Actions
Legal Content Administration
Highest-Level Administrative Control
```

Example:

```text
CRITICAL CASE

Admin
  │
  └── Downgrade → DENIED

Superadmin
  │
  └── Restricted Downgrade → AUTHORIZED
```

---

# 🆘 11. Internal SOS Workflow

SatyaShield contains an **internal SOS workflow**.

```text
SOS
 │
 ├── Police Dispatch      ✕
 ├── Ambulance Dispatch   ✕
 ├── Emergency Call       ✕
 │
 └── Internal Workflow    ✓
```

Flow:

```text
Reporter
   │
   ▼
Press SOS
   │
   ▼
Confirmation
   │
   ▼
Internal SOS Request
   │
   ├──────────────┐
   │              │
   ▼              ▼
No Location    Optional Minimized
                  Location
                      │
                      ▼
               Restricted Storage
   │
   └──────────────┬───────────────
                  ▼
            Admin SOS Queue
```

---

# 📍 Location Privacy

Restricted SOS location should not be:

```text
Publicly Serialized
Placed in Routine Logs
Shown to Every Staff Member
Automatically Shared
```

Access should remain restricted to specifically authorized roles and workflows.

---

# ⚙️ 12. Escalation Engine

```text
Case Assigned
      │
      ▼
Waiting for NGO
Acknowledgement
      │
      ▼
Deadline Reached
      │
      ▼
Escalation Scheduler
      │
      ▼
Internal Action
```

The scheduler design includes:

```text
Deadlines
Scheduler Leasing
Retries
Idempotency
```

---

# 🔔 13. Privacy-Safe Notifications

Notifications should avoid including:

```text
Complaint Narrative
Reporter Secret
Evidence Links
Exact Location
Authentication Credentials
Private Staff Notes
```

A safer notification:

```text
A case assigned to your organization
requires review.

Please sign in to the protected workspace.
```

---

# 📬 Notification Lifecycle

```text
created
   │
   ▼
queued
   │
   ▼
processing
   │
   ▼
provider_accepted
   │
   ├───────────────┐
   │               │
   ▼               ▼
delivered        failed
                   │
                   ▼
             retry_scheduled
                   │
                   ▼
               processing
```

Other possible states:

```text
skipped_not_configured
suppressed
permanently_failed
```

---

# 🚪 14. Quick Exit

Quick Exit can:

```text
Clear in-page reporter state
Close the case socket
Lock related tabs
Broadcast cross-tab lock
Replace the current history entry
```

Architecture:

```text
                 QUICK EXIT
                     │
        ┌────────────┼─────────────┐
        │            │             │
        ▼            ▼             ▼
   Clear State   Close Socket   Cross-Tab Lock
        │            │             │
        └────────────┼─────────────┘
                     ▼
                Safer Exit
```

Quick Exit cannot guarantee removal of:

```text
Browser forensic history
Device logs
ISP records
DNS records
Proxy records
Screenshots
Employer network records
Backups
```

---

# 🔐 15. Staff Authentication

### Reporter

```text
Case ID
+
Access Secret
```

### Staff

```text
Account Credentials
        │
        ▼
Authentication
        │
        ▼
TOTP MFA
        │
        ▼
Access Token
        │
        ▼
Rotating Refresh Session
```

Staff security includes:

* JWT access tokens
* Rotating refresh tokens
* HttpOnly cookies
* CSRF protection
* TOTP MFA
* Recovery codes
* Session revocation
* Token-family reuse detection

---

# 🧬 16. Case Integrity

```text
Complaint
    │
    ▼
Normalized Representation
    │
    ▼
Purpose-Versioned
Keyed HMAC
    │
    ▼
Candidate Lookup
    │
    ▼
Potential Match
    │
    ▼
Internal Review Link
```

A match must not automatically:

```text
Reject Complaint
Hide Complaint
Close Complaint
Downgrade Risk
Change Routing
Revoke Reporter Access
```

---

# 📚 17. Reviewed Safety & Legal Information

Content can include:

* Evidence preservation
* Digital safety
* Complaint process
* Privacy guidance
* NGO support
* General legal information
* Safety resources

Lifecycle:

```text
Draft
  │
  ▼
Under Review
  │
  ▼
Approved
  │
  ▼
Published
  │
  ▼
Review Due
  │
  ├───────────────┐
  ▼               ▼
Updated       Withdrawn
                  │
                  ▼
               Archived
```

---

# 🧾 18. Privacy-Safe Audit Logging

Bad logging:

```text
Reporter Secret
Full Complaint Narrative
Exact Location
Evidence URL
Authentication Token
```

Safer logging:

```text
EVENT:
CASE_ACCESSED

Actor:
NGO_STAFF

Resource:
One-way Case Reference

Result:
AUTHORIZED
```

---

# 🏗️ High-Level System Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                          │
│                                                              │
│  React 18 + Vite + Tailwind CSS + React Router              │
│                                                              │
│  ┌──────────┐ ┌─────────┐ ┌──────────────┐ ┌─────────────┐ │
│  │ Reporter │ │   NGO   │ │ Investigator │ │ Admin/Super │ │
│  └────┬─────┘ └────┬────┘ └──────┬───────┘ └──────┬──────┘ │
└───────┼────────────┼──────────────┼────────────────┼────────┘
        │            │              │                │
        └────────────┴──────────────┴────────────────┘
                             │
                             │ HTTPS
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                        EXPRESS API                           │
│                                                              │
│ Authentication • Authorization • Complaints • NGO Routing   │
│ Investigation • Evidence • Triage • SOS • Notifications     │
│ Audit • Scheduler                                            │
└───────────────┬───────────────────────────┬──────────────────┘
                │                           │
                ▼                           ▼
┌────────────────────────────┐   ┌─────────────────────────────┐
│       MongoDB Atlas        │   │         Socket.IO           │
│                            │   │                             │
│ Complaints                 │   │ Complaint Rooms             │
│ Assignments                │   │ Realtime Chat               │
│ Assessments                │   │ Reconnection                │
│ Staff                      │   │ Live Access Revocation      │
│ Evidence Metadata          │   │                             │
│ Sessions                   │   └─────────────────────────────┘
│ Audit Records              │
│ Notifications              │
└────────────────────────────┘

                │
                ▼

┌──────────────────────────────────────────────────────────────┐
│                    SECURITY SERVICES                         │
│                                                              │
│ JWT • TOTP • AES-GCM • HMAC • scrypt • CSRF                │
│ Refresh Rotation • Access Validation • Redaction            │
└──────────────────────────────────────────────────────────────┘
```

---

# 🌐 Role-Based Access Overview

| Action                       |    Reporter |                     NGO | Investigator |           Admin |      Superadmin |
| ---------------------------- | ----------: | ----------------------: | -----------: | --------------: | --------------: |
| Submit Complaint             |           ✓ |                       ✓ |            ✓ |               ✓ |               ✓ |
| Access Own Case              | Exact Token |                       — |            — |               ✓ |               ✓ |
| Assigned Case                |           — |                       ✓ |            ✓ |               ✓ |               ✓ |
| Evidence Access              |    Own Case | Assigned + Acknowledged |     Assigned |               ✓ |               ✓ |
| Case Chat                    |    Own Case | Assigned + Acknowledged | When Allowed |               ✓ |               ✓ |
| NGO Routing                  |           ✕ |                       ✕ |            ✕ |               ✓ |               ✓ |
| Investigator Assignment      |           ✕ |                       ✕ |            ✕ |               ✓ |               ✓ |
| Triage Review                |           ✕ |                       ✕ | Request Only |               ✓ |               ✓ |
| Critical Downgrade           |           ✕ |                       ✕ |            ✕ |               ✕ |               ✓ |
| SOS Queue                    |           ✕ |                       ✕ |            ✕ |               ✓ |               ✓ |
| Restricted SOS Location      |           ✕ |                       ✕ |            ✕ | Authorized Only | Authorized Only |
| Legal Content Administration |           ✕ |                       ✕ |            ✕ |               ✕ |               ✓ |

---

# 💻 Technology Stack

## Frontend

```text
React 18
Vite
Tailwind CSS
React Router
Socket.IO Client
```

## Backend

```text
Node.js
Express.js
Socket.IO
```

## Database

```text
MongoDB Atlas
Mongoose
```

## Authentication & Security

```text
JWT
Rotating Refresh Tokens
HttpOnly Cookies
CSRF Protection
TOTP MFA
Recovery Codes
AES-GCM
HMAC
scrypt
```

## Testing

```text
Node Test Runner
Playwright
axe-core
```

## Deployment

```text
Frontend → Vercel
Backend → Render
Database → MongoDB Atlas
```

---

# 🧪 Testing

```bash
npm run test:i18n --workspace client

npm test --workspace client

npm run build

npm test --workspace server

npm run test:e2e --workspace client

npm run test:mongodb --workspace server
```

Tests must not contact real NGOs, emergency services, recipients, or public helplines.

---

# 🚀 Local Development

## Requirements

```text
Node.js 20.12+
npm
MongoDB development database
```

Clone:

```bash
git clone https://github.com/bharshit63880/SatyaShield.git

cd SatyaShield

npm install
```

Create environment files:

```powershell
Copy-Item server/.env.example server/.env
Copy-Item client/.env.example client/.env
```

Start:

```bash
npm run dev
```

Local URLs:

```text
Frontend:
http://localhost:5173

Backend:
http://localhost:5000
```

Never commit:

```text
.env files
Database credentials
Deployment credentials
Reporter secrets
JWT secrets
Encryption keys
Reusable access credentials
```

---

# 🚧 Current Public Demo Limitations

Currently:

* No real emergency dispatch is enabled.
* No real NGO response is guaranteed.
* No production helpline integration is published.
* No verified real notification provider is active.
* SOS remains internal.
* Chat is not end-to-end encrypted.
* Evidence remains fail-closed where production scanning/storage is unavailable.
* Realtime deployment currently assumes a single application instance.
* Production legal/privacy review is still required.
* Manual professional accessibility review is still required.
* Complete anonymity is not guaranteed.
* Guaranteed deletion is not promised.
* Message delivery is not guaranteed.
* NGO action is not guaranteed.

---

# 🏭 Requirements Before Real-World Deployment

Before SatyaShield could accept real complaints, it would require:

```text
Verified NGO Partners
        +
Qualified Investigators
        +
Trained Administrators
        +
Legal Review
        +
Privacy Review
        +
Independent Security Assessment
        +
Production Evidence Storage
        +
Malware Scanning
        +
Monitoring & Alerting
        +
Backup & Recovery
        +
Incident Response
        +
Reliable Notifications
        +
Operational SLAs
        +
Human Accessibility Review
```

---

# 🧭 Design Principles

### 1. Data Minimization

Collect only what is necessary.

### 2. Least Privilege

```text
Right Person
    +
Right Resource
    +
Right Permission
    +
Right Time
```

### 3. Deny by Default

If authorization cannot be confidently established:

```text
DENY
```

### 4. Human Oversight

High-impact safety decisions should not be made silently by automated systems.

### 5. Fail Closed

If evidence safety, authorization, or configuration is uncertain, deny the operation rather than expose protected information.

### 6. Honest Security Claims

SatyaShield does not claim:

```text
100% anonymity
Guaranteed safety
Guaranteed deletion
Guaranteed NGO response
End-to-end encrypted chat
Automatic emergency response
Legal certification
```

unless those capabilities actually exist and are independently validated.

---

# 🌟 Why SatyaShield Is More Than a CRUD Project

SatyaShield combines:

```text
Privacy
Security
Realtime Systems
Workflow Automation
Role-Based Access
Resource-Level Authorization
Evidence Protection
Human Oversight
Reliability Engineering
Accessibility
Internationalization
```

It is not simply:

```text
React Form
   ↓
Express API
   ↓
MongoDB
```

---

# 💼 Engineering Concepts Demonstrated

* MERN full-stack development
* REST API design
* JWT authentication
* Refresh-token rotation
* TOTP MFA
* CSRF protection
* RBAC
* Exact-resource authorization
* Private evidence workflows
* AES-GCM encryption
* HMAC
* Socket.IO
* Realtime access revocation
* Workflow state machines
* Idempotency
* Retry systems
* Scheduler design
* Audit logging
* Privacy engineering
* Data minimization
* Accessibility
* Internationalization
* Playwright E2E testing

---

# 🎤 30-Second Project Explanation

> **SatyaShield is a privacy-first MERN platform for sensitive dowry-harassment reporting and case coordination. Instead of forcing reporters to create identity-heavy accounts, it gives them complaint-scoped credentials. Cases can then move through deterministic safety triage, verified NGO routing, investigator assignments, encrypted evidence workflows, realtime complaint-scoped communication, escalation and internal SOS processes. Every sensitive resource uses server-side exact-resource authorization, while high-impact decisions remain under human oversight.**

---

# 🔮 Future Production Improvements

Potential future improvements include:

* Multi-instance Socket.IO with shared adapter
* Production private object storage
* Malware scanning pipeline
* Verified NGO onboarding
* Production monitoring
* Backup and disaster recovery
* Independent security assessment
* Professional accessibility review
* Jurisdiction-specific legal review
* Production notification providers
* Conflict-of-interest workflows
* Dual approval for sensitive actions
* Appeal workflows
* Carefully approved emergency integrations

---

# 🤝 Contributing

Contributions are welcome when they preserve SatyaShield's core principles:

```text
Privacy
Security
Accessibility
Safety
Least Privilege
Human Oversight
Honest Claims
```

---

# 📄 License

SatyaShield is available under the **MIT License**.

The license does **not** provide:

* Legal certification
* Government approval
* Operational authorization
* Emergency-service authorization
* Security certification
* Warranty of safety

---

# ❤️ Purpose

SatyaShield explores one important engineering question:

> **How can we build technology for highly sensitive reporting without asking users to surrender more personal information than the workflow actually needs?**

The project approaches that question through privacy-first architecture, strict authorization, protected evidence handling, controlled organizational collaboration, realtime case communication, and human oversight.

---

<div align="center">

## 🛡️ SatyaShield

**Privacy First • Least Privilege • Human Oversight**

**Built with MERN, Socket.IO and security-focused system design.**

[Live Demo](https://satya-shield-client.vercel.app/) • [GitHub](https://github.com/bharshit63880/SatyaShield)

</div>
