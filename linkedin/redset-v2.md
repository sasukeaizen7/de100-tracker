# LinkedIn post v2: Redset / "Why TPC Is Not Enough" (repost, tighter)

Original (2 weeks ago): 208 impressions, 4 reactions, 0 comments.
What changed: hook on the 0% → 34% surprise instead of the paper intro, ~1,000 characters
instead of ~3,000, one finding, a question at the end, 4 hashtags.
Every number is from `redset-replication/README.md` and `LEARN.md`.
Keep the 7-page PDF as the attached document. Code link in the first comment.

Tag: the paper's first author, found on LinkedIn as "Alexander van Renen, Part time researcher
at UTN, Germany". When typing @Alexander van Renen, pick that profile from the list.

---

## Post text (professional version, preferred)

Amazon's public query logs suggest the Redshift result cache answers 0% of queries. The real figure is 34%.

I replicated a VLDB 2024 paper by @Alexander van Renen and the Amazon Redshift team, "Why TPC Is Not Enough", on Redset, the dataset Amazon released with it: 441 million queries from 400 production clusters, analysed in DuckDB on a single laptop.

The paper argues that standard benchmarks (TPC-H, TPC-DS) no longer reflect what cloud data warehouses actually run. Its numbers come from internal telemetry, so I asked whether its conclusions still hold on the public data. I rebuilt each metric in SQL and compared 29 claims side by side.

Two data issues mattered more than any code:
→ Cache hits are logged as "other", with no tables and no query fingerprint, only a pointer to the original query. Linking them back restores a third of all selects.
→ Every CREATE TABLE AS SELECT receives a new table id, even when it rebuilds the same table every night. Tracking tables by id overcounts them by thousands.

Results: 17 claims confirmed, 7 partially confirmed, 5 not confirmed.
→ Writes account for two thirds of total runtime, as the paper reports.
→ 79% of queries repeat within a typical cluster (paper: 80%).
→ However, only 30% of queries are selects, compared with 49% in the paper.

I then extended the study by simulating an ideal result cache. It would answer 63% of selects instead of 34%, and save three times more compute. It matches 97% of the cache hits Redshift actually served.

Key takeaway: before trusting a metric, understand how the underlying events are logged.

The full 7-page report is attached, and the code is linked in the comments.

I would be glad to hear from anyone working on query workloads or caching: does this match what you see in production?

#DataEngineering #Databases #DuckDB #SQL #Research

---

## Post text (casual version)

Amazon's query logs said the Redshift result cache answered 0% of queries.
the real number was 34%.

i re-checked a VLDB 2024 paper by @Alexander van Renen and the Amazon Redshift team ("Why TPC Is Not Enough") on their public dataset: 441M real queries from 400 clusters, all in DuckDB on my laptop.

the 0% made no sense. turns out cache hits are logged as "other", with no tables and no fingerprint, just a pointer to the original query. link them back and a third of all selects reappear.

the scorecard on 29 of the paper's claims: 17 confirmed, 7 partly, 5 not.
→ writes eat two thirds of the runtime, like the paper says
→ 79% of queries repeat in a typical cluster (paper: 80%)
→ but only 30% of queries are selects, not 49%

then i asked what a perfect cache would do: 63% of selects instead of 34%, and 3x the compute saved.

moral of the story: before you trust a metric, check how the event got logged.

full write-up (7 pages) attached, code in the comments 👇

PS: what's the weirdest thing you've found in a log table?

#DataEngineering #DuckDB #SQL #Databases

---

## First comment

code + every SQL query: https://github.com/sasukeaizen7/redset-replication
paper: van Renen et al., "Why TPC Is Not Enough: An Analysis of the Amazon Redshift Fleet", VLDB 2024

---

## Facts check
- 441M queries, 200 provisioned + 200 serverless clusters: README intro
- cache 0% → 33.6% (shown as 34%): README results + "cache hits logged as other" section
- 17 / 7 / 5 of 29 compared claims (1 more not comparable): README results
- writes 65.8% (paper 66.8%); repeats 79% (paper 80%); selects 30.5% (paper 48.9%): README scorecard
- ideal cache 63.1% of selects; saves 25.1% vs 8.3% runtime (≈3x): README results
