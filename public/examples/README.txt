Truthful fictional source examples

These files are synthetic and use no real customer or vendor information.
The engine is a bounded rules-based parser, not a live inbox or LLM integration.

Pipeline CRM: pipeline-promise.txt + pipeline-invoices.csv, as of 2026-10-28.
USD 2,400 promised, USD 900 matched, USD 1,500 outstanding. Two other rows
are excluded because their vendor or commitment reference differs.
Add pipeline-reply.txt to expose a new renewal condition without changing
the original amount or accepting any obligation.
Replace the invoice CSV with pipeline-invoices-complete.csv and set the review
date to 2026-11-01: USD 2,400 is then matched and fully verified.

Parcel: parcel-promise.txt + parcel-invoices.csv, as of 2026-10-28.
USD 350 is scheduled for November 1. Future invoice rows do not count yet.

Orbit Design: orbit-promise.txt + orbit-invoices.csv.
USD 480 is a conditional renewal offer. It is excluded from verified savings,
even when the supplied CSV contains a proposed credit row.

Accepted CSV columns:
invoice_id,vendor,date,description,amount,currency,commitment_ref

Amounts are positive credit amounts in decimal units (900.00 means USD 900).
This is a credit-ledger adapter, not a general gross-invoice parser.
Use one credit row per invoice ID. Identical duplicates are ignored; conflicting
rows sharing an invoice ID require correction. Dates use YYYY-MM-DD.
Vendor names match after trimming/case normalization; references match exactly.
Every matched row must be USD, have the same vendor and commitment reference,
and be dated on or before the chosen review date.
If a promise has a Date: header, credits older than that promise are excluded.
An explicit Vendor: header must match the selected vendor. Invalid or conflicting
source headers require correction. Undated promises carry a provenance warning.

Supported promises explicitly confirm a USD credit/refund or fee waiver, state
a single amount, an explicit Reference: value, and Due date: YYYY-MM-DD.
Invoice-month wording is also supported with an explicit year or valid Date:
header. Month-only promises use the last day of the month and are labeled as
month precision. Unknown, tentative, denied, multi-amount and foreign-currency
promises are rejected for correction. Currency '$' alone assumes USD and warns.
Scheduled promises do not generate a premature recovery claim. Reply text outside
the supported condition patterns is retained and explicitly marked for review;
absence of a detected condition does not prove the absence of changed terms.

The analysis proves consistency of supplied documents only. It does not prove
that uploaded invoices are authentic or a payment was settled externally.
