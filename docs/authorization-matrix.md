# Authorization matrix

| Resource or action | Reporter | NGO | Investigator | Admin | Superadmin |
|---|---:|---:|---:|---:|---:|
| Submit complaint | Yes | Yes | Yes | Yes | Yes |
| Read reporter-safe case | Exact case token | Assigned and acknowledged | Assigned | Yes | Yes |
| Evidence metadata/download | Exact case token | Assigned and acknowledged | Assigned | Yes | Yes |
| Case chat | Exact case token | Assigned and acknowledged | Assigned when allowed | Yes | Yes |
| NGO offer preview | No | Exact offered assignment | No | Yes | Yes |
| NGO review/routing | No | No | No | Yes | Yes |
| Investigator assignment | No | No | No | Yes | Yes |
| Triage review | No | No | Review request only | Yes | Yes |
| Critical downgrade | No | No | No | No | Yes |
| SOS queue | No | No | No | Yes | Yes |
| Restricted SOS location | No | No | No | Explicitly authorized | Explicitly authorized |
| Legal-content administration | No | No | No | No | Yes |

Every resource check is performed server-side. Client navigation is not an authorization control.
