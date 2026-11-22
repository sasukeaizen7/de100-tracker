# LinkedIn post v2: silent data bugs (professional)

Original (1 week ago): 238 impressions, 0 reactions, 1 comment.
What changed: a sharper opening, one clear story then three short examples, shorter paragraphs,
the lesson as three concrete tests, a question to practitioners, links in the first comment.
Every number comes from the facts check in `silent-data-bugs.md`. Keep the 7-slide carousel.

---

## Post text

Two pipelines. Same 1 million sales lines. All tests green.
They still disagreed on 3,394 rows.

I built the same pipeline twice on real retail data: once in plain Python, once in dbt. Each passed its own tests. Then I added a single test comparing their outputs, and it failed.

The cause was one definition. The Python pipeline flagged a line as a cancellation when its quantity was negative. The dbt pipeline used the invoice number, as the source system documents. Both rules sound reasonable.

3,393 of the disputed lines were not cancellations at all: negative quantities, a price of zero, descriptions such as "damages" and "missing". They were stock write-offs. The last line went the other way: a genuine cancellation invoice with a positive quantity.

The Python pipeline overstated cancellations by 18% (22,557 instead of 19,165) without raising a single error. The code ran exactly as written. The assumption was wrong.

Since then I look for this kind of silent issue in every dataset, and public data is full of them:
→ 2 Paris Vélib' stations with 410 docks each, when no regular station exceeds 200. Temporary stations for events, caught by a range test.
→ 9,443 Chicago crimes recorded at exactly 00:00. Not a midnight crime wave: "time unknown" placeholders.
→ Summing a CO₂ dataset gives 6.4 times the real world total, because countries, continents and "World" share the same column.

None of these breaks a pipeline. All of them would reach a dashboard.

As AI writes more pipeline code, "it runs" is becoming cheap. "It is correct" is not. The tests that catch these issues are about the data, not the code:
1. Compare two sources of the same truth.
2. Check value ranges.
3. Check the grain: one row equals one what?

What is the quietest data bug you have found in production?

#DataEngineering #DataQuality #dbt #SQL #Analytics

---

## First comment

Code and write-ups:
- Python pipeline and the cancellation case: https://github.com/sasukeaizen7/portfolio/tree/main/03-project-1-ingestion
- dbt project and the comparison test: https://github.com/sasukeaizen7/portfolio/tree/main/04-dbt-analytics
- Vélib' pipeline (410-dock stations): https://github.com/sasukeaizen7/portfolio/tree/main/11-final-project
- Chicago crime timestamps: https://github.com/sasukeaizen7/sql-projects/tree/main/projects/14-chicago-crimes
- CO₂ grain issue: https://github.com/sasukeaizen7/sql-projects/tree/main/projects/09-co2-emissions
