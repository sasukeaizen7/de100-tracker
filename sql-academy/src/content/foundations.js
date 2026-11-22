export const foundations = [
  {
    id: 'relational-model',
    title: 'Tables, rows, keys and grain',
    level: 'basic',
    summary: 'A relational database stores facts in tables, links them with keys, and every table has a grain: what one row means.',
    body: [
      { p: 'A **table** is a set of rows that all have the same columns. Each **row** records one fact ("Amina placed order 1 on 15 January"), and each **column** holds one attribute of that fact, with a fixed type (`int`, `text`, `timestamp`…).' },
      { p: 'Tables are linked through **keys**. A **primary key** identifies each row uniquely (`orders.order_id`). A **foreign key** in another table points to it (`order_items.order_id`). Splitting data this way means a customer\'s email is stored once, not repeated on every order.' },
      { callout: 'analogy', text: 'Think of a spreadsheet workbook where each sheet has one job, and you link sheets by an ID column instead of copying data between them. SQL is the language for asking questions across those sheets.' },
      { h: 'The practice database' },
      { p: 'Every example in SQL Academy runs on a small Paris bike shop, loaded into a real PostgreSQL that runs inside your browser. Nothing you do here can break anything: the **Reset data** button at the top rebuilds it.' },
      {
        table: {
          head: ['Table / view', 'Grain: one row is…', 'Worth knowing'],
          rows: [
            ['`customers`', 'a customer', 'Karim (6) never ordered; Chloé (3) has no email'],
            ['`products`', 'a product', 'the Chain (7) was never sold'],
            ['`orders`', 'an order', 'order 8 is a guest checkout: `customer_id` is NULL'],
            ['`order_items`', 'one product inside one order', 'primary key `(order_id, product_id)`'],
            ['`employees`', 'an employee', '`manager_id` points to another employee'],
            ['`events`', 'one website event', 'JSON `payload`; used for sessions and streaks'],
            ['`order_lines` (view)', 'one product in one order, with revenue', 'orders + items + products + city'],
            ['`order_summary` (view)', 'one order, with its total', 'built on `order_lines`'],
          ],
        },
      },
      { sql: 'select * from customers;', title: 'Look at a table' },
      { sql: "select table_name, table_type\nfrom information_schema.tables\nwhere table_schema = 'public'\norder by table_type, table_name;", title: 'List every table and view' },
      { h: 'Grain: the most important word in analytics' },
      { p: 'The **grain** of a table is the answer to "what does one row represent?". `orders` has one row per order; `order_items` has one row per product per order. When you combine tables of different grains, rows multiply, and sums silently become wrong. Before writing any join or aggregate, say the grain of each input out loud.' },
      { sql: 'select order_id, count(*) as lines\nfrom order_items\ngroup by order_id\norder by order_id;', title: 'Order 1 has 3 lines: its grain is finer than orders', note: 'Order 1 appears three times in `order_items`. Joining `orders` to `order_items` therefore repeats order 1 three times.' },
      { callout: 'de', text: 'Data models in dbt and warehouses document the grain of every table first. "One row per order line per day" is a sentence you will write in every model description.' },
    ],
    practice: [
      { q: 'List the name and price of every product.', solution: 'select name, price from products;' },
      { q: 'How many rows does `order_items` have? (one number)', hint: '`count(*)` counts rows.', solution: 'select count(*) from order_items;' },
    ],
    interview: [
      { q: 'What is the difference between a primary key and a foreign key?', a: 'A primary key uniquely identifies each row of its own table and can never be NULL. A foreign key is a column whose values must exist in another table\'s primary (or unique) key; it enforces the link between the tables and may be NULL when the link is optional.' },
      { q: 'What do you mean by the grain of a table?', a: 'The level of detail of one row: one row per order, per order line, per customer per day. Knowing the grain tells you which joins will multiply rows and which aggregations are safe.' },
    ],
    related: ['query-order', 'constraints', 'join-pitfalls'],
  },
  {
    id: 'query-order',
    title: 'How a query is evaluated',
    level: 'basic',
    summary: 'You write SELECT first, but the database runs FROM first. Knowing the logical order explains most beginner errors.',
    body: [
      { p: 'SQL is **declarative**: you describe the result you want, and the database decides how to get it. Still, every query has a **logical order of evaluation** that defines what each clause can see.' },
      { diagram: 'query-order' },
      { p: 'Each step receives the output of the previous one. `WHERE` works on rows coming out of `FROM`, before any group exists, so it cannot use `count(*)`. `SELECT` runs after `GROUP BY`, so it can only show grouped columns and aggregates. `ORDER BY` runs after `SELECT`, so it can use the aliases you defined there.' },
      {
        table: {
          head: ['You try…', 'What happens', 'Because'],
          rows: [
            ['an alias from `SELECT` in `WHERE`', '- error: column does not exist', '`WHERE` runs before `SELECT`'],
            ['an alias from `SELECT` in `ORDER BY`', '+ works', '`ORDER BY` runs after `SELECT`'],
            ['`count(*)` in `WHERE`', '- error: aggregates not allowed', 'groups are formed later; use `HAVING`'],
            ['`row_number()` in `WHERE`', '- error: window functions not allowed', 'windows are computed after `HAVING`'],
            ['`LIMIT 3` without `ORDER BY`', '~ any 3 rows', 'tables have no built-in order'],
          ],
        },
      },
      { sql: "select name, price * 1.2 as price_ttc\nfrom products\nwhere price_ttc > 100;", title: 'Fails: the alias does not exist yet in WHERE', expectError: true, note: 'Run it to see the error, then try the fix below.' },
      { sql: "select * from (\n  select name, round(price * 1.2, 2) as price_ttc\n  from products\n) p\nwhere price_ttc > 100\norder by price_ttc desc;", title: 'Fix: compute it in a subquery, filter outside' },
      { callout: 'tip', text: 'When a query gets complicated, read it in evaluation order: FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY. Ask at each step "what rows do I have now?".' },
      { callout: 'note', text: 'This is the *logical* order. The optimizer may physically execute things differently (push filters down, use an index), but the result is always as if this order were followed.' },
    ],
    practice: [
      { q: 'Show each product\'s name and its price with 20% VAT as `price_ttc`, keeping only products whose `price_ttc` is under 50, cheapest first.', hint: 'Either repeat the expression in WHERE or filter in an outer query.', solution: 'select name, price * 1.2 as price_ttc\nfrom products\nwhere price * 1.2 < 50\norder by price_ttc;', ordered: true },
    ],
    interview: [
      { q: 'Why can you use a column alias in ORDER BY but not in WHERE?', a: 'Because of the logical evaluation order: WHERE is evaluated before the SELECT list, so the alias does not exist yet; ORDER BY is evaluated after SELECT, so it can reference it.' },
    ],
    related: ['select-where', 'group-by-having', 'window-basics'],
  },
  {
    id: 'null-logic',
    title: 'NULL and three-valued logic',
    level: 'basic',
    summary: 'NULL means "unknown". Comparisons with NULL are neither true nor false, which silently removes rows if you forget it.',
    body: [
      { p: '`NULL` is not zero and not an empty string: it is the absence of a value, "we don\'t know". Because it is unknown, any comparison with it is also unknown. SQL therefore has **three** truth values: true, false and unknown (shown as NULL).' },
      { p: '`WHERE` keeps a row only when the condition is **true**. Unknown is treated like false, so rows with NULLs quietly disappear from filters.' },
      {
        table: {
          head: ['Expression', 'Result', 'Why'],
          rows: [
            ['`NULL = NULL`', 'NULL', 'two unknowns are not known to be equal'],
            ['`NULL <> 5`', 'NULL', 'unknown could be 5'],
            ['`NULL IS NULL`', 'true', 'the correct way to test for NULL'],
            ['`NULL IS DISTINCT FROM NULL`', 'false', 'NULL-safe comparison: NULLs count as equal'],
            ['`5 IS DISTINCT FROM NULL`', 'true', 'great for detecting changed values'],
            ['`true AND NULL`', 'NULL', 'depends on the unknown'],
            ['`false AND NULL`', 'false', 'false whatever the unknown is'],
            ['`true OR NULL`', 'true', 'true whatever the unknown is'],
            ['`NOT NULL`', 'NULL', 'the opposite of unknown is unknown'],
            ['`5 + NULL`, `\'a\' || NULL`', 'NULL', 'NULL spreads through expressions'],
          ],
        },
      },
      { sql: "select first_name, email,\n       email = null                     as wrong_test,\n       email is null                    as right_test,\n       email is distinct from 'x@y.fr'  as changed\nfrom customers;", title: 'Testing for NULL', note: '`wrong_test` is NULL on every row, even for Chloé, whose email really is NULL.' },
      { sql: "-- Chloé (NULL email) is in neither result\nselect first_name from customers where email like '%@mail.fr';\nselect first_name from customers where email not like '%@mail.fr';", title: 'Rows with NULL fall through both a filter and its opposite' },
      { h: 'How functions treat NULL' },
      {
        table: {
          head: ['Function', 'Behaviour'],
          rows: [
            ['`count(*)`', 'counts rows, NULLs included'],
            ['`count(col)`, `sum`, `avg`, `min`, `max`', 'ignore NULLs (`avg` divides by non-NULL count only)'],
            ['`sum` of zero rows', 'returns NULL, not 0: wrap in `coalesce(sum(x), 0)`'],
            ['`coalesce(a, b, c)`', 'first non-NULL argument'],
            ['`nullif(a, b)`', 'NULL when a = b, else a'],
            ['`ORDER BY col`', 'NULLs come last ascending, first descending (change with `NULLS FIRST/LAST`)'],
            ['`GROUP BY`, `DISTINCT`, `UNION`', 'treat all NULLs as one group'],
          ],
        },
      },
      { sql: 'select count(*) as rows, count(email) as emails, count(distinct city) as cities\nfrom customers;', title: 'count(*) vs count(column)' },
      { callout: 'trap', text: '`NOT IN (subquery)` returns no rows at all if the subquery contains a NULL. See [IN, ANY, ALL, EXISTS](#/c/in-any-all-exists).' },
    ],
    practice: [
      { q: 'List the first names of customers who **have** an email address.', solution: 'select first_name from customers where email is not null;' },
      { q: 'Show every order with `customer_id`, displaying `0` instead of NULL for the guest order. Columns: `order_id`, `customer`.', hint: '`coalesce`', solution: 'select order_id, coalesce(customer_id, 0) as customer from orders;' },
    ],
    interview: [
      { q: 'What does `SELECT * FROM t WHERE col = NULL` return?', a: 'No rows, ever. `col = NULL` evaluates to unknown for every row and WHERE keeps only true. Use `col IS NULL`.' },
      { q: 'What is the difference between COUNT(*) and COUNT(col)?', a: 'COUNT(*) counts rows; COUNT(col) counts rows where col is not NULL. COUNT(DISTINCT col) counts distinct non-NULL values.' },
    ],
    related: ['in-any-all-exists', 'case-coalesce', 'aggregate-functions'],
  },
];

export const querying = [
  {
    id: 'select-where',
    title: 'SELECT and WHERE',
    level: 'basic',
    summary: 'SELECT chooses and computes columns; WHERE keeps the rows that match a condition.',
    body: [
      { p: '`SELECT` lists the columns you want, including computed ones (`price * 1.2`). `FROM` names the table. `WHERE` filters rows with a boolean condition built from comparisons (`=`, `<>`, `<`, `>=`), `AND`, `OR`, `NOT`, and helpers like `IN`, `BETWEEN` and `LIKE`.' },
      { sql: "select name, category, price, price * 1.2 as price_ttc\nfrom products\nwhere category = 'accessories'\n  and price < 45;", title: 'Columns, an expression and a filter' },
      { h: 'Operators at a glance' },
      {
        table: {
          head: ['Operator', 'Example', 'Note'],
          rows: [
            ['`=`, `<>` (or `!=`)', "`city = 'Paris'`", 'text values use single quotes'],
            ['`<`, `<=`, `>`, `>=`', '`price >= 100`', 'work on numbers, dates and text'],
            ['`BETWEEN a AND b`', '`price between 20 and 50`', 'inclusive on both ends'],
            ['`IN (…)`', "`city in ('Lyon', 'Lille')`", 'shorter than several `OR`s'],
            ['`IS NULL`', '`email is null`', 'never `= null`'],
            ['`AND`, `OR`, `NOT`', '`a and (b or c)`', '`AND` binds tighter than `OR`: use parentheses'],
          ],
        },
      },
      { sql: "-- without parentheses: all Lyon customers + Paris customers who signed up after March\nselect first_name, city, signup_date from customers\nwhere city = 'Lyon' or city = 'Paris' and signup_date > '2026-03-01';\n\n-- with parentheses: only customers (Lyon or Paris) who signed up after March\nselect first_name, city, signup_date from customers\nwhere (city = 'Lyon' or city = 'Paris') and signup_date > '2026-03-01';", title: 'AND before OR: parentheses change the answer' },
      { callout: 'trap', text: '`"Paris"` in double quotes means a column named Paris, not the text. Strings always take single quotes; double quotes are only for identifiers like `"Order Date"`.' },
      { callout: 'tip', text: 'Avoid `SELECT *` in pipelines and views: when someone adds a column upstream, your output silently changes. List the columns you need.' },
    ],
    practice: [
      { q: 'Products in the `parts` or `accessories` category costing less than 30 €. Show `name`, `category`, `price`.', solution: "select name, category, price from products\nwhere category in ('parts', 'accessories') and price < 30;" },
      { q: 'Orders that are not cancelled and were placed in March 2026 or later. Show `order_id`, `status`.', hint: "Compare `ordered_at >= '2026-03-01'`.", solution: "select order_id, status from orders\nwhere status <> 'cancelled' and ordered_at >= '2026-03-01';" },
    ],
    interview: [
      { q: 'What is the precedence of AND and OR?', a: 'AND is evaluated before OR, like multiplication before addition. `a OR b AND c` means `a OR (b AND c)`. Always use parentheses when mixing them.' },
    ],
    related: ['order-limit', 'pattern-matching', 'null-logic'],
  },
  {
    id: 'order-limit',
    title: 'ORDER BY, LIMIT and pagination',
    level: 'basic',
    summary: 'Rows have no order until you ask for one. ORDER BY sorts; LIMIT and OFFSET cut the result.',
    body: [
      { p: 'A table is a set: without `ORDER BY`, the database may return rows in any order, and the order can change between runs. Sort explicitly whenever order matters, and always before `LIMIT`.' },
      { sql: 'select name, category, price\nfrom products\norder by category, price desc, name;', title: 'Sort by several columns', note: 'Sorted by category A→Z, then most expensive first inside each category, then by name to break ties.' },
      { sql: 'select first_name, email\nfrom customers\norder by email nulls first;', title: 'Control where NULLs go' },
      { h: 'LIMIT, OFFSET and their cost' },
      { sql: 'select name, price from products\norder by price desc\nlimit 3 offset 3;   -- page 2 with 3 items per page', title: 'Page 2 with OFFSET' },
      { p: '`OFFSET n` still reads and throws away the first n rows, so page 1000 is slow. For big tables, use **keyset pagination**: remember the last value of the previous page and continue after it, which an index can jump to directly.' },
      { sql: '-- page 1 ended at price 49.90 (product 3): continue right after it\nselect product_id, name, price from products\nwhere (price, product_id) < (49.90, 3)\norder by price desc, product_id desc\nlimit 3;', title: 'Keyset pagination: fast at any depth' },
      {
        table: {
          head: ['', '`LIMIT … OFFSET`', 'Keyset (`WHERE key < last`)'],
          rows: [
            ['Speed on deep pages', '- reads all skipped rows', '+ constant with an index'],
            ['Jump to page N', '+ yes', '- only next / previous'],
            ['Stable when rows are inserted', '- rows shift between pages', '+ yes'],
            ['Typical use', 'small admin lists', 'APIs, infinite scroll, batch exports'],
          ],
        },
      },
      { callout: 'trap', text: 'If the sort key has ties (two products at the same price), pages can overlap or skip rows. Add a unique column (the id) as the last sort key.' },
    ],
    practice: [
      { q: 'The 3 most recent orders: `order_id`, `ordered_at`, newest first.', solution: 'select order_id, ordered_at from orders order by ordered_at desc limit 3;', ordered: true },
      { q: 'Customers sorted by city, then by last name. Show `last_name`, `city`.', solution: 'select last_name, city from customers order by city, last_name;', ordered: true },
    ],
    interview: [
      { q: 'Why is OFFSET pagination slow on large tables and what do you use instead?', a: 'The database must produce and discard every skipped row, so cost grows with the page number. Keyset (seek) pagination filters on the last seen sort key, `WHERE (created_at, id) < (:last_created, :last_id)`, which uses an index and stays fast.' },
    ],
    related: ['select-where', 'indexes'],
  },
  {
    id: 'pattern-matching',
    title: 'LIKE, ILIKE and regular expressions',
    level: 'basic',
    summary: 'Match text by pattern: LIKE for simple wildcards, ~ for full regular expressions.',
    body: [
      { p: '`LIKE` compares text to a pattern with two wildcards: `%` matches any sequence of characters (even empty) and `_` matches exactly one character. `ILIKE` is the case-insensitive version (PostgreSQL only).' },
      { sql: "select name from products where name like '%bike';     -- ends with 'bike'\nselect name from products where name ilike 'e%';       -- starts with e or E\nselect email from customers where email like '_____@%'; -- exactly 5 characters before @", title: 'LIKE patterns' },
      { p: 'For anything richer, PostgreSQL supports POSIX **regular expressions**: `~` (case-sensitive), `~*` (insensitive), `!~` (does not match). Functions extract or rewrite matches.' },
      { sql: "select email,\n       email ~ '^[^@\\s]+@[^@\\s]+\\.[a-z]{2,}$'     as looks_valid,\n       substring(email from '@(.*)$')             as domain,\n       regexp_replace(email, '^(.).*@', '\\1***@') as masked\nfrom customers\nwhere email is not null;", title: 'Validate, extract and mask with regex' },
      {
        table: {
          head: ['Tool', 'Case', 'Power', 'Can use a normal index'],
          rows: [
            ["`LIKE 'abc%'`", 'sensitive', 'prefix/suffix/contains', '+ prefix only (with `text_pattern_ops`)'],
            ["`ILIKE '%abc%'`", 'insensitive', 'same', '- needs a trigram index'],
            ["`~ '^a.c$'`", 'sensitive (`~*` insensitive)', 'full regex', '- needs a trigram index'],
            ['`lower(x) = …`', 'insensitive', 'exact match', '+ with an expression index'],
          ],
        },
      },
      { callout: 'trap', text: 'To match a literal `%` or `_`, escape it: `like \'50\\%%\'`. And remember `LIKE` with a leading `%` cannot use a B-tree index, so it scans the whole table.' },
    ],
    practice: [
      { q: 'Products whose name contains "light" in any case. Show `name`.', solution: "select name from products where name ilike '%light%';" },
      { q: 'Customers whose last name ends with "i". Show `first_name`, `last_name`.', solution: "select first_name, last_name from customers where last_name like '%i';" },
    ],
    interview: [
      { q: 'Which LIKE patterns can use a B-tree index?', a: 'Only anchored prefixes such as `LIKE \'abc%\'` (with a `text_pattern_ops` index or C collation). A leading wildcard `\'%abc\'` cannot; use a trigram GIN index (`pg_trgm`) for contains-searches.' },
    ],
    related: ['strings', 'indexes'],
  },
  {
    id: 'distinct',
    title: 'DISTINCT and DISTINCT ON',
    level: 'basic',
    summary: 'DISTINCT removes duplicate rows; DISTINCT ON keeps the first row of each group.',
    body: [
      { p: '`SELECT DISTINCT` removes rows that are identical across **all** selected columns. It is applied after `SELECT`, so it considers exactly the columns you list.' },
      { sql: 'select distinct city from customers order by city;\nselect distinct category, price > 100 as expensive from products order by 1, 2;', title: 'Unique values and unique combinations' },
      { p: '`DISTINCT ON (cols)` is a PostgreSQL extension: it keeps one row per distinct value of `cols`, the **first** one according to `ORDER BY`. It is the shortest way to say "latest order per customer".' },
      { sql: '-- each customer\'s most recent order\nselect distinct on (customer_id) customer_id, order_id, ordered_at\nfrom orders\nwhere customer_id is not null\norder by customer_id, ordered_at desc;', title: 'First row per group', note: '`ORDER BY` must start with the `DISTINCT ON` columns; the next sort keys decide which row is "first".' },
      {
        table: {
          head: ['', '`DISTINCT`', '`DISTINCT ON`', '`row_number() = 1`'],
          rows: [
            ['Keeps', 'unique combinations of all columns', 'first row per group', 'first row per group'],
            ['Top-N (not only top-1)', '- no', '- no', '+ yes, `rn <= 3`'],
            ['Portable', '+ every database', '~ PostgreSQL, DuckDB', '+ every modern database'],
          ],
        },
      },
      { callout: 'trap', text: 'Adding `DISTINCT` to "fix" duplicated rows usually hides a wrong join. Find out why the rows are duplicated (fan-out) instead of masking it.' },
    ],
    practice: [
      { q: 'The distinct statuses that appear in `orders`.', solution: 'select distinct status from orders;' },
      { q: 'The cheapest product of each category: `category`, `name`, `price`.', hint: '`distinct on (category)` ordered by price.', solution: 'select distinct on (category) category, name, price\nfrom products\norder by category, price;' },
    ],
    interview: [
      { q: 'How would you get the latest record per user?', a: 'In PostgreSQL, `SELECT DISTINCT ON (user_id) … ORDER BY user_id, created_at DESC`. Portably, `row_number() OVER (PARTITION BY user_id ORDER BY created_at DESC)` in a subquery and keep `rn = 1` (or QUALIFY in Snowflake/BigQuery).' },
    ],
    related: ['deduplication', 'ranking-functions'],
  },
];
