export const objects = [
  {
    id: 'views',
    title: 'Views',
    level: 'intermediate',
    summary: 'A saved query that behaves like a table: hide complexity, give users a stable interface, restrict what they see.',
    body: [
      { p: 'A **view** stores a query, not data. Each time you select from it, PostgreSQL runs the query (merged into yours and optimised together). The practice database already uses two: `order_lines` and `order_summary`.' },
      { sql: "create or replace view customer_revenue as\nselect c.customer_id, c.first_name, c.city,\n       coalesce(sum(s.total), 0) as revenue\nfrom customers c\nleft join order_summary s\n  on s.customer_id = c.customer_id and s.status <> 'cancelled'\ngroup by c.customer_id, c.first_name, c.city;\n\nselect * from customer_revenue order by revenue desc;", title: 'Create and query a view' },
      { sql: "select pg_get_viewdef('order_summary'::regclass, true);", title: 'Read a view\'s definition' },
      { callout: 'trap', title: 'CREATE OR REPLACE limits', text: 'Replacing a view may add columns at the end, but cannot drop, rename, reorder or retype existing ones. Use `DROP VIEW … ; CREATE VIEW …` instead (and `CASCADE` drops the views built on top of it, so recreate them too).' },
      { h: 'Updatable views and WITH CHECK OPTION' },
      { p: 'A simple view (one table, no `GROUP BY`, `DISTINCT`, aggregates or set operations) accepts `INSERT`, `UPDATE` and `DELETE`, which are applied to the underlying table. `WITH CHECK OPTION` refuses writes that would produce rows the view can\'t see.' },
      { sql: "create or replace view paris_customers as\nselect customer_id, first_name, last_name, email, city\nfrom customers\nwhere city = 'Paris'\nwith check option;\n\ninsert into paris_customers (first_name, last_name, city) values ('Léa', 'Petit', 'Paris');\nselect * from paris_customers;\ndelete from paris_customers where first_name = 'Léa';", title: 'Writing through a view' },
      { sql: "insert into paris_customers (first_name, last_name, city) values ('Tom', 'Roux', 'Lyon');", title: 'Rejected by WITH CHECK OPTION', expectError: true, note: 'A Lyon customer would be invisible through a Paris view, so the insert is refused.' },
      {
        table: {
          head: ['Use a view to…', 'Example'],
          rows: [
            ['hide join logic', '`order_lines` hides a 4-table join'],
            ['give a stable interface', 'rename columns for BI without touching tables'],
            ['restrict access', 'grant `SELECT` on a view without personal columns'],
            ['standardise business rules', '"revenue excludes cancelled orders" written once'],
          ],
        },
      },
      { callout: 'de', text: 'In dbt, `materialized=\'view\'` models are views: always fresh, zero storage, but every query pays the computation. Staging models are often views; heavy marts become tables.' },
    ],
    practice: [
      { q: 'Using `order_lines`, compute revenue per product name (cancelled orders excluded). Columns: `product`, `revenue`.', solution: "select product, sum(revenue) as revenue from order_lines\nwhere status <> 'cancelled' group by product;" },
    ],
    interview: [
      { q: 'Does a view improve performance?', a: 'Not by itself: a regular view is just a stored query, inlined into the calling query. It improves maintainability and security. For speed, use a materialized view or a table.' },
    ],
    related: ['materialized-views', 'ctes'],
  },
  {
    id: 'materialized-views',
    title: 'Materialized views',
    level: 'intermediate',
    summary: 'A view whose result is stored on disk: fast to read, but only as fresh as its last refresh.',
    body: [
      { p: 'A **materialized view** runs its query once and saves the result like a table. Reads are fast and can use indexes; the price is staleness: data changes are not visible until you run `REFRESH MATERIALIZED VIEW`.' },
      { sql: "drop materialized view if exists monthly_revenue;\ncreate materialized view monthly_revenue as\nselect date_trunc('month', ordered_at)::date as month,\n       sum(total) as revenue,\n       count(*)   as orders\nfrom order_summary\nwhere status <> 'cancelled'\ngroup by 1;\n\ncreate unique index on monthly_revenue (month);\nselect * from monthly_revenue order by month;", title: 'Create and index a materialized view' },
      { sql: "insert into orders (customer_id, ordered_at, status) values (6, '2026-04-25 10:00', 'paid');\ninsert into order_items values (currval('orders_order_id_seq'), 1, 1);\n\nselect * from monthly_revenue where month = '2026-04-01';   -- still the old number\nrefresh materialized view concurrently monthly_revenue;\nselect * from monthly_revenue where month = '2026-04-01';   -- now includes the new order", title: 'Stale until refreshed', note: '`CONCURRENTLY` lets readers keep using the old version during the refresh. It requires a unique index.' },
      {
        table: {
          head: ['', 'View', 'Materialized view', 'Table built by a pipeline'],
          rows: [
            ['Stores', 'the query', 'the query\'s result', 'data'],
            ['Freshness', '+ always current', '~ as of last REFRESH', '~ as of last load'],
            ['Read speed', 'same as the query', '+ fast, indexable', '+ fast, indexable'],
            ['Refresh cost', '—', '- recomputes everything', '+ can be incremental'],
            ['Writable', '~ simple views only', '- no', '+ yes'],
            ['Use for', 'logic and security layers', 'expensive dashboards refreshed hourly', 'large, incremental, historised data'],
          ],
        },
      },
      { callout: 'de', text: 'Schedule refreshes from your orchestrator (an Airflow task after the load). PostgreSQL can\'t refresh incrementally; when the full recompute gets too slow, switch to an incremental table.' },
    ],
    practice: [
      { q: 'Read the materialized view: months with revenue above 1 000. Columns: `month`, `revenue`. (Run the first example first.)', solution: 'select month, revenue from monthly_revenue where revenue > 1000;', setup: true },
    ],
    interview: [
      { q: 'When would you choose a materialized view over a table?', a: 'When the result is expensive to compute, read often, can be fully recomputed in acceptable time, and some staleness is fine. For huge or append-only data, an incrementally maintained table is cheaper to keep fresh.' },
    ],
    related: ['views', 'incremental-loads'],
  },
  {
    id: 'partitioning',
    title: 'Partitioning and inheritance',
    level: 'advanced',
    summary: 'Split one huge logical table into smaller physical pieces so queries skip irrelevant data and old data is cheap to drop.',
    body: [
      { p: 'A **partitioned table** is a single table to your queries, stored as several child tables (partitions) chosen by a **partition key**. When a query filters on the key, the planner reads only the matching partitions (**partition pruning**). Deleting a year of old data becomes dropping a partition: instant, instead of a huge `DELETE`.' },
      {
        table: {
          head: ['Strategy', 'Rows are placed by', 'Best for', 'Example'],
          rows: [
            ['`RANGE`', 'value intervals', '+ time series: by far the most common', 'one partition per month'],
            ['`LIST`', 'explicit values', 'a small set of known categories', 'one per country'],
            ['`HASH`', 'hash(key) modulo n', 'spreading load when there is no natural range', '4 partitions by customer_id'],
          ],
        },
      },
      { sql: "drop table if exists sales cascade;\ncreate table sales (\n  sale_id  bigserial,\n  sold_at  date not null,\n  store    text not null,\n  amount   numeric(10,2) not null,\n  primary key (sale_id, sold_at)    -- must include the partition key\n) partition by range (sold_at);\n\ncreate table sales_2026_q1 partition of sales for values from ('2026-01-01') to ('2026-04-01');\ncreate table sales_2026_q2 partition of sales for values from ('2026-04-01') to ('2026-07-01');\ncreate table sales_default partition of sales default;\n\ninsert into sales (sold_at, store, amount) values\n  ('2026-02-14', 'Bastille', 120.00), ('2026-05-02', 'Bastille', 80.00),\n  ('2026-05-20', 'Montmartre', 45.50), ('2027-01-05', 'Montmartre', 99.00);\n\nselect tableoid::regclass as partition, * from sales order by sold_at;", title: 'Range partitioning by quarter', note: '`tableoid::regclass` shows which partition each row landed in. 2027 goes to the default partition.' },
      { sql: "explain select sum(amount) from sales where sold_at >= '2026-04-01' and sold_at < '2026-07-01';", title: 'Partition pruning in the plan', note: 'Only `sales_2026_q2` is scanned.' },
      { sql: "drop table if exists page_hits cascade;\ncreate table page_hits (customer_id int not null, hit_at timestamptz) partition by hash (customer_id);\ncreate table page_hits_0 partition of page_hits for values with (modulus 2, remainder 0);\ncreate table page_hits_1 partition of page_hits for values with (modulus 2, remainder 1);\ninsert into page_hits select customer_id, occurred_at from events;\nselect tableoid::regclass as partition, count(*) from page_hits group by 1;", title: 'Hash partitioning' },
      { sql: "alter table sales detach partition sales_2026_q1;   -- now an ordinary table (archive it)\ndrop table sales_2026_q1;                           -- or delete the quarter instantly", title: 'Retention: detach or drop a partition' },
      { h: 'Table inheritance' },
      { sql: "drop table if exists vehicles cascade;\ncreate table vehicles (vehicle_id int, name text);\ncreate table ebikes (battery_wh int) inherits (vehicles);\ninsert into vehicles values (1, 'City bike');\ninsert into ebikes values (2, 'Electric bike', 500);\n\nselect * from vehicles;        -- parent + children\nselect * from only vehicles;   -- the parent alone", title: 'Children inherit the parent\'s columns' },
      {
        table: {
          head: ['', 'Declarative partitioning', 'Inheritance'],
          rows: [
            ['Purpose', 'performance and retention of huge tables', '"is-a" hierarchies with extra columns'],
            ['Rows routed automatically', '+ yes', '- no: insert into the child'],
            ['Children add columns', '- no', '+ yes'],
            ['Today', '+ the way to partition', '~ legacy, rarely needed'],
          ],
        },
      },
      { callout: 'de', text: 'Warehouses partition too: BigQuery tables are partitioned by a date column and clustered by up to 4 columns; Snowflake splits data into micro-partitions automatically and lets you define a clustering key. Always filter on the partition column: you scan (and pay for) less.' },
    ],
    practice: [
      { q: 'Total amount per partition of `sales` (run the first example first). Columns: `partition` (as text), `total`.', solution: 'select tableoid::regclass::text as partition, sum(amount) as total from sales group by 1;', setup: true },
    ],
    interview: [
      { q: 'Partitioning vs indexing?', a: 'An index helps find a few rows quickly. Partitioning splits storage so whole chunks can be skipped (pruning) or dropped cheaply; it helps scans over a key range and data lifecycle. They are complementary: each partition has its own indexes.' },
      { q: 'What is a bad partition key?', a: 'One queries rarely filter on (no pruning), or one creating thousands of tiny partitions (planning overhead). For event data, a date at day or month granularity is usually right.' },
    ],
    related: ['indexes', 'explain'],
  },
  {
    id: 'sql-functions',
    title: 'User-defined functions',
    level: 'advanced',
    summary: 'Package a calculation or a parameterised query, written in SQL or PL/pgSQL, and call it inside queries.',
    body: [
      { p: 'A **function** takes arguments and returns a value, a row or a whole table. It is called inside queries like any built-in function. Write simple ones in `LANGUAGE sql`; use `LANGUAGE plpgsql` when you need variables, `IF` and loops.' },
      { sql: "create or replace function order_total(p_order_id int)\nreturns numeric\nlanguage sql stable\nas $$\n  select coalesce(sum(oi.quantity * p.price), 0)\n  from order_items oi\n  join products p using (product_id)\n  where oi.order_id = p_order_id\n$$;\n\nselect order_id, order_total(order_id) as total from orders order by order_id;", title: 'A scalar SQL function' },
      { sql: "create or replace function customer_orders(p_customer_id int)\nreturns table (order_id int, ordered_at timestamp, total numeric)\nlanguage sql stable\nas $$\n  select order_id, ordered_at, total\n  from order_summary\n  where customer_id = p_customer_id\n$$;\n\nselect * from customer_orders(1);", title: 'A table function: a parameterised view' },
      { sql: "create or replace function loyalty_tier(p_customer_id int)\nreturns text\nlanguage plpgsql stable\nas $$\ndeclare\n  spent numeric;\nbegin\n  select coalesce(sum(total), 0) into spent\n  from order_summary\n  where customer_id = p_customer_id and status <> 'cancelled';\n\n  if spent >= 1500 then\n    return 'gold';\n  elsif spent >= 300 then\n    return 'silver';\n  end if;\n  return 'bronze';\nend;\n$$;\n\nselect first_name, loyalty_tier(customer_id) as tier from customers;", title: 'PL/pgSQL: variables and IF' },
      {
        table: {
          head: ['Volatility', 'Promise', 'Lets the planner…', 'Example'],
          rows: [
            ['`IMMUTABLE`', 'same inputs → same output forever, no table reads', 'pre-compute it; use it in index expressions', 'a VAT calculation'],
            ['`STABLE`', 'same output within one statement; may read tables', 'call it once per scan', '`order_total`, `now()`'],
            ['`VOLATILE` (default)', 'may change anything', 'nothing: re-run on every row', '`random()`, functions that write'],
          ],
        },
      },
      { callout: 'trap', text: 'Calling a function that runs a query once per row (like `loyalty_tier` above) is a hidden loop: fine for 6 customers, slow for 6 million. A set-based query with a join and `GROUP BY` does the same work in one pass.' },
    ],
    practice: [
      { q: 'Use the `order_total` function (run the first example) to list orders whose total is above 500. Columns: `order_id`, `total`.', solution: 'select order_id, order_total(order_id) as total from orders where order_total(order_id) > 500;', setup: true },
    ],
    interview: [
      { q: 'What does marking a function IMMUTABLE allow?', a: 'The planner can evaluate it once for constant arguments and use it in index expressions and partition pruning. Marking a function IMMUTABLE when it isn\'t (e.g. it reads a table) leads to wrong results.' },
    ],
    related: ['procedures', 'triggers'],
  },
  {
    id: 'procedures',
    title: 'Stored procedures',
    level: 'advanced',
    summary: 'Multi-step routines called with CALL, which can control transactions: commit work in batches.',
    body: [
      { p: 'A **procedure** is like a function that returns nothing and is invoked on its own with `CALL`. Its special power: when called outside an explicit transaction, it can `COMMIT` and `ROLLBACK` inside its body, for example to process a big table in batches.' },
      { sql: "drop table if exists orders_archive;\ncreate table orders_archive (like orders);\n\ncreate or replace procedure archive_cancelled_orders()\nlanguage plpgsql\nas $$\nbegin\n  insert into orders_archive select * from orders where status = 'cancelled';\n  delete from orders where status = 'cancelled';\n  raise notice 'archived % order(s)', (select count(*) from orders_archive);\nend;\n$$;\n\nbegin;\n  call archive_cancelled_orders();\n  select count(*) as still_cancelled from orders where status = 'cancelled';\nrollback;   -- practice mode: keep the data", title: 'A maintenance procedure' },
      { sql: "create or replace procedure set_category_discount(p_category text, p_pct numeric)\nlanguage plpgsql\nas $$\nbegin\n  if p_pct not between 0 and 50 then\n    raise exception 'discount must be between 0 and 50, got %', p_pct;\n  end if;\n  update products set price = round(price * (1 - p_pct / 100), 2) where category = p_category;\nend;\n$$;\n\nbegin;\n  call set_category_discount('parts', 10);\n  select name, price from products where category = 'parts';\nrollback;", title: 'Parameters and validation with RAISE EXCEPTION' },
      {
        table: {
          head: ['', 'Function', 'Procedure'],
          rows: [
            ['Invoked with', '`SELECT f(…)`, inside any query', '`CALL p(…)`, on its own'],
            ['Returns', 'a value, row or table', 'nothing (or `INOUT` parameters)'],
            ['`COMMIT` inside', '- no', '+ yes, when not called inside BEGIN'],
            ['Use for', 'calculations, parameterised queries', 'multi-step jobs, batch maintenance'],
          ],
        },
      },
      { callout: 'de', text: 'Modern data stacks keep orchestration outside the database (Airflow, dbt), so procedures are less central than in classic BI. You will still meet them in Snowflake (JavaScript/SQL procedures) and SQL Server shops.' },
    ],
    practice: [
      { q: 'Inside `begin … rollback`, call `set_category_discount(\'accessories\', 20)` (run the second example first) and select the new accessory prices. Columns: `name`, `price`.', solution: "begin;\ncall set_category_discount('accessories', 20);\nselect name, price from products where category = 'accessories';\nrollback;", setup: true },
    ],
    interview: [
      { q: 'Function vs procedure in PostgreSQL?', a: 'Functions return values and run inside the caller\'s transaction, so they can\'t commit. Procedures (PostgreSQL 11+) are called with CALL, return nothing, and can commit or roll back internally, which suits batch jobs.' },
    ],
    related: ['sql-functions', 'transactions', 'triggers'],
  },
  {
    id: 'triggers',
    title: 'Triggers',
    level: 'advanced',
    summary: 'Run a function automatically when rows are inserted, updated or deleted: audit logs, timestamps, complex rules.',
    body: [
      { p: 'A **trigger** attaches a function to a table event. In PostgreSQL you write a function that `RETURNS trigger`, then `CREATE TRIGGER` to fire it `BEFORE` or `AFTER` an `INSERT`, `UPDATE`, `DELETE` or `TRUNCATE`, once per row or once per statement. Inside, `OLD` is the row before the change and `NEW` the row after.' },
      { sql: "drop table if exists price_audit;\ncreate table price_audit (\n  product_id int, old_price numeric, new_price numeric,\n  changed_by text default current_user,\n  changed_at timestamptz default now()\n);\n\ncreate or replace function log_price_change()\nreturns trigger\nlanguage plpgsql\nas $$\nbegin\n  insert into price_audit (product_id, old_price, new_price)\n  values (old.product_id, old.price, new.price);\n  return new;\nend;\n$$;\n\ncreate or replace trigger trg_price_audit\nafter update of price on products\nfor each row\nwhen (old.price is distinct from new.price)\nexecute function log_price_change();\n\nupdate products set price = price + 1 where product_id = 5;\nselect * from price_audit;", title: 'AFTER trigger: an audit log of price changes' },
      { sql: "alter table customers add column if not exists updated_at timestamptz;\n\ncreate or replace function touch_updated_at()\nreturns trigger language plpgsql as $$\nbegin\n  new.updated_at := now();   -- a BEFORE trigger can change the row being written\n  return new;\nend;\n$$;\n\ncreate or replace trigger trg_customers_touch\nbefore update on customers\nfor each row execute function touch_updated_at();\n\nupdate customers set city = 'Paris' where first_name = 'Karim';\nselect first_name, city, updated_at from customers where first_name = 'Karim';", title: 'BEFORE trigger: maintain updated_at' },
      { sql: "alter table products disable trigger trg_price_audit;   -- e.g. during a bulk reload\nalter table products enable trigger trg_price_audit;\ndrop trigger if exists trg_customers_touch on customers;", title: 'Disable, enable, drop' },
      {
        table: {
          head: ['Choice', 'Options', 'Rule of thumb'],
          rows: [
            ['Timing', '`BEFORE`, `AFTER`, `INSTEAD OF` (views)', 'BEFORE to modify or reject the row; AFTER to react to it'],
            ['Level', '`FOR EACH ROW`, `FOR EACH STATEMENT`', 'statement-level for one action per bulk operation'],
            ['Return value', '`NEW`, `OLD`, `NULL`', 'returning NULL from a BEFORE row trigger silently skips the row'],
            ['Condition', '`WHEN (…)`', 'fire only on real changes'],
          ],
        },
      },
      { callout: 'trap', text: 'Triggers are invisible from the code that writes the data, slow down bulk loads, and make behaviour hard to debug. Keep them small (audit, timestamps). In pipelines prefer explicit steps; Snowflake and BigQuery don\'t even have triggers (Snowflake uses streams + tasks).' },
      { callout: 'de', text: 'A trigger-based audit table is a simple form of **change data capture** (CDC). At scale, CDC tools like Debezium read the WAL instead, without slowing down writes.' },
    ],
    practice: [
      { q: 'After running the audit example, show how many price changes were logged per product. Columns: `product_id`, `changes`.', solution: 'select product_id, count(*) as changes from price_audit group by product_id;', setup: true },
    ],
    interview: [
      { q: 'BEFORE vs AFTER trigger?', a: 'BEFORE row triggers run before the write and can modify NEW or cancel the row (return NULL): defaults, normalisation, validation. AFTER triggers run once the row is written and see the final values: audit logs, notifications, maintaining other tables.' },
    ],
    related: ['sql-functions', 'scd-type-2'],
  },
];
