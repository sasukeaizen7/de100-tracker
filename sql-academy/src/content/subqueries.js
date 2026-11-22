export const subqueries = [
  {
    id: 'subqueries',
    title: 'Subqueries',
    level: 'intermediate',
    summary: 'A query inside a query: as a value, a list, or a table. Correlated subqueries re-run for each outer row.',
    body: [
      { p: 'A **subquery** is a `SELECT` in parentheses used inside another statement. What it returns decides where it can go.' },
      {
        table: {
          head: ['Kind', 'Returns', 'Used in', 'Example'],
          rows: [
            ['Scalar', 'exactly one value', '`SELECT`, `WHERE`, `SET`', '`price > (select avg(price) from products)`'],
            ['List', 'one column, many rows', '`IN`, `ANY`, `ALL`', '`customer_id in (select customer_id from orders)`'],
            ['Table (derived table)', 'rows and columns', '`FROM`, needs an alias', '`from (select …) t`'],
            ['Correlated', 'depends on the outer row', 'anywhere', '`where o.customer_id = c.customer_id` inside'],
          ],
        },
      },
      { sql: 'select name, price\nfrom products\nwhere price > (select avg(price) from products)\norder by price desc;', title: 'Scalar subquery: above-average products' },
      { sql: "select customer_id, round(avg(total), 2) as avg_order\nfrom (\n  select customer_id, total\n  from order_summary\n  where status <> 'cancelled'\n) t\nwhere customer_id is not null\ngroup by customer_id;", title: 'Derived table in FROM' },
      { h: 'Correlated subqueries' },
      { p: 'A **correlated** subquery refers to a column of the outer query, so conceptually it runs once per outer row. It reads naturally ("for this product, the average of its category") but can be slow on big tables; the same result is often cheaper with a join or a window function.' },
      { sql: 'select name, category, price,\n       (select round(avg(p2.price), 2)\n        from products p2\n        where p2.category = p.category) as category_avg\nfrom products p\norder by category, price desc;', title: 'Each product next to its category average' },
      { sql: 'select name, category, price,\n       round(avg(price) over (partition by category), 2) as category_avg\nfrom products\norder by category, price desc;', title: 'Same result with a window function', note: 'One pass over the table instead of one subquery per row. See [Window functions](#/c/window-basics).' },
      { callout: 'trap', text: 'A scalar subquery that returns more than one row is an error ("more than one row returned by a subquery used as an expression"). Make sure it is aggregated or filtered on a unique key.' },
    ],
    practice: [
      { q: 'Products cheaper than the cheapest bike. Columns: `name`, `price`.', solution: "select name, price from products\nwhere price < (select min(price) from products where category = 'bikes');" },
      { q: 'Orders whose total is above the average order total (from `order_summary`). Columns: `order_id`, `total`.', solution: 'select order_id, total from order_summary\nwhere total > (select avg(total) from order_summary);' },
    ],
    interview: [
      { q: 'What is a correlated subquery and what is its performance risk?', a: 'A subquery that references the outer query\'s columns, so it is logically evaluated for each outer row. On large tables it can mean millions of executions; the planner may decorrelate it, but rewriting as a join or window function is often faster.' },
    ],
    related: ['in-any-all-exists', 'ctes', 'window-basics'],
  },
  {
    id: 'in-any-all-exists',
    title: 'IN, ANY, ALL and EXISTS',
    level: 'intermediate',
    summary: 'Compare a value with a list of values produced by a subquery, and avoid the NOT IN + NULL trap.',
    body: [
      { p: 'These operators test a value against the rows of a subquery. They look interchangeable, but they handle empty results and NULLs differently, which is a classic interview topic.' },
      {
        table: {
          head: ['Operator', 'True when', 'Subquery is empty', 'Subquery contains NULL'],
          rows: [
            ['`x IN (sub)`', 'x equals at least one value', 'false', 'true if a match exists, else NULL'],
            ['`x NOT IN (sub)`', 'x equals none of them', 'true', '- never true: returns no rows'],
            ['`x > ANY (sub)`', 'x is bigger than at least one', 'false', 'true if some value satisfies it, else NULL'],
            ['`x > ALL (sub)`', 'x is bigger than every value', '~ true (nothing to beat)', 'never true'],
            ['`EXISTS (sub)`', 'sub returns at least one row', 'false', '+ unaffected'],
            ['`NOT EXISTS (sub)`', 'sub returns no row', 'true', '+ unaffected'],
          ],
        },
      },
      { sql: '-- returns NOTHING: orders.customer_id contains a NULL (the guest order)\nselect first_name from customers\nwhere customer_id not in (select customer_id from orders);', title: 'The NOT IN trap', note: 'For Karim: `6 NOT IN (1, 2, 3, 4, 5, NULL)` means `6<>1 AND … AND 6<>NULL`. The last part is unknown, so the whole condition is unknown.' },
      { sql: 'select first_name from customers c\nwhere not exists (select 1 from orders o where o.customer_id = c.customer_id);\n\n-- or exclude NULLs explicitly\nselect first_name from customers\nwhere customer_id not in (select customer_id from orders where customer_id is not null);', title: 'Two correct versions: Karim' },
      { sql: "select name, price from products\nwhere price > all (select price from products where category = 'accessories');\n\nselect name, price from products\nwhere price < any (select price from products where category = 'accessories');", title: 'ALL and ANY', note: '`> ALL` means "more than the maximum", `< ANY` means "less than the maximum". `= ANY` is the same as `IN`.' },
      { sql: 'select name from products where product_id = any (array[1, 3, 5]);', title: 'ANY with an array (useful with query parameters)' },
    ],
    practice: [
      { q: 'Names of products more expensive than **every** product in the `parts` category.', solution: "select name from products\nwhere price > all (select price from products where category = 'parts');" },
      { q: 'Using `IN`, the first names of customers who have a `paid` order.', solution: "select first_name from customers\nwhere customer_id in (select customer_id from orders where status = 'paid');" },
    ],
    interview: [
      { q: 'Explain why NOT IN can return no rows.', a: 'NOT IN expands to a chain of `<>` comparisons joined by AND. If the list contains NULL, one comparison is unknown, so the whole condition can never be true and every row is filtered out. Use NOT EXISTS or filter NULLs from the subquery.' },
      { q: 'What does `x > ALL (empty set)` return?', a: 'True, vacuously: there is no value x fails to beat. This surprises people when a filter in the subquery accidentally matches nothing.' },
    ],
    related: ['null-logic', 'semi-anti-joins', 'subqueries'],
  },
  {
    id: 'ctes',
    title: 'Common table expressions (WITH)',
    level: 'intermediate',
    summary: 'Name intermediate steps so a long query reads top to bottom, like a small pipeline.',
    body: [
      { p: 'A **CTE** (`WITH name AS (…)`) defines a named subquery at the start of a statement. Later steps, and the final `SELECT`, can use it like a table. A long query becomes a list of small, testable steps.' },
      { sql: "with paid_orders as (\n  select * from order_summary where status <> 'cancelled'\n),\ncustomer_value as (\n  select customer_id, count(*) as orders, sum(total) as spent\n  from paid_orders\n  where customer_id is not null\n  group by customer_id\n)\nselect c.first_name, v.orders, v.spent,\n       round(100.0 * v.spent / sum(v.spent) over (), 1) as pct_of_revenue\nfrom customer_value v\njoin customers c using (customer_id)\norder by v.spent desc;", title: 'A query as a pipeline of steps' },
      { callout: 'tip', text: 'To debug a CTE chain, replace the final SELECT with `select * from step_2` and look at each step\'s output. This is exactly how dbt models are developed.' },
      {
        table: {
          head: ['', 'Subquery', 'CTE', 'Temporary table', 'View'],
          rows: [
            ['Lives for', 'the expression', 'the statement', 'the session', 'until dropped'],
            ['Reusable by name', '- no', '+ in the statement', '+ yes', '+ yes'],
            ['Readability', '- poor when nested', '+ best', '+ good', '+ good'],
            ['Can have an index', '- no', '- no', '+ yes', '- no (materialized view: yes)'],
            ['Recursive', '- no', '+ `WITH RECURSIVE`', '- no', '+ `CREATE RECURSIVE VIEW`'],
          ],
        },
      },
      { h: 'Performance' },
      { p: 'Since PostgreSQL 12, a CTE referenced once is **inlined**, optimised exactly like a subquery. If an expensive CTE is used several times, `WITH x AS MATERIALIZED (…)` computes it once and reuses the result; `AS NOT MATERIALIZED` forces inlining.' },
      { sql: "with recent as materialized (\n  select * from order_summary where ordered_at >= '2026-03-01'\n)\nselect (select count(*) from recent) as orders,\n       (select sum(total) from recent) as revenue;", title: 'Force a CTE to be computed once' },
      { callout: 'de', text: 'Writing transformations as CTEs (import → clean → join → aggregate → final) is the house style of dbt projects. Interviewers often ask you to "refactor this nested query with CTEs".' },
    ],
    practice: [
      { q: 'With a CTE, compute revenue per city (cancelled orders excluded, guest excluded), then keep only cities above 100 €. Columns: `city`, `revenue`.', solution: "with city_revenue as (\n  select city, sum(revenue) as revenue\n  from order_lines\n  where status <> 'cancelled' and city is not null\n  group by city\n)\nselect city, revenue from city_revenue where revenue > 100;" },
    ],
    interview: [
      { q: 'CTE or subquery: which is faster?', a: 'In modern PostgreSQL (12+), a CTE used once is inlined and performs identically. CTEs win on readability; use MATERIALIZED to compute an expensive reused CTE only once.' },
    ],
    related: ['recursive-ctes', 'subqueries', 'join-pitfalls'],
  },
  {
    id: 'recursive-ctes',
    title: 'Recursive CTEs',
    level: 'advanced',
    summary: 'A CTE that refers to itself, for hierarchies, graphs and sequences.',
    body: [
      { p: 'A recursive CTE has two parts glued by `UNION ALL`: the **anchor** query produces the starting rows, and the **recursive** query refers to the CTE itself to produce the next level from the previous one. PostgreSQL repeats the recursive part until it returns no new rows.' },
      { steps: [
        'Run the anchor → working set = the CEO.',
        'Run the recursive part with the working set → Hugo and Inès (reporting to the CEO).',
        'Run it again with Hugo and Inès → Théo.',
        'Run it with Théo → nothing: stop. The result is everything produced, combined.',
      ] },
      { sql: "with recursive org as (\n  select employee_id, name, manager_id, 0 as depth, name::text as path\n  from employees\n  where manager_id is null                          -- anchor\n  union all\n  select e.employee_id, e.name, e.manager_id, org.depth + 1, org.path || ' > ' || e.name\n  from employees e\n  join org on e.manager_id = org.employee_id        -- recursive step\n)\nselect repeat('    ', depth) || name as tree, depth, path\nfrom org\norder by path;", title: 'Walk the org chart' },
      { sql: "with recursive days(d) as (\n  select date '2026-04-01'\n  union all\n  select d + 1 from days where d < date '2026-04-07'   -- stop condition\n)\nselect d, to_char(d, 'Dy') as weekday from days;", title: 'Generate a sequence of dates', note: 'PostgreSQL has `generate_series` for this, but the recursive version works in every database.' },
      { callout: 'trap', title: 'Infinite loops', text: 'Without a stop condition, or with a cycle in the data (A manages B, B manages A), the recursion never ends. Always bound the depth (`where depth < 20`) or track the path and stop when a node repeats. PostgreSQL 14+ also has a `CYCLE` clause that detects cycles for you.' },
      { sql: "with recursive org as (\n  select employee_id, name, manager_id\n  from employees where manager_id is null\n  union all\n  select e.employee_id, e.name, e.manager_id\n  from employees e join org on e.manager_id = org.employee_id\n) cycle employee_id set is_cycle using path\nselect name, is_cycle, path from org;", title: 'Built-in cycle detection (PostgreSQL 14+)' },
      { callout: 'de', text: 'Typical uses: category trees, bills of materials, following foreign-key chains, building a date spine, and finding all descendants of a node for access control.' },
    ],
    practice: [
      { q: 'All employees under Hugo (direct or indirect), not including Hugo. Column: `name`.', hint: 'Anchor = Hugo\'s direct reports.', solution: "with recursive team as (\n  select employee_id, name from employees\n  where manager_id = (select employee_id from employees where name = 'Hugo')\n  union all\n  select e.employee_id, e.name from employees e join team t on e.manager_id = t.employee_id\n)\nselect name from team;" },
      { q: 'Generate the numbers 1 to 10 with a recursive CTE. Column: `n`.', solution: 'with recursive nums(n) as (\n  select 1\n  union all\n  select n + 1 from nums where n < 10\n)\nselect n from nums;' },
    ],
    interview: [
      { q: 'What are the two parts of a recursive CTE?', a: 'The anchor (non-recursive) query that seeds the result, and the recursive query that references the CTE and is executed repeatedly on the rows produced by the previous iteration, combined with UNION [ALL], until it yields no new rows.' },
    ],
    related: ['ctes', 'self-cross-joins', 'views'],
  },
  {
    id: 'set-operations',
    title: 'UNION, INTERSECT and EXCEPT',
    level: 'intermediate',
    summary: 'Combine the rows of two queries: all of them, the common ones, or the difference.',
    body: [
      { p: 'Joins combine **columns**; set operations combine **rows**. Both queries must return the same number of columns with compatible types, and the column names come from the first query.' },
      {
        table: {
          head: ['Operator', 'Keeps', 'Duplicates', 'Equivalent idea'],
          rows: [
            ['`UNION ALL`', 'every row from both', 'kept', '+ fastest: no dedup'],
            ['`UNION`', 'every row from both', 'removed', '`DISTINCT` over `UNION ALL`'],
            ['`INTERSECT`', 'rows present in both', 'removed (`INTERSECT ALL` keeps)', 'semi join with `EXISTS`'],
            ['`EXCEPT`', 'rows in the first but not the second', 'removed (`EXCEPT ALL` keeps)', 'anti join with `NOT EXISTS`'],
          ],
        },
      },
      { sql: "-- customers who bought bikes AND accessories\nselect customer_id from order_lines where category = 'bikes' and customer_id is not null\nintersect\nselect customer_id from order_lines where category = 'accessories';\n\n-- accessories buyers who never bought a bike\nselect customer_id from order_lines where category = 'accessories' and customer_id is not null\nexcept\nselect customer_id from order_lines where category = 'bikes';", title: 'INTERSECT and EXCEPT' },
      { sql: "select 'customer' as kind, first_name as name from customers\nunion all\nselect 'employee', name from employees\norder by kind, name;", title: 'UNION ALL stacks two lists', note: 'The `ORDER BY` applies to the whole combined result.' },
      { callout: 'tip', title: 'Diffing two tables', text: 'Set operations treat NULLs as equal (unlike `=`), so `(a EXCEPT b) UNION ALL (b EXCEPT a)` lists every row that differs between two versions of a table: a great regression test after changing a model.' },
      { callout: 'de', text: 'Use `UNION ALL` to stack monthly extracts or several sources into one table. `UNION` sorts or hashes everything to remove duplicates: only pay that price when you really want deduplication.' },
    ],
    practice: [
      { q: 'Cities that have customers but where nobody placed an order. Column: `city`.', hint: '`EXCEPT` between two city lists.', solution: 'select city from customers\nexcept\nselect city from order_lines where city is not null;' },
      { q: 'One list of all product ids that were ever ordered OR are in the `bikes` category, without duplicates. Column: `product_id`.', solution: "select product_id from order_items\nunion\nselect product_id from products where category = 'bikes';" },
    ],
    interview: [
      { q: 'UNION vs UNION ALL?', a: 'UNION removes duplicate rows, which requires a sort or hash of the whole result; UNION ALL keeps all rows and is cheaper. Use UNION ALL unless you need deduplication.' },
    ],
    related: ['semi-anti-joins', 'data-quality'],
  },
];
