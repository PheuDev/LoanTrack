# Démarre MySQL local (WAMP) sur le port 3306 sans nécessiter de droits administrateur.
#
# Utilisation :
#   powershell -ExecutionPolicy Bypass -File scripts/db-start.ps1
#
# Paramètres optionnels (variables d'environnement ou arguments) :
#   $env:WAMP_MYSQL_BIN : dossier bin contenant mysqld.exe
#   $env:MYSQL_PORT     : port d'écoute (défaut 3306)
#
# Ordre des tentatives :
#   1. Le port 3306 répond déjà → MySQL est démarré.
#   2. Service Windows WAMP (wampmysqld64 / wampmysqld) → net start
#   3. Démarrage direct de mysqld.exe (config my.ini de WAMP si présente)

param(
  [string]$MysqlBin = '',
  [int]$Port = 3306
)

$ErrorActionPreference = 'Stop'

if (-not $MysqlBin) { $MysqlBin = $env:WAMP_MYSQL_BIN }

# 1. Déjà en écoute sur le port ?
if (Test-NetConnection -ComputerName 127.0.0.1 -Port $Port -WarningAction SilentlyContinue -InformationLevel Quiet) {
  Write-Host "MySQL est déjà démarré sur le port $Port."
  exit 0
}

# 2. Service Windows WAMP
foreach ($svc in @('wampmysqld64', 'wampmysqld')) {
  $out = sc.exe query $svc 2>&1 | Out-String
  if ($out -match 'is not present|not exist|introuvable|ne peut pas') { continue }
  if ($out -match 'RUNNING|EN COURS') {
    Write-Host "MySQL est déjà démarré (service $svc)."
    exit 0
  }
  Write-Host "Démarrage du service $svc..."
  net start $svc
  if ($LASTEXITCODE -eq 0) {
    Write-Host 'MySQL démarré.'
    exit 0
  }
  # Le service existe mais n'a pas pu démarrer → on tente un démarrage direct
  break
}

# 3. Démarrage direct via mysqld.exe
if (-not $MysqlBin) {
  $found = $null
  foreach ($wampRoot in @('C:\wamp64', 'D:\wamp64', 'C:\wamp', 'D:\wamp')) {
    $dir = Join-Path $wampRoot 'bin\mysql'
    if (-not (Test-Path $dir)) { continue }
    $versions = Get-ChildItem $dir -Directory | Sort-Object Name -Descending
    foreach ($v in $versions) {
      $candidate = Join-Path $v.FullName 'bin\mysqld.exe'
      if (Test-Path $candidate) { $found = Join-Path $v.FullName 'bin'; break }
    }
    if ($found) { break }
  }
  if (-not $found) {
    Write-Host 'Impossible de trouver mysqld.exe. Démarrez WAMP Manager, ou passez $env:WAMP_MYSQL_BIN.'
    exit 1
  }
  $MysqlBin = $found
}

$mysqld = Join-Path $MysqlBin 'mysqld.exe'
if (-not (Test-Path $mysqld)) {
  Write-Host "mysqld.exe introuvable : $mysqld"
  exit 1
}

# Utilise le my.ini fourni par WAMP s'il existe (au niveau du dossier mysqlX.Y)
# NB : mysqld exige la syntaxe `--option=valeur` ; `--defaults-file chemin`
# (sans `=`) est refusé par MySQL 8+/9+ qui renvoie "unknown option".
$myIni = Join-Path (Split-Path $MysqlBin -Parent) 'my.ini'
$args = @('--port', "$Port")
if (Test-Path $myIni) { $args = @("--defaults-file=$myIni", '--port', "$Port") }

Write-Host 'Démarrage de MySQL via mysqld...'
Start-Process -FilePath $mysqld -ArgumentList $args

# Attend que le port réponde (jusqu'à ~30 s)
for ($i = 0; $i -lt 30; $i++) {
  Sleep 1
  if (Test-NetConnection -ComputerName 127.0.0.1 -Port $Port -WarningAction SilentlyContinue -InformationLevel Quiet) {
    Write-Host 'MySQL démarré.'
    exit 0
  }
}

Write-Host ''
Write-Host "Le port $Port ne répond toujours pas. Vérifiez le log d'erreur MySQL ou démarrez WAMP Manager."
exit 1