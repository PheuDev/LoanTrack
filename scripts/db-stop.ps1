# Arrête MySQL local (WAMP).
#
# Utilisation :
#   powershell -ExecutionPolicy Bypass -File scripts/db-stop.ps1

$ErrorActionPreference = 'Stop'

foreach ($svc in @('wampmysqld64', 'wampmysqld')) {
  $out = sc.exe query $svc 2>&1 | Out-String
  if ($out -match 'is not present|not exist|introuvable|ne peut pas') { continue }
  if ($out -match 'RUNNING|EN COURS') {
    Write-Host "Arrêt du service $svc..."
    net stop $svc
    if ($LASTEXITCODE -eq 0) {
      Write-Host 'MySQL arrêté.'
      exit 0
    }
  }
}

Write-Host "MySQL n'est pas démarré comme service Windows. Arrêtez-le via WAMP Manager le cas échéant."
exit 1