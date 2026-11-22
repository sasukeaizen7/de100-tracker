# LinkedIn post (casual voice): silent data bugs

Same story and numbers as `silent-data-bugs.md`, rewritten in the tone of the malware post.
Links go in the first comment (links in the post cut reach). The carousel still works with it.

---

## Post text

back to data engineering after last post's malware detour 😅

for the past 100 days i've been grinding through a data engineering program (python ETL, dbt, airflow, spark, kafka, delta lake, terraform, the whole menu) and building every project on real public data. and the thing that taught me the most wasn't a tool, it was a bug that threw 𝐳𝐞𝐫𝐨 errors.

the setup: two pipelines on the same 1M lines of real sales data, one in plain python, one in dbt. both passed their own tests, all green ✅
then i added one test that compares them... and it failed on 3,394 lines 💀

turns out they disagreed on what a "cancellation" even is:
→ python: quantity is negative = cancellation
→ dbt: invoice number starts with "C" = cancellation
both sound reasonable right?

3,393 of those lines were not cancellations at all. negative quantity, price 0, descriptions like "damages" and "missing". they were 𝐬𝐭𝐨𝐜𝐤 𝐰𝐫𝐢𝐭𝐞-𝐨𝐟𝐟𝐬. and the last one went the other way: a real cancellation invoice with a positive quantity that the quantity rule just missed.
so my python pipeline was overcounting cancellations by 18% (22,557 instead of 19,165) and nothing complained. the code did exactly what i told it to, i just told it the wrong thing lol

after that i started hunting for these everywhere, and public data is full of them:
🚲 2 paris vélib' stations with 410 docks each when no normal station goes past 200 → temporary megastations for events
🕛 9,443 chicago crimes logged at exactly 00:00 → not a midnight crime wave, just "time unknown" placeholders
🌍 summing every row of a CO₂ dataset gives 6.4x the actual world total → countries, continents and "World" all living in the same column

none of these crash anything. all of them end up in a dashboard someone makes decisions with.

moral of the story: with AI writing more and more pipeline code, "it runs" is getting cheap. "it's right" still isn't. the tests that catch this stuff are about the 𝐝𝐚𝐭𝐚, not the code: compare two sources of the same truth, check value ranges, and check the grain (one row = one what?).

all the projects + code are on my github, links in the comments 👇

PS: what's the quietest data bug you've ever found? genuinely curious

---

## First comment (links)

code and write-ups:
- python pipeline (the cancellation story): https://github.com/sasukeaizen7/portfolio/tree/main/03-project-1-ingestion
- dbt project + the test that caught it: https://github.com/sasukeaizen7/portfolio/tree/main/04-dbt-analytics
- vélib' pipeline (the 410-dock stations): https://github.com/sasukeaizen7/portfolio/tree/main/11-final-project
- chicago crime timestamps: https://github.com/sasukeaizen7/sql-projects/tree/main/projects/14-chicago-crimes
- CO₂ grain trap: https://github.com/sasukeaizen7/sql-projects/tree/main/projects/09-co2-emissions
