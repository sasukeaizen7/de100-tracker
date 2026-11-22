export const patterns = [
  {
    id: 'deduplication',
    title: 'Deduplication',
    level: 'intermediate',
    summary: 'Keep one row per key (usually the latest), or delete duplicates in place.',
    body: [
      { p: 'Raw data is full of duplicates: an API returned the same record twice, a file was loaded twice, a source sends every update as a new row. The fix is always the same idea: **define the key** that should be unique, **define which copy wins** (latest timestamp, highest id), and keep only that one.' },
      { sql: "with ranked as (\n  select *,\n         row_number() over (\n           partition by customer_id            -- the key\n           order by occurred_at desc, event_id desc   -- which copy wins (+ tie-breaker)\n         ) as rn\n  from events\n)\nselect customer_id, occurred_at, payload ->> 'type' as last_event\nfrom ranked\nwhere rn = 1;", title: 'Keep the latest row per key' },
      { sql: "drop table if exists signups_raw;\ncreate table signups_raw (id serial, email text, loaded_at timestamptz default now());\ninsert into signups_raw (email) values ('a@x.fr'), ('b@x.fr'), ('A@x.fr '), ('a@x.fr');\n\n-- see the duplicates first (after normalising the key)\nselect lower(trim(email)) as email_key, count(*), array_agg(id order by id) as ids\nfrom signups_raw\ngroup by 1\nhaving count(*) > 1;", title: 'Find duplicates (normalise the key first)', note: "'a@x.fr', 'A@x.fr ' and 'a@x.fr' are the same person once trimmed and lower-cased." },
      { sql: "delete from signups_raw t\nusing signups_raw d\nwhere lower(trim(t.email)) = lower(trim(d.email))\n  and t.id > d.id;                -- keep the smallest id\n\nselect * from signups_raw order by id;", title: 'Delete duplicates in place' },
      {
        table: {
          head: ['Method', 'Keeps', 'Note'],
          rows: [
            ['`row_number() … = 1`', 'any chosen row per key', '+ portable, flexible ordering'],
            ['`DISTINCT ON (key)`', 'first row per key', '~ PostgreSQL / DuckDB'],
            ['`QUALIFY row_number() … = 1`', 'same, no subquery', '~ Snowflake, BigQuery, DuckDB'],
            ['`SELECT DISTINCT`', 'fully identical rows only', '- useless if any column differs (load timestamp)'],
            ['`DELETE … USING` self-join', 'modifies the table', 'cleanup in place'],
          ],
        },
      },
      { callout: 'trap', text: 'Without a deterministic tie-breaker, `row_number()` can keep a different row on each run, and your pipeline output changes for no reason. Always end the ORDER BY with a unique column.' },
    ],
    practice: [
      { q: 'Each customer\'s first ever event: `customer_id`, `event_id`.', solution: 'select customer_id, event_id from (\n  select customer_id, event_id,\n         row_number() over (partition by customer_id order by occurred_at, event_id) as rn\n  from events\n) t where rn = 1;' },
    ],
    interview: [
      { q: 'How do you remove duplicates from a table with no primary key?', a: 'Use a key-defining window: create a new table with SELECT … row_number() OVER (PARTITION BY all business columns ORDER BY …) = 1 and swap it in; or, in PostgreSQL, delete using the hidden ctid: DELETE FROM t a USING t b WHERE a.ctid > b.ctid AND a.cols = b.cols.' },
    ],
    related: ['ranking-functions', 'distinct', 'incremental-loads'],
  },
  {
    id: 'top-n',
    title: 'Top N per group',
    level: 'intermediate',
    summary: 'The best-selling product per category, the last three orders per customer: rank inside groups, then filter.',
    body: [
      { p: 'One of the most asked SQL questions. The recipe: rank rows **inside each group** with a window function, then keep the ranks you want in an outer query. Choose the ranking function by how you want ties handled.' },
      { sql: "select category, product, revenue\nfrom (\n  select category, product, sum(revenue) as revenue,\n         rank() over (partition by category order by sum(revenue) desc) as rnk\n  from order_lines\n  where status <> 'cancelled'\n  group by category, product\n) t\nwhere rnk = 1\norder by category;", title: 'Best-selling product per category', note: 'The window runs after GROUP BY, so it can rank the aggregated revenue directly.' },
      { sql: "select customer_id, order_id, ordered_at\nfrom (\n  select customer_id, order_id, ordered_at,\n         row_number() over (partition by customer_id order by ordered_at desc) as rn\n  from orders\n  where customer_id is not null\n) t\nwhere rn <= 2\norder by customer_id, ordered_at desc;", title: 'Last two orders per customer' },
      {
        table: {
          head: ['Want', 'Use', 'Ties'],
          rows: [
            ['exactly N rows per group', '`row_number()`', 'broken arbitrarily: add a tie-breaker'],
            ['all rows tied for the top N positions', '`rank()`', 'may return more than N'],
            ['the top N distinct values', '`dense_rank()`', 'every row with those values'],
            ['top N with an index, very large tables', '`LATERAL … LIMIT N`', 'see [LATERAL](#/c/lateral)'],
          ],
        },
      },
    ],
    practice: [
      { q: 'The most expensive product of each category (ties included). Columns: `category`, `name`, `price`.', solution: 'select category, name, price from (\n  select category, name, price, rank() over (partition by category order by price desc) as r\n  from products\n) t where r = 1;' },
      { q: 'For each customer, their biggest order by total from `order_summary`. Columns: `customer_id`, `order_id`, `total`. Exclude the guest.', solution: 'select customer_id, order_id, total from (\n  select customer_id, order_id, total,\n         row_number() over (partition by customer_id order by total desc, order_id) as rn\n  from order_summary where customer_id is not null\n) t where rn = 1;' },
    ],
    interview: [
      { q: 'Write the top 3 salaries per department.', a: 'SELECT … FROM (SELECT *, DENSE_RANK() OVER (PARTITION BY dept ORDER BY salary DESC) AS r FROM employees) t WHERE r <= 3. Explain the choice of DENSE_RANK vs ROW_NUMBER for ties.' },
    ],
    related: ['ranking-functions', 'lateral', 'deduplication'],
  },
  {
    id: 'period-over-period',
    title: 'Period over period and date spines',
    level: 'intermediate',
    summary: 'Compare each month with the previous one or the same month last year, without being fooled by missing periods.',
    body: [
      { p: 'Growth metrics compare a period with an earlier one. `lag()` reads the previous row, but only if every period has a row. A month with no sales simply doesn\'t appear in a `GROUP BY`, so "previous row" would silently be two months back. The fix is a **date spine**: a complete list of periods, left-joined to the data.' },
      { sql: "with months as (\n  select generate_series('2026-01-01'::date, '2026-05-01', interval '1 month')::date as month\n),\nrevenue as (\n  select date_trunc('month', ordered_at)::date as month, sum(total) as revenue\n  from order_summary\n  where status <> 'cancelled'\n  group by 1\n)\nselect m.month,\n       coalesce(r.revenue, 0)                              as revenue,\n       lag(coalesce(r.revenue, 0)) over (order by m.month) as previous,\n       round(100.0 * (coalesce(r.revenue, 0) - lag(coalesce(r.revenue, 0)) over (order by m.month))\n             / nullif(lag(coalesce(r.revenue, 0)) over (order by m.month), 0), 1) as growth_pct\nfrom months m\nleft join revenue r using (month)\norder by m.month;", title: 'Month-over-month growth with a spine', note: 'May has no orders: it shows 0 instead of disappearing, and its growth is −100%.' },
      { h: 'Variants' },
      {
        table: {
          head: ['Metric', 'Window expression'],
          rows: [
            ['previous period', '`lag(x) over (order by period)`'],
            ['same period last year (monthly data)', '`lag(x, 12) over (order by month)`'],
            ['running total (YTD)', '`sum(x) over (partition by year order by month rows between unbounded preceding and current row)`'],
            ['3-month moving average', '`avg(x) over (order by month rows between 2 preceding and current row)`'],
            ['share of the year', '`x / sum(x) over (partition by year)`'],
          ],
        },
      },
      { callout: 'de', text: 'Most warehouses keep a permanent `dim_date` table (one row per day, with week, month, holiday flags). It is the spine for every report and the dimension behind date filters in BI tools.' },
    ],
    practice: [
      { q: 'Number of orders per month from January to May 2026, with 0 for months without orders. Columns: `month`, `orders`.', solution: "select m.month::date as month, count(o.order_id) as orders\nfrom generate_series('2026-01-01'::date, '2026-05-01', interval '1 month') as m(month)\nleft join orders o on date_trunc('month', o.ordered_at) = m.month\ngroup by m.month;" },
    ],
    interview: [
      { q: 'Your month-over-month query compares March with January. Why?', a: 'February has no rows, so after GROUP BY the previous row of March is January. Generate a complete date spine and left join the data to it before applying LAG.' },
    ],
    related: ['lag-lead', 'window-frames', 'dates-times'],
  },
  {
    id: 'gaps-islands',
    title: 'Gaps and islands',
    level: 'advanced',
    summary: 'Find consecutive runs (streaks) and the gaps between them with a row-number trick.',
    body: [
      { p: 'An **island** is a run of consecutive values (days a user was active, consecutive ids); a **gap** is a missing stretch between islands. The classic trick: within a sorted sequence, consecutive values and `row_number()` both increase by 1, so **value − row_number** is constant inside an island and changes after every gap.' },
      { diagram: 'islands' },
      { sql: "with days as (\n  select distinct customer_id,\n         (occurred_at at time zone 'Europe/Paris')::date as day\n  from events\n),\nislands as (\n  select customer_id, day,\n         day - (row_number() over (partition by customer_id order by day))::int as island\n  from days\n)\nselect customer_id, min(day) as streak_start, max(day) as streak_end, count(*) as days\nfrom islands\ngroup by customer_id, island\norder by customer_id, streak_start;", title: 'Activity streaks per customer', note: 'Customer 1 was active 1–3 April, then 5–6 April: two islands.' },
      { sql: "select order_id + 1 as gap_start, next_id - 1 as gap_end\nfrom (\n  select order_id, lead(order_id) over (order by order_id) as next_id\n  from orders\n) t\nwhere next_id - order_id > 1;", title: 'Gaps in a sequence of ids', note: 'Returns nothing on fresh data. Delete an order (then Reset data) to see a gap appear.' },
      { callout: 'tip', text: 'For timestamps, the islands version uses `lag()`: flag a new island when the gap to the previous row exceeds a threshold, then take a running sum of the flags. That is exactly [Sessionization](#/c/sessionization).' },
    ],
    practice: [
      { q: 'The longest streak (in days) of each customer. Columns: `customer_id`, `longest`.', hint: 'Wrap the streaks query and take `max(days)` per customer.', solution: "with days as (\n  select distinct customer_id, (occurred_at at time zone 'Europe/Paris')::date as day from events\n), islands as (\n  select customer_id, day, day - (row_number() over (partition by customer_id order by day))::int as island from days\n), streaks as (\n  select customer_id, count(*) as days from islands group by customer_id, island\n)\nselect customer_id, max(days) as longest from streaks group by customer_id;" },
    ],
    interview: [
      { q: 'Find users who logged in on at least 3 consecutive days.', a: 'Distinct (user, day); island id = day − row_number() over (partition by user order by day); group by user and island; keep groups with count(*) >= 3. Alternative: lead(day, 2) = day + 2.' },
    ],
    related: ['sessionization', 'ranking-functions', 'lag-lead'],
  },
  {
    id: 'sessionization',
    title: 'Sessionization',
    level: 'advanced',
    summary: 'Group a stream of events into sessions separated by inactivity.',
    body: [
      { p: 'Web analytics define a **session** as a burst of activity: a new one starts after 30 minutes without events. SQL builds sessions in three steps.' },
      { steps: [
        'For each event, compare its time with the previous event of the same user (`lag`).',
        'Flag the event with 1 if it starts a session (no previous event, or gap > 30 min), else 0.',
        'A running `sum` of the flags numbers the sessions: 1, 1, 1, 2, 2, 3…',
      ] },
      { sql: "with flagged as (\n  select customer_id, event_id, occurred_at,\n         case\n           when occurred_at - lag(occurred_at) over (partition by customer_id order by occurred_at)\n                <= interval '30 minutes' then 0\n           else 1\n         end as new_session\n  from events\n),\nnumbered as (\n  select *,\n         sum(new_session) over (partition by customer_id order by occurred_at\n                                rows between unbounded preceding and current row) as session_no\n  from flagged\n)\nselect customer_id, session_no,\n       min(occurred_at) as started,\n       max(occurred_at) as ended,\n       max(occurred_at) - min(occurred_at) as duration,\n       count(*) as events\nfrom numbered\ngroup by customer_id, session_no\norder by customer_id, session_no;", title: 'Sessions from raw events', note: 'For the first event, `lag` is NULL, so the comparison is unknown and CASE falls to ELSE 1: a new session, as intended.' },
      { callout: 'de', text: 'This pattern (flag boundaries with `lag`, number them with a running `sum`) solves many problems: trips from GPS points, machine run periods from sensor readings, price change episodes.' },
    ],
    practice: [
      { q: 'Number of sessions per customer (30-minute rule). Columns: `customer_id`, `sessions`.', solution: "with flagged as (\n  select customer_id,\n         case when occurred_at - lag(occurred_at) over (partition by customer_id order by occurred_at) <= interval '30 minutes' then 0 else 1 end as new_session\n  from events\n)\nselect customer_id, sum(new_session) as sessions from flagged group by customer_id;" },
    ],
    interview: [
      { q: 'How do you sessionize clickstream data in SQL?', a: 'Use LAG to get the previous event time per user, flag a new session when the gap exceeds the threshold (or there is no previous event), then a cumulative SUM of the flag over the user\'s events gives a session number; group by user and session number for session metrics.' },
    ],
    related: ['gaps-islands', 'lag-lead', 'window-frames'],
  },
  {
    id: 'incremental-loads',
    title: 'Incremental loads and watermarks',
    level: 'advanced',
    summary: 'Load only new data on each run, safely: idempotent, transactional, and tolerant of late arrivals.',
    body: [
      { p: 'Reloading everything every hour stops scaling. An **incremental** load processes only rows that arrived since the last run, using a **watermark**: the highest timestamp (or id) already loaded, stored in a small control table.' },
      { sql: "drop table if exists fact_events, etl_watermarks;\ncreate table etl_watermarks (job text primary key, last_loaded timestamptz not null);\ncreate table fact_events (\n  event_id int primary key, customer_id int, occurred_at timestamptz, event_type text\n);\ninsert into etl_watermarks values ('fact_events', '-infinity');\n\n-- the job: safe to run again and again\nbegin;\n  insert into fact_events\n  select event_id, customer_id, occurred_at, payload ->> 'type'\n  from events\n  where occurred_at > (select last_loaded - interval '1 day'   -- reprocess a safety window\n                       from etl_watermarks where job = 'fact_events')\n  on conflict (event_id) do update\n    set event_type = excluded.event_type;                       -- late corrections win\n\n  update etl_watermarks\n  set last_loaded = coalesce((select max(occurred_at) from fact_events), last_loaded)\n  where job = 'fact_events';\ncommit;\n\nselect (select count(*) from fact_events) as loaded,\n       (select last_loaded from etl_watermarks) as watermark;", title: 'A watermark-based incremental load', note: 'Run it twice: the count doesn\'t change. That is idempotency.' },
      { h: 'The four properties of a good load' },
      {
        table: {
          head: ['Property', 'How', 'Without it'],
          rows: [
            ['Idempotent', 'upsert on a business key, or delete-then-insert the reprocessed window', 're-runs create duplicates'],
            ['Atomic', 'data and watermark updated in one transaction', 'a crash leaves the watermark ahead of the data: rows lost'],
            ['Late-data tolerant', 'reprocess a safety window (`watermark - 1 day`)', 'events arriving late are skipped forever'],
            ['Backfillable', 'the window can be set manually to reload history', 'fixing a bug means a full reload'],
          ],
        },
      },
      { callout: 'de', text: 'dbt\'s incremental models implement the same idea: `{% if is_incremental() %} where occurred_at > (select max(occurred_at) from {{ this }}) {% endif %}` plus a `unique_key` for the merge. Airflow passes the run\'s time window (`data_interval_start/end`) to do it by partition.' },
    ],
    practice: [
      { q: 'After running the example, compare counts: events in the source vs rows in `fact_events`. Columns: `source`, `target`.', solution: 'select (select count(*) from events) as source, (select count(*) from fact_events) as target;', setup: true },
    ],
    interview: [
      { q: 'How do you handle late-arriving data in an incremental pipeline?', a: 'Reprocess a lookback window on each run (watermark minus N hours/days) and make the write idempotent (MERGE/upsert on the business key), so re-reading rows already loaded is harmless while late rows are picked up.' },
    ],
    related: ['upsert-merge', 'transactions', 'scd-type-2'],
  },
  {
    id: 'scd-type-2',
    title: 'Slowly changing dimensions (type 2)',
    level: 'advanced',
    summary: 'Keep the full history of a dimension: close the old version, insert a new one, so facts join to the version valid at the time.',
    body: [
      { p: 'Dimensions change slowly: a product\'s price, a customer\'s city. If you overwrite the old value, last year\'s sales suddenly appear at today\'s price or in today\'s city. **SCD type 2** keeps every version with a validity period.' },
      {
        table: {
          head: ['Type', 'On change', 'History', 'Example'],
          rows: [
            ['0', 'never changes', '—', 'date of birth'],
            ['1', 'overwrite', '- lost', 'fixing a typo'],
            ['**2**', 'close the current row, insert a new version', '+ complete', 'price, address, segment'],
            ['3', 'keep a `previous_value` column', '~ one step back', 'previous sales region'],
          ],
        },
      },
      { sql: "drop table if exists dim_product;\ncreate table dim_product (\n  product_key serial primary key,      -- surrogate key: one per version\n  product_id  int not null,            -- natural (business) key\n  name        text,\n  price       numeric(8,2),\n  valid_from  timestamptz not null,\n  valid_to    timestamptz,             -- NULL = current version\n  is_current  boolean not null\n);\n\n-- the same two statements run on every load:\n-- 1) close current versions whose tracked attributes changed\nupdate dim_product d\nset valid_to = now(), is_current = false\nfrom products p\nwhere p.product_id = d.product_id and d.is_current\n  and p.price is distinct from d.price;\n\n-- 2) insert a current version for new and changed products\ninsert into dim_product (product_id, name, price, valid_from, valid_to, is_current)\nselect p.product_id, p.name, p.price, now(), null, true\nfrom products p\nleft join dim_product d on d.product_id = p.product_id and d.is_current\nwhere d.product_id is null;\n\nselect * from dim_product order by product_id;", title: 'Initial load (every product gets version 1)' },
      { sql: "update products set price = 35.00 where product_id = 4;   -- the source changes\n\nupdate dim_product d\nset valid_to = now(), is_current = false\nfrom products p\nwhere p.product_id = d.product_id and d.is_current and p.price is distinct from d.price;\n\ninsert into dim_product (product_id, name, price, valid_from, valid_to, is_current)\nselect p.product_id, p.name, p.price, now(), null, true\nfrom products p\nleft join dim_product d on d.product_id = p.product_id and d.is_current\nwhere d.product_id is null;\n\nselect product_key, product_id, price, valid_from, valid_to, is_current\nfrom dim_product where product_id = 4 order by product_key;", title: 'A price change creates version 2', note: 'Run the first example before this one.' },
      { p: 'To join a fact to the version valid when it happened, compare the fact\'s timestamp with the validity period: `on d.product_id = f.product_id and f.ordered_at >= d.valid_from and (f.ordered_at < d.valid_to or d.valid_to is null)`. Or store the surrogate `product_key` in the fact at load time.' },
      { callout: 'de', text: 'dbt **snapshots** implement SCD2 for you: they add `dbt_valid_from` / `dbt_valid_to` and detect changes with a `timestamp` or `check` strategy. Knowing the SQL underneath is a classic interview question.' },
    ],
    practice: [
      { q: 'From `dim_product` (run both examples), the current price of every product. Columns: `product_id`, `price`.', solution: 'select product_id, price from dim_product where is_current;', setup: true },
    ],
    interview: [
      { q: 'Explain SCD type 1 vs type 2 and when to use each.', a: 'Type 1 overwrites the attribute (no history): use for corrections and attributes whose history doesn\'t matter. Type 2 adds a new row per change with validity dates and a current flag, and a surrogate key: use when reports must reflect the attribute as it was at the time of the fact.' },
      { q: 'Why does an SCD2 dimension need a surrogate key?', a: 'The natural key (product_id) is no longer unique: one product has several versions. A surrogate key identifies one version, so facts can point to exactly the version valid at the time.' },
    ],
    related: ['upsert-merge', 'normalization', 'triggers'],
  },
  {
    id: 'data-quality',
    title: 'Data quality checks in SQL',
    level: 'intermediate',
    summary: 'Every data test is a query that returns the bad rows: zero rows means the check passes.',
    body: [
      { p: 'Tools like dbt tests, Soda and Great Expectations all compile to SQL that looks for violations. Learning the queries means you can test anything, in any tool. Convention: **a test returns the failing rows**; an empty result is a pass.' },
      {
        table: {
          head: ['Check', 'Question', 'dbt equivalent'],
          rows: [
            ['Uniqueness', 'is the key unique?', '`unique`'],
            ['Completeness', 'are required values present?', '`not_null`'],
            ['Referential integrity', 'does every foreign key have a parent?', '`relationships`'],
            ['Validity', 'are values in the allowed set / range / format?', '`accepted_values`, expressions'],
            ['Freshness', 'did new data arrive recently?', '`source freshness`'],
            ['Volume', 'is today\'s row count normal?', 'custom / anomaly tests'],
            ['Consistency', 'do totals match between layers?', 'custom: compare two queries'],
          ],
        },
      },
      { sql: "-- uniqueness: duplicated emails\nselect email, count(*) from customers\nwhere email is not null group by email having count(*) > 1;\n\n-- completeness: customers without email\nselect customer_id, first_name from customers where email is null;\n\n-- referential integrity: order items without a valid order or product\nselect oi.* from order_items oi\nwhere not exists (select 1 from orders o where o.order_id = oi.order_id)\n   or not exists (select 1 from products p where p.product_id = oi.product_id);\n\n-- validity: unexpected statuses, non-positive quantities\nselect order_id, status from orders where status not in ('paid', 'shipped', 'cancelled');\nselect * from order_items where quantity <= 0;", title: 'The core checks' },
      { sql: "-- freshness: is the newest event older than 2 days?\nselect max(occurred_at) as newest_event,\n       now() - max(occurred_at) > interval '2 days' as is_stale\nfrom events;\n\n-- consistency: revenue in the lines view equals revenue in the summary view\nselect (select sum(revenue) from order_lines) as lines_total,\n       (select sum(total) from order_summary) as summary_total;", title: 'Freshness and consistency' },
      { sql: "select 'unique_email' as test, count(*) as failures\nfrom (select email from customers where email is not null group by email having count(*) > 1) t\nunion all\nselect 'not_null_email', count(*) from customers where email is null\nunion all\nselect 'valid_status', count(*) from orders where status not in ('paid', 'shipped', 'cancelled');", title: 'A one-query test report' },
      { callout: 'de', text: 'Put these checks in the pipeline, not in a notebook: run them after each load and stop (or alert) on failure. Constraint where the database enforces it, test where it doesn\'t (warehouses).' },
    ],
    practice: [
      { q: 'Products whose price is not strictly positive or whose category is NULL (should return no rows). Columns: `product_id`.', solution: 'select product_id from products where price <= 0 or category is null;' },
      { q: 'Orders that have no items at all. Column: `order_id`.', solution: 'select order_id from orders o\nwhere not exists (select 1 from order_items oi where oi.order_id = o.order_id);' },
    ],
    interview: [
      { q: 'Which data quality checks would you put on a new fact table?', a: 'Primary key unique and not null; foreign keys exist in dimensions (relationships); measures within valid ranges (quantity > 0); accepted values for status columns; freshness of the latest timestamp; volume compared with recent history; and reconciliation of totals with the source.' },
    ],
    related: ['semi-anti-joins', 'constraints', 'set-operations'],
  },
];
