# Crée la base `loantrack` et l'utilisateur `loantrack` / `loantrack` dans MySQL (WAMP).
# Script idempotent — peut être relancé sans risque.
#
# Compatibilité : les installations existantes sur la base `flexiloan` continuent
# de fonctionner — passez -DbName flexiloan -DbUser flexiloan -DbPassword flexiloan
# pour (re)créer l'ancienne base, ou migrez avec :
#   mysqldump flexiloan | mysql loantrack
#
# Utilisation :
#   powershell -ExecutionPolicy Bypass -File scripts/db-init-mysql.ps1
#
# Si le compte root de MySQL a un mot de passe :
#   $env:MYSQL_ROOT_PASSWORD='votre_mot_de_passe'
#   powershell -ExecutionPolicy Bypass -File scripts/db-init-mysql.ps1
#
# Paramètres optionnels :
#   $env:WAMP_MYSQL_BIN : dossier bin contenant mysql.exe (ex: C:\wamp64\bin\mysql\mysql8.0.37\bin)

param(
  [string]$RootPassword = '',
  [string]$MysqlBin = '',
  [string]$DbName = '',
  [string]$DbUser = '',
  [string]$DbPassword = ''
)

$ErrorActionPreference = 'Stop'

if (-not $RootPassword) { $RootPassword = $env:MYSQL_ROOT_PASSWORD }
if (-not $MysqlBin)     { $MysqlBin     = $env:WAMP_MYSQL_BIN }
if (-not $DbName)       { $DbName       = $env:LOANTRACK_DB_NAME }
if (-not $DbName)       { $DbName       = 'loantrack' }
if (-not $DbUser)       { $DbUser       = $env:LOANTRACK_DB_USER }
if (-not $DbUser)       { $DbUser       = $DbName }
if (-not $DbPassword)   { $DbPassword   = $env:LOANTRACK_DB_PASSWORD }
if (-not $DbPassword)   { $DbPassword   = $DbName }

# Localise mysql.exe dans les installations WAMP
if (-not $MysqlBin) {
  $found = $null
  foreach ($wampRoot in @('C:\wamp64', 'D:\wamp64', 'C:\wamp', 'D:\wamp')) {
    $dir = Join-Path $wampRoot 'bin\mysql'
    if (-not (Test-Path $dir)) { continue }
    $versions = Get-ChildItem $dir -Directory | Sort-Object Name -Descending
    foreach ($v in $versions) {
      $candidate = Join-Path $v.FullName 'bin\mysql.exe'
      if (Test-Path $candidate) { $found = Join-Path $v.FullName 'bin'; break }
    }
    if ($found) { break }
  }
  if (-not $found) {
    Write-Host 'mysql.exe introuvable. Démarrez WAMP, ou passez $env:WAMP_MYSQL_BIN.'
    exit 1
  }
  $MysqlBin = $found
}

$mysql = Join-Path $MysqlBin 'mysql.exe'
if (-not (Test-Path $mysql)) {
  Write-Host "mysql.exe introuvable : $mysql"
  exit 1
}

$sql = @"
CREATE DATABASE IF NOT EXISTS ${DbName} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DbUser}'@'localhost' IDENTIFIED BY '${DbPassword}';
CREATE USER IF NOT EXISTS '${DbUser}'@'127.0.0.1' IDENTIFIED BY '${DbPassword}';
GRANT ALL PRIVILEGES ON ${DbName}.* TO '${DbUser}'@'localhost';
GRANT ALL PRIVILEGES ON ${DbName}.* TO '${DbUser}'@'127.0.0.1';
FLUSH PRIVILEGES;
"@

# Le mot de passe root passe par la variable d'env MYSQL_PWD (pas sur la ligne de commande)
$env:MYSQL_PWD = $RootPassword

Write-Host 'Connexion à MySQL et création de la base / de l''utilisateur...'
& $mysql --protocol=tcp --host=127.0.0.1 --port=3306 --user=root --execute=$sql

if ($LASTEXITCODE -ne 0) {
  Write-Host ''
  Write-Host 'Échec. Vérifiez :'
  Write-Host '  1. MySQL (WAMP) est démarré :  powershell -ExecutionPolicy Bypass -File scripts/db-start.ps1'
  Write-Host '  2. Le mot de passe root si un mot de passe est défini :'
  Write-Host '       $env:MYSQL_ROOT_PASSWORD="..." puis relancer ce script.'
  exit 1
}

Write-Host ''
Write-Host 'Base et utilisateur prêts :'
Write-Host "  Base      : ${DbName}"
Write-Host "  Utilisateur : ${DbUser} / ${DbPassword}"
exit 0