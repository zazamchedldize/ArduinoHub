// საჯარო Supabase URL და anon/publishable key უსაფრთხოა browser-ში.
// აქ ჩასვით თქვენი პროექტის მნიშვნელობები Supabase Dashboard → Connect-დან.
export const SUPABASE_URL = 'https://ywxunhvrwdtlqjfshiyj.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_TwyYKMijLxN4X1J2MybYlQ_x78YSIa4';

export const supabaseIsConfigured = !SUPABASE_URL.includes('YOUR_') && !SUPABASE_ANON_KEY.includes('YOUR_');
