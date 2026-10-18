# URC-07 TooLost statement guard

Data validation only; no TooLost provider authentication, API, statements ingestion or live drill-down exists. All provenance and label permissions must be verified server-side; a caller-supplied verified flag is not sufficient. Currency minor-unit integers are transported as exact strings. Future acceptance needs signed and pinned upstream records, statement versions, pagination, withholding/splits/reversals, reconciliation of totals, cross-label negative tests, and no provider secret in the frontend.
