# T06 blind Ask Arkiv set (written 2026-10-28 before any run; keyless path)

Expected = the conditions a correct query must contain. Judged on the compiled query, then on results.

| # | Question | Expected conditions |
|---|---|---|
| Q1 | claim-check listed hospitals in Pune | project/app=claim-check, kind=listed, city=Pune |
| Q2 | kharab alerts where exp_ok is false | app=kharab, kind=alert, exp_ok=false |
| Q3 | dawa-alert alerts with expiry_ym after 202612 | app=dawa-alert, kind=alert, expiry_ym>202612 |
| Q4 | sayso dla records from lender type NBFC | app=sayso, kind=dla, lender_type=NBFC |
| Q5 | tankha votes with v greater than 1 | project=tankha, type=vote, v>1 |
| Q6 | jalsaakshya observations that exceed limits | app=jalsaakshya/v1, kind=obs, exceeds=true |
| Q7 | jalsaakshya observations with mgl over 1.5 in district Jaipur | exceeds not required; mgl>1.5, district=Jaipur |
| Q8 | haqclock ic orders with penalty_inr at least 25000 | app=haqclock, type=ic_order, penalty_inr>=25000 |
| Q9 | prometheus receipts | project=prometheus, kind=receipt |
| Q10 | supercall-test call records for asset BTC | project prefix supercall-test, kind=call, asset=BTC |
| Q11 | how many claim-check delisted records are there | app=claim-check, kind=delisted (count) |
| Q12 | tideland parcels with x less than 5 | app=tideland, parcel dataset, x<5 |
| Q13 | haqclock corrected ic orders that are historical | app=haqclock, type=ic_order_corrected, historical=true |
| Q14 | records owned by 0x0000000000000000000000000000000000000001 | owner=0x...01 (expect empty, no error) |
| Q15 | weather forecasts for London | no such dataset: graceful "no match", no invented query |
