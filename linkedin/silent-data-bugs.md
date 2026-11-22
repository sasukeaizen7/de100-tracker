# LinkedIn post: "My pipeline ran with zero errors. It was still lying."

Format: text post + PDF carousel (7 slides, upload as a "document").
Put the GitHub links in the first comment, not in the post (links in the post cut reach).

---

## Post text

My pipeline ran with zero errors. Zero alerts. Green tests.

And it was overcounting cancellations by 18%.

I built two pipelines on the same 1M lines of real sales data: one in plain Python, one in dbt. Each one passed its own tests. Then I added a test that compares them, and it failed on 3,394 lines.

The Python pipeline called a line a cancellation when its quantity was negative. The dbt one used the invoice number, as the source documents. Both sound reasonable.

3,393 of those lines were not cancellations at all. Negative quantities, price 0, descriptions like "damages" and "missing". Stock write-offs. The last one went the other way: a real cancellation invoice with a positive quantity, which the quantity rule had missed. Cancellations went from 22,557 to the true 19,165 (−3,393 write-offs, +1 missed cancellation).

The code ran as written. The assumption was wrong.

Since then I look for these silent bugs everywhere, and public data is full of them:
- 2 Paris bike-share stations with 410 docks each, when no normal station has more than 200. A range test failed: they're temporary megastations for events.
- 9,443 Chicago crimes logged at exactly 00:00. Not a midnight crime wave: "time unknown" placeholders.
- Summing every row of a CO₂ dataset gives 6.4x the real world total, because countries, continents and "World" sit in the same column.

None of these throws an error. All of them would end up in a dashboard.

With AI writing more and more pipeline code, "it runs" is getting cheap. "It's right" still isn't. The tests that catch this are about the data, not the code: compare two sources, check ranges, check the grain.

What's the quietest data bug you've ever found?

#DataEngineering #DataQuality #dbt #SQL #Analytics

---

## First comment (links)

Code and write-ups:
- Python pipeline (and the cancellation story): https://github.com/sasukeaizen7/portfolio/tree/main/03-project-1-ingestion
- dbt project and the test that caught it: https://github.com/sasukeaizen7/portfolio/tree/main/04-dbt-analytics
- Vélib' pipeline (the 410-dock stations): https://github.com/sasukeaizen7/portfolio/tree/main/11-final-project
- Chicago crime timestamps: https://github.com/sasukeaizen7/sql-projects/tree/main/projects/14-chicago-crimes
- CO₂ grain trap: https://github.com/sasukeaizen7/sql-projects/tree/main/projects/09-co2-emissions

---

## Carousel (7 slides)

**1. Cover**
> 0 errors. 0 alerts.
> 3,393 wrong rows.
> *Silent data bugs, and the tests that catch them*

**2. The setup**
> Two pipelines. Same 1M sales lines.
> Python pipeline ✅ its tests pass
> dbt pipeline ✅ its tests pass
> Then one test compares them… ❌ 3,394 lines disagree
*(visual: two boxes → one red "≠" between them)*

**3. Two definitions of "cancellation"**
> Python: quantity < 0
> dbt: invoice starts with "C"
> Both sound right. They aren't the same thing.

**4. What the 3,393 lines really were**
> Negative quantity · price 0 · "damages", "missing"
> → stock write-offs, not cancellations
> Cancellations: 22,557 → **19,165**
> −3,393 write-offs · +1 "C" invoice with quantity > 0
> Fix: `line_type` = sale / cancellation / stock_adjustment
> *The code ran as written. The assumption was wrong.*

**5. Public data lies quietly too**
> 🚲 2 Vélib' stations with **410 docks** (normal max: 200) → event megastations · *caught by a range test*
> 🕛 **9,443** Chicago crimes at exactly 00:00 → "time unknown" placeholders · *caught by a time histogram*
> 🌍 Sum every row → **6.4×** the world's CO₂ → countries + continents in one column · *caught by a grain check*

**6. The lesson**
> AI makes "it runs" cheap.
> "It's right" is still your job.
> 3 data tests worth writing:
> 1. Compare two sources of the same truth
> 2. Check value ranges
> 3. Check the grain: one row = one what?

**7. Your turn**
> What's the quietest data bug you've ever found?
> 👇 Tell me in the comments
> *[your name] · Data Engineer · github.com/sasukeaizen7*

---

## Facts check (where each number comes from)
- 3,394 / 3,393 / 22,557 → 19,165: `de100-portfolio/03-project-1-ingestion/LEARN.md`, `04-dbt-analytics/README.md`
- 22,557 − 3,393 + 1 = 19,165, re-counted on the raw feed (`03-project-1-ingestion/data/online_retail_feed.parquet`): 22,557 lines with quantity < 0, 19,165 invoices starting with C, 3,393 negative-quantity non-C lines (all at price 0), and 1 C invoice with quantity > 0 (C496350, "Manual"). The test's 3,394 = 3,393 + 1.
- 18% overcount: 22,557 / 19,165 = 1.177
- 410 docks, range test capacity ≤ 200: `de100-portfolio/11-final-project/README.md`
- 9,443 at 00:00: `sql-portfolio/projects/14-chicago-crimes/README.md`
- 6.4×: `sql-portfolio/projects/09-co2-emissions/README.md`
