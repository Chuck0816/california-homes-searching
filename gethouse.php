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

function col_exists(PDO $pdo, string $table, string $col): bool {
  $st = $pdo->prepare("SHOW COLUMNS FROM `$table` LIKE :c"); 
  $st->execute([':c' => $col]); // prep
  return (bool)$st->fetch();
}

 /* 
 动态检查col是否存在
 PDO的prepare: prepare = 把 SQL 模板先发给数据库，让数据库把 SQL 结构定死，之后再绑定参数。
 Prepare 和 execute 通常同时出现 
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
  // PDO是PHP Data Objects, 是PHP官方提供的标准安全数据库连接方式。是一种统一的数据库接口
  
  $q        = trim($_GET['q'] ?? '');
  $zip      = trim($_GET['zip'] ?? '');
  $beds     = max(0, (int)($_GET['beds'] ?? 0));
  $baths    = max(0, (int)($_GET['baths'] ?? 0));
  $sqftMin  = max(0, (int)($_GET['sqftMin'] ?? 0));
  $priceMin = max(0, (int)($_GET['priceMin'] ?? 0));
  $priceMax = ($_GET['priceMax'] !== '' ? (int)($_GET['priceMax']) : null);
  $sort     = $_GET['sort'] ?? 'price_asc';
  $tbl = 'rets_property';

  /*
  读url
  $_GET：PHP 里的一个超全局数组，专门放 URL 里的 ?xxx=yyy 参数
  e.g. /php/gethouse.php?q=LA&beds=3
  $_GET['q'] == 'LA'
  $_GET['beds'] == 3
  $_GET['zip'] == ''
  max 的作用：因为bed不可能是负数，所以当用户输入负数，我们统一用0
  */



  // 检查字段，调用col_exists函数。$在php中表示变量
  $hasPrice  = col_exists($pdo, $tbl, 'ListPrice');
  $hasArea   = col_exists($pdo, $tbl, 'LivingArea');
  $hasBeds   = col_exists($pdo, $tbl, 'BedroomsTotal');
  $hasBaths  = col_exists($pdo, $tbl, 'BathroomsTotalInteger');
  $hasLat    = col_exists($pdo, $tbl, 'LMD_MP_Latitude');
  $hasLng    = col_exists($pdo, $tbl, 'LMD_MP_Longitude');
  $hasPhotos = col_exists($pdo, $tbl, 'L_Photos');
  $hasNewest = col_exists($pdo, $tbl, 'L_UpdateDate');


  // SELECT
  $select = [
    "L_ListingID AS ListingID",
    "L_Address AS Address",
    "L_City AS City",
    "L_Zip AS PostalCode",
    ($hasBeds  ? "BedroomsTotal"         : "NULL AS BedroomsTotal"), // 即使数据库里没有 BedroomsTotal 字段，也帮我生成一个叫 BedroomsTotal 的字段，只不过它的值是 NULL（空）。
    ($hasBaths ? "BathroomsTotalInteger" : "NULL AS BathroomsTotalInteger"),
    ($hasArea  ? "LivingArea"            : "NULL AS LivingArea"),
    ($hasPrice ? "ListPrice"             : "NULL AS ListPrice"),
    ($hasLat   ? "LMD_MP_Latitude AS lat": "NULL AS lat"),
    ($hasLng   ? "LMD_MP_Longitude AS lng": "NULL AS lng"),
    ($hasPhotos ? "L_Photos AS Photos" : "NULL AS Photos")
  ];

  // WHERE
  $where  = ["L_City IS NOT NULL"];
  $params = [];
  // php 的数组本质都是hash map

  if ($q !== '')  { $where[] = "(L_City LIKE :q OR L_Zip LIKE :q OR L_Address LIKE :q)"; $params[':q'] = "%$q%"; } // key ':q' 对应 %$q%

  if ($zip !== ''){ $where[] = "L_Zip LIKE :zip"; $params[':zip'] = "%$zip%"; }

  if ($beds > 0)  { $where[] = "IFNULL(BedroomsTotal,0) >= :b";  $params[':b'] = $beds; }
  if ($baths > 0) { $where[] = "IFNULL(BathroomsTotalInteger,0) >= :ba"; $params[':ba'] = $baths; }
  if ($sqftMin>0) { $where[] = "IFNULL(LivingArea,0) >= :sq"; $params[':sq'] = $sqftMin; }

  if ($hasPrice && $priceMin>0) { $where[] = "IFNULL(ListPrice,0) >= :pmin"; $params[':pmin'] = $priceMin; }
  if ($hasPrice && $priceMax!==null){ $where[] = "IFNULL(ListPrice,0) <= :pmax"; $params[':pmax'] = $priceMax; }
  /* Where....Like.. query in sql: 
  Like: 模糊搜索
  e.g. WHERE City LIKE '%LA%'
  输出： Los Angeles, PlaZa, Santa Clara */

  // 排序： 根据前端用户选择的 sort，决定 SQL 的 ORDER BY 内容。
  $order = "L_ListingID DESC"; // 默认
  if ($sort==='price_asc')   $order = "ListPrice ASC";
  if ($sort==='price_desc')  $order = "ListPrice DESC";
  if ($sort==='sqft_desc')   $order = "LivingArea DESC";
  if ($sort==='newest')      $order = ($hasNewest ? "L_UpdateDate DESC" : "L_ListingID DESC");

// SQL
// 这里的 SELECT、WHERE、ORDER 拼成一个 SQL 字符串
// implode("输出string的string数组", 数组)

// 先把 SELECT 和 WHERE 拼好（相当于你原逻辑）  
$selectStr = implode(", ", $select);
$whereStr  = implode(" AND ", $where);

$sql = <<<SQL
SELECT $selectStr
FROM `$tbl`
WHERE $whereStr
ORDER BY $order
LIMIT 100
SQL;

/* 这里把拼图中所有需要的 SELECT、WHERE、ORDER 拼成一个 SQL 字符串
   用 implode("输出string的string数组", 数组) */


    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    echo json_encode($rows, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); // 输出json给前端
    exit;

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
    exit;
}

/*
Notes for this process.
从 URL -> GET -> WHERE = params -> SQL -> 执行 -> JSON 输出 的完整流程
https://chatgpt.com/s/t_691e47df85108191a3903d6c6267d382
*/


