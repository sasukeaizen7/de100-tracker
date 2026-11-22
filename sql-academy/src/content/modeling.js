export const modeling = [
  {
    id: 'data-types',
    title: 'Choosing data types',
    level: 'basic',
    summary: 'The type of a column is its first data-quality rule: it decides what can be stored, how it sorts and how fast it is.',
    body: [
      { p: 'Every column has a type. A good type rejects bad data for free (you can\'t store "tomorrow" in a `date`), sorts correctly (dates as dates, not as text), and uses less space.' },
      {
        table: {
          head: ['Need', 'Choose', 'Avoid'],
          rows: [
            ['Identifiers', '`bigint generated always as identity`, or `uuid`', '`serial` in new code (older syntax)'],
            ['Counts', '`int` / `bigint`', '`numeric` (slower)'],
            ['Money', '`numeric(12,2)` or integer cents', '- `float`, `real`, `money`'],
            ['Text', '`text` (or `varchar(n)` to enforce a limit)', '`char(n)`: pads with spaces'],
            ['Yes / no', '`boolean`', "`'Y'/'N'` text"],
            ['Instants', '`timestamptz`', '`timestamp` for events, text dates'],
            ['Calendar days', '`date`', 'timestamps at midnight'],
            ['Durations', '`interval`', 'integers of unknown unit'],
            ['Semi-structured', '`jsonb`', '`json` (slower), text blobs'],
            ['Lists', '`text[]`, `int[]`', 'comma-separated text'],
            ['Fixed set of values', '`text` + `CHECK (x in (…))`, or a lookup table', 'magic numbers'],
          ],
        },
      },
      { sql: "select pg_typeof(1)            as int_literal,\n       pg_typeof(1.5)          as decimal_literal,\n       pg_typeof('2026-04-01'::date) as date_cast,\n       pg_typeof(now())        as now_type,\n       pg_typeof(price)        as price_type\nfrom products limit 1;", title: 'Ask PostgreSQL what type something is' },
      { callout: 'tip', text: '`text` and `varchar(n)` have the same speed in PostgreSQL. Use `varchar(n)` only when the limit is a real business rule (a 2-letter country code), not "just in case".' },
      { callout: 'de', text: 'Warehouses have their own type names (Snowflake `NUMBER`, `VARCHAR`, `VARIANT`; BigQuery `INT64`, `NUMERIC`, `STRING`, `JSON`, `TIMESTAMP` which is always UTC). The principles are the same: exact decimals for money, instants in UTC.' },
    ],
    practice: [
      { q: 'Show the data type of every column of `orders` from `information_schema.columns`. Columns: `column_name`, `data_type`.', solution: "select column_name, data_type from information_schema.columns\nwhere table_schema = 'public' and table_name = 'orders';" },
    ],
    interview: [
      { q: 'serial vs identity columns?', a: 'Both auto-generate integers from a sequence. Identity (`GENERATED ALWAYS AS IDENTITY`) is the SQL-standard form: the sequence is owned by the column, permissions are simpler, and ALWAYS prevents accidental manual values.' },
    ],
    related: ['constraints', 'numbers-casting'],
  },
  {
    id: 'constraints',
    title: 'Keys and constraints',
    level: 'basic',
    summary: 'Constraints are rules the database enforces on every write: the cheapest data-quality checks you will ever get.',
    body: [
      { p: 'A **constraint** rejects any insert or update that would break a rule. Bad data is stopped at the door, instead of being discovered weeks later in a dashboard.' },
      {
        table: {
          head: ['Constraint', 'Guarantees', 'NULL allowed', 'Index created'],
          rows: [
            ['`PRIMARY KEY`', 'each row is unique and identifiable', '- no', '+ yes'],
            ['`UNIQUE`', 'no duplicate values', '+ yes, several (unless `NULLS NOT DISTINCT`)', '+ yes'],
            ['`FOREIGN KEY … REFERENCES`', 'the value exists in the parent table', '+ yes', '- no: add one yourself'],
            ['`NOT NULL`', 'a value is present', '—', '- no'],
            ['`CHECK (expr)`', 'a boolean rule holds', 'NULL passes the check', '- no'],
            ['`EXCLUDE`', 'no two rows overlap (bookings)', '—', '+ GiST index'],
          ],
        },
      },
      { sql: "drop table if exists reviews;\ncreate table reviews (\n  review_id   bigint generated always as identity primary key,\n  product_id  int not null references products (product_id) on delete cascade,\n  customer_id int references customers (customer_id) on delete set null,\n  stars       smallint not null check (stars between 1 and 5),\n  review_text text check (length(review_text) <= 2000),\n  created_at  timestamptz not null default now(),\n  unique (product_id, customer_id)\n);\ncreate index on reviews (customer_id);   -- foreign keys aren't indexed automatically\n\ninsert into reviews (product_id, customer_id, stars, review_text)\nvalues (1, 1, 5, 'Perfect for commuting');\nselect * from reviews;", title: 'A table with every kind of constraint' },
      { sql: "insert into reviews (product_id, customer_id, stars) values (1, 2, 6);", title: 'Rejected: CHECK constraint', expectError: true, note: 'Run it: the error names the constraint that failed. Try a product_id that doesn\'t exist, or the same (product, customer) twice.' },
      { h: 'What happens to children when a parent is deleted' },
      {
        table: {
          head: ['`ON DELETE …`', 'Effect', 'Example'],
          rows: [
            ['`NO ACTION` / `RESTRICT` (default)', 'the delete fails', 'can\'t delete a customer who has orders'],
            ['`CASCADE`', 'children are deleted too', 'delete an order → its items go'],
            ['`SET NULL`', 'children stay, key becomes NULL', 'a deleted customer\'s reviews stay anonymous'],
            ['`SET DEFAULT`', 'key becomes its default', 'reassign to a placeholder'],
          ],
        },
      },
      { sql: 'delete from customers where customer_id = 1;', title: 'Rejected: customer 1 still has orders', expectError: true, note: '`orders.customer_id` references customers with the default NO ACTION, so the delete is refused.' },
      { callout: 'de', text: 'Snowflake and BigQuery let you declare primary and foreign keys but **do not enforce** them. In a warehouse, uniqueness and relationships are checked by tests (dbt `unique`, `relationships`), not by the engine.' },
    ],
    practice: [
      { q: 'List the constraints of the `orders` table from `information_schema.table_constraints`. Columns: `constraint_name`, `constraint_type`.', solution: "select constraint_name, constraint_type from information_schema.table_constraints\nwhere table_schema = 'public' and table_name = 'orders';" },
    ],
    interview: [
      { q: 'PRIMARY KEY vs UNIQUE?', a: 'One primary key per table, never NULL, the row\'s identity. A table can have several UNIQUE constraints and they allow NULLs (multiple NULLs are considered distinct by default). Both create a unique index.' },
      { q: 'Are foreign keys indexed automatically in PostgreSQL?', a: 'No. Only the referenced (parent) key has an index. Index the referencing column yourself, or deletes on the parent and joins become slow.' },
    ],
    related: ['data-types', 'alter-metadata', 'data-quality'],
  },
  {
    id: 'alter-metadata',
    title: 'ALTER TABLE, comments and the information schema',
    level: 'intermediate',
    summary: 'Change tables safely after they exist, document them, and query the database about its own structure.',
    body: [
      { p: 'Tables evolve: new columns, renamed fields, new rules. `ALTER TABLE` changes the structure in place. Most changes are instant; some rewrite the table or lock it, which matters on big production tables.' },
      { sql: "alter table customers add column if not exists phone text;\nalter table customers rename column phone to phone_number;\nalter table customers alter column city set default 'Paris';\nalter table customers add constraint phone_format check (phone_number ~ '^\\+?[0-9 ]+$');\nalter table customers drop constraint phone_format;\nalter table customers drop column phone_number;\nalter table customers alter column city drop default;", title: 'Common ALTER TABLE operations' },
      { sql: "alter table customers add constraint email_has_at check (email like '%@%') not valid;\nalter table customers validate constraint email_has_at;\nalter table customers drop constraint email_has_at;", title: 'Add a constraint without blocking a big table', note: '`NOT VALID` applies the rule to new rows immediately without scanning old ones; `VALIDATE` checks the old rows later with a lighter lock.' },
      { h: 'Documenting with COMMENT' },
      { sql: "comment on table orders is 'One row per customer order; guest checkouts have no customer_id';\ncomment on column orders.status is 'paid → shipped, or cancelled';\n\nselect obj_description('orders'::regclass)       as table_comment,\n       col_description('orders'::regclass, 4)     as status_comment;", title: 'Comments live in the database' },
      { h: 'Querying the structure' },
      { sql: "select table_name, column_name, data_type, is_nullable, column_default\nfrom information_schema.columns\nwhere table_schema = 'public' and table_name in ('orders', 'order_items')\norder by table_name, ordinal_position;", title: 'Columns from information_schema' },
      { sql: "select c.relname as table_name,\n       pg_size_pretty(pg_total_relation_size(c.oid)) as total_size,\n       c.reltuples::bigint as estimated_rows\nfrom pg_class c\njoin pg_namespace n on n.oid = c.relnamespace\nwhere n.nspname = 'public' and c.relkind = 'r'\norder by pg_total_relation_size(c.oid) desc;", title: 'Table sizes from pg_catalog' },
      {
        table: {
          head: ['', '`information_schema`', '`pg_catalog`'],
          rows: [
            ['Standard', '+ SQL standard: works on most databases', '- PostgreSQL only'],
            ['Content', 'tables, columns, constraints, views, privileges', 'everything: sizes, indexes, statistics, comments'],
            ['Use for', 'portable schema-drift checks', 'administration and tuning'],
          ],
        },
      },
      { callout: 'de', text: 'Schema-drift detection ("did the source add or drop a column?") is just a query on `information_schema.columns` compared with yesterday\'s snapshot.' },
    ],
    practice: [
      { q: 'Count the columns of each table in the `public` schema. Columns: `table_name`, `columns`.', solution: "select table_name, count(*) as columns from information_schema.columns\nwhere table_schema = 'public'\ngroup by table_name;" },
    ],
    interview: [
      { q: 'How would you add a NOT NULL column to a 500-million-row table with minimal downtime?', a: 'Add it as nullable (instant), backfill in batches, add a CHECK (col IS NOT NULL) NOT VALID, VALIDATE it, then SET NOT NULL (PostgreSQL uses the validated check to skip the scan). Or add it with a constant DEFAULT, which is instant since PostgreSQL 11.' },
    ],
    related: ['constraints', 'data-types'],
  },
  {
    id: 'normalization',
    title: 'Normalization and star schemas',
    level: 'intermediate',
    summary: 'Operational databases are normalized to avoid duplicated data; warehouses use star schemas to make analysis simple and fast.',
    body: [
      { p: '**Normalization** splits data into tables so each fact is stored exactly once. It prevents anomalies: if a customer\'s email lived on every order, changing it would mean updating many rows, and missing one leaves the data inconsistent.' },
      {
        table: {
          head: ['Normal form', 'Rule (simplified)', 'Violation example'],
          rows: [
            ['1NF', 'one value per cell, no repeating groups', 'a `phones` column holding "06…, 07…"'],
            ['2NF', 'every non-key column depends on the **whole** key', '`product_name` in `order_items` (depends on product_id only)'],
            ['3NF', 'non-key columns depend **only** on the key', '`city_population` in `customers` (depends on city)'],
          ],
        },
      },
      { p: 'Analytics has different needs: few writes, huge reads, many joins per question. Warehouses therefore use **dimensional modelling**: a **fact** table holds the events and their measures at a clear grain, surrounded by **dimension** tables that describe them.' },
      { diagram: 'star' },
      { sql: "-- a fact table at the order-line grain, built from the normalized tables\ndrop table if exists fact_sales;\ncreate table fact_sales as\nselect oi.order_id,\n       oi.product_id,\n       o.customer_id,\n       o.ordered_at::date                as date_key,\n       oi.quantity,\n       oi.quantity * p.price             as revenue\nfrom order_items oi\njoin orders o   on o.order_id = oi.order_id\njoin products p on p.product_id = oi.product_id\nwhere o.status <> 'cancelled';\n\nselect * from fact_sales order by order_id;", title: 'Build a small fact table' },
      {
        table: {
          head: ['', 'Normalized (3NF)', 'Star schema'],
          rows: [
            ['Built for', 'OLTP: many small, safe writes', 'OLAP: big, simple reads'],
            ['Duplication', '+ none', '~ some, in dimensions (by design)'],
            ['Joins per question', 'many', 'few: fact → dimensions'],
            ['Who designs it', 'application developers', 'data engineers / analytics engineers'],
            ['Variants', '—', 'snowflake schema (normalized dimensions), one big table (OBT)'],
          ],
        },
      },
      { callout: 'de', text: 'Kimball\'s method in four steps: choose the business process (sales), declare the grain (one row per order line), identify the dimensions (date, customer, product), identify the facts (quantity, revenue). Interviewers love asking you to model a case this way.' },
    ],
    practice: [
      { q: 'From `fact_sales` (run the example above first), revenue per customer. Columns: `customer_id`, `revenue`.', solution: 'select customer_id, sum(revenue) as revenue from fact_sales group by customer_id;', setup: true },
    ],
    interview: [
      { q: 'Fact table vs dimension table?', a: 'A fact table records events/measurements at a defined grain (sales lines with quantity and revenue) plus foreign keys; it is long and narrow. Dimension tables describe the who/what/where/when (customer, product, date) with descriptive attributes; they are short and wide.' },
      { q: 'Why denormalize in a warehouse?', a: 'Reads dominate and storage is cheap; fewer joins make queries simpler for analysts and faster on columnar engines. Writes are batch loads controlled by the pipeline, so update anomalies are managed there.' },
    ],
    related: ['relational-model', 'scd-type-2', 'oltp-olap'],
  },
  {
    id: 'insert-update-delete',
    title: 'INSERT, UPDATE and DELETE',
    level: 'basic',
    summary: 'Write data: insert rows (or a query result), update them from other tables, delete them, and get the changed rows back.',
    body: [
      { sql: "drop table if exists wishlist;\ncreate table wishlist (\n  customer_id int references customers (customer_id),\n  product_id  int references products (product_id),\n  added_at    timestamptz default now(),\n  primary key (customer_id, product_id)\n);\n\ninsert into wishlist (customer_id, product_id)\nvalues (1, 2), (3, 2), (6, 5)\nreturning *;", title: 'INSERT several rows and RETURNING' },
      { sql: "insert into wishlist (customer_id, product_id)\nselect customer_id, 3\nfrom customers\nwhere city = 'Paris'\non conflict do nothing\nreturning customer_id, product_id;", title: 'INSERT … SELECT: insert a query\'s result', note: 'Every Paris customer gets the Helmet on their wishlist; `on conflict do nothing` skips pairs that already exist.' },
      { sql: "update wishlist w\nset added_at = '2026-01-01'\nfrom customers c\nwhere c.customer_id = w.customer_id\n  and c.city = 'Lyon'\nreturning w.*;", title: 'UPDATE … FROM: update using another table' },
      { sql: "delete from wishlist w\nusing products p\nwhere p.product_id = w.product_id\n  and p.category = 'accessories'\nreturning w.*;", title: 'DELETE … USING: delete using another table' },
      { callout: 'tip', title: 'The safe workflow', text: 'Write the `WHERE` as a `SELECT` first and check the rows. Then turn it into the UPDATE or DELETE, inside `BEGIN; … ROLLBACK;` until you are sure. `RETURNING` shows exactly what changed.' },
      { sql: "begin;\n  delete from wishlist;             -- oops, no WHERE\n  select count(*) from wishlist;    -- 0\nrollback;\nselect count(*) from wishlist;      -- everything is back", title: 'Undo a mistake inside a transaction' },
      {
        table: {
          head: ['', '`DELETE`', '`TRUNCATE`', '`DROP TABLE`'],
          rows: [
            ['Removes', 'rows matching `WHERE`', 'all rows', 'the table itself'],
            ['Speed on big tables', '- row by row', '+ instant', '+ instant'],
            ['Fires row triggers', '+ yes', '- no', '- no'],
            ['Can be rolled back (PostgreSQL)', '+ yes', '+ yes', '+ yes'],
            ['Resets identity', '- no', '~ with `RESTART IDENTITY`', '—'],
          ],
        },
      },
    ],
    practice: [
      { q: 'Return (with a SELECT) what an update would change: products in `accessories` with the price lowered by 10%. Columns: `name`, `old_price`, `new_price` (rounded to 2).', solution: "select name, price as old_price, round(price * 0.9, 2) as new_price\nfrom products where category = 'accessories';" },
    ],
    interview: [
      { q: 'DELETE vs TRUNCATE?', a: 'DELETE removes rows one by one (optionally filtered), fires triggers and leaves dead tuples for VACUUM. TRUNCATE drops all rows at once by replacing the table\'s storage: much faster, no row triggers, needs stronger locks. Both are transactional in PostgreSQL.' },
    ],
    related: ['upsert-merge', 'transactions'],
  },
  {
    id: 'upsert-merge',
    title: 'Upserts: ON CONFLICT and MERGE',
    level: 'intermediate',
    summary: 'Insert new rows and update existing ones in one statement: the heart of every idempotent load.',
    body: [
      { p: 'A pipeline that re-runs must not create duplicates. The standard pattern: load the new batch into a **staging table**, then **upsert** it into the target: insert rows whose key is new, update rows whose key exists.' },
      { sql: "drop table if exists products_staging;\ncreate table products_staging (like products);\ninsert into products_staging values\n  (3,   'Helmet',     'accessories', 44.90),   -- price change\n  (6,   'Repair kit', 'parts',       15.00),   -- unchanged\n  (100, 'Pump',       'parts',       19.90);   -- new\n\ninsert into products (product_id, name, category, price)\nselect product_id, name, category, price from products_staging\non conflict (product_id) do update\n  set name = excluded.name,\n      category = excluded.category,\n      price = excluded.price\n  where products.price is distinct from excluded.price   -- skip no-op updates\nreturning product_id, name, price;", title: 'INSERT … ON CONFLICT DO UPDATE', note: '`excluded` is the row that failed to insert. Only the Helmet (changed) and the Pump (new) are returned: the unchanged Repair kit is skipped.' },
      { sql: "merge into products t\nusing products_staging s on t.product_id = s.product_id\nwhen matched and t.price <> s.price then\n  update set price = s.price\nwhen not matched then\n  insert (product_id, name, category, price)\n  values (s.product_id, s.name, s.category, s.price);", title: 'MERGE (PostgreSQL 15+, Snowflake, BigQuery, SQL Server)' },
      {
        table: {
          head: ['', '`INSERT … ON CONFLICT`', '`MERGE`'],
          rows: [
            ['Needs a unique constraint', '+ yes, the conflict target', '- no: any join condition'],
            ['Can delete rows', '- no', '+ `WHEN MATCHED THEN DELETE`'],
            ['Safe under concurrent inserts', '+ yes, atomic', '~ may fail on a race: retry'],
            ['Portability', 'PostgreSQL, SQLite, DuckDB', 'SQL standard: most warehouses'],
            ['Typical use', 'application upserts, Postgres loads', 'warehouse loads with insert/update/delete rules'],
          ],
        },
      },
      { callout: 'de', text: 'dbt\'s `incremental` models with a `unique_key` compile to exactly this: a MERGE (or delete + insert) from a temporary table of new rows into the target.' },
      { callout: 'trap', text: 'An upsert keyed on the wrong column creates duplicates silently. The conflict target must be the true business key, backed by a unique constraint.' },
    ],
    practice: [
      { q: 'Write a SELECT that previews which staging rows are **new** (not in `products`). Run the first example first. Columns: `product_id`, `name`.', solution: 'select s.product_id, s.name from products_staging s\nwhere not exists (select 1 from products p where p.product_id = s.product_id);', setup: true },
    ],
    interview: [
      { q: 'How do you make a load idempotent?', a: 'Running it twice must give the same result as once: stage the batch, then upsert/MERGE on a business key (or delete-and-reinsert the partition being reloaded) inside one transaction. Never append blindly.' },
    ],
    related: ['insert-update-delete', 'incremental-loads', 'scd-type-2'],
  },
];
