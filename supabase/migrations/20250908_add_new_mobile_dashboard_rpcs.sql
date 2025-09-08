-- 新增：项目趋势区间聚合函数（不影响现有函数）
create or replace function public.get_project_trend_by_range(
  p_project_id uuid,
  p_days int
)
returns table(
  date date,
  trips int,
  weight numeric,
  receivable numeric
)
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  -- 权限校验：必须为已登录且启用的用户
  if auth.uid() is null then
    raise exception 'forbidden: not authenticated';
  end if;

  if not exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and coalesce(p.is_active, true) = true
      and p.role in ('admin','finance','business','operator','viewer')
  ) then
    raise exception 'forbidden: no permission';
  end if;

  return query
  select d::date as date,
         coalesce(count(r.id), 0) as trips,
         coalesce(sum(r.loading_weight), 0) as weight,
         coalesce(sum(r.driver_payable_cost), 0) as receivable
  from generate_series(current_date - (p_days - 1), current_date, interval '1 day') as d
  left join logistics_records r
    on r.project_id = p_project_id
   and r.loading_date::date = d::date
  group by d
  order by d;
end;
$$;

comment on function public.get_project_trend_by_range(uuid, int)
  is '按区间（近 N 天）返回项目趋势数据（车次、重量、金额），用于移动端图表。';


-- 新增：项目当日司机排行函数（排序 + 分页）
create or replace function public.get_project_driver_ranking(
  p_project_id uuid,
  p_report_date date,
  p_sort text,
  p_order text,
  p_limit int default 100,
  p_offset int default 0
)
returns table(
  driver_id uuid,
  driver_name text,
  license_plate text,
  phone text,
  daily_trip_count int,
  total_trip_count int,
  total_tonnage numeric,
  total_driver_receivable numeric
)
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  -- 权限校验：必须为已登录且启用的用户
  if auth.uid() is null then
    raise exception 'forbidden: not authenticated';
  end if;

  if not exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and coalesce(p.is_active, true) = true
      and p.role in ('admin','finance','business','operator','viewer')
  ) then
    raise exception 'forbidden: no permission';
  end if;

  return query
  with daily as (
    select driver_id, count(*) as daily_trip_count
    from logistics_records
    where project_id = p_project_id
      and loading_date::date = p_report_date
    group by driver_id
  ),
  tot as (
    select driver_id,
           max(driver_name) as driver_name,
           max(license_plate) as license_plate,
           max(driver_phone) as phone,
           count(*) as total_trip_count,
           coalesce(sum(loading_weight), 0) as total_tonnage,
           coalesce(sum(driver_payable_cost), 0) as total_driver_receivable
    from logistics_records
    where project_id = p_project_id
    group by driver_id
  ),
  joined as (
    select t.driver_id, t.driver_name, t.license_plate, t.phone,
           coalesce(d.daily_trip_count, 0) as daily_trip_count,
           t.total_trip_count, t.total_tonnage, t.total_driver_receivable
    from tot t
    left join daily d on d.driver_id = t.driver_id
  )
  select driver_id, driver_name, license_plate, phone,
         daily_trip_count, total_trip_count, total_tonnage, total_driver_receivable
  from (
    select j.*, 
      case 
        when lower(p_sort) = 'daily' then j.daily_trip_count::numeric
        when lower(p_sort) = 'total' then j.total_trip_count::numeric
        else j.total_driver_receivable
      end as sort_value
    from joined j
  ) s
  order by 
    case when lower(p_order) = 'asc' then sort_value end asc,
    case when lower(p_order) = 'desc' then sort_value end desc,
    driver_name
  limit p_limit offset p_offset;
end;
$$;

comment on function public.get_project_driver_ranking(uuid, date, text, text, int, int)
  is '返回项目维度的司机排行，支持排序（daily/total/amount）与分页，用于移动端排行与导出。';


