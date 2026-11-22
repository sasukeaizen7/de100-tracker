export const beyond = [
  {
    id: 'oltp-olap',
    title: 'OLTP vs OLAP, rows vs columns',
    level: 'intermediate',
    summary: 'Operational databases and analytical warehouses store data differently because they answer different questions.',
    body: [
      { p: 'An **OLTP** database (PostgreSQL behind an app) handles many tiny transactions: place this order, update that address. An **OLAP** system (Snowflake, BigQuery, DuckDB) handles few huge questions: revenue per month for three years. The physical storage follows the workload.' },
      {
        table: {
          head: ['', 'OLTP', 'OLAP'],
          rows: [
            ['Typical query', 'fetch / update one order by id', 'aggregate millions of rows'],
            ['Storage layout', 'row-oriented: a row\'s values together', 'column-oriented: a column\'s values together, compressed'],
            ['`SELECT *`', '+ cheap', '- reads every column (and costs money on BigQuery)'],
            ['Indexes', 'B-trees on keys', 'min/max metadata per block, partitions, clustering'],
            ['Modelling', 'normalized (3NF)', 'star schema, wide tables'],
            ['Constraints', '+ enforced', '- declared but mostly not enforced: test the data'],
            ['Writes', 'row by row, concurrent', 'batch loads, append-mostly'],
            ['Examples', 'PostgreSQL, MySQL, SQL Server', 'Snowflake, BigQuery, Redshift, ClickHouse, DuckDB'],
          ],
        },
      },
      { callout: 'analogy', text: 'Row storage is a stack of filled-in forms: perfect to pull out one customer\'s whole form. Column storage is the same data as one list per field: perfect to add up every "amount" without touching the names and addresses.' },
      { p: 'Columnar engines compress each column well (similar values sit together) and read only the columns a query names. That is why selecting 3 columns from a 200-column table is fast in a warehouse, and why you should never write `SELECT *` there.' },
      { callout: 'de', text: 'The modern pattern: the app writes to PostgreSQL (OLTP); a pipeline extracts changes into a warehouse (OLAP), where dbt models it into facts and dimensions for BI. DuckDB brings the OLAP engine onto your laptop for local analytics.' },
    ],
    practice: [
      { q: 'Write the analytical query a warehouse is built for: revenue per category per month (cancelled excluded). Columns: `month`, `category`, `revenue`.', solution: "select date_trunc('month', ordered_at)::date as month, category, sum(revenue) as revenue\nfrom order_lines where status <> 'cancelled'\ngroup by 1, 2;" },
    ],
    interview: [
      { q: 'Why is columnar storage faster for analytics?', a: 'Queries read only the columns they need, columns compress very well (similar values together), and engines process column chunks with vectorised execution and skip blocks using min/max statistics.' },
    ],
    related: ['normalization', 'dialects', 'indexes'],
  },
  {
    id: 'dialects',
    title: 'SQL dialects compared',
    level: 'intermediate',
    summary: 'PostgreSQL, Snowflake, BigQuery, DuckDB and SQL Server share the concepts but not all the syntax.',
    body: [
      { p: 'Everything you learned transfers, but each engine has its own spelling for some functions. These differences come up constantly when you move a query from a local Postgres to the company warehouse.' },
      {
        table: {
          head: ['Feature', 'PostgreSQL', 'Snowflake', 'BigQuery', 'DuckDB', 'SQL Server'],
          rows: [
            ['Limit rows', '`LIMIT n`', '`LIMIT n`', '`LIMIT n`', '`LIMIT n`', '`TOP n` / `OFFSET … FETCH`'],
            ['Concatenate', '`||`', '`||`', '`||`, `CONCAT`', '`||`', '`+`, `CONCAT`'],
            ['Case-insensitive LIKE', '`ILIKE`', '`ILIKE`', '`LOWER(x) LIKE`', '`ILIKE`', 'collation (usually insensitive)'],
            ['`7 / 2`', '3', '3.5', '3.5', '3.5 (`//` for 3)', '3'],
            ['Truncate a date', "`date_trunc('month', d)`", "`DATE_TRUNC('month', d)`", '`DATE_TRUNC(d, MONTH)`', "`date_trunc('month', d)`", '`DATETRUNC(month, d)`'],
            ['Filter on a window', 'subquery', '`QUALIFY`', '`QUALIFY`', '`QUALIFY`', 'subquery'],
            ['First row per group', '`DISTINCT ON`', '`QUALIFY row_number() … = 1`', '`QUALIFY`', '`DISTINCT ON`, `QUALIFY`', '`row_number()` subquery'],
            ['Upsert', '`ON CONFLICT`, `MERGE`', '`MERGE`', '`MERGE`', '`ON CONFLICT`, `MERGE`', '`MERGE`'],
            ['Text aggregation', '`string_agg`', '`LISTAGG`', '`STRING_AGG`', '`string_agg`', '`STRING_AGG`'],
            ['JSON field', "`col ->> 'k'`", '`col:k::string`', "`JSON_VALUE(col, '$.k')`", "`col ->> 'k'`", "`JSON_VALUE(col, '$.k')`"],
            ['Explode an array', '`unnest`', '`LATERAL FLATTEN`', '`UNNEST`', '`unnest`', '`OPENJSON`, `STRING_SPLIT`'],
            ['Series of dates', '`generate_series`', '`GENERATOR` + `DATEADD`', '`GENERATE_DATE_ARRAY`', '`generate_series`, `range`', '`GENERATE_SERIES`'],
            ['Safe cast', '`pg_input_is_valid` (16+)', '`TRY_CAST`', '`SAFE_CAST`', '`TRY_CAST`', '`TRY_CAST`'],
            ['Triggers', '+ yes', '- no (streams + tasks)', '- no', '- no', '+ yes'],
            ['Pricing', 'your server', 'warehouse compute time + storage', 'bytes scanned (or slots) + storage', 'free, in-process', 'licence / cloud'],
          ],
        },
      },
      { sql: "-- PostgreSQL has no QUALIFY: the portable form works everywhere\nselect * from (\n  select customer_id, order_id, ordered_at,\n         row_number() over (partition by customer_id order by ordered_at desc) as rn\n  from orders\n) t\nwhere rn = 1;\n\n-- Snowflake / BigQuery / DuckDB:\n-- select customer_id, order_id, ordered_at from orders\n-- qualify row_number() over (partition by customer_id order by ordered_at desc) = 1;", title: 'QUALIFY vs the portable subquery' },
      { callout: 'tip', text: 'dbt helps with portability: cross-database macros like `{{ dbt.date_trunc(\'month\', \'ordered_at\') }}` and `{{ dbt.safe_cast(…) }}` compile to the right syntax for each warehouse.' },
    ],
    practice: [
      { q: 'Rewrite this Snowflake query for PostgreSQL: `select name, price from products qualify rank() over (partition by category order by price) = 1`. Columns: `name`, `price`.', solution: 'select name, price from (\n  select name, price, rank() over (partition by category order by price) as r from products\n) t where r = 1;' },
    ],
    interview: [
      { q: 'What changes when you move a query from PostgreSQL to BigQuery?', a: 'Date functions (DATE_TRUNC argument order), integer division (BigQuery returns FLOAT64), no ILIKE, QUALIFY becomes available, arrays/JSON use UNNEST and JSON_VALUE, and cost is driven by bytes scanned, so selecting fewer columns and filtering on partition columns matters.' },
    ],
    related: ['oltp-olap', 'window-basics'],
  },
];
