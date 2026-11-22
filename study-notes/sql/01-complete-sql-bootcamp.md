# The Complete SQL Bootcamp (Jose Portilla) — my notes

Days 1–9 of the program. PostgreSQL + pgAdmin.

Every example runs on the practice shop database: run [setup.sql](setup.sql) first (customers, products, orders, order_items, employees). The course uses its own sample database; I use mine so I practise on data I didn't see in the videos.

**Contents**
1. [Databases and setup](#1-databases-and-setup)
2. [SQL statement fundamentals](#2-sql-statement-fundamentals)
3. [GROUP BY](#3-group-by)
4. [JOINs](#4-joins)
5. [Advanced commands: dates, math, strings, subqueries, self-joins](#5-advanced-commands)
6. [Creating databases and tables](#6-creating-databases-and-tables)
7. [Conditional expressions, views, import/export](#7-conditional-expressions-views-importexport)
8. [PostgreSQL with Python](#8-postgresql-with-python)
9. [Beyond the course: CTEs and window functions](#9-beyond-the-course-ctes-and-window-functions)
10. [Cheat sheet](#10-cheat-sheet)

---

## 1. Databases and setup

- A **database** stores data in **tables** (rows × columns). A **relational** database links tables through keys, and SQL is the language to query them.
- **PostgreSQL** is the server that stores the data. **pgAdmin** is a GUI client. **psql** is the command-line client. A data engineer uses psql and Python far more than pgAdmin.
- A server holds several **databases**. A database holds **schemas** (`public` by default). A schema holds **tables**.

```bash
psql -U postgres -c "create database shop"
psql -U postgres -d shop -f setup.sql
psql -U postgres -d shop          # then: \dt (tables), \d orders (columns), \q (quit)
```

**My notes**
-

---

## 2. SQL statement fundamentals

### SELECT
Choose columns. `*` means all columns: fine for exploring, avoid in pipelines (a new column silently changes your output).
```sql
select first_name, city from customers;
```

### SELECT DISTINCT
Unique values, or unique combinations of the listed columns.
```sql
select distinct city from customers;
select distinct category, price > 100 as expensive from products;
```

### COUNT
```sql
select count(*) from customers;            -- rows: 6
select count(email) from customers;        -- non-null emails: 5
select count(distinct city) from customers; -- 4 cities
```
`count(*)` counts rows, `count(col)` skips NULLs. That difference is a classic interview question.

### WHERE
Filter rows with `=`, `<>`, `<`, `>=`, `and`, `or`, `not`.
```sql
select name, price from products
where category = 'accessories' and price < 40;
```
- Text uses single quotes. Double quotes are for identifiers (column names).
- `and` binds tighter than `or`, so add parentheses: `where (a or b) and c`.
- NULL is never `= null`. Use `is null` / `is not null`.
```sql
select first_name from customers where email is null;   -- Chloé
```

### ORDER BY and LIMIT
```sql
select name, price from products
order by price desc, name      -- ties broken by name
limit 3;
```
Without `order by`, row order is not guaranteed, even if it looks stable.

### BETWEEN, IN, LIKE / ILIKE
```sql
select * from products where price between 20 and 50;        -- inclusive at both ends
select * from customers where city in ('Lyon', 'Lille');
select * from customers where email like '%@mail.fr';         -- % = any text, _ = one character
select * from products where name ilike '%bike%';             -- ILIKE = case-insensitive (Postgres only)
```
Trap: `ordered_at between '2026-03-01' and '2026-03-31'` misses March 31 after midnight on a timestamp. Use `ordered_at >= '2026-03-01' and ordered_at < '2026-04-01'`.

**Practice**
1. Products in `parts` or `accessories` under 30 €, cheapest first.
2. How many orders were not cancelled?
3. Customers whose last name contains "an", any case.

**My notes**
-

---

## 3. GROUP BY

Aggregate functions turn many rows into one value: `count`, `sum`, `avg`, `min`, `max`. `group by` computes them per group.

```sql
select category, count(*) as n, round(avg(price), 2) as avg_price, max(price)
from products
group by category
order by n desc;
```
Rule: every column in `select` is either in `group by` or inside an aggregate.

### HAVING
`where` filters rows **before** grouping, `having` filters groups **after**.
```sql
-- customers with at least 2 non-cancelled orders
select customer_id, count(*) as orders
from orders
where status <> 'cancelled'      -- row filter
group by customer_id
having count(*) >= 2;            -- group filter
```

Order SQL runs in (not the order you write it):
`from → join → where → group by → having → select → distinct → order by → limit`.
That's why a `select` alias can be used in `order by` but not in `where`.

**Practice**
1. Number of orders per status.
2. Revenue per category (join order_items and products, `sum(quantity * price)`).
3. Cities with more than one customer.

**My notes**
-

---

## 4. JOINs

### Aliases (AS)
```sql
select c.first_name as customer, o.ordered_at
from customers as c
join orders as o on o.customer_id = c.customer_id;
```

### The join types

| Join | Keeps |
| --- | --- |
| `inner join` (or just `join`) | only rows that match on both sides |
| `left join` | every row on the left, plus matches (NULLs when none) |
| `right join` | every row on the right (rewrite it as a left join, it's easier to read) |
| `full outer join` | every row from both sides |

```sql
-- every customer, including Karim who never ordered
select c.first_name, count(o.order_id) as orders
from customers c
left join orders o on o.customer_id = c.customer_id
group by c.first_name
order by orders desc;
```
`count(o.order_id)`, not `count(*)`: for Karim, `count(*)` would count his NULL row and return 1.

### Anti-join: rows with no match
```sql
-- products never sold (Chain)
select p.name
from products p
left join order_items oi on oi.product_id = p.product_id
where oi.product_id is null;
```

### Full outer join
```sql
-- customers without orders AND orders without customers (the guest checkout)
select c.first_name, o.order_id
from customers c
full outer join orders o on o.customer_id = c.customer_id
where c.customer_id is null or o.order_id is null;
```

### UNION
Stacks results with the same columns. `union` removes duplicates; `union all` keeps them and is faster.
```sql
select city from customers where city = 'Paris'
union all
select 'Paris';
```

Join traps:
- **Fan-out:** joining orders to order_items repeats each order once per item. Summing an order-level value after that join counts it several times.
- A `where` on the right table of a left join (`where o.status = 'paid'`) silently turns it into an inner join. Put that condition in the `on` clause instead.

**Practice**
1. Each order with the customer's full name, guests shown as "Guest".
2. Total spent per customer, including customers who spent 0.
3. Products bought by customers from Paris.

**My notes**
-

---

## 5. Advanced commands

### Dates and times
Types: `date`, `time`, `timestamp`, `timestamptz` (with time zone — prefer it for event data), `interval`.
```sql
select now(), current_date;
select order_id,
       extract(month from ordered_at)  as month,
       extract(dow from ordered_at)    as weekday,      -- 0 = Sunday
       date_trunc('month', ordered_at) as month_start,  -- best for grouping by month
       age(now(), ordered_at)          as how_long_ago,
       to_char(ordered_at, 'DD/MM/YYYY HH24:MI') as french_format
from orders;

select ordered_at + interval '7 days' as delivery_deadline from orders;
```
```sql
-- orders per month
select date_trunc('month', ordered_at)::date as month, count(*)
from orders group by 1 order by 1;
```

### Math
```sql
select name, price,
       round(price * 1.2, 2) as price_with_vat,
       price::int / 100      as hundreds,      -- integer division drops decimals
       price % 10            as remainder
from products;
```
Trap: `5 / 2 = 2` in Postgres (integer division). Write `5 / 2.0` or `5::numeric / 2`.

### Strings
```sql
select first_name || ' ' || upper(last_name)  as full_name,
       length(first_name)                     as len,
       lower(email)                           as email,
       left(last_name, 1) || '.'              as initial,
       split_part(email, '@', 2)              as domain,
       replace(city, 'Paris', 'Paname')       as nickname
from customers;
```

### Subqueries
A query inside a query.
```sql
-- products more expensive than the average
select name, price from products
where price > (select avg(price) from products);

-- customers who placed at least one order
select first_name from customers
where customer_id in (select customer_id from orders);

-- same with EXISTS (stops at the first match, handles NULLs safely)
select first_name from customers c
where exists (select 1 from orders o where o.customer_id = c.customer_id);
```
Trap: `not in (subquery)` returns nothing if the subquery contains a NULL. Our orders table has a NULL customer_id (the guest), so `where customer_id not in (select customer_id from orders)` returns zero rows. Use `not exists`.

### Self-join
A table joined to itself, with two aliases.
```sql
-- each employee and their manager
select e.name as employee, m.name as manager
from employees e
left join employees m on m.employee_id = e.manager_id;
```

**Practice**
1. Number of orders per weekday name (`to_char(ordered_at, 'Day')`).
2. Customers who never ordered, with `not exists`.
3. Pairs of products in the same category (self-join, avoid pairing a product with itself or listing each pair twice).

**My notes**
-

---

## 6. Creating databases and tables

### Data types
| Need | Type |
| --- | --- |
| whole numbers | `int`, `bigint` (ids that may exceed 2 billion) |
| money | `numeric(10,2)` — never `float` (0.1 + 0.2 ≠ 0.3) |
| text | `text` or `varchar(n)` (same speed in Postgres) |
| true/false | `boolean` |
| dates | `date`, `timestamptz` |
| auto ids | `serial`, or the modern `int generated always as identity` |
| semi-structured | `jsonb` |

### Keys
- **Primary key:** unique and not null; identifies a row. It can span several columns (`order_items` uses `(order_id, product_id)`).
- **Foreign key:** a column that must match a primary key in another table. It stops orphans (an order for a customer who doesn't exist).

### Constraints
`not null`, `unique`, `check (price > 0)`, `default`, `references`. Constraints are your last line of data-quality defence: bad data is rejected at insert time instead of found in a dashboard.

```sql
create table reviews (
  review_id   int generated always as identity primary key,
  product_id  int not null references products (product_id),
  stars       int not null check (stars between 1 and 5),
  comment     text,
  created_at  timestamptz not null default now()
);
```

### INSERT, UPDATE, DELETE
```sql
insert into reviews (product_id, stars, comment) values (3, 5, 'Very comfortable')
returning review_id;                       -- get the generated id back

update products set price = price * 0.9
where category = 'accessories'
returning name, price;

delete from reviews where stars < 2;
```
Always write the `where` first. Run it as a `select` to see which rows it hits, then change it to `update`/`delete`. Inside `begin; ... rollback;` you can test without risk.

Upsert (essential in pipelines: re-running a load must not create duplicates):
```sql
insert into products (product_id, name, category, price)
values (3, 'Helmet', 'accessories', 44.90)
on conflict (product_id) do update set price = excluded.price;
```

### ALTER and DROP
```sql
alter table customers add column phone text;
alter table customers rename column phone to phone_number;
alter table customers alter column city set default 'Paris';
alter table customers drop column phone_number;
alter table reviews add constraint short_comment check (length(comment) <= 500);
drop table if exists reviews;
```
`drop table` deletes the table and its data. `truncate` empties it but keeps the structure. `delete` without a `where` empties it row by row (slower, but it fires triggers and can be filtered).

**Practice**
1. Create a `stores` table (id, name, arrondissement 1–20 with a CHECK).
2. Insert a product with a negative price and read the error.
3. Try to delete customer 1 and explain the foreign-key error.

**My notes**
-

---

## 7. Conditional expressions, views, import/export

### CASE
```sql
select name, price,
  case
    when price >= 500 then 'premium'
    when price >= 30  then 'mid'
    else 'budget'
  end as tier
from products;

-- conditional counting: one row, one column per status
select
  count(*) filter (where status = 'paid')    as paid,     -- Postgres shortcut
  sum(case when status = 'shipped' then 1 else 0 end) as shipped,  -- portable version
  count(*) filter (where status = 'cancelled') as cancelled
from orders;
```

### COALESCE
First non-null value.
```sql
select first_name, coalesce(email, 'no email') from customers;
select o.order_id, coalesce(c.first_name, 'Guest') from orders o left join customers c using (customer_id);
```

### CAST
```sql
select cast('2026-04-01' as date), '42'::int, price::text from products;
```

### NULLIF
Returns NULL when both values are equal. The classic use is avoiding division by zero:
```sql
select category,
       sum(price) / nullif(count(*) filter (where price > 1000), 0) as ratio
from products group by category;     -- NULL instead of an error when the count is 0
```

### Views
A saved query you can select from like a table. It stores the query, not the data (a `materialized view` stores the data and needs `refresh`).
```sql
create or replace view order_totals as
select o.order_id, o.customer_id, o.status, sum(oi.quantity * p.price) as total
from orders o
join order_items oi using (order_id)
join products p using (product_id)
group by o.order_id;

select * from order_totals where total > 500;
```

### Import and export
```sql
-- psql client-side (file on your machine)
\copy products to 'products.csv' with (format csv, header)

-- import into an empty staging table: loading straight into products would fail on duplicate ids
create table products_staging (like products);
\copy products_staging from 'products.csv' with (format csv, header)
```
`copy` without the backslash reads files on the **server**, which is usually not your laptop.

Pipeline pattern: load the raw file into a staging table, check it, then `insert ... on conflict` into the real table.

**Practice**
1. Label each customer "new" (signed up after March 1st) or "existing".
2. A view `customer_revenue` with total spent per customer (0 when none).
3. Export it to CSV with `\copy`.

**My notes**
-

---

## 8. PostgreSQL with Python

The course uses psycopg2. New projects use **psycopg 3** (`pip install "psycopg[binary]"`); the API is almost the same.

```python
import os
import psycopg

with psycopg.connect(os.environ["PG_DSN"]) as conn:       # e.g. postgresql://postgres:pw@localhost/shop
    with conn.cursor() as cur:
        cur.execute(
            "select name, price from products where category = %s and price < %s",
            ("accessories", 50),                            # parameters: never f-strings
        )
        for name, price in cur.fetchall():
            print(name, price)

        cur.executemany(
            "insert into reviews (product_id, stars) values (%s, %s)",
            [(1, 4), (2, 5)],
        )
    # leaving the `with` block commits; an exception rolls back
```

Rules:
- **Never** build SQL with f-strings or `+`: that's SQL injection. Pass values as parameters (`%s`).
- Keep credentials in environment variables or `.env`, never in code.
- For loading big files, use `cur.copy(...)` (COPY), which is far faster than row-by-row inserts.
- `pandas.read_sql(query, conn)` is handy for analysis; for pipelines, plain SQL with COPY is faster.

**My notes**
-

---

## 9. Beyond the course: CTEs and window functions

The bootcamp stops before these, but they're in almost every data engineering interview (and they're LinkedIn Post 2 on day 14).

### CTE (WITH)
Names a subquery so the query reads top to bottom.
```sql
with order_totals as (
  select o.order_id, o.customer_id, sum(oi.quantity * p.price) as total
  from orders o
  join order_items oi using (order_id)
  join products p using (product_id)
  where o.status <> 'cancelled'
  group by o.order_id, o.customer_id
)
select customer_id, count(*) as orders, sum(total) as spent
from order_totals
where customer_id is not null
group by customer_id
order by spent desc;
```

### Window functions
Like an aggregate, but every row stays: `function() over (partition by ... order by ...)`.
```sql
with order_totals as (
  select o.order_id, o.customer_id, o.ordered_at, sum(oi.quantity * p.price) as total
  from orders o join order_items oi using (order_id) join products p using (product_id)
  group by o.order_id
)
select customer_id, order_id, ordered_at, total,
  row_number() over (partition by customer_id order by ordered_at)  as nth_order,
  sum(total)   over (partition by customer_id order by ordered_at)  as running_total,
  lag(ordered_at) over (partition by customer_id order by ordered_at) as previous_order,
  rank()       over (order by total desc)                           as rank_by_value
from order_totals
order by customer_id, ordered_at;
```
- `row_number` → 1, 2, 3, 4. `rank` → 1, 2, 2, 4 (gaps after ties). `dense_rank` → 1, 2, 2, 3.
- `lag`/`lead` → previous/next row's value (time between orders, month-over-month change).
- Deduplication pattern used in every pipeline: keep the latest row per key.
```sql
select * from (
  select *, row_number() over (partition by customer_id order by ordered_at desc) as rn
  from orders
) t
where rn = 1;     -- each customer's most recent order
```

**My notes**
-

---

## 10. Cheat sheet

```sql
select [distinct] cols, agg(col)
from t1
[left|full] join t2 on ...
where row_condition
group by cols
having group_condition
order by col [desc]
limit n;
```

| Question | Answer |
| --- | --- |
| `where` vs `having` | `where` filters rows before grouping, `having` filters groups after |
| `count(*)` vs `count(col)` | `count(col)` skips NULLs |
| `union` vs `union all` | `union` removes duplicates (slower) |
| `delete` vs `truncate` vs `drop` | some rows / all rows / the whole table |
| `in` vs `exists` | `not in` breaks on NULLs; `not exists` doesn't |
| `rank` vs `dense_rank` vs `row_number` | gaps after ties / no gaps / always unique |
| primary key vs unique | PK: one per table, never NULL; unique: several allowed, NULL allowed |
| view vs materialized view | stored query vs stored result (needs refresh) |

**Interview questions to answer out loud**
1. Find the second-highest product price (two ways: subquery, window function).
2. Find duplicate emails in a customers table.
3. Explain why a left join can return more rows than the left table.
4. Monthly revenue and its change from the previous month.
5. What happens to `not in` when the subquery returns a NULL?
