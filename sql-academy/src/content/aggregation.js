export const aggregation = [
  {
    id: 'aggregate-functions',
    title: 'Aggregate functions',
    level: 'basic',
    summary: 'Aggregates turn many rows into one value: count, sum, avg, min, max, and more specialised ones like percentiles and string_agg.',
    body: [
      { p: 'An **aggregate function** reads a set of rows and returns a single value. Without `GROUP BY`, the whole table is one set and you get one row back.' },
      { sql: 'select count(*)              as products,\n       min(price)            as cheapest,\n       max(price)            as most_expensive,\n       round(avg(price), 2)  as average,\n       sum(price)            as total_catalogue\nfrom products;', title: 'One row summarising the table' },
      {
        table: {
          head: ['Function', 'Returns', 'NULLs'],
          rows: [
            ['`count(*)`', 'number of rows', 'counted'],
            ['`count(col)`, `count(distinct col)`', 'non-NULL values / distinct non-NULL values', 'ignored'],
            ['`sum`, `avg`, `min`, `max`', 'as named', 'ignored; `sum` of no rows is NULL'],
            ['`string_agg(col, \', \' order by …)`', 'values joined into one text', 'ignored'],
            ['`array_agg(col order by …)`', 'an array', 'kept'],
            ['`bool_and(cond)` / `bool_or(cond)`', 'all true / at least one true', 'ignored'],
            ['`percentile_cont(0.5) within group (order by x)`', 'interpolated median', 'ignored'],
            ['`percentile_disc(0.5) within group (order by x)`', 'a real value from the data', 'ignored'],
            ['`mode() within group (order by x)`', 'most frequent value', 'ignored'],
            ['`stddev`, `variance`, `corr(y, x)`', 'statistics', 'ignored'],
          ],
        },
      },
      { sql: "select string_agg(name, ', ' order by price desc)             as by_price,\n       percentile_cont(0.5) within group (order by price)    as median_price,\n       percentile_disc(0.5) within group (order by price)    as median_real_value,\n       bool_or(price > 1000)                                 as any_over_1000\nfrom products;", title: 'Text, percentiles and booleans' },
      { h: 'Mean vs median' },
      { p: 'The average is pulled by extreme values: one Electric bike at 1 890 € drags the mean far above what a typical product costs. The **median** (the middle value) resists outliers. When you report "typical" values (salary, basket size, delivery time), show the median too.' },
      { callout: 'trap', text: '`avg(col)` divides by the number of **non-NULL** values. If NULL really means 0 in your data, write `avg(coalesce(col, 0))`.' },
      { callout: 'trap', text: 'Integer averages: `avg()` on integers returns numeric in PostgreSQL, but `sum(int_col) / count(*)` is integer division and truncates. Multiply by `1.0` first.' },
    ],
    practice: [
      { q: 'How many customers live in Paris? (one number)', solution: "select count(*) from customers where city = 'Paris';" },
      { q: 'Total quantity of items ever ordered, and the number of distinct products ordered. Columns: `items`, `products`.', solution: 'select sum(quantity) as items, count(distinct product_id) as products from order_items;' },
    ],
    interview: [
      { q: 'What is the difference between percentile_cont and percentile_disc?', a: 'percentile_cont interpolates between the two middle values (can return a value not in the data); percentile_disc returns an actual value from the data set (the first value whose cumulative position reaches the percentile).' },
    ],
    related: ['group-by-having', 'null-logic', 'grouping-sets'],
  },
  {
    id: 'group-by-having',
    title: 'GROUP BY, HAVING and FILTER',
    level: 'basic',
    summary: 'GROUP BY splits rows into groups and computes aggregates per group; HAVING filters groups; FILTER restricts one aggregate.',
    body: [
      { p: '`GROUP BY` puts rows with the same values in the grouping columns together, and every aggregate is computed once per group. The output has one row per group.' },
      { sql: 'select category,\n       count(*)              as products,\n       round(avg(price), 2)  as avg_price,\n       max(price)            as max_price\nfrom products\ngroup by category\norder by products desc;', title: 'One row per category' },
      { callout: 'note', title: 'The golden rule', text: 'Every column in `SELECT` must either be in `GROUP BY` or be inside an aggregate. Otherwise the database doesn\'t know which of the group\'s values to show. (PostgreSQL lets you skip columns that depend on a grouped primary key.)' },
      { h: 'Three ways to filter' },
      {
        table: {
          head: ['Clause', 'When it runs', 'Filters', 'Example'],
          rows: [
            ['`WHERE`', 'before grouping', 'input rows', "`where status <> 'cancelled'`"],
            ['`HAVING`', 'after grouping', 'whole groups', '`having count(*) >= 2`'],
            ['`FILTER (WHERE …)`', 'inside one aggregate', 'rows fed to that aggregate only', "`count(*) filter (where status = 'paid')`"],
          ],
        },
      },
      { sql: "select customer_id,\n       count(*)                                   as orders,\n       count(*) filter (where status = 'shipped') as shipped,\n       sum(total) filter (where status = 'paid')  as awaiting_shipment\nfrom order_summary\nwhere customer_id is not null       -- rows: drop the guest order\ngroup by customer_id\nhaving count(*) >= 2;               -- groups: repeat customers only", title: 'WHERE, HAVING and FILTER together' },
      { p: 'Filtering in `WHERE` is also faster when possible: fewer rows reach the grouping step. Use `HAVING` only for conditions on aggregates.' },
      { sql: "select date_trunc('month', ordered_at)::date as month,\n       count(*) as orders,\n       sum(total) as revenue\nfrom order_summary\nwhere status <> 'cancelled'\ngroup by 1\norder by 1;", title: 'Group by an expression: revenue per month', note: '`group by 1` means "the first column of the SELECT list". Handy in exploration; name the expression in production code.' },
      { callout: 'trap', text: 'Grouping by a non-unique label merges different things: two customers both called "Martin" become one group. Group by the id, and show the name alongside.' },
    ],
    practice: [
      { q: 'Number of orders per status. Columns: `status`, `orders`.', solution: 'select status, count(*) as orders from orders group by status;' },
      { q: 'Revenue per category from `order_lines`, excluding cancelled orders. Columns: `category`, `revenue`.', solution: "select category, sum(revenue) as revenue\nfrom order_lines\nwhere status <> 'cancelled'\ngroup by category;" },
      { q: 'Cities with more than one customer. Columns: `city`, `customers`.', solution: 'select city, count(*) as customers from customers group by city having count(*) > 1;' },
    ],
    interview: [
      { q: 'Difference between WHERE and HAVING?', a: 'WHERE filters individual rows before grouping and cannot use aggregates. HAVING filters groups after aggregation and can. Put every condition that doesn\'t need an aggregate in WHERE: it is clearer and cheaper.' },
      { q: 'How do you count several conditions in one pass?', a: 'Conditional aggregation: `count(*) FILTER (WHERE …)` in PostgreSQL, or portably `sum(CASE WHEN … THEN 1 ELSE 0 END)`.' },
    ],
    related: ['aggregate-functions', 'grouping-sets', 'case-coalesce'],
  },
  {
    id: 'grouping-sets',
    title: 'GROUPING SETS, ROLLUP and CUBE',
    level: 'intermediate',
    summary: 'Compute several levels of aggregation (details, subtotals, grand total) in a single query.',
    body: [
      { p: 'Reports often need several levels at once: revenue per city and category, per city, and overall. Without special syntax you would write three `GROUP BY` queries and glue them with `UNION ALL`. **Grouping sets** do it in one pass.' },
      {
        table: {
          head: ['Syntax', 'Groupings produced for (city, category)', 'Use for'],
          rows: [
            ['`GROUPING SETS ((city, category), (city), ())`', 'exactly the ones you list', 'custom combinations'],
            ['`ROLLUP (city, category)`', '(city, category) → (city) → ()', 'hierarchies: year → month → day'],
            ['`CUBE (city, category)`', 'every combination, 2ⁿ groupings', 'cross-tab with all margins'],
          ],
        },
      },
      { sql: "select city, category, sum(revenue) as revenue\nfrom order_lines\nwhere status <> 'cancelled'\ngroup by grouping sets ((city, category), (city), ())\norder by city nulls last, category nulls last;", title: 'GROUPING SETS: details, city subtotals, grand total' },
      { p: 'In subtotal rows, the rolled-up column is NULL. But real data can also contain NULLs (the guest order has no city). The function `grouping(col)` returns **1** when the NULL comes from a subtotal and **0** for a real value, so you can label rows properly.' },
      { sql: "select case when grouping(city) = 1 then 'ALL CITIES' else coalesce(city, 'guest') end as city,\n       case when grouping(category) = 1 then 'ALL' else category end                     as category,\n       sum(revenue) as revenue\nfrom order_lines\nwhere status <> 'cancelled'\ngroup by rollup (city, category)\norder by grouping(city), city, grouping(category), category;", title: 'ROLLUP with readable labels' },
      { sql: 'select category, status, count(*) as lines, sum(revenue) as revenue\nfrom order_lines\ngroup by cube (category, status)\norder by category nulls last, status nulls last;', title: 'CUBE: every combination' },
      { callout: 'tip', text: 'BI tools (Power BI, Looker) usually compute subtotals themselves. Grouping sets shine when you build a summary table in the warehouse, or a quick report straight from SQL.' },
    ],
    practice: [
      { q: 'Number of order lines per category, plus a grand total row (category NULL). Columns: `category`, `lines`.', hint: '`group by rollup (category)`', solution: 'select category, count(*) as lines from order_lines group by rollup (category);' },
    ],
    interview: [
      { q: 'How do you distinguish a subtotal row from a real NULL in ROLLUP output?', a: 'With the GROUPING() function: it returns 1 when the column was aggregated away in that row (subtotal) and 0 when the NULL is a real value.' },
      { q: 'How many grouping combinations does CUBE(a, b, c) produce?', a: '2³ = 8: every subset of the three columns, from (a, b, c) down to the grand total ().' },
    ],
    related: ['group-by-having', 'case-coalesce'],
  },
];
