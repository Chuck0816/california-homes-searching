<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

error_reporting(E_ALL);
ini_set('display_errors', '0');
while (ob_get_level()) { ob_end_clean(); }

$host     = 'localhost';
$dbname   = 'boxgra6_cali';
$username = 'boxgra6_sd';
$password = 'Real_estate650$';

function col_exists(PDO $pdo, string $table, string $col): bool {
  $st = $pdo->prepare("SHOW COLUMNS FROM `$table` LIKE :c");
  $st->execute([':c' => $col]);
  return (bool)$st->fetch();
}

try {
  $pdo = new PDO(
    "mysql:host=$host;dbname=$dbname;charset=utf8mb4",
    $username,
    $password,
    [
      PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
      PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
      // ⚠️ 不要在这里关掉 emulate prepares，不然 SHOW COLUMNS 用占位符会 1064
      // PDO::ATTR_EMULATE_PREPARES => false,
    ]
  );

  $id = trim($_GET['id'] ?? '');
  if ($id === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Missing id'], JSON_UNESCAPED_UNICODE);
    exit;
  }

  $tbl = 'rets_property';

  // 动态检查字段是否存在，避免 Unknown column
  $hasBeds   = col_exists($pdo, $tbl, 'L_Keyword2');
  $hasBaths  = col_exists($pdo, $tbl, 'LM_Dec_3');
  $hasArea   = col_exists($pdo, $tbl, 'LivingArea');
  $hasPrice  = col_exists($pdo, $tbl, 'ListPrice');
  $hasLat    = col_exists($pdo, $tbl, 'LMD_MP_Latitude');
  $hasLng    = col_exists($pdo, $tbl, 'LMD_MP_Longitude');
  $hasPhotos = col_exists($pdo, $tbl, 'L_Photos');
  $hasRemarks= col_exists($pdo, $tbl, 'L_Remarks');
  $hasStreet = col_exists($pdo, $tbl, 'L_AddressStreet');
  $hasMLS    = col_exists($pdo, $tbl, 'L_DisplayId');
  $hasRenter = col_exists($pdo, $tbl, 'ListAgentEmail');

  // 兼容：有些时候前端传的是 MLS / DisplayId
  $where = "L_ListingID = :id";
  if ($hasMLS) $where .= " OR L_DisplayId = :id";

  $sql = "
    SELECT
      L_ListingID AS ListingID,
      ".($hasMLS ? "L_DisplayId AS MLS" : "L_ListingID AS MLS").",
      L_Address AS Address,
      ".($hasStreet ? "L_AddressStreet AS Street" : "NULL AS Street").",
      L_City AS City,
      L_State AS State,
      L_Zip AS PostalCode,
      ".($hasBeds  ? "L_Keyword2 AS Bedrooms" : "NULL AS Bedrooms").",
      ".($hasBaths ? "LM_Dec_3 AS Bathrooms" : "NULL AS Bathrooms").",
      ".($hasArea  ? "LivingArea" : "NULL AS LivingArea").",
      ".($hasPrice ? "ListPrice" : "NULL AS ListPrice").",
      ".($hasLat   ? "LMD_MP_Latitude AS lat" : "NULL AS lat").",
      ".($hasLng   ? "LMD_MP_Longitude AS lng" : "NULL AS lng").",
      ".($hasPhotos? "L_Photos AS Photos" : "NULL AS Photos").",
      ".($hasRemarks? "L_Remarks AS remarks" : "NULL AS remarks").",
      ".($hasRenter ? "ListAgentEmail AS renteremail" : "NULL AS renteremail")."
    FROM `$tbl`
    WHERE $where
    LIMIT 1
  ";

  $stmt = $pdo->prepare($sql);
  $stmt->execute([':id' => $id]);
  $row = $stmt->fetch();

  if (!$row) {
    http_response_code(404);
    echo json_encode(['error' => 'Listing not found'], JSON_UNESCAPED_UNICODE);
    exit;
  }

  echo json_encode($row, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;

} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['error' => $e->getMessage()]);
  exit;
}
