# Private evidence storage adapter boundary

Controllers use the evidence-vault service, not filesystem paths. A future cloud adapter must
implement `save`, `open`, `exists`, `delete`, `quarantine`, and `metadata` with private object
permissions and must never return provider URLs or object keys through API serializers.
