-- Practice database for the SQL notes: a small Paris bike shop.
-- Run in psql or pgAdmin:  psql -U postgres -c "create database shop" && psql -U postgres -d shop -f setup.sql
-- Re-running it resets everything.

drop view if exists order_lines, order_summary cascade;
drop table if exists events, order_items, orders, products, customers, employees cascade;

create table customers (
  customer_id  serial primary key,
  first_name   text not null,
  last_name    text not null,
  email        text unique,
  city         text not null,
  signup_date  date not null default current_date
);

create table products (
  product_id  serial primary key,
  name        text not null,
  category    text not null,
  price       numeric(8,2) not null check (price > 0)
);

create table orders (
  order_id     serial primary key,
  customer_id  int references customers (customer_id),
  ordered_at   timestamp not null,
  status       text not null check (status in ('paid', 'shipped', 'cancelled'))
);

create table order_items (
  order_id    int references orders (order_id) on delete cascade,
  product_id  int references products (product_id),
  quantity    int not null check (quantity > 0),
  primary key (order_id, product_id)
);

create table employees (
  employee_id  int primary key,
  name         text not null,
  manager_id   int references employees (employee_id)
);

insert into customers (first_name, last_name, email, city, signup_date) values
  ('Amina',  'Benali',  'amina@mail.fr',  'Paris',    '2026-01-12'),
  ('Lucas',  'Martin',  'lucas@mail.fr',  'Paris',    '2026-02-03'),
  ('Chloé',  'Dubois',  null,             'Lyon',     '2026-02-20'),
  ('Yanis',  'Haddad',  'yanis@mail.fr',  'Marseille','2026-03-15'),
  ('Emma',   'Leroy',   'emma@mail.fr',   'Paris',    '2026-04-01'),
  ('Karim',  'Mansour', 'karim@mail.fr',  'Lille',    '2026-05-09');   -- never orders

insert into products (name, category, price) values
  ('City bike',       'bikes',       549.00),
  ('Electric bike',   'bikes',      1890.00),
  ('Helmet',          'accessories',  49.90),
  ('U-lock',          'accessories',  39.00),
  ('Front light',     'accessories',  24.50),
  ('Repair kit',      'parts',        15.00),
  ('Chain',           'parts',        29.90);   -- never sold

insert into orders (customer_id, ordered_at, status) values
  (1, '2026-01-15 10:20', 'shipped'),
  (1, '2026-03-02 18:45', 'shipped'),
  (2, '2026-02-10 09:05', 'shipped'),
  (3, '2026-03-01 14:30', 'cancelled'),
  (4, '2026-03-20 11:00', 'paid'),
  (5, '2026-04-05 20:15', 'shipped'),
  (2, '2026-04-18 16:40', 'paid'),
  (null, '2026-04-20 12:00', 'paid');   -- guest checkout, no customer

insert into order_items values
  (1, 1, 1), (1, 3, 1), (1, 4, 1),
  (2, 5, 2),
  (3, 2, 1), (3, 3, 2),
  (4, 1, 1),
  (5, 6, 3), (5, 5, 1),
  (6, 2, 1), (6, 4, 1),
  (7, 3, 1),
  (8, 6, 1);

insert into employees values
  (1, 'Sophie (CEO)', null),
  (2, 'Hugo', 1),
  (3, 'Inès', 1),
  (4, 'Théo', 2);

-- Website events for the advanced handbook (JSON, sessions, streaks). Times are Paris time (+02 in April).
create table events (
  event_id     serial primary key,
  customer_id  int references customers (customer_id),
  occurred_at  timestamptz not null,
  payload      jsonb not null
);

insert into events (customer_id, occurred_at, payload) values
  (1, '2026-04-01 10:00+02', '{"type": "page_view", "page": "/bikes", "device": "mobile"}'),
  (1, '2026-04-01 10:05+02', '{"type": "page_view", "page": "/bikes/electric", "device": "mobile"}'),
  (1, '2026-04-01 10:20+02', '{"type": "add_to_cart", "product_id": 2, "device": "mobile"}'),
  (1, '2026-04-01 11:30+02', '{"type": "page_view", "page": "/", "device": "desktop"}'),
  (1, '2026-04-01 11:32+02', '{"type": "purchase", "amount": 1890.00, "device": "desktop"}'),
  (1, '2026-04-02 09:00+02', '{"type": "page_view", "page": "/accessories", "device": "mobile"}'),
  (1, '2026-04-03 21:00+02', '{"type": "page_view", "page": "/", "device": "mobile"}'),
  (1, '2026-04-05 08:00+02', '{"type": "page_view", "page": "/parts", "device": "mobile"}'),
  (1, '2026-04-06 08:10+02', '{"type": "page_view", "page": "/parts", "device": "mobile"}'),
  (2, '2026-04-01 09:00+02', '{"type": "page_view", "page": "/", "device": "desktop"}'),
  (2, '2026-04-01 09:50+02', '{"type": "page_view", "page": "/accessories", "device": "desktop"}'),
  (2, '2026-04-01 09:55+02', '{"type": "add_to_cart", "product_id": 3, "device": "desktop"}'),
  (2, '2026-04-02 13:00+02', '{"type": "page_view", "page": "/", "device": "mobile"}'),
  (5, '2026-04-04 20:00+02', '{"type": "search", "query": "helmet", "filters": ["size:M", "color:black"], "device": "mobile"}');

-- Two helper views used throughout the handbook.
create view order_lines as
select o.order_id, o.customer_id, o.ordered_at, o.status, c.city,
       p.product_id, p.name as product, p.category, oi.quantity,
       oi.quantity * p.price as revenue
from orders o
join order_items oi using (order_id)
join products p using (product_id)
left join customers c on c.customer_id = o.customer_id;

create view order_summary as
select order_id, customer_id, ordered_at, status, sum(quantity) as items, sum(revenue) as total
from order_lines
group by order_id, customer_id, ordered_at, status;
