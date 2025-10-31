# 登录页白屏问题修复指南

## 🐛 问题现象

**症状**：
- ✅ 第一次打开登录页 - 正常
- ❌ 退出登录后，第二次打开登录页 - 白屏

**影响范围**：部分电脑

---

## 🔍 问题根源

### 原因1：RLS策略太严格（我刚才的修改导致）⚠️

**问题代码（我之前的修改）**：
```sql
CREATE POLICY "profiles_select_policy" 
ON public.profiles
FOR SELECT
USING (
  auth.role() = 'service_role'
  OR id = auth.uid()  -- 问题：退出后auth.uid()为NULL
  OR EXISTS (...)
);
```

**导致的问题**：
1. 用户退出登录
2. localStorage中还有残留session
3. AuthContext尝试用这个session查询profiles表（第62-66行）
4. RLS策略太严格，查询失败
5. AuthContext一直loading，页面白屏

### 原因2：localStorage缓存

退出登录后，浏览器可能保留了：
- Supabase session数据
- Token残留
- 用户状态缓存

---

## 🚀 立即修复（2步）

### 步骤1：回滚RLS策略（紧急！）

在Supabase SQL Editor中执行：

```sql
BEGIN;

-- 删除严格的策略
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;

-- 创建宽松的SELECT策略
CREATE POLICY "profiles_select_all_authenticated" 
ON public.profiles
FOR SELECT
TO authenticated
USING (true);  -- 允许所有已认证用户查看

COMMIT;
```

### 步骤2：清除浏览器缓存

在白屏的电脑上执行：

1. **按F12打开开发者工具**
2. **切换到Console标签**
3. **输入以下命令并按回车**：

```javascript
// 清除所有Supabase相关的localStorage
Object.keys(localStorage)
  .filter(key => key.includes('supabase') || key.includes('sb-'))
  .forEach(key => localStorage.removeItem(key));

// 刷新页面
location.reload();
```

或者：

1. **按Ctrl + Shift + Delete**
2. **选择"Cookie和其他网站数据"**
3. **选择"缓存的图片和文件"**
4. **点击"清除数据"**
5. **刷新页面**

---

## 🎯 完整的RLS修复SQL

### 在Supabase执行（包含所有策略）：

```sql
BEGIN;

-- 删除所有旧策略
DROP POLICY IF EXISTS "profiles_insert_restricted" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_by_admin_only" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_service_role_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_service_role_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_service_role_delete" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;

-- ✅ SELECT策略：允许所有已认证用户查看（修复白屏问题）
CREATE POLICY "profiles_select_all_authenticated" 
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- ✅ INSERT策略：允许service_role插入（修复创建admin问题）
CREATE POLICY "profiles_insert_service_role" 
ON public.profiles
FOR INSERT
TO service_role
WITH CHECK (true);

-- ✅ UPDATE策略：用户可以更新自己，admin可以更新所有
CREATE POLICY "profiles_update_own_or_admin" 
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ✅ DELETE策略：只有admin可以删除
CREATE POLICY "profiles_delete_admin_only" 
ON public.profiles
FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

COMMIT;

-- 验证
SELECT 
  policyname,
  cmd,
  '修复完成' as status
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY cmd;
```

---

## 💡 为什么会出现白屏？

### 代码执行流程：

1. **用户打开登录页**
   - AuthContext初始化
   - 检查localStorage中的session
   
2. **如果有残留session**
   - onAuthStateChange触发
   - 尝试查询profiles表（第62-66行）
   
3. **如果RLS策略太严格**
   - 查询失败
   - 但代码没有正确处理错误
   - loading状态一直为true
   - 导致白屏

4. **为什么第一次正常？**
   - 第一次没有localStorage缓存
   - 直接显示登录表单
   - 不触发profiles查询

---

## 🔧 长期修复方案

### 方案A：改进AuthContext的错误处理

在`src/contexts/AuthContext.tsx`第62-90行，添加更好的错误处理：

```typescript
try {
  const { data: profileData, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', currentUser.id)
    .maybeSingle();

  if (error) {
    console.error('获取用户配置文件失败:', error);
    // 关键：即使失败也要设置loading为false
    setProfile(null);
    setLoading(false);
    // 清除session，强制重新登录
    await supabase.auth.signOut();
  } else if (profileData) {
    // 正常设置profile
  }
} catch (catchError) {
  console.error('查询profiles异常:', catchError);
  setProfile(null);
  setLoading(false);
  // 清除session
  await supabase.auth.signOut();
}
```

### 方案B：退出登录时清除localStorage

在`signOut`函数中添加清除逻辑：

```typescript
const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) {
    toast({ title: "登出失败", description: error.message, variant: "destructive" });
  }
  
  // 清除所有Supabase缓存
  Object.keys(localStorage)
    .filter(key => key.includes('supabase') || key.includes('sb-'))
    .forEach(key => localStorage.removeItem(key));
};
```

---

## ✅ 快速解决步骤

### 对于管理员（您）：

1. **立即执行RLS回滚SQL**（上面的完整SQL）
2. **通知用户清除缓存**

### 对于遇到白屏的用户：

1. **按F12打开控制台**
2. **粘贴并执行**：
```javascript
Object.keys(localStorage)
  .filter(key => key.includes('supabase') || key.includes('sb-'))
  .forEach(key => localStorage.removeItem(key));
location.reload();
```

或

1. **按Ctrl + Shift + Delete**
2. **清除缓存和Cookie**
3. **刷新页面**

---

## 📊 验证修复

### 执行SQL后测试：

1. ✅ 退出登录
2. ✅ 关闭浏览器
3. ✅ 重新打开浏览器
4. ✅ 访问登录页
5. ✅ 应该能正常显示

### 同时测试：

1. ✅ 创建管理员账号 - 应该成功
2. ✅ 查看付款审核的收款人信息 - 应该能看到

---

## 🎯 总结

**我的修改导致的问题**：
- RLS SELECT策略太严格
- 退出登录后查询profiles失败
- AuthContext一直loading

**解决方案**：
1. 修改SELECT策略为 `USING (true)`
2. 清除localStorage缓存

**立即执行上面的完整SQL即可修复！** 🚀

文件位置：`scripts/ROLLBACK_PROFILES_RLS.sql`

