、<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8'); // 响应类型：Json
header('Cache-Control: no-store'); // 禁止缓存

error_reporting(E_ALL);
ini_set('display_errors', '0');

// 清空缓冲区，避免输出垃圾字符
while (ob_get_level()) { ob_end_clean(); }

$host = 'localhost';
$dbname = 'boxgra6_cali';   // ←←← 修正为真实数据库
$username = 'boxgra6_sd';
$password = 'Real_estate650$';

// 检查字段是否存在
function col_exists(PDO $pdo, string $table, string $col): bool {
    $st = $pdo->prepare("SHOW COLUMNS FROM $table LIKE :c");
    $st->execute([':c' => $col]);
    return (bool)$st->fetch();
}

try {
    // 连接数据库
    $pdo = new PDO(
        "mysql:host=$host;dbname=$dbname;charset=utf8mb4",
        $username,
        $password,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );

    // 读取 URL 参数
    $q        = trim($_GET['q'] ?? '');
    $zip      = trim($_GET['zip'] ?? '');
    $beds     = max(0, (int)($_GET['beds'] ?? 0));
    $baths    = max(0, (int)($_GET['baths'] ?? 0));
    $sqftMin  = max(0, (int)($_GET['sqftMin'] ?? 0));
    $priceMin = max(0, (int)($_GET['priceMin'] ?? 0));
    $priceMaxRaw = $_GET['priceMax'] ?? '';
    $priceMax = ($priceMaxRaw !== '' ? (int)$priceMaxRaw : null);
    $sort     = $_GET['sort'] ?? 'price_asc';

    $tbl = 'rets_property';

    // 动态检查字段
    $hasPrice  = col_exists($pdo, $tbl, 'ListPrice');
    $hasArea   = col_exists($pdo, $tbl, 'LivingArea');
    $hasBeds   = col_exists($pdo, $tbl, 'L_Keyword2');   // Beds
    $hasBaths  = col_exists($pdo, $tbl, 'LM_Dec_3');     // Baths
    $hasLat    = col_exists($pdo, $tbl, 'LMD_MP_Latitude');
    $hasLng    = col_exists($pdo, $tbl, 'LMD_MP_Longitude');
    $hasPhotos = col_exists($pdo, $tbl, 'L_Photos');
    $hasRenter = col_exists($pdo, $tbl, 'ListAgentEmail'); // renter email

    // newest 排序字段
    $newestCol = null;
    if (col_exists($pdo, $tbl, 'ModificationTimestamp')) {
        $newestCol = 'ModificationTimestamp';
    } elseif (col_exists($pdo, $tbl, 'MajorChangeTimestamp')) {
        $newestCol = 'MajorChangeTimestamp';
    }

    // SELECT 字段
    $select = [
        "L_ListingID AS ListingID",
        "L_Address AS Address",
        "L_City AS City",
        "L_Zip AS PostalCode",

        ($hasBeds  ? "L_Keyword2 AS BedroomsTotal"            : "NULL AS BedroomsTotal"),
        ($hasBaths ? "LM_Dec_3 AS BathroomsTotalInteger"      : "NULL AS BathroomsTotalInteger"),
        ($hasArea  ? "LivingArea"                             : "NULL AS LivingArea"),
        ($hasPrice ? "ListPrice"                              : "NULL AS ListPrice"),
        ($hasLat   ? "LMD_MP_Latitude AS lat"                 : "NULL AS lat"),
        ($hasLng   ? "LMD_MP_Longitude AS lng"                : "NULL AS lng"),
        ($hasPhotos? "L_Photos AS Photos"                     : "NULL AS Photos"),
        ($hasRenter? "ListAgentEmail AS renteremail"          : "NULL AS renteremail"),
    ];

    // WHERE 条件
    $where = ["L_City IS NOT NULL"];
    $params = [];

    if ($q !== '') {
        $where[] = "(L_City LIKE :q OR L_Zip LIKE :q OR L_Address LIKE :q)";
        $params[':q'] = "%$q%";
    }
    if ($zip !== '') {
        $where[] = "L_Zip LIKE :zip";
        $params[':zip'] = "%$zip%";
    }
    if ($hasBeds && $beds > 0) {
        $where[] = "IFNULL(L_Keyword2,0) >= :b";
        $params[':b'] = $beds;
    }
    if ($hasBaths && $baths > 0) {
        $where[] = "IFNULL(LM_Dec_3,0) >= :ba";
        $params[':ba'] = $baths;
    }
    if ($hasArea && $sqftMin > 0) {
        $where[] = "IFNULL(LivingArea,0) >= :sq";
        $params[':sq'] = $sqftMin;
    }
    if ($hasPrice && $priceMin > 0) {
        $where[] = "IFNULL(ListPrice,0) >= :pmin";
        $params[':pmin'] = $priceMin;
    }
    if ($hasPrice && $priceMax !== null) {
        $where[] = "IFNULL(ListPrice,0) <= :pmax";
        $params[':pmax'] = $priceMax;
    }

    // 排序
    $order = "L_ListingID DESC";
    if ($sort === 'price_asc'  && $hasPrice) $order = "ListPrice ASC";
    if ($sort === 'price_desc' && $hasPrice) $order = "ListPrice DESC";
    if ($sort === 'sqft_desc'  && $hasArea)  $order = "LivingArea DESC";
    if ($sort === 'newest')                 $order = ($newestCol ? "$newestCol DESC" : "L_ListingID DESC");

    // 拼 SQL
    $selectStr = implode(", ", $select);
    $whereStr  = implode(" AND ", $where);

    $sql = <<<SQL
SELECT $selectStr
FROM $tbl
WHERE $whereStr
ORDER BY $order
LIMIT 100
SQL;

    // 执行
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    echo json_encode($rows, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
    exit;
}

/*
Notes:
URL -> GET -> WHERE params -> SQL -> fetch -> JSON 输出
*/
