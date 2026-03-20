-- 在 Supabase SQL 编辑器中执行此脚本，创建管理员密码表并插入初始数据。
-- 执行后，看板登录将使用此表中的密码校验；修改密码功能会更新此表。

-- 创建 auth_settings 表
CREATE TABLE IF NOT EXISTS public.auth_settings (
  id BIGINT PRIMARY KEY,
  password TEXT NOT NULL
);

-- 插入初始管理员密码（与当前默认密码一致，可自行修改）
INSERT INTO public.auth_settings (id, password)
VALUES (1, '123456')
ON CONFLICT (id) DO NOTHING;

-- 若项目启用了 RLS，需为 auth_settings 添加策略，否则前端无法读写：
-- 策略名可自定义，以下允许 anon 对 id=1 的行做 SELECT 和 UPDATE。

-- ALTER TABLE public.auth_settings ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY "Allow anon read auth_settings"
--   ON public.auth_settings FOR SELECT TO anon USING (id = 1);

-- CREATE POLICY "Allow anon update auth_settings"
--   ON public.auth_settings FOR UPDATE TO anon USING (id = 1) WITH CHECK (id = 1);
