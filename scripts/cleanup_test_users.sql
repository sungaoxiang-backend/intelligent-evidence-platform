-- 清理生产数据库中的测试用户数据
-- ⚠️ 警告：此脚本会删除数据，请在执行前确认！
--
-- 使用方法：
-- 1. 先运行查询部分确认要删除的数据
-- 2. 再执行删除部分

-- ============================================================
-- 第一步：查看将要删除的测试用户
-- ============================================================

SELECT 
    id, 
    name, 
    phone, 
    created_at,
    'TEST_USER' as source
FROM users
WHERE 
    name LIKE '%test_user%'
    OR name LIKE '%占位符%'
    OR name LIKE '%测试%'
    OR name LIKE '%导出用户%'
    OR name LIKE '%模板测试%'
    OR name LIKE '%获取测试%'
    OR name LIKE '%创建测试%'
    OR name LIKE '%发布测试%'
    OR name LIKE '%更新测试%'
    OR name LIKE '%文件名测试%'
    OR name LIKE '%详情测试%'
ORDER BY created_at DESC;

-- 查看关联的案件数量
SELECT 
    u.id AS user_id,
    u.name AS user_name,
    COUNT(c.id) AS case_count
FROM users u
LEFT JOIN cases c ON c.user_id = u.id
WHERE 
    u.name LIKE '%test_user%'
    OR u.name LIKE '%占位符%'
    OR u.name LIKE '%测试%'
    OR u.name LIKE '%导出用户%'
GROUP BY u.id, u.name
HAVING COUNT(c.id) > 0
ORDER BY case_count DESC;

-- ============================================================
-- 第二步：删除测试用户及其关联数据
-- ⚠️ 请在确认上面的查询结果后再执行下面的删除语句！
-- ============================================================

-- 2.1 先删除关联的文书生成记录
DELETE FROM document_generations
WHERE case_id IN (
    SELECT c.id
    FROM cases c
    INNER JOIN users u ON c.user_id = u.id
    WHERE 
        u.name LIKE '%test_user%'
        OR u.name LIKE '%占位符%'
        OR u.name LIKE '%测试%'
        OR u.name LIKE '%导出用户%'
);

-- 2.2 再删除关联的案件
DELETE FROM cases
WHERE user_id IN (
    SELECT id
    FROM users
    WHERE 
        name LIKE '%test_user%'
        OR name LIKE '%占位符%'
        OR name LIKE '%测试%'
        OR name LIKE '%导出用户%'
);

-- 2.3 最后删除测试用户
DELETE FROM users
WHERE 
    name LIKE '%test_user%'
    OR name LIKE '%占位符%'
    OR name LIKE '%测试%'
    OR name LIKE '%导出用户%'
    OR name LIKE '%模板测试%'
    OR name LIKE '%获取测试%'
    OR name LIKE '%创建测试%'
    OR name LIKE '%发布测试%'
    OR name LIKE '%更新测试%'
    OR name LIKE '%文件名测试%'
    OR name LIKE '%详情测试%';

-- ============================================================
-- 第三步：验证清理结果
-- ============================================================

SELECT 
    COUNT(*) as remaining_test_users
FROM users
WHERE 
    name LIKE '%test_user%'
    OR name LIKE '%占位符%'
    OR name LIKE '%测试%'
    OR name LIKE '%导出用户%';

-- 应该返回 0

-- ============================================================
-- 备选方案：只删除特定 ID 范围的用户（更安全）
-- ============================================================

-- 如果你想更精确地删除，可以使用 ID 范围
-- 根据脚本输出，测试用户的 ID 主要在以下范围：
-- - 1-4 （早期测试）
-- - 2064-2619 （第一批测试）
-- - 5036-5138 （最近的测试）

-- 删除案件
-- DELETE FROM cases WHERE user_id IN (1,2,4) OR user_id BETWEEN 2064 AND 2619 OR user_id BETWEEN 5036 AND 5138;

-- 删除用户
-- DELETE FROM users WHERE id IN (1,2,4) OR id BETWEEN 2064 AND 2619 OR id BETWEEN 5036 AND 5138;


