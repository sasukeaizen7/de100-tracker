export const analyticsPatterns = {
  id: 'analytics-patterns',
  title: 'Analytical query patterns',
  level: 'intermediate',
  summary: 'Dimensions vs measures, magnitude, ranking, change over time, cumulative, part-to-whole and segmentation: the questions every dataset gets asked.',
  body: [
    { p: 'Exploring a new dataset follows a repeatable path. First separate **dimensions** (what you group and filter by: city, category, date) from **measures** (what you add up: revenue, quantity). Then ask the same families of questions. Each one maps to a SQL shape you already know.' },
    {
      table: {
        head: ['Question family', 'Example question', 'SQL shape'],
        rows: [
          ['Magnitude', 'revenue per category', '`GROUP BY` dimension, `SUM(measure)`'],
          ['Ranking', 'top 3 products', '`RANK() OVER (ORDER BY measure DESC)`'],
          ['Change over time', 'revenue per month', '`GROUP BY date_trunc(…)` + date spine'],
          ['Cumulative', 'revenue to date', '`SUM(…) OVER (ORDER BY period)`'],
          ['Performance vs benchmark', 'each month vs the average month', '`measure - AVG(measure) OVER ()`'],
          ['Part to whole', 'share of each category', '`measure / SUM(measure) OVER ()`'],
          ['Segmentation', 'customers by spend band', '`CASE` buckets, then `GROUP BY` bucket'],
        ],
      },
    },
    { h: 'Profile first: what is in this table?' },
    { sql: "select count(*)                       as orders,\n       count(distinct customer_id)    as customers,\n       min(ordered_at)::date          as first_order,\n       max(ordered_at)::date          as last_order,\n       sum(total)                     as revenue,\n       round(avg(total), 2)           as avg_order,\n       percentile_cont(0.5) within group (order by total) as median_order\nfrom order_summary\nwhere status <> 'cancelled';", title: 'The one-row profile' },
    { h: 'Part to whole' },
    { sql: "select category,\n       sum(revenue) as revenue,\n       round(100.0 * sum(revenue) / sum(sum(revenue)) over (), 1) as pct_of_total\nfrom order_lines\nwhere status <> 'cancelled'\ngroup by category\norder by revenue desc;", title: 'Share of revenue by category', note: '`sum(sum(revenue)) over ()`: the inner sum is the group total, the outer window sum adds all groups.' },
    { h: 'Performance against a benchmark' },
    { sql: "with monthly as (\n  select date_trunc('month', ordered_at)::date as month, sum(total) as revenue\n  from order_summary where status <> 'cancelled'\n  group by 1\n)\nselect month, revenue,\n       round(avg(revenue) over (), 2)                as avg_month,\n       round(revenue - avg(revenue) over (), 2)      as diff_vs_avg,\n       case when revenue > avg(revenue) over () then 'above' else 'below' end as vs_avg,\n       sum(revenue) over (order by month rows between unbounded preceding and current row) as cumulative\nfrom monthly\norder by month;", title: 'Each month vs the average, plus the running total' },
    { h: 'Segmentation' },
    { sql: "with spend as (\n  select c.customer_id, c.first_name,\n         coalesce(sum(s.total) filter (where s.status <> 'cancelled'), 0) as spent,\n         count(s.order_id) filter (where s.status <> 'cancelled')          as orders\n  from customers c\n  left join order_summary s on s.customer_id = c.customer_id\n  group by c.customer_id, c.first_name\n)\nselect case\n         when spent >= 1500 then 'VIP'\n         when spent >= 100  then 'regular'\n         when spent > 0     then 'small'\n         else 'inactive'\n       end as segment,\n       count(*)              as customers,\n       sum(spent)            as revenue,\n       string_agg(first_name, ', ' order by spent desc) as who\nfrom spend\ngroup by 1\norder by revenue desc;", title: 'Customer segments by spend' },
    { callout: 'tip', title: 'RFM in one sentence', text: 'A classic segmentation scores each customer on **R**ecency (days since last order), **F**requency (number of orders) and **M**onetary value (total spent), often with `ntile(5)` per dimension, then combines the scores into segments like "champions" or "at risk".' },
    { callout: 'de', text: 'These shapes become **marts**: a `customer_report` and a `product_report` table with one row per entity and all its KPIs (orders, revenue, recency, segment), refreshed by the pipeline so BI tools read one wide table.' },
  ],
  practice: [
    { q: 'Share of order lines (count, not revenue) per city, as a percentage with one decimal. Ignore the guest (NULL city). Columns: `city`, `pct`.', solution: 'select city, round(100.0 * count(*) / sum(count(*)) over (), 1) as pct\nfrom order_lines where city is not null group by city;' },
    { q: 'Recency: days between each customer\'s last order and 2026-05-01. Exclude the guest. Columns: `customer_id`, `days_since_last`.', solution: "select customer_id, date '2026-05-01' - max(ordered_at)::date as days_since_last\nfrom orders where customer_id is not null group by customer_id;" },
  ],
  interview: [
    { q: 'How do you compute each category\'s share of total revenue in one query?', a: 'Group by category and divide the group sum by a window sum over all groups: `sum(revenue) / sum(sum(revenue)) over ()`, multiplied by 100.0 for a percentage.' },
  ],
  related: ['window-basics', 'grouping-sets', 'cohort-retention'],
};

export const cohortRetention = {
  id: 'cohort-retention',
  title: 'Cohorts and retention',
  level: 'advanced',
  summary: 'Group customers by when they started, then measure how many come back in later periods: the most asked product-analytics query.',
  body: [
    { p: 'A **cohort** is a group of users who share a starting event in the same period: everyone whose first order was in January. **Retention** asks: of that cohort, what share was active again 1, 2, 3 months later? Comparing cohorts shows whether the product is getting better at keeping customers.' },
    { steps: [
      'Find each customer\'s **cohort**: the month of their first order.',
      'For every order, compute the **period number**: months between the cohort month and the order month (0 = first month).',
      'Count distinct active customers per (cohort, period).',
      'Divide by the cohort size (active customers in period 0) to get the retention rate.',
    ] },
    { sql: "with orders_ok as (\n  select customer_id, date_trunc('month', ordered_at)::date as month\n  from orders\n  where customer_id is not null and status <> 'cancelled'\n),\ncohorts as (\n  select customer_id, min(month) as cohort\n  from orders_ok\n  group by customer_id\n),\nactivity as (\n  select c.cohort,\n         (extract(year from age(o.month, c.cohort)) * 12\n          + extract(month from age(o.month, c.cohort)))::int as period,\n         o.customer_id\n  from orders_ok o\n  join cohorts c using (customer_id)\n)\nselect cohort, period,\n       count(distinct customer_id) as active,\n       round(100.0 * count(distinct customer_id)\n             / first_value(count(distinct customer_id)) over (partition by cohort order by period), 0) as retention_pct\nfrom activity\ngroup by cohort, period\norder by cohort, period;", title: 'Monthly cohort retention' },
    { p: 'With 6 customers the numbers are tiny, but the query is exactly the one you would run on millions of orders. Pivot it (one column per period with `FILTER`) to get the classic triangle chart.' },
    { sql: "with orders_ok as (\n  select customer_id, date_trunc('month', ordered_at)::date as month\n  from orders where customer_id is not null and status <> 'cancelled'\n),\nfirst_month as (\n  select customer_id, min(month) as cohort from orders_ok group by customer_id\n),\nactivity as (\n  select f.cohort, o.customer_id,\n         (extract(year from age(o.month, f.cohort)) * 12 + extract(month from age(o.month, f.cohort)))::int as period\n  from orders_ok o join first_month f using (customer_id)\n)\nselect cohort,\n       count(distinct customer_id) filter (where period = 0) as m0,\n       count(distinct customer_id) filter (where period = 1) as m1,\n       count(distinct customer_id) filter (where period = 2) as m2,\n       count(distinct customer_id) filter (where period = 3) as m3\nfrom activity\ngroup by cohort\norder by cohort;", title: 'The retention triangle' },
    { callout: 'trap', text: 'Retention must count **distinct** customers: a customer with 3 orders in month 2 is still one retained customer. And define "active" explicitly (any order? a paid order? a login?): it changes the numbers a lot.' },
  ],
  practice: [
    { q: 'Cohort size: number of customers whose first non-cancelled order was in each month. Columns: `cohort`, `customers`.', solution: "with firsts as (\n  select customer_id, min(date_trunc('month', ordered_at))::date as cohort\n  from orders where customer_id is not null and status <> 'cancelled'\n  group by customer_id\n)\nselect cohort, count(*) as customers from firsts group by cohort;" },
  ],
  interview: [
    { q: 'Write a query for month-1 retention.', a: 'Compute each user\'s cohort month (min activity month), join activity back, compute months since cohort, then for each cohort divide distinct users active in period 1 by distinct users in period 0.' },
  ],
  related: ['analytics-patterns', 'dates-times', 'window-basics'],
};

export const medallion = {
  id: 'medallion-architecture',
  title: 'ETL, ELT and the medallion architecture',
  level: 'intermediate',
  summary: 'Organise a warehouse in layers (bronze raw, silver clean, gold business-ready) and build each layer with SQL.',
  body: [
    { p: '**ETL** transforms data before loading it into the warehouse; **ELT** loads raw data first and transforms it inside the warehouse with SQL. Cheap warehouse compute made ELT the default, and the **medallion architecture** is its usual layout.' },
    {
      table: {
        head: ['', 'ETL', 'ELT'],
        rows: [
          ['Transform where', 'in a separate tool, before loading', 'inside the warehouse, with SQL'],
          ['Raw data kept', '- often not', '+ yes, re-transform any time'],
          ['Typical tools', 'Informatica, SSIS, custom Python', 'Fivetran/Airbyte + dbt + Snowflake/BigQuery'],
          ['Fits', 'strict, stable schemas; sensitive data to mask early', 'most modern analytics'],
        ],
      },
    },
    {
      table: {
        head: ['Layer', 'Also called', 'Contains', 'Rules'],
        rows: [
          ['**Bronze**', 'raw, landing, staging', 'source data as received (often JSON, all as text)', 'append only, never edited, adds load metadata'],
          ['**Silver**', 'cleaned, conformed, intermediate', 'typed, deduplicated, standardised data', 'one row per business entity/event, quality tested'],
          ['**Gold**', 'marts, presentation', 'facts, dimensions and reports for BI', 'business names, aggregates, documented'],
        ],
      },
    },
    { p: 'Let\'s build the three layers from the raw website events, with one schema per layer.' },
    { sql: "create schema if not exists bronze;\ncreate schema if not exists silver;\ncreate schema if not exists gold;\n\n-- BRONZE: land the raw payloads exactly as received, plus load metadata\ndrop table if exists bronze.web_events;\ncreate table bronze.web_events as\nselect event_id, customer_id, occurred_at::text as occurred_at_raw, payload,\n       now() as _loaded_at, 'events_api' as _source\nfrom events;\n-- the source sent one event twice (it happens):\ninsert into bronze.web_events\nselect event_id, customer_id, occurred_at_raw, payload, now(), _source from bronze.web_events where event_id = 3;\n\nselect count(*) as bronze_rows from bronze.web_events;", title: 'Bronze: raw data as received' },
    { sql: "-- SILVER: typed, deduplicated, flattened\ndrop table if exists silver.web_events;\ncreate table silver.web_events as\nselect distinct on (event_id)\n       event_id,\n       customer_id,\n       occurred_at_raw::timestamptz           as occurred_at,\n       lower(payload ->> 'type')              as event_type,\n       payload ->> 'page'                     as page,\n       coalesce(payload ->> 'device', 'unknown') as device,\n       (payload ->> 'amount')::numeric        as amount\nfrom bronze.web_events\norder by event_id, _loaded_at desc;\nalter table silver.web_events add primary key (event_id);\n\nselect count(*) as silver_rows from silver.web_events;", title: 'Silver: clean and deduplicate', note: 'The duplicate landed twice in bronze; silver keeps one row per event, so the primary key can be added.' },
    { sql: "-- GOLD: business-ready tables for BI\ndrop table if exists gold.daily_activity;\ncreate table gold.daily_activity as\nselect (occurred_at at time zone 'Europe/Paris')::date as day,\n       count(*)                                        as events,\n       count(distinct customer_id)                     as active_customers,\n       count(*) filter (where event_type = 'purchase') as purchases,\n       coalesce(sum(amount), 0)                        as revenue\nfrom silver.web_events\ngroup by 1;\n\nselect * from gold.daily_activity order by day;", title: 'Gold: a report table' },
    { h: 'Conventions that keep a warehouse sane' },
    { list: [
      '**Naming**: `bronze.<source>_<entity>`, `silver.<entity>`, `gold.fact_<process>` / `gold.dim_<entity>`; snake_case everywhere; the same column name for the same thing in every table (`customer_id`, never `cust_id` in one and `client` in another).',
      '**Metadata columns** in bronze: `_loaded_at`, `_source`, `_file_name`, so you can trace and reprocess any row.',
      '**Tests between layers**: uniqueness and not-null in silver, reconciliation of totals between silver and gold (see [Data quality checks](#/c/data-quality)).',
      '**Documentation**: comment every gold table and column (see [ALTER TABLE, comments](#/c/alter-metadata)): this becomes the data catalog.',
    ] },
    { callout: 'de', text: 'In dbt this maps to folders: `models/staging` (silver views over sources declared in `sources.yml`, which point at bronze), `models/intermediate`, and `models/marts` (gold). Databricks popularised the bronze/silver/gold names; the idea is the same everywhere.' },
  ],
  practice: [
    { q: 'From `silver.web_events` (run the examples first), events per device. Columns: `device`, `events`.', solution: 'select device, count(*) as events from silver.web_events group by device;', setup: true },
    { q: 'Reconciliation: return one row with the number of distinct `event_id`s in bronze and the number of rows in silver. Columns: `bronze_distinct`, `silver_rows`. (They should be equal.)', solution: 'select (select count(distinct event_id) from bronze.web_events) as bronze_distinct,\n       (select count(*) from silver.web_events) as silver_rows;', setup: true },
  ],
  interview: [
    { q: 'Explain the medallion architecture.', a: 'Bronze holds raw source data as ingested (append-only, with load metadata); silver holds cleaned, typed, deduplicated and conformed data; gold holds business-level models (facts, dimensions, aggregates) for consumption. Each layer is rebuilt from the previous one, so you can reprocess history and isolate source problems.' },
    { q: 'ETL vs ELT?', a: 'ETL transforms before loading into the target; ELT loads raw data into the warehouse and transforms there with SQL. ELT keeps raw history, scales with warehouse compute and suits tools like dbt.' },
  ],
  related: ['normalization', 'incremental-loads', 'data-quality'],
};
