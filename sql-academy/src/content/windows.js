export const windows = [
  {
    id: 'window-basics',
    title: 'Window functions: the OVER clause',
    level: 'intermediate',
    summary: 'Compute across related rows while keeping every row: totals, ranks and comparisons without collapsing the result.',
    body: [
      { p: '`GROUP BY` collapses each group into one row. A **window function** computes over a group of rows too, but it returns a value **for every row**, so you can show a detail row next to a group-level number.' },
      { sql: "select name, category, price,\n       sum(price) over ()                          as all_products_total,\n       sum(price) over (partition by category)     as category_total,\n       round(100.0 * price / sum(price) over (partition by category), 1) as pct_of_category\nfrom products\norder by category, price desc;", title: 'Detail rows with group totals' },
      { h: 'Anatomy of OVER' },
      {
        table: {
          head: ['Part', 'Meaning', 'If omitted'],
          rows: [
            ['`PARTITION BY cols`', 'restart the calculation for each group', 'all rows form one partition'],
            ['`ORDER BY cols`', 'order of rows inside the partition', 'no order: ranks are meaningless; aggregates see the whole partition'],
            ['frame `ROWS/RANGE BETWEEN …`', 'which rows around the current one are visible', 'with ORDER BY: from the start to the current row (and its ties)'],
          ],
        },
      },
      { callout: 'analogy', text: 'Picture the result as a sheet of paper. `PARTITION BY` cuts it into separate pieces, `ORDER BY` sorts each piece, and the frame is a window you slide down each piece: the function only looks through the window.' },
      { h: 'The three families' },
      {
        table: {
          head: ['Family', 'Functions', 'Page'],
          rows: [
            ['Ranking', '`row_number`, `rank`, `dense_rank`, `ntile`, `percent_rank`, `cume_dist`', '[Ranking functions](#/c/ranking-functions)'],
            ['Offset / value', '`lag`, `lead`, `first_value`, `last_value`, `nth_value`', '[LAG, LEAD and values](#/c/lag-lead)'],
            ['Aggregates', '`sum`, `avg`, `count`, `min`, `max` … with `OVER`', '[Running totals and frames](#/c/window-frames)'],
          ],
        },
      },
      { h: 'Naming windows' },
      { sql: "select customer_id, order_id, ordered_at::date, total,\n       row_number() over w as nth_order,\n       sum(total)   over w as running_total\nfrom order_summary\nwhere customer_id is not null and status <> 'cancelled'\nwindow w as (partition by customer_id order by ordered_at)\norder by customer_id, ordered_at;", title: 'The WINDOW clause avoids repeating yourself' },
      { callout: 'trap', text: 'Window functions are computed after `WHERE`, `GROUP BY` and `HAVING`, so you can\'t filter on them directly. Wrap the query and filter outside. (Snowflake, BigQuery and DuckDB offer `QUALIFY` for this; PostgreSQL doesn\'t.)' },
      { sql: "select * from (\n  select name, category, price,\n         rank() over (partition by category order by price desc) as rnk\n  from products\n) t\nwhere rnk = 1;", title: 'Filter on a window result: wrap it' },
      { callout: 'tip', text: 'You can apply a window function to an aggregate in the same query: `rank() over (order by sum(revenue) desc)` ranks groups after `GROUP BY`.' },
    ],
    practice: [
      { q: 'Each product with the average price of all products, as `avg_all` (rounded to 2). Columns: `name`, `price`, `avg_all`.', solution: 'select name, price, round(avg(price) over (), 2) as avg_all from products;' },
      { q: 'Each order from `order_summary` with the number of orders of the same customer, as `customer_orders`. Columns: `order_id`, `customer_id`, `customer_orders`.', solution: 'select order_id, customer_id, count(*) over (partition by customer_id) as customer_orders\nfrom order_summary;' },
    ],
    interview: [
      { q: 'What is the difference between GROUP BY and a window function?', a: 'GROUP BY returns one row per group; a window function returns one value per input row, computed over the row\'s partition/frame, so detail and aggregate appear together.' },
      { q: 'Why can\'t you use a window function in WHERE?', a: 'Windows are evaluated after WHERE, GROUP BY and HAVING. Filter in an outer query or CTE, or use QUALIFY where available.' },
    ],
    related: ['ranking-functions', 'lag-lead', 'window-frames'],
  },
  {
    id: 'ranking-functions',
    title: 'Ranking functions',
    level: 'intermediate',
    summary: 'row_number, rank, dense_rank, ntile, percent_rank and cume_dist differ only in how they treat ties.',
    body: [
      { p: 'All ranking functions need an `ORDER BY` inside `OVER`. They differ in how they number **ties** (rows with the same sort value). Run this example on four scores where two are tied:' },
      { sql: "select score,\n       row_number()  over w as row_number,\n       rank()        over w as rank,\n       dense_rank()  over w as dense_rank,\n       round((percent_rank() over w)::numeric, 2) as percent_rank,\n       round((cume_dist()    over w)::numeric, 2) as cume_dist,\n       ntile(2)      over w as ntile_2\nfrom (values (100), (90), (90), (80)) as t(score)\nwindow w as (order by score desc);", title: 'Five rankings of the same data' },
      {
        table: {
          head: ['Function', 'Ties get', 'Result for 100, 90, 90, 80', 'Use it for'],
          rows: [
            ['`row_number()`', 'different numbers (arbitrary order)', '1, 2, 3, 4', 'dedup, top-1, pagination'],
            ['`rank()`', 'the same number, then a gap', '1, 2, 2, 4', 'sports-style ranking'],
            ['`dense_rank()`', 'the same number, no gap', '1, 2, 2, 3', '"Nth highest distinct value"'],
            ['`percent_rank()`', '(rank − 1) / (rows − 1)', '0, 0.33, 0.33, 1', 'relative position 0 → 1'],
            ['`cume_dist()`', 'share of rows ≤ current', '0.25, 0.75, 0.75, 1', 'percentiles, "top 10%"'],
            ['`ntile(n)`', 'n buckets of near-equal size', '1, 1, 2, 2', 'quartiles, deciles, A/B splits'],
          ],
        },
      },
      { callout: 'trap', title: 'Non-deterministic row_number', text: 'With ties, `row_number()` picks an arbitrary order that can change between runs, so a dedup may keep a different row each time. Always add a unique tie-breaker: `order by updated_at desc, id desc`.' },
      { sql: "select category, name, price,\n       dense_rank() over (partition by category order by price desc) as price_rank\nfrom products\norder by category, price_rank;", title: 'Rank inside each category' },
      { sql: "select customer_id, spent,\n       ntile(3) over (order by spent desc) as tier   -- 1 = top third\nfrom (\n  select customer_id, sum(total) as spent\n  from order_summary\n  where customer_id is not null and status <> 'cancelled'\n  group by customer_id\n) t;", title: 'Split customers into thirds by spend' },
    ],
    practice: [
      { q: 'The second-highest distinct product price (one value, column `price`).', hint: '`dense_rank()` = 2.', solution: 'select distinct price from (\n  select price, dense_rank() over (order by price desc) as r from products\n) t where r = 2;' },
      { q: 'Number each customer\'s orders from oldest to newest: `customer_id`, `order_id`, `n` (1 = first order). Exclude the guest.', solution: 'select customer_id, order_id, row_number() over (partition by customer_id order by ordered_at) as n\nfrom orders where customer_id is not null;' },
    ],
    interview: [
      { q: 'RANK vs DENSE_RANK vs ROW_NUMBER?', a: 'For values 100, 90, 90, 80: ROW_NUMBER gives 1, 2, 3, 4; RANK gives 1, 2, 2, 4 (gap after ties); DENSE_RANK gives 1, 2, 2, 3 (no gap).' },
      { q: 'How do you find the Nth highest salary?', a: 'DENSE_RANK() OVER (ORDER BY salary DESC) in a subquery and keep rank = N; DENSE_RANK so ties don\'t skip values. Alternatives: LIMIT 1 OFFSET N-1 on DISTINCT salaries.' },
    ],
    related: ['window-basics', 'top-n', 'deduplication'],
  },
  {
    id: 'lag-lead',
    title: 'LAG, LEAD and value functions',
    level: 'intermediate',
    summary: 'Read values from previous or next rows: time between events, period-over-period changes, first and last values.',
    body: [
      { p: '`lag(x)` returns `x` from the **previous** row of the partition (in window order); `lead(x)` from the **next** one. Both accept an offset and a default: `lag(x, 2, 0)` is the value two rows back, or 0 when it doesn\'t exist.' },
      { sql: "select customer_id, order_id, ordered_at::date as day,\n       lag(ordered_at::date)  over c                    as previous_order,\n       ordered_at::date - lag(ordered_at::date) over c  as days_since_previous,\n       lead(ordered_at::date) over c                    as next_order\nfrom orders\nwhere customer_id is not null\nwindow c as (partition by customer_id order by ordered_at)\norder by customer_id, ordered_at;", title: 'Time between a customer\'s orders' },
      { sql: "with monthly as (\n  select date_trunc('month', ordered_at)::date as month, sum(total) as revenue\n  from order_summary where status <> 'cancelled'\n  group by 1\n)\nselect month, revenue,\n       lag(revenue) over (order by month)            as previous_month,\n       revenue - lag(revenue) over (order by month)  as change,\n       round(100.0 * (revenue - lag(revenue) over (order by month))\n             / nullif(lag(revenue) over (order by month), 0), 1) as change_pct\nfrom monthly\norder by month;", title: 'Month-over-month change' },
      { h: 'first_value, last_value, nth_value' },
      { p: 'These read a value at a position **in the frame**. `first_value` works as expected, but `last_value` surprises everyone: with the default frame (start → current row), the last row of the frame is the current row itself.' },
      { sql: "select order_id, ordered_at::date, total,\n       first_value(total) over w_default as first_total,\n       last_value(total)  over w_default as last_total_wrong,\n       last_value(total)  over w_full    as last_total_right,\n       nth_value(total, 2) over w_full   as second_total\nfrom order_summary\nwindow w_default as (order by ordered_at),\n       w_full    as (order by ordered_at rows between unbounded preceding and unbounded following)\norder by ordered_at;", title: 'The last_value trap and its fix' },
      {
        table: {
          head: ['Function', 'Reads', 'Affected by the frame'],
          rows: [
            ['`lag(x, n, default)`', 'n rows before', '+ no: partition and order only'],
            ['`lead(x, n, default)`', 'n rows after', '+ no'],
            ['`first_value(x)`', 'first row of the frame', '~ yes, but default frame is fine'],
            ['`last_value(x)`', 'last row of the frame', '- yes: needs `… UNBOUNDED FOLLOWING`'],
            ['`nth_value(x, n)`', 'nth row of the frame', '- yes: rows after the current one are invisible by default'],
          ],
        },
      },
      { callout: 'trap', text: 'Period-over-period with `lag` assumes there is a row for every period. If a month has no sales, the "previous" row is two months back. Fill the gaps with a date spine first: see [Gaps and islands](#/c/gaps-islands) and the cross-join example in [Self and cross joins](#/c/self-cross-joins).' },
    ],
    practice: [
      { q: 'For each event of customer 1, the time since the previous event as `gap` (an interval). Columns: `event_id`, `gap`.', solution: 'select event_id, occurred_at - lag(occurred_at) over (order by occurred_at) as gap\nfrom events where customer_id = 1;' },
      { q: 'Each product with the price of the next more expensive product in the same category (`next_price`, NULL for the most expensive). Columns: `name`, `price`, `next_price`.', solution: 'select name, price, lead(price) over (partition by category order by price) as next_price\nfrom products;' },
    ],
    interview: [
      { q: 'Why does LAST_VALUE often return the current row?', a: 'With ORDER BY, the default frame ends at the current row (RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW), so the last row of the frame is the current row (or its last peer). Specify ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING.' },
    ],
    related: ['window-frames', 'sessionization', 'gaps-islands'],
  },
  {
    id: 'window-frames',
    title: 'Running totals, moving averages and frames',
    level: 'advanced',
    summary: 'The frame decides which neighbouring rows an aggregate window sees. ROWS, RANGE and GROUPS count them differently.',
    body: [
      { p: 'When you add `ORDER BY` to a window aggregate, it becomes cumulative: `sum(x) over (order by day)` is a running total. The **frame** clause controls exactly which rows around the current one are included.' },
      { diagram: 'frame' },
      { sql: "select order_id, ordered_at::date, total,\n       sum(total) over (order by ordered_at rows between unbounded preceding and current row) as running_total,\n       round(avg(total) over (order by ordered_at rows between 2 preceding and current row), 2) as moving_avg_3,\n       sum(total) over (order by ordered_at rows between current row and unbounded following) as remaining\nfrom order_summary\norder by ordered_at;", title: 'Running total, 3-order moving average, remaining total' },
      { h: 'Frame boundaries' },
      {
        table: {
          head: ['Boundary', 'Meaning'],
          rows: [
            ['`UNBOUNDED PRECEDING`', 'first row of the partition'],
            ['`n PRECEDING`', 'n rows (or values, or peer groups) before'],
            ['`CURRENT ROW`', 'the current row (with RANGE/GROUPS: its peers too)'],
            ['`n FOLLOWING`', 'n after'],
            ['`UNBOUNDED FOLLOWING`', 'last row of the partition'],
          ],
        },
      },
      { h: 'ROWS vs RANGE vs GROUPS' },
      {
        table: {
          head: ['Mode', 'Counts', '`1 PRECEDING` means', 'Ties'],
          rows: [
            ['`ROWS`', 'physical rows', 'the row just before', 'treated one by one'],
            ['`RANGE` (default)', 'values of the ORDER BY column', 'rows whose value is within 1 of the current value', '~ all peers included together'],
            ['`GROUPS`', 'groups of tied rows', 'the previous group of peers', 'whole peer groups'],
          ],
        },
      },
      { sql: "select x,\n       sum(x) over (order by x)                                                  as default_range,\n       sum(x) over (order by x rows between unbounded preceding and current row) as rows_frame\nfrom (values (1), (2), (2), (3)) as t(x);", title: 'Why the default frame surprises people', note: 'default_range gives 1, 5, 5, 8: both 2s are peers and see each other. rows_frame gives 1, 3, 5, 8: a true row-by-row running total.' },
      { sql: "select day, visits,\n       sum(visits) over (order by day range between interval '6 days' preceding and current row) as last_7_days\nfrom (values (date '2026-04-01', 10), (date '2026-04-02', 12), (date '2026-04-05', 7),\n             (date '2026-04-09', 20), (date '2026-04-10', 5)) as t(day, visits)\norder by day;", title: 'RANGE with an interval: a true 7-day window even with missing days', note: 'With ROWS, "6 preceding" would mean 6 rows, which span more than 7 days when days are missing. RANGE counts calendar days.' },
      { callout: 'tip', text: 'Write the frame explicitly whenever you compute running totals: `rows between unbounded preceding and current row`. It documents your intent and avoids the tie surprise.' },
    ],
    practice: [
      { q: 'Running count of events per customer in time order, as `n_so_far`. Columns: `customer_id`, `event_id`, `n_so_far`.', solution: 'select customer_id, event_id,\n       count(*) over (partition by customer_id order by occurred_at rows between unbounded preceding and current row) as n_so_far\nfrom events;' },
      { q: 'For each order (by date), the sum of its total and the previous order\'s total as `two_order_sum`. Columns: `order_id`, `two_order_sum`.', solution: 'select order_id, sum(total) over (order by ordered_at rows between 1 preceding and current row) as two_order_sum\nfrom order_summary;' },
    ],
    interview: [
      { q: 'What is the default window frame?', a: 'With ORDER BY: RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW (including peers of the current row). Without ORDER BY: the whole partition.' },
      { q: 'Compute a 7-day rolling average when some days are missing.', a: 'Either generate a date spine and left join so every day exists, then use ROWS 6 PRECEDING; or use RANGE BETWEEN INTERVAL \'6 days\' PRECEDING AND CURRENT ROW, which counts calendar time.' },
    ],
    related: ['window-basics', 'lag-lead', 'period-over-period'],
  },
];
