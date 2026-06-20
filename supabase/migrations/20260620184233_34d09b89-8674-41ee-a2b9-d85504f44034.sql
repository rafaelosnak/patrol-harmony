
-- Remove admin@admin.com and promote rafa.losnack@gmail.com to admin
DELETE FROM auth.users WHERE email = 'admin@admin.com';
DELETE FROM public.user_roles WHERE user_id = '1e76658a-23a3-4d4a-8a0c-41558da96b57';
INSERT INTO public.user_roles (user_id, role) VALUES ('1e76658a-23a3-4d4a-8a0c-41558da96b57', 'admin');
