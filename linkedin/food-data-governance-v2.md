# LinkedIn post v2: "one coffee capsule broke the average" (tighter, built for reach)

Same story and numbers as `food-data-governance.md` (see its facts check). Changes:
- about a third of the length (~800 characters), one story instead of five, no unicode bold
- simple English: most of the network reads French first
- 1 company tag (Open Food Facts, the one most likely to engage or reshare), 4 hashtags at the end
- attach as a PDF carousel (document), not 3 images: more dwell time
- links still go in the first comment

---

## Post text (professional version, preferred)

A single coffee capsule raised the average sugar content of 1.27 million food products to 1.3 × 10²⁷ g per 100 g.

One Open Food Facts record, a decaf ristretto, declares 1.17 × 10³³ g of sugar per 100 g. That one row is enough to make a simple average over a million products meaningless. On trusted data only, the real figure is 13.9 g.

I built a data quality and governance layer on @Open Food Facts, covering the 1.27 million products sold in France:
→ 17 quality rules (invalid barcodes, sugars greater than carbohydrates, kJ entered as kcal…), each with an owner and a severity level
→ A trust level for every product: 79.6% trusted, 16.8% caution, 3.5% untrusted
→ A Power BI dashboard showing which rules fail, who should fix them, and how much the KPIs change on trusted data
→ An AI agent that answers questions on the data, running locally with Ollama

The agent was the most instructive part. Without safeguards, it invented figures (20,000 "caution" products instead of 214,815) and summed rule failures instead of counting products. Better prompts did not fully solve it. The safeguards now live in code: the agent uses governed metrics, and every number in its answer is checked against the actual query result. Any mismatch is flagged.

I also had to correct two of my own rules. One flagged 14.8% of products for a kJ/kcal mismatch that labelling rules actually allow. The other flagged mineral water for missing nutrition data, which EU law does not require. A rule that raises false alarms is as harmful as no rule.

Key takeaway: a dashboard or an AI agent is only as reliable as the governance beneath it.

The code and dashboard are linked in the comments.

What is the most absurd value you have found in a dataset that was supposed to be clean?

#DataQuality #DataGovernance #PowerBI #dbt #AI

---

## Post text (casual version)

one coffee capsule made the average sugar of 1.27M food products jump to 1.3 × 10²⁷ g per 100g 💀

not a typo. one decaf ristretto declares 1.17 × 10³³ g of sugar. one row, and the average is garbage.
on trusted data only: 13.9g.

so on @Open Food Facts (1.27M products sold in France) i built the layer that catches this:
→ 17 quality rules, each with an owner and a severity
→ a trust level per product: 79.6% trusted, 16.8% caution, 3.5% untrusted
→ a Power BI dashboard + a local AI agent on top

the AI agent invented numbers. so every number it says is now checked against the real query, in code, not in the prompt.

moral of the story: a dashboard or an AI agent is only as good as the data under it.

code in the comments 👇

PS: what's the most absurd value you've ever found in a "clean" dataset?

#DataQuality #DataGovernance #PowerBI #dbt

---

## First comment (post it within a minute of publishing)

Code, the 17 rules, the dashboard and what the local model got wrong:
https://github.com/sasukeaizen7/food-data-governance

Data: Open Food Facts (ODbL). The records are crowd-sourced, not published by the brands.

---

## Carousel (5 slides, export as PDF)
1. "1.3 × 10²⁷ g of sugar per 100g" + the trusted vs all chart (powerbi_trusted_vs_all.png)
2. the culprit: one decaf ristretto, 1.17 × 10³³ g/100g
3. 17 rules → 79.6 / 16.8 / 3.5 % trust levels (powerbi_overview.png)
4. the agent's answer with the flag line (screenshot)
5. "what's the most absurd value you've found?" + name · github.com/sasukeaizen7
