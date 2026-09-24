# Synchro IGestion (HFSQL / ODBC) -> Supabase.
# Connexion sortante uniquement. Ne jamais exposer ce script sur Internet.
#
# Catalogue complet (1x/jour) :
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\chemin\sync\sync-igestion.ps1 -FullSync
# Stock et prix (toutes les 15 min) :
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\chemin\sync\sync-igestion.ps1 -QuickSync
#
# Variables : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY
# (environnement, ou fichier sync/.env non commite).

param(
  [switch]$FullSync,
  [switch]$QuickSync,
  [string]$EnvFile = "",
  [string]$PhotoDir = "E:\ISOFT\igestion\PHOTOS\OFF",
  [string]$Dsn = "IGestionODBC",
  [int]$BatchSize = 500
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
[System.Threading.Thread]::CurrentThread.CurrentCulture = [Globalization.CultureInfo]::InvariantCulture

if (-not $FullSync -and -not $QuickSync) { $FullSync = $true }
if ($FullSync -and $QuickSync) { throw "Choisir -FullSync ou -QuickSync, pas les deux." }

$logDir = Join-Path $PSScriptRoot "logs"
$stateDir = Join-Path $PSScriptRoot "state"
New-Item -ItemType Directory -Force -Path $logDir, $stateDir | Out-Null
$logFile = Join-Path $logDir ("sync-{0:yyyyMMdd}.log" -f (Get-Date))

function Write-Log([string]$Message, [string]$Level = "INFO") {
  $line = "{0:yyyy-MM-dd HH:mm:ss} [{1}] {2}" -f (Get-Date), $Level, $Message
  Add-Content -Path $logFile -Value $line -Encoding UTF8
  Write-Host $line
}

function Import-EnvFile([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { return }
  Get-Content -LiteralPath $Path -Encoding UTF8 | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq "" -or $line.StartsWith("#")) { return }
    $i = $line.IndexOf("=")
    if ($i -lt 1) { return }
    $name = $line.Substring(0, $i).Trim()
    $value = $line.Substring($i + 1).Trim().Trim('"').Trim("'")
    if (-not [Environment]::GetEnvironmentVariable($name, "Process")) {
      [Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
  }
}

function ConvertTo-ApiJson($Value) {
  if ($null -eq $Value) { return "null" }
  $isList = ($Value -is [System.Collections.IEnumerable]) -and -not ($Value -is [string])
  if ($isList) {
    $items = @($Value)
    if ($items.Count -eq 0) { return "[]" }
    $json = ConvertTo-Json -InputObject $items -Depth 8 -Compress
    if ($items.Count -eq 1 -and -not $json.StartsWith("[")) { return "[$json]" }
    return $json
  }
  return (ConvertTo-Json -InputObject $Value -Depth 8 -Compress)
}

function To-Num($Value, [int]$Scale) {
  if ($null -eq $Value -or $Value -is [DBNull]) { return $null }
  $text = ([string]$Value).Trim().Replace(" ", "").Replace(",", ".")
  if ($text -eq "") { return $null }
  $n = 0.0
  if (-not [double]::TryParse($text, [Globalization.NumberStyles]::Any, [Globalization.CultureInfo]::InvariantCulture, [ref]$n)) {
    return $null
  }
  return [math]::Round($n, $Scale)
}

function To-Int($Value) {
  $n = To-Num $Value 0
  if ($null -eq $n) { return 0 }
  $rounded = [int][math]::Round($n, 0)
  if ($rounded -lt 0) { return 0 }
  return $rounded
}

function To-Text($Value) {
  if ($null -eq $Value -or $Value -is [DBNull]) { return "" }
  return ([string]$Value).Trim()
}

function To-DateOrNull($Value) {
  if ($null -eq $Value -or $Value -is [DBNull]) { return $null }
  try { return ([datetime]$Value).ToString("yyyy-MM-dd") } catch { return $null }
}

function To-BoolFlag($Value) {
  return ((To-Int $Value) -eq 1)
}

function Get-Slug([string]$Name, [string]$Codpro) {
  $formD = $Name.Normalize([Text.NormalizationForm]::FormD)
  $builder = New-Object System.Text.StringBuilder
  foreach ($ch in $formD.ToCharArray()) {
    $category = [Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch)
    if ($category -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
      [void]$builder.Append($ch)
    }
  }
  $s = $builder.ToString().ToLowerInvariant()
  $s = [regex]::Replace($s, "[^a-z0-9]+", "-").Trim("-")
  if ([string]::IsNullOrWhiteSpace($s)) { $s = "produit" }
  $id = [regex]::Replace($Codpro.ToLowerInvariant(), "[^a-z0-9]+", "")
  if ([string]::IsNullOrWhiteSpace($id)) { $id = "ref" }
  return "$s-$id"
}

function Get-ImageContentType([string]$Extension) {
  switch ($Extension.ToLowerInvariant()) {
    ".png" { return "image/png" }
    ".gif" { return "image/gif" }
    ".webp" { return "image/webp" }
    ".bmp" { return "image/bmp" }
    default { return "image/jpeg" }
  }
}

function Get-ImageObjectName([string]$Codpro, [string]$Extension) {
  $safe = [regex]::Replace($Codpro, "[^A-Za-z0-9._-]", "")
  if ([string]::IsNullOrWhiteSpace($safe)) { $safe = "image" }
  return $safe + $Extension.ToLowerInvariant()
}

function Test-StorageObject([string]$ObjectName) {
  $uri = $script:SupabaseUrl.TrimEnd("/") + "/storage/v1/object/product-images/" + [uri]::EscapeDataString($ObjectName)
  $req = New-Object System.Net.Http.HttpRequestMessage ([System.Net.Http.HttpMethod]::Head), $uri
  [void]$req.Headers.TryAddWithoutValidation("apikey", $script:ServiceKey)
  [void]$req.Headers.TryAddWithoutValidation("Authorization", "Bearer $($script:ServiceKey)")
  $resp = $script:Http.SendAsync($req).GetAwaiter().GetResult()
  return [bool]$resp.IsSuccessStatusCode
}

function Read-OdbcRows($Connection, [string]$Sql) {
  $cmd = $Connection.CreateCommand()
  $cmd.CommandText = $Sql
  $cmd.CommandTimeout = 300
  $reader = $cmd.ExecuteReader()
  $rows = New-Object System.Collections.Generic.List[object]
  try {
    while ($reader.Read()) {
      $row = @{}
      for ($i = 0; $i -lt $reader.FieldCount; $i++) {
        $val = $reader.GetValue($i)
        if ($val -is [DBNull]) { $val = $null }
        $row[$reader.GetName($i)] = $val
      }
      $rows.Add($row)
    }
  } finally {
    $reader.Close()
    $cmd.Dispose()
  }
  return $rows
}

$script:Http = $null

function Invoke-Supabase {
  param(
    [string]$Method,
    [string]$Path,
    $Body = $null,
    [string]$Prefer = "",
    [hashtable]$Headers = @{}
  )
  $uri = $script:SupabaseUrl.TrimEnd("/") + $Path
  $req = New-Object System.Net.Http.HttpRequestMessage ([System.Net.Http.HttpMethod]::new($Method), $uri)
  [void]$req.Headers.TryAddWithoutValidation("apikey", $script:ServiceKey)
  [void]$req.Headers.TryAddWithoutValidation("Authorization", "Bearer $($script:ServiceKey)")
  if ($Prefer) { [void]$req.Headers.TryAddWithoutValidation("Prefer", $Prefer) }
  foreach ($key in $Headers.Keys) { [void]$req.Headers.TryAddWithoutValidation($key, [string]$Headers[$key]) }
  if ($null -ne $Body) {
    $json = ConvertTo-ApiJson $Body
    $req.Content = New-Object System.Net.Http.StringContent($json, [Text.Encoding]::UTF8, "application/json")
  }
  $resp = $script:Http.SendAsync($req).GetAwaiter().GetResult()
  $text = $resp.Content.ReadAsStringAsync().GetAwaiter().GetResult()
  if (-not $resp.IsSuccessStatusCode) { throw "HTTP $([int]$resp.StatusCode) $text" }
  return $text
}

function Send-Upsert([string]$Table, [string]$Conflict, $Rows) {
  $arr = @($Rows)
  $ok = 0
  for ($i = 0; $i -lt $arr.Count; $i += $BatchSize) {
    $take = [Math]::Min($BatchSize, $arr.Count - $i)
    $slice = New-Object System.Collections.Generic.List[object]
    for ($j = 0; $j -lt $take; $j++) { $slice.Add($arr[$i + $j]) }
    $path = "/rest/v1/${Table}?on_conflict=$Conflict"
    $attempt = 0
    while ($true) {
      try {
        Invoke-Supabase -Method POST -Path $path -Body $slice.ToArray() -Prefer "resolution=merge-duplicates,return=minimal" | Out-Null
        $ok += $take
        break
      } catch {
        $attempt++
        if ($attempt -ge 3) { throw }
        Write-Log "Nouvel essai $Table lot $i : $($_.Exception.Message)" "WARN"
        Start-Sleep -Seconds (2 * $attempt)
      }
    }
  }
  return $ok
}

function Get-RemoteCodpros {
  $set = @{}
  $from = 0
  $page = 1000
  while ($true) {
    $to = $from + $page - 1
    $text = Invoke-Supabase -Method GET -Path "/rest/v1/products?select=codpro&order=codpro.asc" -Headers @{ Range = "$from-$to" }
    if ([string]::IsNullOrWhiteSpace($text) -or $text -eq "[]") { break }
    $rows = @($text | ConvertFrom-Json)
    if ($rows.Count -eq 0) { break }
    foreach ($row in $rows) { $set[[string]$row.codpro] = $true }
    if ($rows.Count -lt $page) { break }
    $from += $page
  }
  return $set
}

try {
  $envCandidates = @()
  if ($EnvFile) { $envCandidates += $EnvFile }
  $envCandidates += (Join-Path $PSScriptRoot ".env")
  $envCandidates += (Join-Path (Split-Path $PSScriptRoot -Parent) ".env")
  foreach ($candidate in $envCandidates) { Import-EnvFile $candidate }

  $script:SupabaseUrl = [Environment]::GetEnvironmentVariable("SUPABASE_URL", "Process")
  if (-not $script:SupabaseUrl) { $script:SupabaseUrl = [Environment]::GetEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL", "Process") }
  $script:ServiceKey = [Environment]::GetEnvironmentVariable("SUPABASE_SERVICE_ROLE_KEY", "Process")
  if (-not $script:SupabaseUrl -or -not $script:ServiceKey) {
    throw "SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis."
  }

  Add-Type -AssemblyName System.Net.Http
  $script:Http = New-Object System.Net.Http.HttpClient
  $script:Http.Timeout = [TimeSpan]::FromMinutes(10)
  $mode = $(if ($FullSync) { "FullSync" } else { "QuickSync" })
  Write-Log "Debut $mode vers $(([uri]$script:SupabaseUrl).Host)"

  Add-Type -AssemblyName System.Data
  $conn = New-Object System.Data.Odbc.OdbcConnection("DSN=$Dsn")
  $conn.Open()
  $created = 0
  $updated = 0
  $errors = 0
  try {
    $familles = Read-OdbcRows $conn "SELECT CODFAM, LIBFAM FROM FAMILLES"
    $tva = Read-OdbcRows $conn "SELECT CODTVA, TAUTVA FROM TABTVA"
    $unites = Read-OdbcRows $conn "SELECT CODUNI, LIBUNI FROM UNITES"
    $tarifs = Read-OdbcRows $conn "SELECT CODPRO, PRIVTE1, PRIVTE2, PRIVTE3, PRIVTE4, PRIVTE5, PRIPRO, DEBPRO, FINPRO FROM PROTAR"
    $stocks = Read-OdbcRows $conn "SELECT CODPRO, QTESTK FROM PROSTOCK"
    $produitsSql = "SELECT CODPRO, CODTVAVTE"
    if ($FullSync) {
      $produitsSql = "SELECT CODPRO, LIBPRO, CODFAM, CODUNI, CODTVAVTE, POICOL, AFFWEB, AFFTARWEB, AFFSTKWEB, IMAFIC, LEFT(MEMPRO,4000) AS DESCR FROM PRODUITS WHERE AFFWEB = 1"
    } else {
      $produitsSql = "SELECT CODPRO, CODTVAVTE FROM PRODUITS WHERE AFFWEB = 1"
    }
    $produits = Read-OdbcRows $conn $produitsSql
    $barcodes = @()
    $unpublished = @()
    if ($FullSync) {
      $barcodes = Read-OdbcRows $conn "SELECT CODPRO, GENCOD, QTEMUL FROM PROGCD"
      $unpublished = Read-OdbcRows $conn "SELECT CODPRO FROM PRODUITS WHERE AFFWEB = 0"
    }
  } finally {
    $conn.Close()
  }

  $famBy = @{}; foreach ($row in $familles) { $famBy[(To-Text $row.CODFAM)] = To-Text $row.LIBFAM }
  $tvaBy = @{}; foreach ($row in $tva) { $tvaBy[(To-Text $row.CODTVA)] = To-Num $row.TAUTVA 2 }
  $uniBy = @{}; foreach ($row in $unites) { $uniBy[(To-Text $row.CODUNI)] = To-Text $row.LIBUNI }
  $tarBy = @{}
  foreach ($row in $tarifs) {
    $id = To-Text $row.CODPRO
    if ($id -and -not $tarBy.ContainsKey($id)) { $tarBy[$id] = $row }
  }
  $stkBy = @{}
  foreach ($row in $stocks) {
    $id = To-Text $row.CODPRO
    if (-not $id) { continue }
    if (-not $stkBy.ContainsKey($id)) { $stkBy[$id] = 0 }
    $stkBy[$id] = $stkBy[$id] + (To-Int $row.QTESTK)
  }

  $remote = Get-RemoteCodpros
  $now = (Get-Date).ToUniversalTime().ToString("o")
  $productRows = New-Object System.Collections.Generic.List[object]
  $priceRows = New-Object System.Collections.Generic.List[object]
  $categoryRows = @{}
  $publishedSet = @{}
  $imageStatePath = Join-Path $stateDir "images.json"
  $imageState = @{}
  if (Test-Path -LiteralPath $imageStatePath) {
    $rawState = Get-Content -Raw -LiteralPath $imageStatePath -Encoding UTF8
    if ($rawState) {
      $parsed = $rawState | ConvertFrom-Json
      foreach ($prop in $parsed.PSObject.Properties) { $imageState[$prop.Name] = [string]$prop.Value }
    }
  }
  $images = 0
  $photoIndex = @{}
  if ($FullSync -and (Test-Path -LiteralPath $PhotoDir)) {
    Get-ChildItem -LiteralPath $PhotoDir -File | ForEach-Object {
      $photoIndex[$_.Name.ToLowerInvariant()] = $_.FullName
    }
  }

  foreach ($row in $produits) {
    $id = To-Text $row.CODPRO
    if (-not $id) { continue }
    $publishedSet[$id] = $true
    $tar = $null; if ($tarBy.ContainsKey($id)) { $tar = $tarBy[$id] }
    $vat = $null
    $vatCode = To-Text $row.CODTVAVTE
    if ($vatCode -and $tvaBy.ContainsKey($vatCode)) { $vat = $tvaBy[$vatCode] }
    $priceHt = $null
    $promo = $null
    $promoStart = $null
    $promoEnd = $null
    if ($tar) {
      $priceHt = To-Num $tar.PRIVTE1 2
      $promoRaw = To-Num $tar.PRIPRO 2
      if ($promoRaw -and $promoRaw -gt 0) {
        $promo = $promoRaw
        $promoStart = To-DateOrNull $tar.DEBPRO
        $promoEnd = To-DateOrNull $tar.FINPRO
      }
    }
    $priceTtc = $null
    if ($null -ne $priceHt -and $null -ne $vat) { $priceTtc = [math]::Round($priceHt * (1 + $vat / 100), 2) }
    $stock = 0; if ($stkBy.ContainsKey($id)) { $stock = [int]$stkBy[$id] }

    if ($FullSync) {
      $fam = To-Text $row.CODFAM
      $catName = ""
      if ($fam -and $famBy.ContainsKey($fam)) { $catName = $famBy[$fam] }
      if ($fam -and $catName) { $categoryRows[$fam] = @{ code = $fam; name = $catName; updated_at = $now } }
      $unit = ""
      $unitCode = To-Text $row.CODUNI
      if ($unitCode -and $uniBy.ContainsKey($unitCode)) { $unit = $uniBy[$unitCode] }
      $descr = To-Text $row.DESCR
      $imageUrl = $null
      $imafic = To-Text $row.IMAFIC
      $leaf = ""
      if ($imafic) { $leaf = [IO.Path]::GetFileName($imafic) }
      $photo = $null
      if ($leaf -and $photoIndex.ContainsKey($leaf.ToLowerInvariant())) {
        $photo = $photoIndex[$leaf.ToLowerInvariant()]
      }
      if ($photo) {
        $ext = [IO.Path]::GetExtension($photo).ToLowerInvariant()
        if (@(".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp") -contains $ext) {
          $item = Get-Item -LiteralPath $photo
          $stamp = $item.LastWriteTimeUtc.ToString("o")
          $objectName = Get-ImageObjectName $id $ext
          $exists = $false
          try { $exists = Test-StorageObject $objectName } catch { $exists = $false }
          $newer = -not ($imageState.ContainsKey($id) -and $imageState[$id])
          if (-not $newer) { $newer = $stamp -gt [string]$imageState[$id] }
          if ((-not $exists) -or $newer) {
            try {
              $bytes = [IO.File]::ReadAllBytes($photo)
              $upload = New-Object System.Net.Http.HttpRequestMessage ([System.Net.Http.HttpMethod]::Post), ($script:SupabaseUrl.TrimEnd("/") + "/storage/v1/object/product-images/" + [uri]::EscapeDataString($objectName))
              [void]$upload.Headers.TryAddWithoutValidation("apikey", $script:ServiceKey)
              [void]$upload.Headers.TryAddWithoutValidation("Authorization", "Bearer $($script:ServiceKey)")
              [void]$upload.Headers.TryAddWithoutValidation("x-upsert", "true")
              $content = New-Object System.Net.Http.ByteArrayContent (,$bytes)
              $content.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse((Get-ImageContentType $ext))
              $upload.Content = $content
              $uploadResp = $script:Http.SendAsync($upload).GetAwaiter().GetResult()
              $uploadText = $uploadResp.Content.ReadAsStringAsync().GetAwaiter().GetResult()
              if (-not $uploadResp.IsSuccessStatusCode) { throw $uploadText }
              $imageState[$id] = $stamp
              $images++
              $exists = $true
            } catch {
              $errors++
              Write-Log "Image $id : $($_.Exception.Message)" "ERROR"
            }
          }
          if ($exists) {
            $imageUrl = $script:SupabaseUrl.TrimEnd("/") + "/storage/v1/object/public/product-images/" + [uri]::EscapeDataString($objectName)
          }
        }
      }
      $productRows.Add(@{
        codpro = $id
        name = $(if (To-Text $row.LIBPRO) { To-Text $row.LIBPRO } else { $id })
        slug = (Get-Slug $(if (To-Text $row.LIBPRO) { To-Text $row.LIBPRO } else { $id }) $id)
        description = $(if ($descr) { $descr } else { $null })
        category_code = $(if ($fam -and $catName) { $fam } else { $null })
        unit = $(if ($unit) { $unit } else { $null })
        price_ht = $priceHt
        vat_rate = $vat
        price_ttc = $priceTtc
        promo_ht = $promo
        promo_start = $promoStart
        promo_end = $promoEnd
        weight = (To-Num $row.POICOL 3)
        stock = $stock
        image_url = $imageUrl
        show_price = (To-BoolFlag $row.AFFTARWEB)
        show_stock = (To-BoolFlag $row.AFFSTKWEB)
        published = $true
        updated_at = $now
      })
      if ($tar) {
        for ($tier = 1; $tier -le 5; $tier++) {
          $tierPrice = To-Num $tar.("PRIVTE" + $tier) 2
          if ($null -ne $tierPrice) { $priceRows.Add(@{ codpro = $id; tier = $tier; price_ht = $tierPrice }) }
        }
      }
    } else {
      if (-not $remote.ContainsKey($id)) { continue }
      $productRows.Add(@{
        codpro = $id
        price_ht = $priceHt
        vat_rate = $vat
        price_ttc = $priceTtc
        promo_ht = $promo
        promo_start = $promoStart
        promo_end = $promoEnd
        stock = $stock
        updated_at = $now
      })
    }
  }

  if ($FullSync -and $categoryRows.Count -gt 0) {
    $n = Send-Upsert "categories" "code" @($categoryRows.Values)
    Write-Log "Categories upsert : $n"
  }

  foreach ($row in $productRows) {
    if ($remote.ContainsKey([string]$row.codpro)) { $updated++ } else { $created++ }
  }
  $nProd = Send-Upsert "products" "codpro" $productRows.ToArray()
  Write-Log "Produits upsert : $nProd (nouveaux $created, maj $updated)"

  if ($FullSync) {
    if ($priceRows.Count -gt 0) {
      $nPrices = Send-Upsert "product_prices" "codpro,tier" $priceRows.ToArray()
      Write-Log "Tarifs upsert : $nPrices"
    }
    $barcodeRows = New-Object System.Collections.Generic.List[object]
    $seen = @{}
    foreach ($row in $barcodes) {
      $id = To-Text $row.CODPRO
      $code = To-Text $row.GENCOD
      if (-not $id -or -not $code -or -not $publishedSet.ContainsKey($id)) { continue }
      $key = "$id|$code"
      if ($seen.ContainsKey($key)) { continue }
      $seen[$key] = $true
      $mult = To-Num $row.QTEMUL 3
      if ($null -eq $mult) { $mult = 1 }
      $barcodeRows.Add(@{ codpro = $id; barcode = $code; qty_mult = $mult })
    }
    if ($barcodeRows.Count -gt 0) {
      $nBars = Send-Upsert "product_barcodes" "codpro,barcode" $barcodeRows.ToArray()
      Write-Log "Codes-barres upsert : $nBars"
    }

    $hide = New-Object System.Collections.Generic.List[string]
    foreach ($id in @($remote.Keys)) {
      if (-not $publishedSet.ContainsKey($id)) { $hide.Add($id) }
    }
    foreach ($row in $unpublished) {
      $id = To-Text $row.CODPRO
      if ($id -and $remote.ContainsKey($id) -and -not $hide.Contains($id)) { $hide.Add($id) }
    }
    for ($i = 0; $i -lt $hide.Count; $i += 80) {
      $take = [Math]::Min(80, $hide.Count - $i)
      $parts = @()
      for ($j = 0; $j -lt $take; $j++) { $parts += '"' + ($hide[$i + $j] -replace '"','') + '"' }
      $filter = [uri]::EscapeDataString(($parts -join ","))
      Invoke-Supabase -Method PATCH -Path ("/rest/v1/products?codpro=in.(" + $filter + ")") -Body @{ published = $false; updated_at = $now } -Prefer "return=minimal" | Out-Null
    }
    if ($hide.Count -gt 0) { Write-Log "Depublies : $($hide.Count)" }

    $imageState | ConvertTo-Json -Compress | Set-Content -LiteralPath $imageStatePath -Encoding UTF8
    Write-Log "Images envoyees : $images"
  }

  Write-Log "Termine. Erreurs : $errors"
  if ($errors -gt 0) { exit 1 }
} catch {
  Write-Log $_.Exception.Message "ERROR"
  exit 1
} finally {
  if ($script:Http) { $script:Http.Dispose() }
}
