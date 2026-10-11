$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$hostName = 'gateway01.ap-northeast-1.prod.aws.tidbcloud.com'
$userName = '2phhcR8LZbH4naU.root'
$port = 4000
$database = 'loantrack'

function Read-SecretText([string]$label) {
  $secure = Read-Host $label -AsSecureString
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  }
  finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  }
}

Write-Host ''
Write-Host 'Preparation locale de LoanTrack'
Write-Host 'Les valeurs saisies ne seront pas affichees.'
Write-Host ''
$dbPassword = Read-SecretText 'Mot de passe TiDB (Connect > Generate Password)'
$renderKey = Read-SecretText 'Nouvelle cle API Render'
if ([string]::IsNullOrWhiteSpace($dbPassword) -or [string]::IsNullOrWhiteSpace($renderKey)) {
  throw 'Les deux secrets sont requis.'
}

$encUser = [Uri]::EscapeDataString($userName)
$encPassword = [Uri]::EscapeDataString($dbPassword)
$url = 'mysql://' + $encUser + ':' + $encPassword + '@' + $hostName + ':' + $port + '/' + $database
$lines = @(
  'DATABASE_URL=' + $url
  'DATABASE_SSL=true'
  'TIDB_HOST=' + $hostName
  'TIDB_USER=' + $userName
  'TIDB_DATABASE=' + $database
  'RENDER_API_KEY=' + $renderKey
)
$file = Join-Path $root '.env.local'
$utf8 = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllLines($file, $lines, $utf8)

Write-Host ''
Write-Host 'Configuration enregistree localement dans .env.local (fichier ignore par Git).'
Write-Host 'Aucune valeur secrete ne sera affichee. Revenez ici et dites : pret.'
