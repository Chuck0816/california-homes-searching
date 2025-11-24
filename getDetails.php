<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8'); // 响应类型：Json
header('Cache-Control: no-store'); // 禁止缓存

error_reporting(E_ALL);
ini_set('display_errors', '0');

while (ob_get_level()) { ob_end_clean(); }

$host     = 'localhost';
$dbname   = 'boxgra6_cali';
$username = 'boxgra6_sd';
$password = 'Real_estate650$';

/*
 和 gethouse.php 完全相同的连接逻辑
 PDO = PHP Data Objects, PHP 的官方安全数据库连接方式
*/
try {
    $pdo = new PDO(
        "mysql:host=$host;dbname=$dbname;charset=utf8mb4",
        $username,
        $password,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );

    /*
      获取 URL 参数
      e.g. /api/getDetails.php?id=123456
    */
    $id = $_GET['id'] ?? '';

    if (!$id) {
        echo json_encode(['error' => 'Missing id']);
        exit;
    }

    /*
      查询单个房源所有字段
      限制只取 1 条（ListingID 是唯一）
    */
    $stmt = $pdo->prepare("
        SELECT *
        FROM rets_property
        WHERE L_ListingID = :id
        LIMIT 1
    ");

    $stmt->execute([':id' => $id]);
    $row = $stmt->fetch();

    /*
      输出 JSON 给前端
      JSON_UNESCAPED_UNICODE: 不转义中文
      JSON_UNESCAPED_SLASHES: 不转义 URL
    */
    echo json_encode($row, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
    exit;
}

/*
Notes:
这个 PHP 用于 Modal(弹窗) 获取单个房源详情
前端用法：
fetch('/api/getDetails.php?id=123456')
*/
