# T17 blind Ask Arkiv set (written before any run; keyless rules path)

Different in kind from T06 (single conditions) and T15 (negation/ranges/OR/typos/hostile):
number words, "at most"/"no more than", quoted multi-word values, attribute synonyms, dataset by
description not name, "not between", contradictions, conditions on two attrs with the same op,
non-English, overflow, long rambling text.
Pass = compiled query has exactly the expected conditions, OR every unapplied part is listed under
Not used (ignored). No inverted, rebound or invented condition. No-match is fine where expected.

| # | Question | Expected |
|---|---|---|
| Q1 | tideland parcels with x at most ten | x<=10 (number word), or "ten" Not used; never x<=<other> |
| Q2 | haqclock ic orders with penalty_inr no more than 500 | penalty_inr<=500 |
| Q3 | sayso dla where lender is "PUNJAB NATIONAL BANK" | lender='PUNJAB NATIONAL BANK' (whole quoted value) |
| Q4 | haqclock ic orders with a penalty above 20000 | penalty_inr>20000 (synonym), or "penalty" Not used |
| Q5 | water quality observations in Purulia | jalsaakshya/v1 obs + district=Purulia, or no-match; not an unrelated dataset |
| Q6 | haqclock ic orders where penalty_inr is not between 1000 and 5000 | (<1000 OR >5000), or Not used; never the between range itself |
| Q7 | tideland parcels with x greater than 10 and x less than 5 | both applied (empty), or flagged; never one silently |
| Q8 | tideland parcels with x greater than 2 and y greater than 2 | x>2 AND y>2 (same op, two attrs) |
| Q9 | kharab alerts जिनका exp_ok false है | kharab alert, exp_ok=false or non-English words Not used; no invented condition |
| Q10 | haqclock ic orders with penalty_inr over 99999999999999999999999 | overflow handled: error/Not used, not a wrapped number |
| Q11 | so I was wondering, if it is not too much trouble, could you maybe find me the claim-check delisted entries for the city YSR please | claim-check delisted, city=YSR; filler not turned into conditions |
| Q12 | dawa-alert alerts with expiry_ym equal to 202701 | expiry_ym=202701 |
| Q13 | jalsaakshya observations where contaminant is arsenic and exceeds is true | contaminant=arsenic (case as data) AND exceeds=true |
| Q14 | tankha votes from project tankha with v of exactly -1 | v=-1 (negative number) |
| Q15 | prometheus receipts with trigger_block after done_block | attr-to-attr compare unsupported: Not used; never trigger_block > <number> |
