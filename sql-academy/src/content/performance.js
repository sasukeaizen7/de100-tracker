export const performance = [
  {
    id: 'explain',
    title: 'EXPLAIN: reading a query plan',
    level: 'advanced',
    summary: 'See how PostgreSQL will execute a query, and how long each step really took.',
    body: [
      { p: 'Before running a query, the **planner** considers many possible strategies (scan this table first or that one, use an index or not, hash or loop join) and picks the cheapest according to its statistics. `EXPLAIN` shows the chosen plan; `EXPLAIN ANALYZE` actually runs the query and adds real timings and row counts.' },
      { sql: 'explain\nselect * from orders where customer_id = 2;', title: 'The plan and its estimates' },
      { sql: "explain (analyze, buffers)\nselect c.city, sum(s.total)\nfrom order_summary s\njoin customers c using (customer_id)\ngroup by c.city;", title: 'Real execution: EXPLAIN ANALYZE' },
      { h: 'How to read it' },
      { list: [
        'A plan is a **tree**, read from the most indented line upwards: leaves read tables, parents combine their results.',
        '`cost=0.00..35.50` is in arbitrary units: startup cost .. total cost. Compare plans, don\'t interpret the number alone.',
        '`rows=` is the **estimate**; `actual … rows=` the reality. A big gap (estimated 1, actual 50 000) means stale statistics: run `ANALYZE table`.',
        'Look for the node with the most `actual time`, `Rows Removed by Filter` in the thousands (reading a lot to keep a little), and sorts that spill to disk.',
      ] },
      {
        table: {
          head: ['Node', 'What it does', 'Good when'],
          rows: [
            ['`Seq Scan`', 'reads the whole table', 'small tables, or most rows are needed'],
            ['`Index Scan`', 'walks an index, then fetches each row', 'few rows match'],
            ['`Index Only Scan`', 'answers from the index alone', 'all needed columns are in the index'],
            ['`Bitmap Heap Scan`', 'collects row locations from index(es), then reads pages in order', 'a medium share of rows; combining two indexes'],
            ['`Nested Loop`', 'for each outer row, look up matching inner rows', 'small outer side + index on the inner key'],
            ['`Hash Join`', 'builds a hash table from one side, probes with the other', 'large inputs, equality joins'],
            ['`Merge Join`', 'walks two sorted inputs in step', 'both sides already sorted'],
            ['`HashAggregate` / `GroupAggregate`', 'GROUP BY via hashing / on sorted input', '—'],
          ],
        },
      },
      { callout: 'trap', text: '`EXPLAIN ANALYZE` executes the statement. On an `UPDATE` or `DELETE`, wrap it: `BEGIN; EXPLAIN ANALYZE DELETE …; ROLLBACK;`' },
      { callout: 'note', text: 'On tiny tables like ours, PostgreSQL rightly prefers sequential scans: reading 8 rows is cheaper than walking an index. Plans only become interesting with thousands of rows: the next page generates some.' },
    ],
    practice: [
      { q: 'Run `explain` on a query that counts events per customer, and return the plan (one column `QUERY PLAN`).', solution: 'explain select customer_id, count(*) from events group by customer_id;' },
    ],
    interview: [
      { q: 'A query got slow. How do you investigate?', a: 'Reproduce it, run EXPLAIN (ANALYZE, BUFFERS), find the most expensive node, compare estimated vs actual rows (stale stats → ANALYZE), check for sequential scans with heavy filters (missing or unusable index), large sorts/hashes spilling to disk (work_mem), and row explosions from joins. Then test a fix and compare plans.' },
    ],
    related: ['indexes', 'partitioning'],
  },
  {
    id: 'indexes',
    title: 'Indexes',
    level: 'advanced',
    summary: 'Data structures that let PostgreSQL find rows without reading the whole table, at the cost of slower writes and disk space.',
    body: [
      { callout: 'analogy', text: 'An index is the index at the back of a book: to find "window functions" you don\'t read all 500 pages, you look up the term and jump to page 212. Like a book index, it must be updated whenever the content changes.' },
      { p: 'The default **B-tree** index keeps values sorted, so it answers equality, ranges, `ORDER BY` and prefix `LIKE` quickly. Let\'s create a bigger table so the planner has a reason to use one.' },
      { sql: "drop table if exists big_events;\ncreate table big_events as\nselect g as id,\n       (g % 1000) + 1                                as customer_id,\n       timestamptz '2026-01-01' + (g || ' minutes')::interval as occurred_at,\n       (array['page_view', 'add_to_cart', 'purchase'])[1 + g % 3] as event_type\nfrom generate_series(1, 200000) as g;\nanalyze big_events;\n\nexplain analyze select * from big_events where customer_id = 42;", title: 'Without an index: a sequential scan', note: 'The plan reads all 200 000 rows and removes almost all of them.' },
      { sql: "create index if not exists big_events_customer_idx on big_events (customer_id);\nexplain analyze select * from big_events where customer_id = 42;", title: 'With an index: a bitmap or index scan', note: 'Compare the execution time with the previous run.' },
      { h: 'Index types' },
      {
        table: {
          head: ['Type', 'Supports', 'Use for'],
          rows: [
            ['**B-tree** (default)', '`= < > BETWEEN`, `ORDER BY`, `LIKE \'abc%\'`', 'almost everything: ids, dates, foreign keys'],
            ['Hash', '`=` only', 'rarely better than B-tree'],
            ['**GIN**', 'contains: `@>`, `?`, arrays, full-text, trigrams', '`jsonb`, tags arrays, text search'],
            ['GiST', 'overlaps, nearest neighbour', 'geography (PostGIS), ranges, exclusion constraints'],
            ['**BRIN**', 'min/max per block range', 'huge append-only tables ordered by time: tiny index'],
          ],
        },
      },
      { h: 'Special B-tree indexes' },
      { sql: "-- composite: equality column first, then the range/sort column\ncreate index if not exists big_events_cust_time_idx on big_events (customer_id, occurred_at);\n-- partial: only the rows you query often (smaller, faster)\ncreate index if not exists big_events_purchase_idx on big_events (occurred_at) where event_type = 'purchase';\n-- expression: for queries that filter on a computed value\ncreate index if not exists customers_email_lower_idx on customers (lower(email));\n-- covering: extra columns stored in the index for index-only scans\ncreate index if not exists orders_customer_cover_idx on orders (customer_id) include (status);\n\nexplain select occurred_at from big_events\nwhere customer_id = 42 and occurred_at >= '2026-03-01'\norder by occurred_at;", title: 'Composite, partial, expression and covering indexes' },
      {
        table: {
          head: ['The index is ignored because…', 'Example', 'Fix'],
          rows: [
            ['a function wraps the column', '`where lower(email) = …` with an index on `email`', 'expression index on `lower(email)`'],
            ['the leading column of a composite index is missing', 'index `(customer_id, occurred_at)`, filter on `occurred_at` only', 'reorder, or add an index'],
            ['arithmetic on the column', "`where occurred_at + interval '1 day' > now()`", "move it: `occurred_at > now() - interval '1 day'`"],
            ['a leading wildcard', "`like '%bike'`", 'trigram GIN index (`pg_trgm`)'],
            ['a type mismatch', 'text column compared with a number', 'compare with the right type'],
            ['most rows match', "`where event_type <> 'purchase'`", 'nothing: a seq scan is faster'],
          ],
        },
      },
      { callout: 'trap', text: 'Every index slows down every insert and update, and takes disk space. Index foreign keys and the columns you filter, join and sort on; check `pg_stat_user_indexes` for indexes with `idx_scan = 0` and drop them.' },
      { callout: 'de', text: 'Columnar warehouses don\'t use B-tree indexes at all. Snowflake and BigQuery skip data using min/max metadata per micro-partition or block, so the equivalent skill is choosing good partitioning and clustering keys.' },
    ],
    practice: [
      { q: 'List the indexes of `big_events` from `pg_indexes` (run the examples first). Columns: `indexname`.', solution: "select indexname from pg_indexes where tablename = 'big_events';", setup: true },
    ],
    interview: [
      { q: 'In a composite index (a, b), which queries can use it?', a: 'Filters on a, or on a and b (equality on a + range or sort on b is ideal). A filter on b alone generally can\'t use it efficiently, because the index is sorted by a first (leftmost-prefix rule).' },
      { q: 'Why not index every column?', a: 'Each index must be updated on every write, consumes disk and memory, and adds planning choices. Unused indexes are pure cost.' },
    ],
    related: ['explain', 'pattern-matching', 'partitioning'],
  },
  {
    id: 'arrays',
    title: 'Arrays',
    level: 'intermediate',
    summary: 'Store a list in one column, build lists from rows, and explode lists back into rows.',
    body: [
      { p: 'PostgreSQL columns can hold arrays (`text[]`, `int[]`). They are handy for small lists that belong to the row, like tags, and for building lists in queries. For anything you join or update item by item, a separate table is still the better model.' },
      { sql: "select customer_id,\n       array_agg(order_id order by ordered_at) as orders,\n       cardinality(array_agg(order_id))        as n_orders\nfrom orders\nwhere customer_id is not null\ngroup by customer_id;", title: 'Rows → array with array_agg' },
      { sql: "alter table products add column if not exists tags text[] default '{}';\nupdate products set tags = array['commute', 'city']     where name = 'City bike';\nupdate products set tags = array['commute', 'electric'] where name = 'Electric bike';\nupdate products set tags = array['safety']              where name in ('Helmet', 'Front light', 'U-lock');\n\nselect name, tags,\n       tags[1]                as first_tag,   -- arrays start at 1\n       'commute' = any (tags) as is_commute\nfrom products;", title: 'An array column' },
      {
        table: {
          head: ['Operator / function', 'Meaning', 'Example'],
          rows: [
            ['`arr[1]`, `arr[2:3]`', 'element, slice (1-based)', '`tags[1]`'],
            ['`x = ANY (arr)`', 'x is in the array', "`'safety' = any (tags)`"],
            ['`@>`', 'contains all of', "`tags @> array['commute']`"],
            ['`&&`', 'overlaps (shares an element)', "`tags && array['safety', 'kids']`"],
            ['`unnest(arr)`', 'one row per element', '`select unnest(tags)`'],
            ['`array_length`, `cardinality`', 'size', '`cardinality(tags)`'],
            ['`array_append`, `||`', 'add elements', "`tags || 'sale'`"],
          ],
        },
      },
      { sql: "select name from products where tags @> array['commute'];\n\nselect tag, count(*) as products\nfrom products, unnest(tags) as tag\ngroup by tag\norder by products desc;", title: 'Search and explode' },
      { callout: 'tip', text: 'A GIN index (`create index on products using gin (tags)`) makes `@>` and `&&` fast on big tables.' },
    ],
    practice: [
      { q: 'For each category, an array of its product names sorted by price. Columns: `category`, `products`.', solution: 'select category, array_agg(name order by price) as products from products group by category;' },
    ],
    interview: [
      { q: 'When would you not use an array column?', a: 'When elements need their own attributes, foreign keys, frequent individual updates, or are joined to other tables: then a child table (one row per element) is the normalised, indexable design.' },
    ],
    related: ['json', 'lateral'],
  },
  {
    id: 'json',
    title: 'JSON and JSONB',
    level: 'intermediate',
    summary: 'Store semi-structured data, extract fields, search inside documents and build JSON output.',
    body: [
      { p: 'APIs return JSON, and data engineers land it in the database before modelling it. PostgreSQL has two JSON types; you almost always want **jsonb**, a parsed binary format that is fast to query and can be indexed.' },
      {
        table: {
          head: ['', '`json`', '`jsonb`'],
          rows: [
            ['Stored as', 'the exact text', 'parsed binary'],
            ['Keeps key order, whitespace, duplicate keys', '+ yes', '- no (last duplicate wins)'],
            ['Query speed', '- reparsed every time', '+ fast'],
            ['GIN index, `@>` containment', '- no', '+ yes'],
            ['Verdict', 'only to keep the raw text byte for byte', '+ default choice'],
          ],
        },
      },
      {
        table: {
          head: ['Operator / function', 'Returns', 'Example'],
          rows: [
            ['`->`', 'jsonb', "`payload -> 'filters'`"],
            ['`->>`', 'text', "`payload ->> 'type'`"],
            ['`#>>`', 'text at a path', "`payload #>> '{filters,0}'`"],
            ['`@>`', 'contains', "`payload @> '{\"device\":\"mobile\"}'`"],
            ['`?`', 'key exists', "`payload ? 'amount'`"],
            ['`jsonb_array_elements(_text)`', 'one row per element', 'explode a list'],
            ['`jsonb_build_object`, `jsonb_agg`', 'build JSON', 'API-shaped output'],
            ['`||`, `-`, `jsonb_set`', 'modified jsonb', 'merge, remove, replace keys'],
          ],
        },
      },
      { sql: "select event_id, customer_id,\n       payload ->> 'type'               as event_type,\n       payload ->> 'page'               as page,\n       payload ->> 'device'             as device,\n       (payload ->> 'product_id')::int  as product_id,\n       (payload ->> 'amount')::numeric  as amount\nfrom events\norder by occurred_at;", title: 'Flatten raw JSON into typed columns', note: 'This is the "staging" step of ELT: land raw JSON, then expose clean typed columns.' },
      { sql: "select count(*) as mobile_events from events where payload @> '{\"device\": \"mobile\"}';\nselect event_id, payload ->> 'type' as type from events where payload ? 'amount';", title: 'Search inside documents' },
      { sql: "select e.event_id, f.filter\nfrom events e\ncross join lateral jsonb_array_elements_text(e.payload -> 'filters') as f(filter);", title: 'Explode a JSON array into rows' },
      { sql: "select jsonb_build_object(\n         'customer', c.first_name,\n         'orders', coalesce(\n            jsonb_agg(jsonb_build_object('id', s.order_id, 'total', s.total) order by s.order_id)\n              filter (where s.order_id is not null),\n            '[]'::jsonb)\n       ) as document\nfrom customers c\nleft join order_summary s on s.customer_id = c.customer_id\ngroup by c.customer_id, c.first_name;", title: 'Build nested JSON from rows' },
      { sql: "select payload || '{\"campaign\": \"spring\"}'         as added,\n       payload - 'device'                          as removed,\n       jsonb_set(payload, '{device}', '\"tablet\"')  as replaced\nfrom events where event_id = 1;", title: 'Modify a document' },
      { callout: 'de', text: 'Land API responses as raw `jsonb` first: you never lose a field, and a new field never breaks the load. Then flatten into typed columns in a staging model, where a type error is caught and tested.' },
    ],
    practice: [
      { q: 'Number of events per `type` (from the JSON payload). Columns: `type`, `events`.', solution: "select payload ->> 'type' as type, count(*) as events from events group by 1;" },
      { q: 'Total of `amount` across purchase events. Column: `revenue`.', solution: "select sum((payload ->> 'amount')::numeric) as revenue from events where payload ->> 'type' = 'purchase';" },
    ],
    interview: [
      { q: 'json vs jsonb?', a: 'json stores the original text (preserving formatting, key order and duplicates) and reparses on every access. jsonb stores a decomposed binary form: slightly slower to write, much faster to query, supports containment operators and GIN indexes. Use jsonb unless you must keep the exact text.' },
    ],
    related: ['arrays', 'lateral', 'incremental-loads'],
  },
];
