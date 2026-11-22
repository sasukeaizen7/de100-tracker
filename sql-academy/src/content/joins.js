export const joins = [
  {
    id: 'inner-join',
    title: 'INNER JOIN',
    level: 'basic',
    summary: 'Combine columns from two tables, keeping only the pairs of rows that match the join condition.',
    body: [
      { p: 'A **join** puts columns from two tables side by side. For each row of the left table, the database looks for rows of the right table that satisfy the `ON` condition, and outputs one combined row per matching pair. An **inner** join drops rows that have no partner on the other side.' },
      { diagram: 'joins' },
      { sql: 'select o.order_id, o.ordered_at, c.first_name, c.city\nfrom orders o\njoin customers c on c.customer_id = o.customer_id\norder by o.order_id;', title: 'Orders with their customer', note: 'Order 8 (guest, NULL customer) has no match, so it disappears. Karim has no order, so he does too.' },
      { h: 'Aliases and qualified columns' },
      { p: '`orders o` gives the table a short alias. Qualify every column with it (`o.order_id`) as soon as two tables are involved: it makes the query readable and avoids "column reference is ambiguous" errors when both tables have a column with the same name.' },
      { h: 'Chaining joins' },
      { sql: "select o.order_id, c.first_name, p.name as product, oi.quantity, oi.quantity * p.price as line_total\nfrom orders o\njoin customers c    on c.customer_id = o.customer_id\njoin order_items oi on oi.order_id = o.order_id\njoin products p     on p.product_id = oi.product_id\nwhere o.status <> 'cancelled'\norder by o.order_id, p.name;", title: 'Four tables: who bought what', note: 'Each join adds the columns of one more table. The grain of the result is now "one row per order line".' },
      { h: 'ON vs USING vs NATURAL' },
      {
        table: {
          head: ['Form', 'Example', 'Output', 'Verdict'],
          rows: [
            ['`ON`', '`join orders o on o.customer_id = c.customer_id`', 'both key columns', '+ default: any condition'],
            ['`USING`', '`join orders using (customer_id)`', 'one merged key column', '+ fine when names match'],
            ['`NATURAL`', '`natural join orders`', 'joins on every same-named column', '- avoid: a new column changes the join silently'],
          ],
        },
      },
      { callout: 'tip', text: 'A join condition can be anything boolean, not only equality: ranges (`e.occurred_at between s.start and s.end`), inequalities, or several columns. Equality joins are the fastest because they can use hash and merge joins.' },
    ],
    practice: [
      { q: 'Every order line with the product name: `order_id`, `name`, `quantity`.', solution: 'select oi.order_id, p.name, oi.quantity\nfrom order_items oi\njoin products p on p.product_id = oi.product_id;' },
      { q: 'First names of customers who placed at least one **shipped** order (each name once).', hint: 'Join, filter on status, and use DISTINCT.', solution: "select distinct c.first_name\nfrom customers c\njoin orders o on o.customer_id = c.customer_id\nwhere o.status = 'shipped';" },
    ],
    interview: [
      { q: 'If table A has 3 rows with key 1 and table B has 2 rows with key 1, how many rows does A INNER JOIN B ON key return for that key?', a: '3 × 2 = 6. A join returns every matching pair; duplicates on both sides multiply.' },
    ],
    related: ['outer-joins', 'join-pitfalls', 'semi-anti-joins'],
  },
  {
    id: 'outer-joins',
    title: 'LEFT, RIGHT and FULL joins',
    level: 'basic',
    summary: 'Outer joins keep rows without a match and fill the missing side with NULLs.',
    body: [
      { p: 'A `LEFT JOIN` keeps **every** row of the left table. When a row has no partner, the right table\'s columns are filled with NULL. `RIGHT JOIN` is the mirror image, and `FULL JOIN` keeps unmatched rows from both sides.' },
      { diagram: 'joins' },
      { sql: 'select c.first_name, o.order_id, o.status\nfrom customers c\nleft join orders o on o.customer_id = c.customer_id\norder by c.first_name, o.order_id;', title: 'All customers, with their orders if any', note: 'Karim appears once, with NULL order columns.' },
      { sql: 'select c.first_name, count(o.order_id) as orders\nfrom customers c\nleft join orders o on o.customer_id = c.customer_id\ngroup by c.customer_id, c.first_name\norder by orders desc, c.first_name;', title: 'Counting through a left join', note: 'Use `count(o.order_id)`, not `count(*)`: for Karim, `count(*)` counts his NULL-filled row and returns 1.' },
      { sql: 'select c.first_name, o.order_id\nfrom customers c\nfull join orders o on o.customer_id = c.customer_id\nwhere c.customer_id is null or o.order_id is null;', title: 'FULL JOIN to reconcile two sources', note: 'Shows what exists on only one side: Karim (no order) and order 8 (no customer). This is how you compare a source system with your warehouse.' },
      {
        table: {
          head: ['Join', 'Unmatched left rows', 'Unmatched right rows', 'Typical use'],
          rows: [
            ['`INNER`', '- dropped', '- dropped', 'facts that must have their dimension'],
            ['`LEFT`', '+ kept (NULLs on the right)', '- dropped', '"all X, with Y if any"'],
            ['`RIGHT`', '- dropped', '+ kept', 'rewrite as LEFT for readability'],
            ['`FULL`', '+ kept', '+ kept', 'reconciliation, merging two lists'],
          ],
        },
      },
      { callout: 'trap', title: 'The left join that became an inner join', text: 'A condition on the right table in `WHERE` (`where o.status = \'paid\'`) removes the NULL-filled rows, so customers without orders vanish. Put that condition in the `ON` clause to filter the right side while keeping every left row.' },
      { sql: "-- WHERE: Karim and customers without paid orders disappear\nselect c.first_name, o.order_id\nfrom customers c left join orders o on o.customer_id = c.customer_id\nwhere o.status = 'paid';\n\n-- ON: everyone stays; only paid orders are attached\nselect c.first_name, o.order_id\nfrom customers c left join orders o on o.customer_id = c.customer_id and o.status = 'paid';", title: 'Condition in WHERE vs in ON' },
    ],
    practice: [
      { q: 'Every product with the total quantity sold, 0 for products never sold. Columns: `name`, `sold`.', hint: '`left join` then `coalesce(sum(...), 0)`.', solution: 'select p.name, coalesce(sum(oi.quantity), 0) as sold\nfrom products p\nleft join order_items oi on oi.product_id = p.product_id\ngroup by p.product_id, p.name;' },
      { q: 'Every customer\'s first name and the number of their **cancelled** orders (0 if none). Columns: `first_name`, `cancelled`.', solution: "select c.first_name, count(o.order_id) as cancelled\nfrom customers c\nleft join orders o on o.customer_id = c.customer_id and o.status = 'cancelled'\ngroup by c.customer_id, c.first_name;" },
    ],
    interview: [
      { q: 'Can a LEFT JOIN return more rows than the left table?', a: 'Yes. Each left row appears once per matching right row; a customer with 3 orders appears 3 times. It returns at least as many rows as the left table, never fewer.' },
      { q: 'Why does filtering the right table in WHERE change a LEFT JOIN\'s result?', a: 'Unmatched rows have NULL in the right table\'s columns; the WHERE condition evaluates to unknown for them and removes them, which is exactly an inner join. Move the condition into ON.' },
    ],
    related: ['inner-join', 'semi-anti-joins', 'join-pitfalls'],
  },
  {
    id: 'semi-anti-joins',
    title: 'Semi joins and anti joins',
    level: 'intermediate',
    summary: 'Ask "does a match exist?" without multiplying rows: EXISTS for a semi join, NOT EXISTS for an anti join.',
    body: [
      { p: 'Sometimes you only need to know **whether** a match exists, not the matching rows themselves. A **semi join** returns each left row at most once if it has at least one match. An **anti join** returns the left rows that have **no** match. SQL has no `SEMI JOIN` keyword: you write them with `EXISTS` and `NOT EXISTS`.' },
      { sql: '-- semi join: customers who ordered (each once, however many orders)\nselect c.first_name\nfrom customers c\nwhere exists (select 1 from orders o where o.customer_id = c.customer_id);', title: 'Semi join with EXISTS' },
      { sql: '-- anti join: products never sold\nselect p.name\nfrom products p\nwhere not exists (select 1 from order_items oi where oi.product_id = p.product_id);\n\n-- the same with LEFT JOIN … IS NULL\nselect p.name\nfrom products p\nleft join order_items oi on oi.product_id = p.product_id\nwhere oi.product_id is null;', title: 'Two ways to write an anti join' },
      {
        table: {
          head: ['Pattern', 'Duplicates', 'NULL-safe', 'Readability'],
          rows: [
            ['`EXISTS` / `NOT EXISTS`', '+ never', '+ yes', '+ says exactly what you mean'],
            ['`IN` / `NOT IN`', '+ never', '- `NOT IN` breaks if the list has a NULL', '+ short'],
            ['`JOIN` + `DISTINCT`', '~ needs DISTINCT', '+ yes', '- hides intent, extra work'],
            ['`LEFT JOIN … IS NULL`', '+ never (for anti)', '+ yes', '~ classic but less obvious'],
          ],
        },
      },
      { callout: 'de', text: 'Anti joins are the core of data-quality checks: "order items whose product doesn\'t exist", "customers in the CRM but not in the warehouse", "events not yet loaded".' },
      { callout: 'tip', text: 'Inside `EXISTS`, what you select doesn\'t matter (`select 1` is the convention): the database stops at the first matching row.' },
    ],
    practice: [
      { q: 'First names of customers who have **never** placed an order.', solution: 'select first_name from customers c\nwhere not exists (select 1 from orders o where o.customer_id = c.customer_id);' },
      { q: 'Names of products that appear in at least one **cancelled** order.', solution: "select p.name from products p\nwhere exists (\n  select 1 from order_items oi join orders o on o.order_id = oi.order_id\n  where oi.product_id = p.product_id and o.status = 'cancelled'\n);" },
    ],
    interview: [
      { q: 'Why prefer NOT EXISTS over NOT IN?', a: 'If the subquery returns a NULL, `x NOT IN (…)` is never true (it becomes unknown), so the query silently returns nothing. NOT EXISTS is unaffected by NULLs and is usually planned as an efficient anti join.' },
    ],
    related: ['in-any-all-exists', 'outer-joins', 'data-quality'],
  },
  {
    id: 'self-cross-joins',
    title: 'Self joins and cross joins',
    level: 'intermediate',
    summary: 'A self join compares rows of the same table; a cross join pairs every row with every row.',
    body: [
      { h: 'Self join' },
      { p: 'A **self join** joins a table to itself, using two different aliases as if they were two tables. You need it whenever rows refer to other rows of the same table (an employee and their manager) or when you compare rows with each other (products in the same category).' },
      { sql: "select e.name as employee, coalesce(m.name, '—') as manager\nfrom employees e\nleft join employees m on m.employee_id = e.manager_id\norder by e.employee_id;", title: 'Employee → manager' },
      { sql: 'select a.name as product_a, b.name as product_b, a.category\nfrom products a\njoin products b on a.category = b.category and a.product_id < b.product_id\norder by a.category;', title: 'Pairs of products in the same category', note: '`a.product_id < b.product_id` removes self-pairs (Helmet, Helmet) and mirrored duplicates (Helmet, U-lock) / (U-lock, Helmet).' },
      { h: 'Cross join' },
      { p: 'A `CROSS JOIN` returns the **Cartesian product**: every row of A combined with every row of B, n × m rows. Usually a mistake when it happens by accident (a forgotten `ON`), but very useful on purpose to build complete grids.' },
      { sql: "select m.month::date, c.category, coalesce(sum(l.revenue), 0) as revenue\nfrom generate_series('2026-01-01'::date, '2026-04-01', interval '1 month') as m(month)\ncross join (select distinct category from products) c\nleft join order_lines l\n  on date_trunc('month', l.ordered_at) = m.month\n and l.category = c.category\n and l.status <> 'cancelled'\ngroup by m.month, c.category\norder by m.month, c.category;", title: 'A report with no holes: every month × every category', note: 'Without the cross join, months where a category sold nothing would be missing rows instead of showing 0.' },
      { callout: 'trap', text: 'A join with a missing or wrong condition becomes a cross join: 1 million × 1 million rows. If a query suddenly returns far more rows than expected, check every `ON`.' },
    ],
    practice: [
      { q: 'For each employee, show their name and their manager\'s manager (grand-manager), only for employees who have one. Columns: `employee`, `grand_manager`.', hint: 'Join employees three times.', solution: 'select e.name as employee, g.name as grand_manager\nfrom employees e\njoin employees m on m.employee_id = e.manager_id\njoin employees g on g.employee_id = m.manager_id;' },
      { q: 'Every combination of city (from customers, distinct) and order status (distinct). Columns: `city`, `status`.', solution: 'select c.city, s.status\nfrom (select distinct city from customers) c\ncross join (select distinct status from orders) s;' },
    ],
    interview: [
      { q: 'Give a legitimate use of a CROSS JOIN.', a: 'Building a complete grid before a left join: every date × every store, so days with no sales show 0 instead of missing; or generating test combinations.' },
    ],
    related: ['recursive-ctes', 'inner-join'],
  },
  {
    id: 'lateral',
    title: 'LATERAL joins',
    level: 'advanced',
    summary: 'A subquery that runs once per row of the left table and can reference its columns: perfect for top-N per row.',
    body: [
      { p: 'A normal subquery in `FROM` is independent: it cannot see other tables of the same `FROM`. Adding `LATERAL` lets it reference columns of the tables listed before it, so it is evaluated **for each left row**, like a `foreach` loop.' },
      { sql: 'select c.first_name, last2.order_id, last2.ordered_at\nfrom customers c\nleft join lateral (\n  select o.order_id, o.ordered_at\n  from orders o\n  where o.customer_id = c.customer_id   -- uses the outer row\n  order by o.ordered_at desc\n  limit 2\n) last2 on true\norder by c.first_name, last2.ordered_at desc;', title: 'The two most recent orders of each customer', note: '`LEFT JOIN LATERAL … ON true` keeps customers with no orders; `CROSS JOIN LATERAL` would drop them.' },
      { p: 'LATERAL is also how you call a **set-returning function** per row, for example to explode a JSON array that lives in each row.' },
      { sql: "select e.event_id, f.filter\nfrom events e\ncross join lateral jsonb_array_elements_text(e.payload -> 'filters') as f(filter);", title: 'Explode an array stored in each row' },
      {
        table: {
          head: ['Top-N per group with…', 'Strength', 'Weakness'],
          rows: [
            ['`LATERAL … LIMIT n`', '+ very fast with an index on (group, sort key); stops after n', '~ PostgreSQL/Snowflake syntax'],
            ['`row_number()` then `rn <= n`', '+ portable, easy to read', '~ ranks every row of every group first'],
            ['`DISTINCT ON`', '+ shortest for top-1', '- top-1 only'],
          ],
        },
      },
    ],
    practice: [
      { q: 'For each category, its single most expensive product using LATERAL. Columns: `category`, `name`, `price`.', solution: 'select c.category, top.name, top.price\nfrom (select distinct category from products) c\ncross join lateral (\n  select name, price from products p\n  where p.category = c.category\n  order by price desc\n  limit 1\n) top;' },
    ],
    interview: [
      { q: 'What does LATERAL allow that a normal derived table doesn\'t?', a: 'Referencing columns from tables earlier in the FROM clause, so the subquery is evaluated per outer row. That enables per-row top-N with LIMIT and calling set-returning functions with per-row arguments.' },
    ],
    related: ['top-n', 'json', 'subqueries'],
  },
  {
    id: 'join-pitfalls',
    title: 'Join pitfalls: fan-out and NULL keys',
    level: 'intermediate',
    summary: 'Most wrong numbers come from joins that multiply rows. Aggregate to the right grain before joining.',
    body: [
      { p: 'When you join a table to a table of a **finer grain** (orders → order items), each row on the coarse side is repeated once per matching row. That is correct for line-level analysis, but any order-level measure you then `sum` is counted several times. This is called **fan-out**.' },
      { sql: "-- WRONG: each order's total is repeated once per item, then summed\nselect o.customer_id, sum(s.total) as spent_wrong\nfrom orders o\njoin order_summary s on s.order_id = o.order_id\njoin order_items oi on oi.order_id = o.order_id\nwhere o.customer_id = 1\ngroup by o.customer_id;\n\n-- RIGHT: stay at the order grain\nselect customer_id, sum(total) as spent_right\nfrom order_summary\nwhere customer_id = 1\ngroup by customer_id;", title: 'Fan-out inflates a sum', note: 'Customer 1 has two orders: one with 3 lines, one with 1. The wrong query counts the first total three times.' },
      { h: 'The safe recipe' },
      { steps: [
        'Write the grain of each table you join.',
        'Aggregate the finer table to the grain you need **first** (in a CTE or subquery).',
        'Join the aggregated results on their keys: now it is one-to-one.',
        'Check row counts: `count(*)` before and after the join should match what you expect.',
      ] },
      { sql: "with items_per_order as (\n  select order_id, sum(quantity) as items\n  from order_items\n  group by order_id\n)\nselect o.order_id, o.status, i.items\nfrom orders o\njoin items_per_order i on i.order_id = o.order_id\norder by o.order_id;", title: 'Aggregate first, then join one-to-one' },
      { h: 'NULL keys never match' },
      { p: '`NULL = NULL` is not true, so rows with a NULL join key never match anything. The guest order (customer NULL) disappears from every inner join to customers. If NULL keys are meaningful, use `IS NOT DISTINCT FROM` in the condition or replace them with a placeholder key ("unknown customer", id -1), which is what data warehouses do.' },
      { callout: 'tip', text: 'A quick fan-out detector: `select key, count(*) from right_table group by key having count(*) > 1`. If the key you join on isn\'t unique on one side, the other side will multiply.' },
    ],
    practice: [
      { q: 'Total spent per customer (excluding cancelled orders), computed without fan-out. Columns: `customer_id`, `spent`. Ignore the guest order.', solution: "select customer_id, sum(total) as spent\nfrom order_summary\nwhere status <> 'cancelled' and customer_id is not null\ngroup by customer_id;" },
    ],
    interview: [
      { q: 'Your revenue doubled after adding a join. What happened?', a: 'Almost certainly fan-out: the joined table has several rows per key, so each revenue row is duplicated. Check the uniqueness of the join key on that side, and aggregate it to the right grain before joining.' },
    ],
    related: ['relational-model', 'ctes', 'inner-join'],
  },
];
