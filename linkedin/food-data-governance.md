# LinkedIn post: "one coffee capsule broke the average"

Casual voice (same tone as the malware post). Every number comes from food-data-governance/README.md.
Links go in the first comment (links in the post cut reach).

Visuals to attach (carousel or 2-3 images, in this order):
1. images/powerbi_trusted_vs_all.png (13.9 vs 1.3E+27: the hook)
2. images/powerbi_overview.png
3. screenshot of the local agent's answer with the flag line

---

## Post text

one coffee capsule made the average sugar of 1.27M food products jump to 1.3 × 10²⁷ g per 100g

no that's not a typo. one Open Food Facts record (a decaf ristretto) declares 1.17 × 10³³ g of sugar per 100g, and that single row is enough to wreck a plain average over a million products. on trusted data only, the real number is 13.9g.

that's basically the whole project in one chart lol

i took Open Food Facts (the open food database, 4.8M products worldwide), and on the 1.27M products sold in France i built:
→ 17 quality rules (invalid barcodes, sugars > carbs, kJ typed as kcal…), each one with an 𝐨𝐰𝐧𝐞𝐫 and a 𝐬𝐞𝐯𝐞𝐫𝐢𝐭𝐲
→ a trust level for every product: 79.6% trusted, 16.8% caution, 3.5% untrusted
→ a 𝐏𝐨𝐰𝐞𝐫 𝐁𝐈 dashboard on top: what fails, who fixes it, which products to fix first, trusted vs all
→ an AI agent that answers questions on the data, running locally with ollama (free, nothing leaves my laptop)

other things the data told me:
→ nutella in the contributor data: 15g of salt. the manufacturer says 0.107g. manufacturer and contributors disagree on 10.5% of the products that have both
→ 1,171 products have the exact same number in kJ and kcal → someone typed kJ in the kcal box
→ 6,236 barcodes have 15 digits. real barcodes don't

the agent part was humbling:
1. thinking mode off → 5x faster… and it invented numbers (20,000 "caution" products instead of 214,815)
2. it added up rule failures instead of counting products → 283,060 instead of 259,653. classic grain bug, done by an AI this time
3. even with a solid prompt it still slipped a made-up number into a side note

so the guard rails live in 𝐜𝐨𝐝𝐞, not in the prompt: governed metrics published ready-made, and every number in the answer checked against the actual query results. anything that doesn't match gets flagged

and 2 of my own rules were wrong at first. my kJ/kcal check flagged 14.8% of products (labels compute each nutrient separately, so 4.0 to 4.25 is legit, not exactly 4.184), and i was flagging mineral water for having no nutrition table… which EU law doesn't even require. a rule that cries wolf is as bad as no rule.

moral of the story: a dashboard or an AI agent is only as good as the governance under it. one bad row can turn your KPI into 10²⁷.

code + dashboard + full write-up in the comments

PS: what's the most absurd value you've ever found in a "clean" dataset? genuinely curious

---

## First comment (links)

code, dashboard and design decisions:
- project: https://github.com/sasukeaizen7/food-data-governance
- the 17 quality rules: https://github.com/sasukeaizen7/food-data-governance/blob/main/transform/seeds/dq_rules.csv
- the Power BI dashboard: https://github.com/sasukeaizen7/food-data-governance#power-bi-dashboard
- what testing the local model taught me: https://github.com/sasukeaizen7/food-data-governance#what-testing-the-local-model-taught-me

data: Open Food Facts (ODbL). the records are crowd-sourced, not data published by the brands.

---

## Facts check (where each number comes from)
- 1.17e33 g/100g (Ristretto decaffeinato), 1.3e27 average, 13.9 g trusted average, 45 records > 100 g: Power BI "Trusted vs all" page, README "Power BI dashboard"
- 4.8M worldwide / 1,275,888 in France: bronze.products_full, silver.products
- 17 rules, 79.6 / 16.8 / 3.5 %: results/rule_summary.csv, results/trust_levels.csv
- Nutella 15 g salt vs 0.107 g: raw delta records (packaging vs manufacturer set)
- 10.5 % disagreement: rule R17, 190 of 1,809 products
- 1,171 kJ = kcal; 6,236 15-digit codes: README "Findings"
- 20,000 vs 214,815; 283,060 vs 259,653: README "What testing the local model taught me"
- 14.8 % → 5.6 % (kJ/kcal), water exemption: README "Two rules I had to fix"
