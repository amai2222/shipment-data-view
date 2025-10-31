# 🚨 紧急：白屏问题立即修复

## 立即执行（3个步骤）

### 步骤1：修复AuthContext代码（前端）

这是**最关键**的修复！

打开文件：`src/contexts/AuthContext.tsx`

找到第52-100行的代码，将整个 `useEffect` 替换为：

```typescript
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      setSession(session);
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        try {
          const { data: profileData, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .maybeSingle();

          if (error) {
            console.error('获取用户配置文件失败:', error);
            // 关键修复：设置loading为false，不要卡住
            setProfile(null);
            setLoading(false);
            // 清除无效session
            await supabase.auth.signOut();
          } else if (profileData) {
            const anyProfile = profileData as any;
            setProfile({
              id: anyProfile.id,
              email: anyProfile.email || '',
              username: anyProfile.username || anyProfile.email || '',
              full_name: anyProfile.full_name || '',
              role: (anyProfile.role as UserRole) ?? 'operator',
              is_active: anyProfile.is_active ?? true
            });
            setLoading(false);
          } else {
            setProfile(null);
            setLoading(false);
          }
        } catch (catchError) {
          console.error('处理用户配置文件时发生意外错误:', catchError);
          setProfile(null);
          setLoading(false);
          // 清除session
          await supabase.auth.signOut();
        }
      } else {
        setProfile(null);
        setLoading(false);
      }
    }
  );

  return () => {
    subscription.unsubscribe();
  };
}, []);
```

### 步骤2：在Supabase执行SQL

```sql
BEGIN;

DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_service_role_insert" ON public.profiles;

CREATE POLICY "profiles_select_all" 
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "profiles_insert_service" 
ON public.profiles
FOR INSERT
TO service_role
WITH CHECK (true);

COMMIT;
```

### 步骤3：清除所有浏览器缓存

在白屏页面按F12，粘贴执行：

```javascript
// 清除所有Supabase缓存
Object.keys(localStorage).forEach(key => localStorage.removeItem(key));
Object.keys(sessionStorage).forEach(key => sessionStorage.removeItem(key));
// 刷新
location.href = '/auth';
```

## ✅ 立即测试

修改代码后：
1. 保存文件
2. 刷新浏览器
3. 应该能看到登录页了

如果还是白屏，告诉我！

