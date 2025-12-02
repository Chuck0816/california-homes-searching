<?php
header("Content-Type: text/plain; charset=utf-8");

$host = "localhost";
$dbname = "boxgra6_Chuck";
$username = "boxgra6_Chuck";
$password = "Whk20060816!"; // ⚠️ 一定要改成你自己的密码

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8", $username, $password);
    echo "✅ 成功连接到数据库 $dbname！";
} catch (PDOException $e) {
    echo "❌ 数据库连接失败: " . $e->getMessage();
}
?>
